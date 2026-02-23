import re
import json
import time
import logging
from typing import Any

from langchain_community.chat_models import ChatOllama
from langchain_community.agent_toolkits import SQLDatabaseToolkit
from langchain.agents import create_sql_agent, AgentType
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.tools import Tool

from ..config import OLLAMA_URL, OLLAMA_MODEL
from ..db.connections import get_available_databases
from ..prompts.system import SYSTEM_PROMPT

logger = logging.getLogger(__name__)


class SQLCaptureHandler(BaseCallbackHandler):
    """Captures SQL queries executed by the agent."""

    def __init__(self):
        self.sql_queries: list[str] = []

    def on_tool_start(
        self, serialized: dict[str, Any], input_str: str, **kwargs: Any
    ) -> None:
        tool_name = serialized.get("name", "")
        if "query" in tool_name.lower():
            self.sql_queries.append(input_str)


def get_llm():
    return ChatOllama(
        base_url=OLLAMA_URL,
        model=OLLAMA_MODEL,
        temperature=0,
        num_predict=2048,
    )


def parse_chart_from_response(text: str) -> dict | None:
    """Extract chart config from ```chart ... ``` blocks in response."""
    match = re.search(r"```chart\s*\n(.*?)\n```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            return None
    return None


def clean_response(text: str) -> str:
    """Remove chart blocks from the text response."""
    return re.sub(r"```chart\s*\n.*?\n```", "", text, flags=re.DOTALL).strip()


def _build_extra_db_tools(databases: dict, llm) -> list[Tool]:
    """Build query and schema tools for secondary databases."""
    extra_tools = []
    for name, db in databases.items():
        # Query tool
        def make_query_fn(d=db, n=name):
            def query_fn(query: str) -> str:
                try:
                    return d.run(query)
                except Exception as e:
                    return f"Error querying {n}: {e}"
            return query_fn

        extra_tools.append(Tool(
            name=f"query_{name}_db",
            func=make_query_fn(),
            description=(
                f"Execute a SELECT SQL query against the '{name}' database. "
                f"Input: a valid SQL SELECT query. Returns the results."
            ),
        ))

        # Schema tool
        def make_schema_fn(d=db, n=name):
            def schema_fn(_: str = "") -> str:
                return d.get_table_info()
            return schema_fn

        extra_tools.append(Tool(
            name=f"schema_{name}_db",
            func=make_schema_fn(),
            description=(
                f"Get the schema (tables and columns) of the '{name}' database. "
                f"Input: ignored. Returns table definitions."
            ),
        ))

    return extra_tools


async def query_databases(mensaje: str, historial: list[dict] | None = None) -> dict:
    """Run a natural language query against available databases."""
    start = time.time()
    databases = get_available_databases()

    if not databases:
        return {
            "respuesta": "No hay bases de datos configuradas.",
            "sql_queries": [],
            "chart": None,
            "model": OLLAMA_MODEL,
            "duration_ms": int((time.time() - start) * 1000),
        }

    llm = get_llm()
    sql_handler = SQLCaptureHandler()

    # Build context from history
    history_context = ""
    if historial:
        for msg in historial[-10:]:
            role = "Usuario" if msg["rol"] == "user" else "Asistente"
            history_context += f"{role}: {msg['contenido']}\n"

    # BD Sistema is the primary toolkit (has resumen tables + operational data)
    primary_db = databases.get("sistema")
    if not primary_db:
        # Fallback to first available
        primary_name = next(iter(databases))
        primary_db = databases[primary_name]
    else:
        primary_name = "sistema"

    primary_toolkit = SQLDatabaseToolkit(db=primary_db, llm=llm)

    # Build extra tools for all other databases
    secondary_dbs = {k: v for k, v in databases.items() if k != primary_name}
    extra_tools = _build_extra_db_tools(secondary_dbs, llm)

    # Available DB names for the prompt
    all_db_names = list(databases.keys())
    db_list = ", ".join(all_db_names)

    agent = create_sql_agent(
        llm=llm,
        toolkit=primary_toolkit,
        extra_tools=extra_tools,
        agent_type=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
        verbose=True,
        prefix=(
            f"{SYSTEM_PROMPT}\n\n"
            f"Historial de conversación:\n{history_context}\n\n"
            f"Base de datos principal: {primary_name}\n"
            f"Bases de datos disponibles: {db_list}\n"
            f"Para consultar otras BDs usa las herramientas query_<nombre>_db y schema_<nombre>_db.\n\n"
            f"IMPORTANTE: SIEMPRE responde usando el formato exacto:\n"
            f"Final Answer: <tu respuesta aquí>\n"
            f"Si no necesitas consultar la base de datos, responde directamente con Final Answer."
        ),
        agent_executor_kwargs={
            "handle_parsing_errors": "Por favor responde usando el formato: Final Answer: <tu respuesta>",
            "max_iterations": 10,
        },
    )

    try:
        result = agent.invoke(
            {"input": mensaje},
            config={"callbacks": [sql_handler]},
        )
        output = result.get("output", "No pude procesar la consulta.")

        # Extract chart config if present
        chart = parse_chart_from_response(output)
        clean_text = clean_response(output) if chart else output

        return {
            "respuesta": clean_text,
            "sql_queries": sql_handler.sql_queries,
            "chart": chart,
            "model": OLLAMA_MODEL,
            "duration_ms": int((time.time() - start) * 1000),
        }
    except Exception:
        logger.exception("Error processing query in SQL agent")
        return {
            "respuesta": "Hubo un problema al procesar tu consulta. Por favor intenta de nuevo.",
            "sql_queries": sql_handler.sql_queries,
            "chart": None,
            "model": OLLAMA_MODEL,
            "duration_ms": int((time.time() - start) * 1000),
        }

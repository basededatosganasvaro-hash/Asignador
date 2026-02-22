import re
import json
import time
from langchain_community.chat_models import ChatOllama
from langchain_community.agent_toolkits import SQLDatabaseToolkit
from langchain.agents import create_sql_agent, AgentType

from ..config import OLLAMA_URL, OLLAMA_MODEL
from ..db.connections import get_available_databases
from ..prompts.system import SYSTEM_PROMPT


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
    sql_queries = []

    # Build context from history
    history_context = ""
    if historial:
        for msg in historial[-10:]:
            role = "Usuario" if msg["rol"] == "user" else "Asistente"
            history_context += f"{role}: {msg['contenido']}\n"

    # Create toolkits for each database
    toolkits = []
    for name, db in databases.items():
        toolkit = SQLDatabaseToolkit(db=db, llm=llm)
        toolkits.append((name, toolkit))

    # Use the first available database's toolkit to create agent
    # The agent will have access to query tools
    if not toolkits:
        return {
            "respuesta": "No se pudieron conectar las bases de datos.",
            "sql_queries": [],
            "chart": None,
            "model": OLLAMA_MODEL,
            "duration_ms": int((time.time() - start) * 1000),
        }

    # Create agent with primary toolkit
    primary_name, primary_toolkit = toolkits[0]
    agent = create_sql_agent(
        llm=llm,
        toolkit=primary_toolkit,
        agent_type=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
        verbose=True,
        prefix=SYSTEM_PROMPT + f"\n\nHistorial de conversación:\n{history_context}\n\nBase de datos activa: {primary_name}",
        handle_parsing_errors=True,
        max_iterations=10,
    )

    try:
        result = agent.invoke({"input": mensaje})
        output = result.get("output", "No pude procesar la consulta.")

        # Extract chart config if present
        chart = parse_chart_from_response(output)
        clean_text = clean_response(output) if chart else output

        return {
            "respuesta": clean_text,
            "sql_queries": sql_queries,
            "chart": chart,
            "model": OLLAMA_MODEL,
            "duration_ms": int((time.time() - start) * 1000),
        }
    except Exception as e:
        return {
            "respuesta": f"Error al procesar la consulta: {str(e)}",
            "sql_queries": [],
            "chart": None,
            "model": OLLAMA_MODEL,
            "duration_ms": int((time.time() - start) * 1000),
        }

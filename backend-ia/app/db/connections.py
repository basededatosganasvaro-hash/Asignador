from sqlalchemy import create_engine
from langchain_community.utilities import SQLDatabase

from ..config import DB_URLS

_engines = {}
_databases = {}


def get_engine(name: str):
    """Get or create a read-only SQLAlchemy engine for a database."""
    if name not in _engines:
        url = DB_URLS.get(name)
        if not url:
            return None
        # Ensure read-only by using execution_options
        _engines[name] = create_engine(
            url,
            pool_size=3,
            max_overflow=2,
            pool_pre_ping=True,
            execution_options={"postgresql_readonly": True},
        )
    return _engines[name]


def get_sql_database(name: str) -> SQLDatabase | None:
    """Get a LangChain SQLDatabase instance for a named database."""
    if name not in _databases:
        engine = get_engine(name)
        if not engine:
            return None
        _databases[name] = SQLDatabase(engine)
    return _databases[name]


def get_available_databases() -> dict[str, SQLDatabase]:
    """Get all configured databases."""
    result = {}
    for name in DB_URLS:
        db = get_sql_database(name)
        if db:
            result[name] = db
    return result

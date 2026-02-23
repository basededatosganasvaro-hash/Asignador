import asyncio
import logging

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import ENVIRONMENT, FRONTEND_URL
from .routes.chat import router as chat_router
from .routes.sync import router as sync_router
from .sync.resumen_sync import sync_all

logger = logging.getLogger(__name__)


async def _run_initial_sync():
    """Ejecuta sync de tablas resumen en background al arrancar."""
    await asyncio.sleep(5)  # Esperar a que las conexiones DB esten listas
    try:
        result = await sync_all()
        logger.info(f"Sync inicial completado: {result}")
    except Exception as e:
        logger.error(f"Error en sync inicial (no critico, se reintentara via POST /sync): {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: lanzar sync en background (no bloquea el arranque)
    task = asyncio.create_task(_run_initial_sync())
    yield
    # Shutdown: cancelar si sigue corriendo
    task.cancel()


app = FastAPI(
    title="Agente IA - Sistema de Asignaciones",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: restrictivo en producción, abierto solo en desarrollo
if ENVIRONMENT == "production":
    cors_origins = [FRONTEND_URL]
else:
    cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-API-Key"],
)

app.include_router(chat_router)
app.include_router(sync_router)


@app.get("/health")
async def health():
    return {"status": "ok"}

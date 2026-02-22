from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..auth import verify_api_key
from ..agents.sql_agent import query_databases

router = APIRouter()


class ChatRequest(BaseModel):
    mensaje: str
    historial: list[dict] | None = None
    usuario_id: int | None = None


class ChatResponse(BaseModel):
    respuesta: str
    sql_queries: list = []
    chart: dict | None = None
    model: str | None = None
    tokens_used: int | None = None
    duration_ms: int | None = None


@router.post("/chat", response_model=ChatResponse, dependencies=[Depends(verify_api_key)])
async def chat(request: ChatRequest):
    result = await query_databases(
        mensaje=request.mensaje,
        historial=request.historial,
    )
    return ChatResponse(**result)

import logging

from fastapi import APIRouter, Depends, HTTPException

from ..auth import verify_api_key
from ..sync.resumen_sync import sync_all

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/sync", dependencies=[Depends(verify_api_key)])
async def run_sync():
    """Dispara sincronizacion completa de tablas resumen."""
    try:
        result = await sync_all()
        return result
    except Exception as e:
        logger.exception("Error durante sincronizacion")
        raise HTTPException(status_code=500, detail=str(e))

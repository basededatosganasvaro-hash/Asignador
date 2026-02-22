from fastapi import Request, HTTPException

from .config import API_KEY


async def verify_api_key(request: Request):
    """Middleware to verify X-API-Key header."""
    if not API_KEY:
        return  # No key configured, skip auth (dev mode)

    key = request.headers.get("X-API-Key", "")
    if key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

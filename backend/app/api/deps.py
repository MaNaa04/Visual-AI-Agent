from fastapi import Header, HTTPException
import logging

logger = logging.getLogger(__name__)

async def get_client_id(x_client_id: str = Header(default=None)) -> str:
    if not x_client_id:
        raise HTTPException(status_code=400, detail="Missing X-Client-ID header")
    # For MVP, we don't strictly validate/reject unknown IDs since it's a personal tool.
    return x_client_id

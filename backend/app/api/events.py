from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from ..models.events import BatchRequest
from ..db import get_db
from ..services.pipeline import process_screenshot
from .deps import get_client_id
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/api/events/batch")
async def ingest_batch(
    batch: BatchRequest, 
    background_tasks: BackgroundTasks, 
    client_id: str = Depends(get_client_id)
):
    """
    Ingest a batch of events.
    FastAPI and Pydantic will automatically 422 if the schema is malformed.
    """
    db = get_db()
    
    if not batch.events:
        return {"accepted": 0}
        
    try:
        # Convert all Pydantic models to dicts for MongoDB insertion
        documents = [event.model_dump() for event in batch.events]
        
        # Insert all at once to minimize DB roundtrips.
        # This writes them as "pending" initially.
        await db.events.insert_many(documents)
        
        # Enqueue screenshot events for background processing
        for event in batch.events:
            if event.eventType == "screenshot":
                background_tasks.add_task(process_screenshot, event.eventId)
                
        return {"accepted": len(batch.events)}
        
    except Exception as e:
        logger.error(f"Error inserting batch: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during ingestion")

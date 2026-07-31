import os
import logging
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from ..db import get_db
from .deps import get_client_id

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/api/events/export")
async def export_events(client_id: str = Depends(get_client_id)):
    """
    Export all events for the authenticated client.
    """
    db = get_db()
    cursor = db.events.find({"clientId": client_id}, {"_id": 0})
    events = await cursor.to_list(length=None)
    return JSONResponse(content=jsonable_encoder(events))

@router.delete("/api/events")
async def delete_all_events(client_id: str = Depends(get_client_id)):
    """
    Robustly delete all events and their associated screenshot files for the authenticated client.
    """
    db = get_db()
    
    # 1. Fetch all events for this client that have a screenshotRef
    cursor = db.events.find({"clientId": client_id, "screenshotRef": {"$exists": True}})
    screenshot_events = await cursor.to_list(length=None)
    
    file_failures = 0
    event_ids_to_skip = []
    
    # 2. Try to delete the physical files one by one
    for event in screenshot_events:
        filepath = event.get("screenshotRef")
        if not filepath:
            continue
            
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
            # If it doesn't exist, that's fine—it's already gone, safe to delete DB record
        except Exception as e:
            logger.error(f"Failed to delete screenshot file {filepath}: {e}")
            file_failures += 1
            # If file deletion fails (e.g. permissions), we MUST NOT delete the DB record, 
            # otherwise we end up with orphaned image files on disk forever.
            event_ids_to_skip.append(event["eventId"])

    # 3. Delete from MongoDB, carefully skipping records where file deletion failed
    delete_query = {"clientId": client_id}
    if event_ids_to_skip:
        delete_query["eventId"] = {"$nin": event_ids_to_skip}
        
    result = await db.events.delete_many(delete_query)
    
    return {
        "deleted_records": result.deleted_count,
        "failed_files": file_failures,
        "message": "Partial deletion due to file errors" if file_failures > 0 else "Success"
    }

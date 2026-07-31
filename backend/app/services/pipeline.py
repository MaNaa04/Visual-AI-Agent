import logging
from ..db import get_db

logger = logging.getLogger(__name__)

async def process_screenshot(event_id: str):
    """
    Stub for Phase 4 (Vision Pipeline).
    This function is enqueued via BackgroundTasks whenever a ScreenshotEvent is ingested.
    """
    logger.info(f"Starting process_screenshot for event {event_id}...")
    db = get_db()
    
    try:
        # Phase 4 will fill in:
        # 1. Fetch event from DB
        # 2. Extract screenshot reference
        # 3. Dedup check using perceptual hashing (Redis)
        # 4. Vision API call (with retry)
        # 5. Parse response
        # 6. Update DB with AIResult
        
        # For Phase 3, just flip the status to 'classified' (stubbed)
        await db.events.update_one(
            {"eventId": event_id},
            {"$set": {"status": "classified"}}
        )
        logger.info(f"Successfully processed (stubbed) event {event_id}.")
        
    except Exception as e:
        logger.error(f"Failed to process screenshot {event_id}: {e}")
        # Never leave silently pending forever
        await db.events.update_one(
            {"eventId": event_id},
            {"$set": {"status": "failed_classification"}}
        )

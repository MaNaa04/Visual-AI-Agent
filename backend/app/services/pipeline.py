import logging
import json
import pathlib
from ..db import get_db, get_redis
from .vision import get_vision_client
from .dedup import check_and_update_hash, cache_classification_result
from .retry import with_retry

logger = logging.getLogger(__name__)

async def process_screenshot(event_id: str):
    """
    Phase 4: The Vision Pipeline.
    """
    logger.info(f"Starting process_screenshot for event {event_id}...")
    db = get_db()
    redis_client = get_redis()
    
    try:
        # 1. Fetch event from DB
        event = await db.events.find_one({"eventId": event_id})
        if not event or event.get("eventType") != "screenshot":
            logger.warning(f"Event {event_id} not found or not a screenshot.")
            return

        screenshot_ref = event.get("screenshotRef")
        if not screenshot_ref:
            raise ValueError(f"No screenshotRef for event {event_id}")

        # Load image bytes
        image_path = pathlib.Path(screenshot_ref)
        if not image_path.exists():
            raise FileNotFoundError(f"Screenshot file not found: {screenshot_ref}")
        
        image_bytes = image_path.read_bytes()
        tab_id = event.get("tabId")

        # 2. Dedup check (Perceptual hashing)
        is_dup, result_dict = await check_and_update_hash(redis_client, tab_id, image_bytes)
        
        if is_dup and result_dict:
            logger.info(f"Event {event_id} is a visual duplicate. Reusing cached AI result.")
        else:
            # 3. Vision API call (with retry)
            vision_client = get_vision_client()
            logger.info(f"Calling vision API for event {event_id}...")
            
            # with_retry returns a VisionResult Pydantic model
            vision_result = await with_retry(vision_client.classify, image_bytes)
            result_dict = vision_result.model_dump()
            
            # Cache the result for future dedups on this tab
            await cache_classification_result(redis_client, tab_id, result_dict)
            
            # 4. Accuracy logging loop (Phase 4.5)
            # Log the parsed result to a local file for spot-checking
            with open("data/logs/vision_debug.jsonl", "a") as f:
                log_entry = {
                    "eventId": event_id,
                    "screenshotRef": screenshot_ref,
                    "parsed": result_dict
                }
                f.write(json.dumps(log_entry) + "\n")

        # 5. Update MongoDB event
        await db.events.update_one(
            {"eventId": event_id},
            {"$set": {
                "ai": result_dict,
                "status": "classified"
            }}
        )
        logger.info(f"Successfully processed event {event_id}.")
        
    except Exception as e:
        logger.error(f"Failed to process screenshot {event_id}: {e}")
        # Never leave silently pending forever
        await db.events.update_one(
            {"eventId": event_id},
            {"$set": {"status": "failed_classification"}}
        )

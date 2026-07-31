from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import TypeAdapter, ValidationError
from ..models.events import Event
from ..db import get_db
from ..services.pipeline import process_screenshot
from .deps import get_client_id
import json
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Validates a single event against the discriminated Event union. Using a
# TypeAdapter (rather than the strict BatchRequest body model) lets us validate
# events one-by-one so a single malformed event can't 422 the entire batch.
_event_adapter = TypeAdapter(Event)

@router.post("/api/events/batch")
async def ingest_batch(
    request: Request,
    background_tasks: BackgroundTasks,
    client_id: str = Depends(get_client_id)
):
    """
    Ingest a batch of events.

    We read the raw body and validate each event individually so that a single
    malformed event does not reject the whole batch. Valid events are inserted;
    invalid ones are skipped and reported back with the exact validation errors.
    """
    db = get_db()

    body = await request.json()
    # Tolerate both payload shapes: a bare list [...] or {"events": [...]}.
    if isinstance(body, list):
        raw_events = body
    elif isinstance(body, dict):
        raw_events = body.get("events", [])
    else:
        raise HTTPException(status_code=400, detail="Request body must be a JSON object or array")

    valid_events: list = []
    rejected: list = []

    for raw in raw_events:
        try:
            valid_events.append(_event_adapter.validate_python(raw))
        except ValidationError as ve:
            event_id = raw.get("eventId") if isinstance(raw, dict) else None
            # Use ve.json() -> loads to guarantee JSON-serializable error detail.
            # ve.errors() can embed raw exception objects in `ctx` that FastAPI's
            # encoder would choke on, which would turn this into a 500.
            errors = json.loads(ve.json())
            rejected.append({"eventId": event_id, "errors": errors})
            logger.warning(f"Rejected event {event_id}: {errors}")

    if valid_events:
        try:
            # Insert all at once to minimize DB roundtrips (written as "pending").
            documents = [event.model_dump() for event in valid_events]
            for doc in documents:
                doc["clientId"] = client_id
            
            await db.events.insert_many(documents)

            # Enqueue screenshot events for background processing
            for event in valid_events:
                if event.eventType == "screenshot":
                    background_tasks.add_task(process_screenshot, event.eventId)
        except Exception as e:
            logger.error(f"Error inserting batch: {e}")
            raise HTTPException(status_code=500, detail="Internal server error during ingestion")

    return {
        "accepted": len(valid_events),
        "rejected": len(rejected),
        "errors": rejected,
    }

@router.get("/api/events")
async def get_events(limit: int = 50):
    """
    Fetch the most recent events for debugging.
    """
    db = get_db()
    try:
        # Sort by timestamp descending
        cursor = db.events.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit)
        events = await cursor.to_list(length=limit)
        return {"count": len(events), "events": events}
    except Exception as e:
        logger.error(f"Error fetching events: {e}")
        return {"error": str(e), "type": str(type(e))}

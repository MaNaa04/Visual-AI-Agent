import asyncio
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import sys
import os

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

# Connect string must be the same as backend/.env
# Easiest way is to read it from .env or hardcode for test script
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

MONGODB_URI = os.getenv("MONGODB_URI")

async def run_audit():
    if not MONGODB_URI:
        print("❌ Error: MONGODB_URI not found in .env")
        sys.exit(1)
        
    print(f"Connecting to MongoDB...")
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client.get_database("visual_ai_agent")
    
    total_events = await db.events.count_documents({})
    print(f"Total events in DB: {total_events}")
    if total_events == 0:
        print("No events found to audit.")
        sys.exit(0)

    failed = False

    # 1. Check for duplicate eventIds
    print("\n--- Auditing Duplicate Event IDs ---")
    dupes_pipeline = [
        {"$group": {"_id": "$eventId", "n": {"$sum": 1}}},
        {"$match": {"n": {"$gt": 1}}}
    ]
    dupes = await db.events.aggregate(dupes_pipeline).to_list(None)
    if dupes:
        print(f"❌ FOUND {len(dupes)} duplicate eventIds!")
        for d in dupes[:5]:
            print(f"   EventID: {d['_id']} (Count: {d['n']})")
        failed = True
    else:
        print("✅ Zero duplicate eventIds.")

    # 2. Check for stuck pending screenshots (> 5 mins)
    print("\n--- Auditing Stuck Screenshots ---")
    five_mins_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
    
    stuck_count = await db.events.count_documents({
        "eventType": "screenshot",
        "status": "pending",
        # We store timestamp as ISO string, so we need string comparison.
        # String comparison works perfectly for ISO-8601 timestamps.
        "timestamp": {"$lt": five_mins_ago.isoformat()}
    })
    
    if stuck_count > 0:
        print(f"❌ FOUND {stuck_count} screenshot events stuck in 'pending' state > 5 minutes.")
        failed = True
    else:
        print("✅ Zero stuck screenshot events.")

    # 3. Check for failed classification
    print("\n--- Auditing Failed Classification ---")
    failed_class_count = await db.events.count_documents({
        "eventType": "screenshot",
        "status": "failed_classification"
    })
    
    if failed_class_count > 0:
        print(f"❌ FOUND {failed_class_count} screenshot events in 'failed_classification' state. (Canary for broken vision models!)")
        failed = True
    else:
        print("✅ Zero failed classification events.")

    # 4. Check for missing clientId
    print("\n--- Auditing Client ID Stamping ---")
    missing_client_id = await db.events.count_documents({
        "clientId": {"$exists": False}
    })
    
    if missing_client_id > 0:
        print(f"❌ FOUND {missing_client_id} events missing a 'clientId'.")
        failed = True
    else:
        print("✅ 100% of events possess a valid clientId.")

    # Results
    if failed:
        print("\n❌ Audit FAILED.")
        sys.exit(1)
    else:
        print("\n✅ Audit PASSED. Database correctness verified.")
        sys.exit(0)

if __name__ == "__main__":
    asyncio.run(run_audit())

import asyncio
import httpx
import uuid
import os
import time
from datetime import datetime, timezone

# We'll use a specific client ID for this test
CLIENT_ID = "lifecycle-test-client"

async def run_lifecycle_test():
    print(f"--- Starting Data Lifecycle Test for {CLIENT_ID} ---")
    
    async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=10.0) as client:
        # 1. Ingest Mock Events
        print("\n1. Ingesting mock events...")
        
        # Create a fake screenshot file on disk
        screenshot_dir = os.path.join(os.path.dirname(__file__), "..", "data", "screenshots", "test")
        os.makedirs(screenshot_dir, exist_ok=True)
        screenshot_path = os.path.join(screenshot_dir, "test_screenshot.jpg")
        
        with open(screenshot_path, "wb") as f:
            f.write(b"fake jpeg data")
            
        event_id_1 = str(uuid.uuid4())
        event_id_2 = str(uuid.uuid4())
        
        events = [
            {
                "eventId": event_id_1,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "tabId": 1,
                "url": "https://example.com/test1",
                "domain": "example.com",
                "title": "Test 1",
                "eventType": "click",
                "meta": {}
            },
            {
                "eventId": event_id_2,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "tabId": 1,
                "url": "https://example.com/test2",
                "domain": "example.com",
                "title": "Test 2",
                "eventType": "screenshot",
                "screenshotRef": screenshot_path,
                "meta": {}
            }
        ]
        
        res = await client.post("/api/events/batch", json=events, headers={"X-Client-ID": CLIENT_ID})
        assert res.status_code == 200
        print(f"✅ Ingested {res.json()['accepted']} events.")
        
        # Give DB a moment to settle
        time.sleep(1)
        
        # 2. Export Data
        print("\n2. Exporting data...")
        res = await client.get("/api/events/export", headers={"X-Client-ID": CLIENT_ID})
        assert res.status_code == 200
        exported_data = res.json()
        print(f"✅ Exported {len(exported_data)} events.")
        assert len(exported_data) >= 2, "Export did not return the ingested events"
        
        # 3. Deliberate file lock/permission test
        print("\n3. Testing partial failure (locking file)...")
        # In Python on Windows, opening a file in exclusive write mode locks it.
        # But actually, the easiest way to simulate a permission error is to make it read-only, 
        # or just hold a file handle open.
        f = open(screenshot_path, "r")
        
        # 4. Delete Data
        print("\n4. Deleting data (expecting partial failure)...")
        try:
            res = await client.delete("/api/events", headers={"X-Client-ID": CLIENT_ID})
            data = res.json()
            print(f"Delete response: {data}")
            
            # Note: on Windows, os.remove on an open file will throw PermissionError.
            # On Linux, it might succeed. We assume Windows here since the env is Windows.
            if data.get("failed_files", 0) > 0:
                print("✅ Partial failure correctly detected (file was locked).")
            else:
                print("⚠️ File was deleted despite being locked (this happens on some OSes).")
        finally:
            f.close()
            
        # Clean up the file if it wasn't deleted
        if os.path.exists(screenshot_path):
            os.remove(screenshot_path)
            
        # 5. Second Delete (Cleanup)
        print("\n5. Running second delete to clean up...")
        res = await client.delete("/api/events", headers={"X-Client-ID": CLIENT_ID})
        print(f"✅ Final delete response: {res.json()}")
        
        # 6. Verify Empty
        print("\n6. Verifying DB is empty...")
        res = await client.get("/api/events/export", headers={"X-Client-ID": CLIENT_ID})
        assert len(res.json()) == 0
        print("✅ DB is fully empty for this client.")
        
        print("\n🎉 Lifecycle Test Complete!")

if __name__ == "__main__":
    asyncio.run(run_lifecycle_test())

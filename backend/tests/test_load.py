import asyncio
import httpx
import uuid
from datetime import datetime, timezone
import time
import sys

# The target load
NUM_EVENTS = 500
CONCURRENCY = 20

async def send_event(client, idx):
    event = {
        "eventId": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "tabId": 1,
        "url": f"https://example.com/page-{idx}",
        "domain": "example.com",
        "title": f"Test Page {idx}",
        "eventType": "click",
        "meta": {"x": 100, "y": 200, "target": "button"}
    }
    
    # Send a tiny batch of 1 to maximize HTTP connection concurrency
    response = await client.post(
        "/api/events/batch",
        json=[event],
        headers={"X-Client-ID": "loadtest-client-7.1"}
    )
    return response.status_code

async def fire_burst():
    print(f"Firing {NUM_EVENTS} events at concurrency {CONCURRENCY}...")
    
    start_time = time.time()
    
    # We use a custom transport with high connection limits for burst testing
    limits = httpx.Limits(max_connections=CONCURRENCY, max_keepalive_connections=CONCURRENCY)
    
    async with httpx.AsyncClient(base_url="http://localhost:8000", limits=limits, timeout=10.0) as client:
        # Use a semaphore to strictly control concurrency
        sem = asyncio.Semaphore(CONCURRENCY)
        
        async def bounded_send(idx):
            async with sem:
                return await send_event(client, idx)
                
        tasks = [bounded_send(i) for i in range(NUM_EVENTS)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
    duration = time.time() - start_time
    
    # Tally results
    successes = 0
    errors = 0
    status_counts = {}
    
    for r in results:
        if isinstance(r, Exception):
            errors += 1
        else:
            status_counts[r] = status_counts.get(r, 0) + 1
            if r == 200:
                successes += 1
                
    print(f"\n--- Load Test Results ---")
    print(f"Time Taken:    {duration:.2f} seconds")
    print(f"Throughput:    {NUM_EVENTS / duration:.1f} req/s")
    print(f"Success (200): {successes}")
    print(f"Exceptions:    {errors}")
    print(f"Status Codes:  {status_counts}")
    
    if successes == NUM_EVENTS:
        print("\n✅ SUCCESS: Backend gracefully handled the burst without dropping a single event.")
        sys.exit(0)
    else:
        print("\n❌ FAILURE: Some requests were dropped or failed.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(fire_burst())

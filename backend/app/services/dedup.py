import imagehash
from PIL import Image
import io
import json

async def check_and_update_hash(redis_client, tab_id: int, image_bytes: bytes, threshold: int = 5) -> tuple[bool, dict | None]:
    """
    Returns (is_duplicate, previous_ai_result).
    If is_duplicate is True, skip the vision call and reuse the previous_ai_result.
    """
    current_hash = imagehash.phash(Image.open(io.BytesIO(image_bytes)))
    
    hash_key = f"dedup:tab:{tab_id}:hash"
    result_key = f"dedup:tab:{tab_id}:result"
    
    last_hash_str = await redis_client.get(hash_key)
    
    is_dup = False
    prev_ai = None
    
    if last_hash_str:
        last_hash = imagehash.hex_to_hash(last_hash_str.decode('utf-8'))
        if (current_hash - last_hash) <= threshold:
            is_dup = True
            raw_result = await redis_client.get(result_key)
            if raw_result:
                prev_ai = json.loads(raw_result.decode('utf-8'))

    if not is_dup:
        # TTL: 3600 seconds (1 hour). Stale tab hashes expire overnight.
        await redis_client.set(hash_key, str(current_hash), ex=3600)
        # We don't set the result here; pipeline.py will set it once it gets the fresh classification.
        
    return is_dup, prev_ai

async def cache_classification_result(redis_client, tab_id: int, ai_result: dict):
    """Caches the fresh classification result for a given tab."""
    result_key = f"dedup:tab:{tab_id}:result"
    await redis_client.set(result_key, json.dumps(ai_result), ex=3600)

import asyncio
import logging
from typing import Callable, Any

logger = logging.getLogger(__name__)

async def with_retry(
    fn: Callable[..., Any],
    *args,
    attempts: int = 3,
    backoff: int = 2,
    **kwargs
) -> Any:
    """
    Wraps an async function with bounded retries and exponential backoff.
    """
    for i in range(attempts):
        try:
            return await fn(*args, **kwargs)
        except Exception as e:
            if i == attempts - 1:
                logger.error(f"Final retry attempt failed: {e}")
                raise
            sleep_time = backoff ** i
            logger.warning(f"Attempt {i+1} failed: {e}. Retrying in {sleep_time}s...")
            await asyncio.sleep(sleep_time)

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import redis.asyncio as redis
import os
from dotenv import load_dotenv
import logging

load_dotenv()
logger = logging.getLogger(__name__)

# Global instances
_mongo_client: AsyncIOMotorClient = None
_db: AsyncIOMotorDatabase = None
_redis_client: redis.Redis = None

def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("Database not initialized")
    return _db

def get_redis() -> redis.Redis:
    if _redis_client is None:
        raise RuntimeError("Redis not initialized")
    return _redis_client

async def connect_to_databases():
    global _mongo_client, _db, _redis_client
    
    mongo_uri = os.getenv("MONGODB_URI")
    redis_uri = os.getenv("REDIS_URI")
    
    if mongo_uri:
        logger.info("Connecting to MongoDB...")
        _mongo_client = AsyncIOMotorClient(mongo_uri)
        _db = _mongo_client.get_database("visual_ai_agent")
    else:
        logger.warning("MONGODB_URI not set. DB will not be connected.")
        
    if redis_uri:
        logger.info("Connecting to Redis...")
        _redis_client = redis.from_url(redis_uri)
    else:
        logger.warning("REDIS_URI not set. Redis will not be connected.")

async def close_databases():
    global _mongo_client, _redis_client
    if _mongo_client:
        _mongo_client.close()
    if _redis_client:
        await _redis_client.aclose()

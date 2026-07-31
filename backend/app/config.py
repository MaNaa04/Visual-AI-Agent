import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    MONGODB_URI = os.getenv("MONGODB_URI")
    REDIS_URI = os.getenv("REDIS_URI")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    VISION_PROVIDER = os.getenv("VISION_PROVIDER", "gemini").lower()

config = Config()

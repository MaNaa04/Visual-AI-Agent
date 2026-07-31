from .base import VisionClient
from .gemini_client import GeminiVisionClient
from .groq_client import GroqVisionClient
from ...config import config

_client_instance = None

def get_vision_client() -> VisionClient:
    global _client_instance
    if _client_instance is not None:
        return _client_instance

    if config.VISION_PROVIDER == "groq":
        _client_instance = GroqVisionClient()
    else:
        # Default to Gemini
        _client_instance = GeminiVisionClient()
        
    return _client_instance

import google.generativeai as genai
from .base import VisionClient, VisionResult, VISION_PROMPT
from ...config import config

class GeminiVisionClient(VisionClient):
    def __init__(self, model_name: str = "gemini-2.5-flash"):
        if not config.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is not set")
        genai.configure(api_key=config.GEMINI_API_KEY)
        self._model = genai.GenerativeModel(model_name)

    async def classify(self, image_bytes: bytes) -> VisionResult:
        image_part = {
            "mime_type": "image/jpeg",
            "data": image_bytes
        }
        response = await self._model.generate_content_async([VISION_PROMPT, image_part])
        return self._parse_json_result(response.text)

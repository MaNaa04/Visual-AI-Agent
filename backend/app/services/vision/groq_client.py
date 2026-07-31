import base64
from groq import AsyncGroq
from .base import VisionClient, VisionResult, VISION_PROMPT
from ...config import config

class GroqVisionClient(VisionClient):
    def __init__(self):
        if not config.GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY is not set")
        self._client = AsyncGroq(api_key=config.GROQ_API_KEY)

    async def classify(self, image_bytes: bytes) -> VisionResult:
        base64_image = base64.b64encode(image_bytes).decode('utf-8')
        
        response = await self._client.chat.completions.create(
            model="meta-llama/llama-4-scout",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": VISION_PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}",
                            },
                        },
                    ],
                }
            ],
            response_format={"type": "json_object"}
        )
        return self._parse_json_result(response.choices[0].message.content)

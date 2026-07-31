from abc import ABC, abstractmethod
from pydantic import BaseModel
import re

class VisionResult(BaseModel):
    app: str
    activitySummary: str
    tags: list[str]
    confidence: float

VISION_PROMPT = """You are classifying a screenshot of browser activity. Return ONLY valid JSON:
{"app": "<app/site name>", "activitySummary": "<one sentence>", "tags": ["<tag1>", "<tag2>"], "confidence": <0.0-1.0>}
No markdown, no explanation, JSON only.
"""

class VisionClient(ABC):
    @abstractmethod
    async def classify(self, image_bytes: bytes) -> VisionResult:
        ...

    def _parse_json_result(self, text: str) -> VisionResult:
        """
        Attempts to parse the result. If it fails, attempts one repair pass
        (stripping markdown fences) before letting it raise a ValidationError.
        """
        try:
            return VisionResult.model_validate_json(text)
        except Exception as e:
            # Try to strip ```json ... ``` markdown block
            match = re.search(r'```(?:json)?(.*?)```', text, re.DOTALL)
            if match:
                clean_text = match.group(1).strip()
                return VisionResult.model_validate_json(clean_text)
            # If still fails, re-raise the original exception
            raise e

from pydantic import BaseModel, Field
from typing import Literal, Union, Optional, Annotated
from datetime import datetime

class BehavioralEventMeta(BaseModel):
    clickTarget: Optional[str] = None
    scrollPct: Optional[int] = None
    idleSeconds: Optional[int] = None
    prevUrl: Optional[str] = None

class BehavioralEvent(BaseModel):
    eventId: str
    timestamp: datetime
    tabId: int
    url: str
    domain: str
    title: str
    eventType: Literal["nav", "click", "scroll", "idle"]
    meta: Optional[BehavioralEventMeta] = None

class AIResult(BaseModel):
    app: str
    activitySummary: str
    tags: list[str]
    confidence: float

class ScreenshotEvent(BaseModel):
    eventId: str
    timestamp: datetime
    tabId: int
    url: str
    domain: str
    title: str
    eventType: Literal["screenshot"]
    screenshotRef: str
    status: Literal["pending", "classified", "failed_classification"] = "pending"
    ai: Optional[AIResult] = None

Event = Annotated[Union[BehavioralEvent, ScreenshotEvent], Field(discriminator="eventType")]

class BatchRequest(BaseModel):
    events: list[Event]

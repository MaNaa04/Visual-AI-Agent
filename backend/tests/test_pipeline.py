import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.services.pipeline import process_screenshot
from app.services.vision.base import VisionResult

@pytest.fixture
def mock_db():
    with patch("app.services.pipeline.get_db") as mock:
        db = MagicMock()
        db.events.find_one = AsyncMock()
        db.events.update_one = AsyncMock()
        mock.return_value = db
        yield db

@pytest.fixture
def mock_redis():
    with patch("app.services.pipeline.get_redis") as mock:
        redis = MagicMock()
        redis.get = AsyncMock()
        redis.set = AsyncMock()
        mock.return_value = redis
        yield redis

@pytest.fixture
def mock_vision():
    with patch("app.services.pipeline.get_vision_client") as mock:
        client = MagicMock()
        client.classify = AsyncMock()
        # Ensure it returns a VisionResult
        client.classify.return_value = VisionResult(
            app="TestApp",
            activitySummary="Doing a test",
            tags=["test"],
            confidence=0.9
        )
        mock.return_value = client
        yield client

@pytest.fixture
def mock_path():
    with patch("app.services.pipeline.pathlib.Path") as mock:
        path_instance = MagicMock()
        path_instance.exists.return_value = True
        path_instance.read_bytes.return_value = b"fake_image_bytes"
        mock.return_value = path_instance
        yield mock

@patch("app.services.dedup.Image.open")
@patch("app.services.dedup.imagehash.phash")
@pytest.mark.asyncio
async def test_process_screenshot_success(mock_phash, mock_image_open, mock_db, mock_redis, mock_vision, mock_path):
    mock_db.events.find_one.return_value = {
        "eventId": "event-123",
        "eventType": "screenshot",
        "screenshotRef": "fake.jpg",
        "tabId": 1
    }
    
    # Mock phash returns a mock hash object that supports subtraction
    hash_obj = MagicMock()
    hash_obj.__sub__.return_value = 10 # Force it to NOT be a duplicate (difference > 5)
    mock_phash.return_value = hash_obj
    
    mock_redis.get.return_value = b"0000000000000000" # Some fake previous hash
    
    with patch("builtins.open", new_callable=MagicMock):
        await process_screenshot("event-123")
    
    # Vision client should be called because it wasn't a duplicate
    mock_vision.classify.assert_called_once_with(b"fake_image_bytes")
    
    # Check if DB was updated with status classified
    mock_db.events.update_one.assert_called_once()
    call_args = mock_db.events.update_one.call_args[0]
    assert call_args[0] == {"eventId": "event-123"}
    assert call_args[1]["$set"]["status"] == "classified"
    assert "TestApp" in str(call_args[1]["$set"]["ai"])

@patch("app.services.dedup.Image.open")
@patch("app.services.dedup.imagehash.phash")
@pytest.mark.asyncio
async def test_process_screenshot_duplicate(mock_phash, mock_image_open, mock_db, mock_redis, mock_vision, mock_path):
    mock_db.events.find_one.return_value = {
        "eventId": "event-123",
        "eventType": "screenshot",
        "screenshotRef": "fake.jpg",
        "tabId": 1
    }
    
    # Force IT TO BE a duplicate (difference <= 5)
    hash_obj = MagicMock()
    hash_obj.__sub__.return_value = 0
    mock_phash.return_value = hash_obj
    
    mock_redis.get.side_effect = [
        b"0000000000000000", # hash key
        b'{"app": "CachedApp", "activitySummary": "cached", "tags": [], "confidence": 1.0}' # result key
    ]
    
    await process_screenshot("event-123")
    
    # Vision client should NOT be called because it's a duplicate
    mock_vision.classify.assert_not_called()
    
    # Check if DB was updated with the cached AI result
    mock_db.events.update_one.assert_called_once()
    call_args = mock_db.events.update_one.call_args[0]
    assert call_args[1]["$set"]["ai"]["app"] == "CachedApp"

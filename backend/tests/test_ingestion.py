import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock
from app.main import app

client = TestClient(app)

valid_batch = {
    "events": [
        {
            "eventId": "123e4567-e89b-12d3-a456-426614174000",
            "timestamp": "2023-10-25T12:00:00Z",
            "tabId": 1,
            "url": "https://github.com",
            "domain": "github.com",
            "title": "GitHub",
            "eventType": "nav",
            "meta": {"prevUrl": "https://google.com"}
        },
        {
            "eventId": "123e4567-e89b-12d3-a456-426614174001",
            "timestamp": "2023-10-25T12:00:05Z",
            "tabId": 1,
            "url": "https://github.com",
            "domain": "github.com",
            "title": "GitHub",
            "eventType": "screenshot",
            "screenshotRef": "data/screenshots/2023-10-25/123.jpg",
            "status": "pending"
        }
    ]
}

malformed_batch = {
    "events": [
        {
            "eventId": "123e4567-e89b-12d3-a456-426614174002",
            # missing timestamp
            "tabId": 1,
            "url": "https://github.com",
            "domain": "github.com",
            "title": "GitHub",
            "eventType": "nav"
        }
    ]
}

@patch('app.api.events.process_screenshot', new_callable=AsyncMock)
@patch('app.api.events.get_db')
def test_ingest_batch_success(mock_get_db, mock_process_screenshot):
    # Mock the async insert_many
    mock_db = MagicMock()
    mock_db.events.insert_many = AsyncMock()
    mock_get_db.return_value = mock_db
    
    response = client.post(
        "/api/events/batch",
        json=valid_batch,
        headers={"X-Client-ID": "test-client-123"}
    )
    
    assert response.status_code == 200
    assert response.json() == {"accepted": 2}
    mock_db.events.insert_many.assert_called_once()
    mock_process_screenshot.assert_called_once_with("123e4567-e89b-12d3-a456-426614174001")
    
    # We can also verify BackgroundTasks was called by checking if the task was queued,
    # but FastAPI's TestClient runs BackgroundTasks inline synchronously after the response.
    # To prevent process_screenshot from failing due to missing DB inside it, we could patch it.
    
@patch('app.api.events.get_db')
def test_ingest_batch_missing_client_id(mock_get_db):
    response = client.post(
        "/api/events/batch",
        json=valid_batch
    )
    # The dependency requires X-Client-ID
    assert response.status_code == 400
    assert "Missing X-Client-ID" in response.text

@patch('app.api.events.get_db')
def test_ingest_batch_malformed(mock_get_db):
    response = client.post(
        "/api/events/batch",
        json=malformed_batch,
        headers={"X-Client-ID": "test-client-123"}
    )
    # Should automatically 422
    assert response.status_code == 422

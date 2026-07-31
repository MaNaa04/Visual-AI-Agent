from fastapi import APIRouter, UploadFile, Depends, HTTPException, Form
import uuid
import pathlib
from datetime import date
from .deps import get_client_id

router = APIRouter()

@router.post("/api/screenshots/upload")
async def upload_screenshot(
    file: UploadFile,
    eventId: str = Form(...),
    client_id: str = Depends(get_client_id)
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Store screenshots organized by day to avoid massive flat directories
    day = date.today().isoformat()
    # E.g., data/screenshots/2023-10-25
    dir_path = pathlib.Path(f"data/screenshots/{day}")
    dir_path.mkdir(parents=True, exist_ok=True)
    
    # We name the file using the eventId from the form to tie it directly,
    # or fallback to uuid if not provided (though Form(...) makes it required)
    filename = f"{eventId}.jpg"
    dest = dir_path / filename
    
    # Write to disk asynchronously
    content = await file.read()
    dest.write_bytes(content)
    
    # Return the relative path so the extension can attach it to the ScreenshotEvent
    return {"screenshotRef": str(dest).replace("\\", "/")}

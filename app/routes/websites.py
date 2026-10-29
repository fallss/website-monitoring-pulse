import time
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.utils.validator import validate_and_fix_url
from app import database

router = APIRouter()

class WebsiteCreate(BaseModel):
    url: str
    id: Optional[str] = None

class WebsiteUpdate(BaseModel):
    status: Optional[str] = None
    latency: Optional[int] = None
    statusCode: Optional[int] = None
    lastChecked: Optional[str] = None
    history: Optional[List[int]] = None

class WebsiteSyncRequest(BaseModel):
    websites: List[Dict[str, Any]]

@router.get("/websites")
def list_websites():
    """Retrieve all monitored websites from the central database."""
    return database.get_all_websites()

@router.post("/websites")
def create_website(payload: WebsiteCreate):
    """Add a new website to be monitored across all devices."""
    try:
        clean_url = validate_and_fix_url(payload.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    website_id = payload.id or str(int(time.time() * 1000))
    result = database.add_website(website_id=website_id, url=clean_url)
    return result

@router.put("/websites/{website_id}")
def update_website(website_id: str, payload: WebsiteUpdate):
    """Update website metrics (status, latency, history) in the central database."""
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    updated = database.update_website(website_id, update_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Website not found")
    return updated

@router.delete("/websites/{website_id}")
def remove_website(website_id: str):
    """Delete a website from the central database."""
    success = database.delete_website(website_id)
    if not success:
        raise HTTPException(status_code=404, detail="Website not found")
    return {"message": "Website deleted successfully", "id": website_id}

@router.post("/websites/sync")
def sync_websites(payload: WebsiteSyncRequest):
    """Bulk sync websites (e.g. from local storage cache)."""
    return database.sync_websites(payload.websites)

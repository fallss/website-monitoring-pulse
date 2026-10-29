import time
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from app.utils.validator import validate_and_fix_url
from app.utils.http_client import check_url_status
import httpx

router = APIRouter()

@router.get("/check")
async def check_website(url: str = Query(..., description="URL website to check")):
    try:
        # 1. Validasi URL
        target_url = validate_and_fix_url(url)
        
        # 2. Start Timer
        start_time = time.perf_counter()
        
        # 3. Perform Request
        try:
            response = await check_url_status(target_url)
            status_code = response.status_code
            status = "up" if response.status_code < 400 else "down"
        except httpx.TimeoutException:
            status_code = 408
            status = "down"
        except httpx.RequestError:
            status_code = 503 # Service Unavailable / Connection Failed
            status = "down"

        # 4. Stop Timer
        end_time = time.perf_counter()
        response_time_ms = int((end_time - start_time) * 1000)

        # 5. Construct Response
        return {
            "url": target_url,
            "status": status,
            "status_code": status_code,
            "response_time_ms": response_time_ms,
            "checked_at": datetime.now(timezone.utc).isoformat()
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Fallback error handling
        raise HTTPException(status_code=500, detail="Internal Server Error")

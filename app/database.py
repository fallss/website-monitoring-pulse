import os
import json
import sqlite3
import httpx
from typing import List, Optional, Dict, Any

# Upstash Redis / Vercel KV Configuration
KV_URL = os.environ.get("KV_REST_API_URL") or os.environ.get("UPSTASH_REDIS_REST_URL")
KV_TOKEN = os.environ.get("KV_REST_API_TOKEN") or os.environ.get("UPSTASH_REDIS_REST_TOKEN")
REDIS_KEY = "nexct_monitoring_websites"

def is_redis_configured() -> bool:
    return bool(KV_URL and KV_TOKEN)

def redis_exec(command: list) -> Any:
    if not is_redis_configured():
        return None
    try:
        headers = {
            "Authorization": f"Bearer {KV_TOKEN}",
            "Content-Type": "application/json"
        }
        with httpx.Client(timeout=6.0) as client:
            resp = client.post(KV_URL, headers=headers, json=command)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("result")
    except Exception as e:
        print(f"[Database] Upstash Redis error: {e}")
    return None

def redis_get_all() -> List[Dict[str, Any]]:
    res = redis_exec(["GET", REDIS_KEY])
    if not res:
        return []
    try:
        if isinstance(res, str):
            parsed = json.loads(res)
            return parsed if isinstance(parsed, list) else []
        elif isinstance(res, list):
            return res
    except Exception as e:
        print(f"[Database] Redis parse error: {e}")
    return []

def redis_save_all(sites: List[Dict[str, Any]]) -> bool:
    res = redis_exec(["SET", REDIS_KEY, json.dumps(sites)])
    return res == "OK"

# Fallback: Local SQLite
if os.environ.get("VERCEL"):
    DB_DIR = "/tmp"
else:
    DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, "websites.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    if is_redis_configured():
        return
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS websites (
                id TEXT PRIMARY KEY,
                url TEXT NOT NULL UNIQUE,
                status TEXT DEFAULT 'pending',
                latency INTEGER DEFAULT 0,
                status_code INTEGER DEFAULT 0,
                last_checked TEXT,
                history TEXT DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

init_db()

def get_all_websites() -> List[Dict[str, Any]]:
    if is_redis_configured():
        return redis_get_all()

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM websites ORDER BY created_at ASC")
        rows = cursor.fetchall()
        result = []
        for row in rows:
            try:
                history = json.loads(row["history"]) if row["history"] else []
            except Exception:
                history = []
            result.append({
                "id": str(row["id"]),
                "url": row["url"],
                "status": row["status"],
                "latency": row["latency"],
                "statusCode": row["status_code"],
                "lastChecked": row["last_checked"],
                "history": history
            })
        return result

def add_website(website_id: str, url: str) -> Dict[str, Any]:
    if is_redis_configured():
        sites = redis_get_all()
        for site in sites:
            if site.get("url", "").lower() == url.lower():
                return site
        new_site = {
            "id": str(website_id),
            "url": url,
            "status": "pending",
            "latency": 0,
            "statusCode": 0,
            "lastChecked": None,
            "history": []
        }
        sites.append(new_site)
        redis_save_all(sites)
        return new_site

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM websites WHERE url = ?", (url,))
        existing = cursor.fetchone()
        if existing:
            try:
                hist = json.loads(existing["history"]) if existing["history"] else []
            except Exception:
                hist = []
            return {
                "id": str(existing["id"]),
                "url": existing["url"],
                "status": existing["status"],
                "latency": existing["latency"],
                "statusCode": existing["status_code"],
                "lastChecked": existing["last_checked"],
                "history": hist
            }

        cursor.execute(
            """
            INSERT INTO websites (id, url, status, latency, status_code, last_checked, history)
            VALUES (?, ?, 'pending', 0, 0, NULL, '[]')
            """,
            (website_id, url)
        )
        conn.commit()
        return {
            "id": str(website_id),
            "url": url,
            "status": "pending",
            "latency": 0,
            "statusCode": 0,
            "lastChecked": None,
            "history": []
        }

def update_website(website_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if is_redis_configured():
        sites = redis_get_all()
        target = None
        for site in sites:
            if str(site.get("id")) == str(website_id):
                if "status" in data:
                    site["status"] = data["status"]
                if "latency" in data:
                    site["latency"] = data["latency"]
                if "statusCode" in data:
                    site["statusCode"] = data["statusCode"]
                if "lastChecked" in data:
                    site["lastChecked"] = data["lastChecked"]
                if "history" in data:
                    site["history"] = data["history"]
                target = site
                break
        if target:
            redis_save_all(sites)
        return target

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM websites WHERE id = ?", (website_id,))
        existing = cursor.fetchone()
        if not existing:
            return None

        status = data.get("status", existing["status"])
        latency = data.get("latency", existing["latency"])
        status_code = data.get("statusCode", existing["status_code"])
        last_checked = data.get("lastChecked", existing["last_checked"])
        history = data.get("history")
        history_str = json.dumps(history) if history is not None else existing["history"]

        cursor.execute(
            """
            UPDATE websites
            SET status = ?, latency = ?, status_code = ?, last_checked = ?, history = ?
            WHERE id = ?
            """,
            (status, latency, status_code, last_checked, history_str, website_id)
        )
        conn.commit()
        return {
            "id": str(website_id),
            "url": existing["url"],
            "status": status,
            "latency": latency,
            "statusCode": status_code,
            "lastChecked": last_checked,
            "history": json.loads(history_str) if history_str else []
        }

def delete_website(website_id: str) -> bool:
    if is_redis_configured():
        sites = redis_get_all()
        initial_len = len(sites)
        sites = [s for s in sites if str(s.get("id")) != str(website_id)]
        if len(sites) != initial_len:
            redis_save_all(sites)
            return True
        return False

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM websites WHERE id = ?", (website_id,))
        conn.commit()
        return cursor.rowcount > 0

def sync_websites(sites: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if is_redis_configured():
        existing = redis_get_all()
        existing_urls = {s.get("url", "").lower(): s for s in existing}
        for s in sites:
            u = s.get("url", "").lower()
            if u and u not in existing_urls:
                existing.append({
                    "id": str(s.get("id")),
                    "url": s.get("url"),
                    "status": s.get("status", "pending"),
                    "latency": s.get("latency", 0),
                    "statusCode": s.get("statusCode", 0),
                    "lastChecked": s.get("lastChecked"),
                    "history": s.get("history", [])
                })
                existing_urls[u] = s
        redis_save_all(existing)
        return existing

    with get_connection() as conn:
        cursor = conn.cursor()
        for site in sites:
            s_id = str(site.get("id"))
            url = site.get("url")
            if not url or not s_id:
                continue
            status = site.get("status", "pending")
            latency = site.get("latency", 0)
            status_code = site.get("statusCode", 0)
            last_checked = site.get("lastChecked")
            history = json.dumps(site.get("history", []))

            cursor.execute("""
                INSERT OR IGNORE INTO websites (id, url, status, latency, status_code, last_checked, history)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (s_id, url, status, latency, status_code, last_checked, history))
        conn.commit()
    return get_all_websites()

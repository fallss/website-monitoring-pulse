import os
import json
import sqlite3
from typing import List, Optional, Dict, Any

# Lokasi penyimpanan database: /tmp di Vercel, data/websites.db di local
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
                "id": row["id"],
                "url": row["url"],
                "status": row["status"],
                "latency": row["latency"],
                "statusCode": row["status_code"],
                "lastChecked": row["last_checked"],
                "history": history
            })
        return result

def add_website(website_id: str, url: str) -> Dict[str, Any]:
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
                "id": existing["id"],
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
            "id": website_id,
            "url": url,
            "status": "pending",
            "latency": 0,
            "statusCode": 0,
            "lastChecked": None,
            "history": []
        }

def update_website(website_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
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
            "id": website_id,
            "url": existing["url"],
            "status": status,
            "latency": latency,
            "statusCode": status_code,
            "lastChecked": last_checked,
            "history": json.loads(history_str) if history_str else []
        }

def delete_website(website_id: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM websites WHERE id = ?", (website_id,))
        conn.commit()
        return cursor.rowcount > 0

def sync_websites(sites: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
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

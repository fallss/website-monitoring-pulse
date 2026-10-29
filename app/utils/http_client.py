import httpx

# User Agent agar tidak diblokir oleh beberapa firewall basic
HEADERS = {
    "User-Agent": "PingChecker/1.0 (Serverless Monitor; +https://pingchecker.vercel.app)"
}

async def check_url_status(url: str):
    async with httpx.AsyncClient(follow_redirects=True, headers=HEADERS) as client:
        return await client.get(url, timeout=5.0)

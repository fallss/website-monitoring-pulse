import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.routes import check, health, websites

app = FastAPI(
    title="PingChecker API",
    description="Serverless Website Monitoring API",
    version="1.0.0"
)

# Konfigurasi CORS (Penting untuk akses frontend ke backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Dalam production sebaiknya diganti dengan domain frontend spesifik
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routes
app.include_router(check.router, prefix="/api")
app.include_router(health.router, prefix="/api")
app.include_router(websites.router, prefix="/api")

# Mount public directory for static assets and HTML if present (local dev support)
if os.path.exists("public"):
    app.mount("/", StaticFiles(directory="public", html=True), name="public")
else:
    @app.get("/")
    def read_root():
        return {"message": "PingChecker API is running. Go to /api/check?url=... to use it."}


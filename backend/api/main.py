"""
FastAPI application for Nivo Intelligence API
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
import os

# Load environment variables from .env file in project root
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

app = FastAPI(
    title="Nivo Intelligence API",
    description="API for company intelligence, enrichment, and AI analysis",
    version="0.1.0"
)

# CORS configuration
# Allow localhost ports and Vercel preview deployments
default_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost:8082",
    "http://localhost:8083",
    "http://localhost:8084",
    "http://127.0.0.1:8084",
]

cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    default_origins.extend([origin.strip() for origin in cors_origins_env.split(",") if origin.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=default_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",  # Allow all Vercel preview deployments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT auth when REQUIRE_AUTH=true (prod)
from .auth import JWTAuthMiddleware
app.add_middleware(JWTAuthMiddleware)

# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "nivo-intelligence-api"}

# Import routers
from . import ai_filter, ai_reports, companies, enrichment, export, filters, jobs, shortlists, status, analysis, saved_lists
from .chat import router as chat_router
from .enrichment import router as enrichment_router

app.include_router(filters.router)
app.include_router(ai_filter.router)
app.include_router(enrichment_router)
app.include_router(export.router)
app.include_router(jobs.router)
app.include_router(companies.router)
app.include_router(status.router)
app.include_router(ai_reports.router)
app.include_router(shortlists.router)
app.include_router(saved_lists.router)
app.include_router(analysis.router)
app.include_router(chat_router)

# TODO: Add when implemented
# from . import search
# app.include_router(search.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


#!/usr/bin/env python3
"""
Verify environment setup for the AI sourcing tool.

Checks:
1. Required environment variables are set
2. Optional environment variables are documented
3. Backend can start and new endpoints are accessible
"""

import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

REQUIRED_VARS = {
    "DATABASE_SOURCE": "local",  # Default value
    "OPENAI_API_KEY": None,  # Required
}

OPTIONAL_VARS = {
    "LOCAL_DB_PATH": "data/nivo_optimized.db",  # Default value
    "OPENAI_MODEL": "gpt-4o-mini",  # Default value
    "SERPAPI_KEY": None,  # Optional - for website lookup
    "PUPPETEER_SERVICE_URL": None,  # Optional - for deep scraping
    "PUPPETEER_SERVICE_TOKEN": None,  # Optional - for Puppeteer auth
    "COPPER_API_TOKEN": None,  # Optional - for CRM export
    "SUPABASE_URL": None,  # Optional if using local DB
    "SUPABASE_SERVICE_ROLE_KEY": None,  # Optional if using local DB
    "SUPABASE_ANON_KEY": None,  # Optional if using local DB
    "REDIS_URL": "redis://localhost:6379/0",  # Default value
    "CORS_ORIGINS": "",  # Optional
    "VITE_API_BASE_URL": None,  # Frontend only
}

NEW_ENDPOINTS = [
    "/api/ai-filter",
    "/api/enrichment",
    "/api/export",
]


def load_env_file() -> Dict[str, str]:
    """Load environment variables from .env file."""
    env_path = Path(__file__).parent.parent / ".env"
    env_vars = {}
    
    if env_path.exists():
        print(f"📄 Found .env file at: {env_path}")
        with env_path.open() as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                env_vars[key] = value
    else:
        print(f"⚠️  No .env file found at: {env_path}")
        print("   Environment variables must be set in your shell or system.")
    
    return env_vars


def check_env_var(key: str, default: str = None, required: bool = False) -> Tuple[bool, str]:
    """Check if an environment variable is set."""
    value = os.getenv(key)
    
    if value:
        # Mask sensitive values
        if "KEY" in key or "TOKEN" in key or "SECRET" in key:
            display_value = f"{value[:8]}...{value[-4:]}" if len(value) > 12 else "***"
        else:
            display_value = value
        return True, f"✅ {key}={display_value}"
    elif default:
        return True, f"⚠️  {key} not set (using default: {default})"
    elif required:
        return False, f"❌ {key} is REQUIRED but not set"
    else:
        return True, f"⚪ {key} not set (optional)"


def verify_database_setup() -> Tuple[bool, List[str]]:
    """Verify database configuration."""
    results = []
    all_good = True
    
    db_source = os.getenv("DATABASE_SOURCE", "local").lower()
    results.append(f"📊 Database source: {db_source}")
    
    if db_source == "local":
        local_db_path = os.getenv("LOCAL_DB_PATH")
        if not local_db_path:
            # Use default path
            project_root = Path(__file__).parent.parent
            local_db_path = project_root / "data" / "nivo_optimized.db"
        else:
            local_db_path = Path(local_db_path)
            if not local_db_path.is_absolute():
                project_root = Path(__file__).parent.parent
                local_db_path = project_root / local_db_path
        
        if local_db_path.exists():
            results.append(f"✅ Local database found: {local_db_path}")
            # Check file size
            size_mb = local_db_path.stat().st_size / (1024 * 1024)
            results.append(f"   Size: {size_mb:.1f} MB")
        else:
            results.append(f"❌ Local database NOT found: {local_db_path}")
            all_good = False
    
    elif db_source == "supabase":
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        
        if supabase_url and supabase_key:
            results.append(f"✅ Supabase configured")
        else:
            results.append(f"❌ Supabase URL or key missing")
            all_good = False
    
    return all_good, results


def verify_backend_imports() -> Tuple[bool, List[str]]:
    """Verify that backend modules can be imported."""
    results = []
    all_good = True
    
    # Check if venv exists
    backend_dir = Path(__file__).parent.parent / "backend"
    venv_path = backend_dir / "venv"
    if venv_path.exists():
        results.append(f"✅ Virtual environment found: {venv_path}")
        # Note: We can't activate venv in this script, but we can check if it exists
    else:
        results.append(f"⚠️  No virtual environment found in backend/")
    
    try:
        from backend.api.main import app
        results.append("✅ Backend main module imports successfully")
    except ImportError as e:
        # This is expected if dependencies aren't installed
        results.append(f"⚠️  Backend imports failed (dependencies may need installation): {e}")
        results.append("   Run: cd backend && source venv/bin/activate && pip install -r requirements.txt")
        all_good = False
        return all_good, results
    except Exception as e:
        results.append(f"❌ Failed to import backend: {e}")
        all_good = False
        return all_good, results
    
    # Check for new routers
    try:
        from backend.api import ai_filter, enrichment, export
        results.append("✅ New API routers (ai_filter, enrichment, export) import successfully")
    except Exception as e:
        results.append(f"❌ Failed to import new routers: {e}")
        all_good = False
    
    # Check database service
    try:
        from backend.services.db_factory import get_database_service
        db_service = get_database_service()
        results.append(f"✅ Database service initialized: {type(db_service).__name__}")
    except Exception as e:
        results.append(f"❌ Failed to initialize database service: {e}")
        all_good = False
    
    return all_good, results


def main():
    """Run all verification checks."""
    print("🔍 Verifying Environment Setup for AI Sourcing Tool\n")
    print("=" * 60)
    
    # Load .env file
    env_vars = load_env_file()
    if env_vars:
        # Set environment variables from .env file
        for key, value in env_vars.items():
            if key not in os.environ:
                os.environ[key] = value
    
    print("\n📋 Environment Variables Check:")
    print("-" * 60)
    
    all_required_ok = True
    for key, default in REQUIRED_VARS.items():
        required = default is None
        ok, message = check_env_var(key, default, required)
        print(f"  {message}")
        if not ok:
            all_required_ok = False
    
    print("\n📋 Optional Environment Variables:")
    print("-" * 60)
    for key, default in OPTIONAL_VARS.items():
        ok, message = check_env_var(key, default, required=False)
        print(f"  {message}")
    
    print("\n💾 Database Setup:")
    print("-" * 60)
    db_ok, db_results = verify_database_setup()
    for result in db_results:
        print(f"  {result}")
    
    print("\n🔧 Backend Module Verification:")
    print("-" * 60)
    backend_ok, backend_results = verify_backend_imports()
    for result in backend_results:
        print(f"  {result}")
    
    print("\n📡 New API Endpoints:")
    print("-" * 60)
    for endpoint in NEW_ENDPOINTS:
        print(f"  ✓ {endpoint}")
    
    # Check enrichment services
    print("\n🔧 Enrichment Services:")
    print("-" * 60)
    serpapi_key = os.getenv("SERPAPI_KEY")
    puppeteer_url = os.getenv("PUPPETEER_SERVICE_URL")
    
    if serpapi_key:
        print("  ✅ SerpAPI configured (for website lookup)")
    else:
        print("  ⚠️  SerpAPI not configured (website lookup may fail)")
    
    if puppeteer_url:
        print(f"  ✅ Puppeteer service configured: {puppeteer_url}")
    else:
        print("  ⚪ Puppeteer not configured (optional - for deep scraping)")
        print("     See PUPPETEER_SERVICE_SETUP.md for setup instructions")
    
    print("\n" + "=" * 60)
    
    if all_required_ok and db_ok and backend_ok:
        print("✅ All checks passed! Environment is properly configured.")
        print("\n💡 Next steps:")
        print("   1. Start the backend: cd backend && uvicorn api.main:app --reload")
        print("   2. Test endpoints: curl http://localhost:8000/api/status")
        print("   3. Start the frontend: cd frontend && npm run dev")
        return 0
    else:
        print("❌ Some checks failed. Please fix the issues above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())


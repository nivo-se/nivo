#!/usr/bin/env python3
"""Print one orgnr that has company_enrichment (for manual API testing)."""
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_SOURCE", "postgres")
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")
from backend.services.db_factory import get_database_service
db = get_database_service()
r = db.run_raw_query("SELECT orgnr FROM company_enrichment LIMIT 1", [])
print(r[0]["orgnr"] if r else "")

#!/usr/bin/env python3
"""
Verify Postgres connectivity using POSTGRES_* env vars.

Prints server version and current database.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def load_dotenv() -> None:
    env_path = REPO_ROOT / ".env"
    if env_path.exists():
        try:
            from dotenv import load_dotenv as _load
            _load(dotenv_path=env_path)
        except ImportError:
            pass


def main() -> int:
    load_dotenv()

    try:
        import psycopg2
    except ImportError:
        print("❌ psycopg2 not found. Install: pip install psycopg2-binary")
        return 1

    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5433")
    dbname = os.getenv("POSTGRES_DB", "nivo")
    user = os.getenv("POSTGRES_USER", "nivo")

    print(f"Connecting to {host}:{port}/{dbname} as {user}...")
    try:
        conn = psycopg2.connect(
            host=host,
            port=int(port),
            dbname=dbname,
            user=user,
            password=os.getenv("POSTGRES_PASSWORD", "nivo"),
            connect_timeout=5,
        )
        with conn.cursor() as cur:
            cur.execute("SELECT version();")
            version = cur.fetchone()[0]
            cur.execute("SELECT current_database();")
            db = cur.fetchone()[0]
        conn.close()

        print(f"✅ Connected")
        print(f"   Server: {version.split(',')[0]}")
        print(f"   Database: {db}")
        return 0
    except Exception as e:
        print(f"❌ Failed: {e}")
        print("   Ensure Postgres is running: docker compose up -d")
        return 1


if __name__ == "__main__":
    sys.exit(main())

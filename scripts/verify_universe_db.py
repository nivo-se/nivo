#!/usr/bin/env python3
"""
Verify DB access for the Universe page: connection, tables, row counts, and API.
Run from repo root with .env loaded (same as backend).
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
            with env_path.open() as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def main() -> int:
    load_dotenv()

    try:
        import psycopg2
        from psycopg2 import extras
    except ImportError:
        print("❌ psycopg2 not found. Install: pip install psycopg2-binary")
        return 1

    url = os.getenv("DATABASE_URL")
    if not url:
        host = os.getenv("POSTGRES_HOST", "localhost")
        port = os.getenv("POSTGRES_PORT", "5433")
        db = os.getenv("POSTGRES_DB", "nivo")
        user = os.getenv("POSTGRES_USER", "nivo")
        pw = os.getenv("POSTGRES_PASSWORD", "nivo")
        url = f"postgresql://{user}:{pw}@{host}:{port}/{db}"
    display_url = f"{url.split('@')[1].split('/')[0]}/{url.split('/')[-1].split('?')[0]}"

    print("=== Universe DB verification ===\n")
    print(f"Target: {display_url}\n")

    try:
        conn = psycopg2.connect(url, connect_timeout=5)
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return 1

    ok = True
    with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
        # 1. Connection
        cur.execute("SELECT current_database(), current_user;")
        row = cur.fetchone()
        print(f"1. Connection: OK (db={row['current_database']}, user={row['current_user']})")

        # 2. public.companies
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'companies'
            );
        """)
        if not cur.fetchone()["exists"]:
            print("2. public.companies: ❌ Table does not exist")
            ok = False
        else:
            cur.execute("SELECT COUNT(*) AS n FROM public.companies;")
            n = cur.fetchone()["n"]
            print(f"2. public.companies: OK (rows = {n})")
            if n == 0:
                print("   ⚠️  Table is empty — Universe will show no companies. Load data (e.g. migrate_sqlite_to_postgres).")
                ok = False

        # 3. coverage_metrics view
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.views
                WHERE table_schema = 'public' AND table_name = 'coverage_metrics'
            );
        """)
        if not cur.fetchone()["exists"]:
            print("3. coverage_metrics view: ❌ View does not exist (run migrations)")
            ok = False
        else:
            cur.execute("SELECT COUNT(*) AS n FROM coverage_metrics;")
            n = cur.fetchone()["n"]
            print(f"3. coverage_metrics view: OK (rows = {n})")

        # 4. Sample from coverage_metrics (what Universe uses)
        cur.execute("SELECT orgnr, name FROM coverage_metrics LIMIT 3;")
        rows = cur.fetchall()
        if rows:
            print("4. Sample from coverage_metrics:")
            for r in rows:
                print(f"   orgnr={r['orgnr']}, name={r['name'][:50] if r['name'] else None}...")
        else:
            print("4. Sample: (no rows)")

        # 5. Optional tables
        for tbl in ("financials", "company_kpis", "ai_profiles"):
            cur.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = %s
                );
            """, (tbl,))
            exists = cur.fetchone()["exists"]
            if exists:
                cur.execute(f"SELECT COUNT(*) AS n FROM public.{tbl};")
                n = cur.fetchone()["n"]
                print(f"5. {tbl}: OK (rows = {n})")
            else:
                print(f"5. {tbl}: missing")

    conn.close()

    # 6. Backend API (which app is on 8000?)
    print("\n6. Backend API:")
    base = os.getenv("VITE_API_BASE_URL", "http://localhost:8000").rstrip("/")
    try:
        import urllib.request
        import json
        req = urllib.request.Request(f"{base}/health", method="GET")
        with urllib.request.urlopen(req, timeout=3) as r:
            body = json.loads(r.read().decode())
            service = body.get("service", "")
            if "Deep Research" in service:
                print(f"   Health: OK — but wrong backend: '{service}'")
                print("   ⚠️  Universe needs the full Nivo Intelligence API (backend.api.main), not the Deep Research–only app.")
                print("   Stop the current process on 8000 and run: ./scripts/start-backend.sh")
                ok = False
            else:
                print(f"   Health: OK ({base}) — {service}")
    except Exception as e:
        print(f"   Health: not reachable — {e}")
        print("   Start backend: ./scripts/start-backend.sh")
        ok = False

    try:
        import urllib.request
        import json
        req = urllib.request.Request(
            f"{base}/api/coverage/snapshot",
            method="GET",
            headers={"Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as r:
            data = json.loads(r.read().decode())
            total = data.get("total_companies", 0)
            print(f"   /api/coverage/snapshot: total_companies = {total}")
            if total == 0 and ok:
                print("   ⚠️  API reports 0 companies — DB may be empty or backend using different DB.")
    except Exception as e:
        print(f"   /api/coverage/snapshot: failed — {e}")
        if "404" in str(e):
            print("   ⚠️  404 = Universe/coverage routes not mounted. Use full backend: ./scripts/start-backend.sh")
        ok = False

    print("\n" + ("✅ Verification done (fix empty companies if Universe should show data)." if ok else "❌ Fix issues above (empty companies = load data)."))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

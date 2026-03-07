#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Load .env if present
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

URL="${DATABASE_URL:-postgresql://nivo:nivo@localhost:5433/nivo}"
echo "Applying Deep Research migration to: ${URL%%@*}@***"

if command -v psql >/dev/null 2>&1; then
  psql "$URL" -f database/migrations/024_deep_research_persistence.sql -v ON_ERROR_STOP=1
else
  DATABASE_URL="$URL" python3 - <<'PY'
import os
from pathlib import Path
import psycopg2

sql = Path("database/migrations/024_deep_research_persistence.sql").read_text(encoding="utf-8")
conn = psycopg2.connect(os.environ["DATABASE_URL"], connect_timeout=10)
try:
    with conn:
        with conn.cursor() as cur:
            cur.execute(sql)
finally:
    conn.close()
PY
fi

echo "Deep Research migration applied."


#!/usr/bin/env bash
# Diagnostic script for Universe "0 rows" issue.
# Run from project root. Requires: psql, curl.
# Usage: ./scripts/diagnose_universe_zero_rows.sh

set -e

DB_URL="${DATABASE_URL:-postgresql://nivo:nivo@localhost:5433/nivo}"
API_BASE="${VITE_API_BASE_URL:-http://localhost:8000}"

echo "=== 1) DB: coverage_metrics row counts ==="
psql "$DB_URL" -c "SELECT count(*) AS total FROM coverage_metrics;"
psql "$DB_URL" -c "SELECT count(*) AS has_ai_profile_false FROM coverage_metrics WHERE has_ai_profile = false;"

echo ""
echo "=== 2A) API: filters taxonomy ==="
curl -s -w "\nHTTP %{http_code}\n" --max-time 10 "$API_BASE/api/universe/filters" | head -20

echo ""
echo "=== 2B) API: query with no filters (should return rows) ==="
curl -s -w "\nHTTP %{http_code}\n" --max-time 15 -X POST "$API_BASE/api/universe/query" \
  -H "Content-Type: application/json" \
  -d '{"filters":[],"logic":"and","sort":{"by":"revenue_latest","dir":"desc"},"limit":5,"offset":0}'

echo ""
echo "=== 2C) API: query with has_ai_profile=false ==="
curl -s -w "\nHTTP %{http_code}\n" --max-time 15 -X POST "$API_BASE/api/universe/query" \
  -H "Content-Type: application/json" \
  -d '{"filters":[{"field":"has_ai_profile","op":"=","value":false,"type":"boolean"}],"logic":"and","sort":{"by":"data_quality_score","dir":"asc"},"limit":5,"offset":0}'

echo ""
echo "=== Done ==="

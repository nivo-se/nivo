#!/usr/bin/env bash
set -euo pipefail

TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-15}"

pick_api_base() {
  if [[ -n "${VITE_API_BASE_URL:-}" ]]; then
    echo "$VITE_API_BASE_URL"
    return
  fi

  for candidate in "http://127.0.0.1:8001" "http://127.0.0.1:8000"; do
    code="$(curl -sS --max-time 4 -o /dev/null -w "%{http_code}" "$candidate/health" || true)"
    if [[ "$code" != "000" ]]; then
      echo "$candidate"
      return
    fi
  done

  echo "http://127.0.0.1:8001"
}

API_BASE="$(pick_api_base)"
FAILED=0
STATUS_BODY=""
DB_INFO_BODY=""
STATUS_CODE_STATUS=""
STATUS_CODE_DB_INFO=""

echo "Using API base: $API_BASE"

request_endpoint() {
  local label="$1"
  local method="$2"
  local path="$3"
  local payload="${4:-}"
  local body_file
  body_file="$(mktemp)"

  local code
  if [[ "$method" == "POST" ]]; then
    code="$(curl -sS --max-time "$TIMEOUT_SECONDS" -o "$body_file" -w "%{http_code}" \
      -X POST "$API_BASE$path" \
      -H "Content-Type: application/json" \
      -d "$payload" || true)"
  else
    code="$(curl -sS --max-time "$TIMEOUT_SECONDS" -o "$body_file" -w "%{http_code}" \
      -X "$method" "$API_BASE$path" || true)"
  fi

  local body
  body="$(cat "$body_file")"
  rm -f "$body_file"

  echo
  echo "[$label] $method $path"
  echo "status: $code"
  echo "body:"
  echo "$body"

  if [[ "$path" == "/api/status" ]]; then
    STATUS_BODY="$body"
    STATUS_CODE_STATUS="$code"
  fi
  if [[ "$path" == "/api/db/info" ]]; then
    DB_INFO_BODY="$body"
    STATUS_CODE_DB_INFO="$code"
  fi

  if [[ "$code" == "401" ]]; then
    echo "AUTH REQUIRED"
    return
  fi

  if [[ "$code" == "200" ]]; then
    return
  fi

  echo "ERROR: unexpected status for $path"
  FAILED=1
}

request_endpoint "health" GET "/health"
request_endpoint "status" GET "/api/status"
request_endpoint "capabilities" GET "/api/status/capabilities"
request_endpoint "db-info" GET "/api/db/info"
request_endpoint "universe-query" POST "/api/universe/query" '{"filters":[],"logic":"and","limit":5,"offset":0,"sort":{"by":"data_quality_score","dir":"asc"}}'
request_endpoint "lists" GET "/api/lists?scope=all"
request_endpoint "prospects" GET "/api/prospects?scope=team"
request_endpoint "analysis-runs" GET "/api/analysis/runs?limit=5"

extract_db_source() {
  local body="$1"
  printf '%s' "$body" | sed -n 's/.*"database_source"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1
}

DB_SOURCE="$(extract_db_source "$DB_INFO_BODY")"
if [[ -z "$DB_SOURCE" ]]; then
  DB_SOURCE="$(printf '%s' "$STATUS_BODY" | sed -n 's/.*"db_source"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
fi

if [[ -n "$DB_SOURCE" ]]; then
  echo
  echo "Detected database_source: $DB_SOURCE"
  if [[ "$DB_SOURCE" != "postgres" ]]; then
    echo "ERROR: expected database_source=postgres"
    FAILED=1
  fi
else
  if [[ "$STATUS_CODE_DB_INFO" == "401" && "$STATUS_CODE_STATUS" == "401" ]]; then
    echo
    echo "DB source check skipped (AUTH REQUIRED)"
  else
    echo
    echo "ERROR: could not determine database_source from /api/db/info or /api/status"
    FAILED=1
  fi
fi

if [[ "$FAILED" -ne 0 ]]; then
  echo
  echo "Smoke result: FAILED"
  exit 2
fi

echo

echo "Smoke result: PASS (all required endpoints returned 200 or 401)"
exit 0

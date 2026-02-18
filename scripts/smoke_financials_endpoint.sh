#!/usr/bin/env bash
# Smoke test for GET /api/companies/{orgnr}/financials.
# Ensures the endpoint returns 200 and does not return Postgres "ambiguous column" errors.
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
echo "Using API base: $API_BASE"

# Prefer orgnr from env; otherwise try to get one from universe (first row)
ORGNR="${SMOKE_FINANCIALS_ORGNR:-}"
if [[ -z "$ORGNR" ]]; then
  BODY="$(curl -sS --max-time "$TIMEOUT_SECONDS" -X POST "$API_BASE/api/universe/query" \
    -H "Content-Type: application/json" \
    -d '{"filters":[],"logic":"and","limit":1,"offset":0,"sort":{"by":"data_quality_score","dir":"asc"}}' || true)"
  if command -v jq &>/dev/null; then
    ORGNR="$(printf '%s' "$BODY" | jq -r '.rows[0].orgnr // empty')"
  fi
fi
# Fallback orgnr if no universe data (endpoint should still return 200 with count 0)
ORGNR="${ORGNR:-5562642362}"

echo
echo "[financials] GET /api/companies/$ORGNR/financials"
RESPONSE="$(curl -sS --max-time "$TIMEOUT_SECONDS" -w "\n%{http_code}" "$API_BASE/api/companies/$ORGNR/financials" || true)"
HTTP_CODE="$(printf '%s' "$RESPONSE" | tail -n1)"
BODY="$(printf '%s' "$RESPONSE" | sed '$d')"

echo "status: $HTTP_CODE"
echo "body (first 500 chars):"
printf '%s' "$BODY" | head -c 500
echo

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "ERROR: expected 200, got $HTTP_CODE"
  exit 2
fi

if printf '%s' "$BODY" | grep -q "ambiguous"; then
  echo "ERROR: response contains 'ambiguous' (Postgres column ambiguity)"
  exit 2
fi

# Basic shape: expect .financials array and .count
if command -v jq &>/dev/null; then
  COUNT="$(printf '%s' "$BODY" | jq -r '.count // empty')"
  if [[ "$COUNT" != "" ]]; then
    echo "count: $COUNT"
    if [[ "$COUNT" -ge 1 ]]; then
      FIRST="$(printf '%s' "$BODY" | jq -r '.financials[0] // empty')"
      if [[ -n "$FIRST" ]]; then
        YEAR="$(printf '%s' "$FIRST" | jq -r '.year // empty')"
        PERIOD="$(printf '%s' "$FIRST" | jq -r '.period // empty')"
        if [[ -z "$YEAR" && -z "$PERIOD" ]]; then
          echo "WARN: first row missing year/period (optional check)"
        fi
      fi
    fi
  fi
fi

echo
echo "Smoke result: PASS (financials endpoint returned 200, no ambiguous error)"
exit 0

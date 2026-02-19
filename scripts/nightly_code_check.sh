#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILURES=0
WARNINGS=0

declare -a RESULTS

run_check() {
  local name="$1"
  local cmd="$2"
  echo ""
  echo "==> $name"
  if bash -lc "$cmd"; then
    RESULTS+=("PASS|$name")
    echo -e "${GREEN}PASS${NC}: $name"
  else
    RESULTS+=("FAIL|$name")
    echo -e "${RED}FAIL${NC}: $name"
    FAILURES=$((FAILURES + 1))
  fi
}

run_warn_check() {
  local name="$1"
  local cmd="$2"
  echo ""
  echo "==> $name"
  if bash -lc "$cmd"; then
    RESULTS+=("PASS|$name")
    echo -e "${GREEN}PASS${NC}: $name"
  else
    RESULTS+=("WARN|$name")
    echo -e "${YELLOW}WARN${NC}: $name"
    WARNINGS=$((WARNINGS + 1))
  fi
}

PY_BIN="backend/.venv/bin/python"
if [[ ! -x "$PY_BIN" ]]; then
  PY_BIN="python3"
fi

run_check "Naming guardrail: no figma naming" "./scripts/no_figma_naming.sh"
run_check "Naming guardrail: no compatClient imports" "./scripts/no_compat_imports.sh"
run_check "Frontend typecheck" "cd frontend && npx tsc --noEmit"
run_check "Frontend build" "cd frontend && npm run build"
run_warn_check "Frontend lint" "cd frontend && npm run lint"
run_check "API smoke endpoints" "./scripts/smoke_api_endpoints.sh"
run_check "Frontend service smoke" "$PY_BIN scripts/smoke_frontend_services.py"
run_check "Financials endpoint smoke" "./scripts/smoke_financials_endpoint.sh"

run_warn_check "AppleDouble artifact scan (tracked files)" "! git ls-files | rg -n '(^|/)\\._[^/]+$'"
run_warn_check "Legacy localhost:3000 endpoint scan" "! rg -n 'localhost:3000/api' frontend/src --glob '!**/node_modules/**'"

echo ""
echo "===== Nightly Check Summary ====="
for item in "${RESULTS[@]}"; do
  status="${item%%|*}"
  name="${item#*|}"
  case "$status" in
    PASS) echo -e "${GREEN}[PASS]${NC} $name" ;;
    WARN) echo -e "${YELLOW}[WARN]${NC} $name" ;;
    FAIL) echo -e "${RED}[FAIL]${NC} $name" ;;
  esac
done

echo ""
echo "Failures: $FAILURES"
echo "Warnings: $WARNINGS"

if [[ $FAILURES -gt 0 ]]; then
  exit 2
fi

exit 0

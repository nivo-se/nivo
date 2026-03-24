#!/usr/bin/env bash
set -euo pipefail

if command -v rg >/dev/null 2>&1; then
  search_cmd=(rg -n "compatClient" frontend/src)
else
  search_cmd=(grep -Rni "compatClient" frontend/src)
fi

if "${search_cmd[@]}"; then
  echo "Error: compatibility client imports still present in frontend/src"
  exit 1
fi

echo "OK: no compatClient imports in frontend/src"

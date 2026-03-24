#!/usr/bin/env bash
set -euo pipefail

if command -v rg >/dev/null 2>&1; then
  search_cmd=(rg -n "(?i)figma" frontend/src)
else
  search_cmd=(grep -Rni "figma" frontend/src)
fi

if "${search_cmd[@]}"; then
  echo "Error: legacy 'figma' naming found in frontend/src"
  exit 1
fi

echo "OK: no legacy 'figma' naming found in frontend/src"

#!/usr/bin/env bash
set -euo pipefail

if rg -n "(?i)figma" frontend/src; then
  echo "Error: legacy 'figma' naming found in frontend/src"
  exit 1
fi

echo "OK: no legacy 'figma' naming found in frontend/src"

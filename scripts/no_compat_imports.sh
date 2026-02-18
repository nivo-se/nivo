#!/usr/bin/env bash
set -euo pipefail

if rg -n "compatClient" frontend/src; then
  echo "Error: compatibility client imports still present in frontend/src"
  exit 1
fi

echo "OK: no compatClient imports in frontend/src"

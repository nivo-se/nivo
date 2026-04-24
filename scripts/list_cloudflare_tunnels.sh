#!/usr/bin/env bash
# List Cloudflare tunnels for the account (name + id). Needs token + account only.
#
#   export CLOUDFLARE_API_TOKEN=...
#   export CF_ACCOUNT_ID=...
#   # or use .env.cloudflare.local / CF_ENV_FILE like apply_crm_cloudflare_ingress.sh
#   ./scripts/list_cloudflare_tunnels.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${CF_ENV_FILE:-$REPO_ROOT/.env.cloudflare.local}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"
: "${CF_ACCOUNT_ID:?set CF_ACCOUNT_ID}"

curl -fsS "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
| jq -r '.result[]? | "\(.id)\t\(.name)\t\(.status // "")"'

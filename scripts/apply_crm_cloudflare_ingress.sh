#!/usr/bin/env bash
# Remotely prepend a /crm -> Node (3001) ingress rule on a token-managed Cloudflare tunnel.
# Requires: Account Zero Trust "Cloudflare Tunnel" Edit (or Account equivalent).
#
#   export CLOUDFLARE_API_TOKEN=...
#   export CF_ACCOUNT_ID=...        # Account home → right sidebar, or API token "Resources"
#   export CF_TUNNEL_ID=...         # Tunnel UUID (Zero Trust → Tunnels → tunnel → copy ID)
#   # optional:
#   #   CF_CRM_HOSTNAME=api.nivogroup.se
#   #   CF_CRM_NODE_SERVICE=http://127.0.0.1:3001
#   ./scripts/apply_crm_cloudflare_ingress.sh
#
# Optional: put secrets in repo root .env.cloudflare.local (gitignored) or set CF_ENV_FILE:
#   CF_ENV_FILE=~/secrets/cf.env ./scripts/apply_crm_cloudflare_ingress.sh
#
# Idempotent: if the first ingress rule already matches hostname + path /crm + service, exits 0.
# See docs/CRM_CLOUDFLARE_ROUTE.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${CF_ENV_FILE:-$REPO_ROOT/.env.cloudflare.local}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  echo "Loaded: $ENV_FILE" >&2
fi

: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN or add to .env.cloudflare.local}"
: "${CF_ACCOUNT_ID:?set CF_ACCOUNT_ID}"
: "${CF_TUNNEL_ID:?set CF_TUNNEL_ID}"

API_HOSTNAME="${CF_CRM_HOSTNAME:-api.nivogroup.se}"
NODE_SERVICE="${CF_CRM_NODE_SERVICE:-http://127.0.0.1:3001}"
API_URL="https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${CF_TUNNEL_ID}/configurations"

GET_RESP=$(curl -fsS "$API_URL" -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}")

if [[ $(echo "$GET_RESP" | jq -r '.success') != "true" ]]; then
  echo "GET tunnel configuration failed:" >&2
  echo "$GET_RESP" | jq . >&2
  exit 1
fi

# Build new config JSON; prepend /crm rule, drop any prior same-host /crm rules to avoid duplicates
BODY=$(echo "$GET_RESP" | jq \
  --arg h "$API_HOSTNAME" \
  --arg s "$NODE_SERVICE" '
  .result.config as $cfg
  | ($cfg // {}) as $cfg2
  | ($cfg2.ingress // []) as $ing
  | ($ing | map(select(
      (.hostname != $h) or (
        ( .path // "" ) | test("^/crm") | not
      )
    ))) as $rest
  | $cfg2
  | .ingress = ([{ hostname: $h, path: "/crm", service: $s }] + $rest)
  | { config: . }
')

if echo "$GET_RESP" | jq -e --arg h "$API_HOSTNAME" --arg s "$NODE_SERVICE" \
  '(.result.config.ingress // [])[0]
    | . != null
    and .hostname == $h
    and ((.path // "") | startswith("/crm"))
    and .service == $s' >/dev/null
then
  echo "Already configured: first ingress is ${API_HOSTNAME} path /crm* -> ${NODE_SERVICE}. Nothing to do."
  exit 0
fi

PUT_RESP=$(curl -fsS -X PUT "$API_URL" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$BODY")

if [[ $(echo "$PUT_RESP" | jq -r '.success') != "true" ]]; then
  echo "PUT tunnel configuration failed:" >&2
  echo "$PUT_RESP" | jq . >&2
  exit 1
fi

echo "Updated tunnel ingress. Wait ~1 minute, then: curl -sS https://${API_HOSTNAME}/crm/email-config | head -c 200"
echo "$PUT_RESP" | jq -r '.result.config.ingress[0:3]'

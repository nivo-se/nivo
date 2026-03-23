#!/usr/bin/env bash
# Screening API smoke: status → context → profiles → campaign → Layer 0 → candidates.
# Usage: API_BASE=http://127.0.0.1:8000 ./scripts/smoke_screening_api.sh
set -euo pipefail
export BASE="${API_BASE:-http://127.0.0.1:8000}"

echo "=== GET /api/status ==="
curl -sf "${BASE}/api/status" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('db_ok')==True; print('db_ok', d.get('db_ok'), 'companies', d.get('counts',{}).get('companies'))"

echo "=== GET /api/screening/context ==="
curl -sf "${BASE}/api/screening/context" | python3 -m json.tool

echo "=== POST campaign + Layer 0 + candidates ==="
python3 <<'PY'
import json, os, urllib.request
BASE = os.environ["BASE"]

def req(method, path, data=None):
    url = BASE + path
    body = json.dumps(data).encode() if data is not None else None
    h = {"Content-Type": "application/json", "Accept": "application/json"}
    r = urllib.request.Request(url, data=body, headers=h, method=method)
    with urllib.request.urlopen(r, timeout=300) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw else {}

prof = req("GET", "/api/screening/profiles?scope=all")
items = prof.get("items") or []
assert items, "no profiles"
pid = items[0]["id"]
print("profile", items[0].get("name"), pid)
created = req("POST", "/api/screening/campaigns", {
    "name": "Smoke test",
    "profileId": pid,
    "params": {"layer0Limit": 10},
})
cid = created["campaignId"]
started = req("POST", f"/api/screening/campaigns/{cid}/start", {})
assert started.get("ok") is True, started
print("layer0", started.get("layer0"))
cand = req("GET", f"/api/screening/campaigns/{cid}/candidates?limit=3")
assert (cand.get("total") or 0) > 0
print("candidates_total", cand.get("total"), "sample", cand.get("rows", [])[:1])
print("SMOKE OK")
PY

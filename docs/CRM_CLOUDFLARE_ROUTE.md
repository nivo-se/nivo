# Route `/crm` through Cloudflare Tunnel to the Node enhanced server

The **Vercel** build is static: the browser must call a **real** Node process for `/crm/*` (Gmail, CRM API). On the **miniserver**, that process is `nivo-enhanced` (port **3001** by default). **FastAPI** stays on **8000**.

Today, if `https://api.nivogroup.se/crm/...` returns `401 {"error":"unauthorized"}`, traffic is still hitting **FastAPI** (JWT on `/api`-style protection), not Node — the tunnel is sending **all** of `api.nivogroup.se` to `localhost:8000` only.

## 1. Run Node on the tunnel host (done on miniserver)

- User systemd: `nivo-enhanced` → `http://127.0.0.1:3001`  
- Example unit: `config/systemd/nivo-enhanced.user.service.example`  
- Check: `curl -sS http://127.0.0.1:3001/crm/email-config` → JSON with `"success":true`.

## 2. Cloudflare: add a path route **before** the catch‑all to 8000

Your tunnel is often managed with a **token** (`cloudflared tunnel run --token …`), so ingress is edited in **Zero Trust**, not a local `cloudflared.yml`.

1. **Cloudflare** → **Zero Trust** (or **Networks** → **Tunnels**).
2. Open the tunnel that serves `api.nivogroup.se` (e.g. **internal-api**).
3. **Public hostnames** (or “Published applications”) → **Add** (or **Configure**).
4. Add a rule that is **more specific** than the generic API rule:
   - **Hostname:** `api.nivogroup.se`
   - **Path:** `/crm` (if the UI supports a path, use `/crm` or `Prefix` `/crm` — some UIs use `/crm*`)
   - **Service / URL:** `http://127.0.0.1:3001` (or `http://localhost:3001`)
5. Ensure the rule that sends **the rest** of `api.nivogroup.se` to `http://127.0.0.1:8000` (FastAPI) is still present and ordered **after** the `/crm` rule.

If your dashboard **does not** support path-based rules on the same hostname, add a second hostname, e.g. `crm.nivogroup.se` → `http://127.0.0.1:3001`, and set in **Vercel** `VITE_CRM_BASE_URL=https://crm.nivogroup.se` (no trailing slash). Add that hostname in DNS / tunnel the same way as `api`.

## 3. Vercel (build-time)

When `https://api.nivogroup.se/crm/email-config` returns the **Node** JSON (same check as local curl, but public):

- `VITE_CRM_BASE_URL=https://api.nivogroup.se`  
  (or `https://crm.nivogroup.se` if you use a separate hostname)

Redeploy the frontend so Vite bakes the variable in.

## 4. CORS

The enhanced server uses permissive CORS. If you still see browser blocks, add your app origin to FastAPI/Node env as you already do for the API. For a dedicated `crm.*` host, add `https://app.nivogroup.se` (and `www` if used) to `CORS_ORIGINS` on the **Node** side if you tighten CORS later.

## 5. Optional: Cloudflare API (automated)

If you use an API token with **Account** → **Cloudflare Tunnel** **Edit** permission, you can update tunnel ingress via API instead of the UI. The account ID and tunnel UUID are in the Cloudflare dashboard. Do not commit tokens; set `CLOUDFLARE_API_TOKEN` only in CI or your shell for one-off runs.

- **Repo script:** `scripts/apply_crm_cloudflare_ingress.sh` (reads current ingress, prepends `hostname` + `path: /crm` → `http://127.0.0.1:3001`, idempotent). Requires `CF_ACCOUNT_ID` and `CF_TUNNEL_ID`.
- **Local env file (recommended):** copy `.env.cloudflare.local.example` to **`.env.cloudflare.local`** (gitignored), set the three variables, then run the script from the repo root. Or set **`CF_ENV_FILE=/path/to/your.env`** if the values live in another file.
- **Find tunnel UUID:** `scripts/list_cloudflare_tunnels.sh` (token + account only; prints `id`, `name`, `status` per tunnel).
- **Reference:** [Update tunnel configuration](https://developers.cloudflare.com/api/resources/zero_trust/subresources/tunnels/subresources/cloudflared/subresources/configurations/methods/update/).

## Verify from the public internet

```bash
curl -sS "https://api.nivogroup.se/crm/email-config" | head -c 200
```

You should see `"success":true` and `gmail_oauth_…` — **not** `{"error":"unauthorized"}` from FastAPI.

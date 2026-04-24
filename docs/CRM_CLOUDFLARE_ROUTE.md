# Route `/crm` through Cloudflare Tunnel to the Node enhanced server

The **Vercel** build is static: the browser must call a **real** Node process for `/crm/*` (Gmail, CRM API). On the **miniserver**, that process is `nivo-enhanced` (port **3001** by default). **FastAPI** stays on **8000**.

Today, if `https://api.nivogroup.se/crm/...` returns `401 {"error":"unauthorized"}`, traffic is still hitting **FastAPI** (JWT on `/api`-style protection), not Node — the tunnel is sending **all** of `api.nivogroup.se` to `localhost:8000` only.

## 1. Run Node on the tunnel host (done on miniserver)

- User systemd: `nivo-enhanced` → `http://127.0.0.1:3001`  
- Example unit: `config/systemd/nivo-enhanced.user.service.example`  
- Check: `curl -sS http://127.0.0.1:3001/crm/email-config` → JSON with `"success":true`.

## 2. Cloudflare: public hostname `crm.nivogroup.se` → Node (recommended if `api` is one line to 8000)

You keep **`api.nivogroup.se`** as-is (FastAPI only). You add a **second** public hostname on the same tunnel pointing at the Node process.

1. **Zero Trust** → **Networks** → **Tunnels** → open **internal-api** (or your connector).
2. **Public hostnames** (or **Routes** / “Published application routes”) → **Add a public hostname** (or **Add**).
3. **Subdomain / hostname:** `crm.nivogroup.se` (some UIs: subdomain `crm`, domain `nivogroup.se`).
4. **Path:** leave **empty** (whole host goes to this service) unless you use a sub-path (you should not need one).
5. **Service** / **URL:** `http://127.0.0.1:3001` (same host where `nivo-enhanced` runs — not port 8000).
6. Save. Cloudflare usually creates/updates the **DNS** record for `crm` automatically; in **nivogroup.se** → **DNS**, confirm a **CNAME** for `crm` → your tunnel (proxied) if something is missing.

**Gmail OAuth (miniserver + Google Cloud):** the callback path is under the same Node app, e.g. `https://crm.nivogroup.se/crm/gmail/oauth/callback`. On the server `.env` set `GOOGLE_OAUTH_REDIRECT_URI` to that **https** URL. In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → your OAuth 2.0 client → **Authorized redirect URIs** — add the same URL, then **restart** `nivo-enhanced` or reload env.

**Vercel:** `VITE_CRM_BASE_URL=https://crm.nivogroup.se` (no trailing slash) and **redeploy**.

**Check:** `curl -sS "https://crm.nivogroup.se/crm/email-config" | head -c 200` should show Node JSON with `"success":true`.

## 3. Cloudflare: alternative — path on `api` **before** the rule to 8000

Your tunnel is often managed with a **token** (`cloudflared tunnel run --token …`), so ingress is edited in **Zero Trust**, not a local `cloudflared.yml`.

1. **Cloudflare** → **Zero Trust** (or **Networks** → **Tunnels**).
2. Open the tunnel that serves `api.nivogroup.se` (e.g. **internal-api**).
3. **Public hostnames** (or “Published applications”) → **Add** (or **Configure**).
4. Add a rule that is **more specific** than the generic API rule:
   - **Hostname:** `api.nivogroup.se`
   - **Path:** `/crm` (if the UI supports a path, use `/crm` or `Prefix` `/crm` — some UIs use `/crm*`)
   - **Service / URL:** `http://127.0.0.1:3001` (or `http://localhost:3001`)
5. Ensure the rule that sends **the rest** of `api.nivogroup.se` to `http://127.0.0.1:8000` (FastAPI) is still present and ordered **after** the `/crm` rule.

If you use path routing on `api` instead of `crm.nivogroup.se`, you do **not** need a second hostname, but the `/crm` rule must be **above** the `api` → 8000 rule.

## 4. Vercel (build-time)

- **Separate CRM host (section 2):** `VITE_CRM_BASE_URL=https://crm.nivogroup.se`
- **Path on `api` (section 3):** `VITE_CRM_BASE_URL=https://api.nivogroup.se`

Redeploy after changing. Use the same base you configured in Cloudflare.

## 5. CORS

The enhanced server uses permissive CORS. If you still see browser blocks, add your app origin to FastAPI/Node env as you already do for the API. For a dedicated `crm.*` host, add `https://app.nivogroup.se` (and `www` if used) to `CORS_ORIGINS` on the **Node** side if you tighten CORS later.

## 6. Optional: Cloudflare API (automated)

If you use an API token with **Account** → **Cloudflare Tunnel** **Edit** permission, you can update tunnel ingress via API instead of the UI. The account ID and tunnel UUID are in the Cloudflare dashboard. Do not commit tokens; set `CLOUDFLARE_API_TOKEN` only in CI or your shell for one-off runs.

- **Repo script:** `scripts/apply_crm_cloudflare_ingress.sh` (reads current ingress, prepends `hostname` + `path: /crm` → `http://127.0.0.1:3001`, idempotent). Requires `CF_ACCOUNT_ID` and `CF_TUNNEL_ID`.
- **Local env file (recommended):** copy `.env.cloudflare.local.example` to **`.env.cloudflare.local`** (gitignored), set the three variables, then run the script from the repo root. Or set **`CF_ENV_FILE=/path/to/your.env`** if the values live in another file.
- **Find tunnel UUID:** `scripts/list_cloudflare_tunnels.sh` (token + account only; prints `id`, `name`, `status` per tunnel).
- **Reference:** [Update tunnel configuration](https://developers.cloudflare.com/api/resources/zero_trust/subresources/tunnels/subresources/cloudflared/subresources/configurations/methods/update/).

## Verify from the public internet

After using **`crm.nivogroup.se`** (section 2):

```bash
curl -sS "https://crm.nivogroup.se/crm/email-config" | head -c 200
```

If you use **path on `api`** (section 3) instead, test `https://api.nivogroup.se/crm/email-config` the same way.

You should see `"success":true` and `gmail_oauth_…` from **Node** — **not** `{"error":"unauthorized"}` from FastAPI.

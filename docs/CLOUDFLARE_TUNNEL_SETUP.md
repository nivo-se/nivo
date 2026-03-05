# Cloudflare Tunnel setup for Nivo

Use a **Cloudflare Tunnel** to expose your Nivo API (and optionally the frontend) from the Mac mini to the internet without opening firewall ports or exposing your home/office IP. Traffic goes: **User → Cloudflare → tunnel (cloudflared) → your API on localhost**.

**Already installed and created a tunnel?** See [CLOUDFLARE_TUNNEL_VERIFICATION.md](CLOUDFLARE_TUNNEL_VERIFICATION.md) for a verification checklist and the exact commands for your setup (tunnel name `internal-api`, correct `--config` order).

---

## Prerequisites

- A **Cloudflare account** and a **domain** you manage (or a subdomain) with DNS **on Cloudflare** (nameservers pointed to Cloudflare).
- The machine that runs the tunnel (e.g. the Mac mini) must be able to reach your API. If the API runs in Docker on the mini, use `http://localhost:8000` from the host.

---

## 1. Install cloudflared

**On macOS (Mac mini or your Mac):**

```bash
brew install cloudflared
```

**On Linux (e.g. if you run the tunnel on a Linux server):**

- [Cloudflare package repo](https://pkg.cloudflare.com/) or download from [GitHub Releases](https://github.com/cloudflare/cloudflared/releases).

**Check:**

```bash
cloudflared --version
```

---

## 2. Log in to Cloudflare

This opens a browser and saves a cert for your account so `cloudflared` can create and run tunnels.

```bash
cloudflared tunnel login
```

When prompted, pick the **domain** (e.g. `nivogroup.se`) you want to use for the tunnel. A certificate file is written to `~/.cloudflared/` (e.g. `cert.pem`).

---

## 3. Create a tunnel

Create a named tunnel (e.g. `nivo`). This prints a **Tunnel ID** (UUID) and creates a credentials file under `~/.cloudflared/`.

```bash
cloudflared tunnel create nivo
```

Example output:

```
Created tunnel nivo with id abc12345-1234-1234-1234-123456789012
```

Credentials are stored at:

- **macOS/Linux:** `~/.cloudflared/<TUNNEL_ID>.json`

You will use the **tunnel name** (`nivo`) and **Tunnel ID** in the next steps.

---

## 4. Create the config file

Create a config file that tells the tunnel which hostnames to accept and where to send traffic. Use the example in this repo and adjust hostnames and ports.

**Copy the example:**

```bash
cp config/cloudflared-example.yml config/cloudflared.yml
```

Edit `config/cloudflared.yml`:

1. Set **`tunnel`** to your **Tunnel ID** (from step 3).
2. Set **`credentials-file`** to the path of the JSON file (e.g. `~/.cloudflared/<TUNNEL_ID>.json`). Use an absolute path or a path relative to where you run `cloudflared`.
3. Set **`hostname`** under `ingress` to your real hostname(s), e.g.:
   - `api.nivogroup.se` → API (required)
   - `app.nivogroup.se` → frontend (optional; only if you serve the app through the same tunnel)

**Important:** The last ingress rule must be a catch-all (e.g. `service: http_status:404`). Do not remove it.

Example for **API only** (frontend hosted elsewhere, e.g. Vercel):

```yaml
ingress:
  - hostname: api.nivogroup.se
    service: http://localhost:8000
  - service: http_status:404
```

Example for **API + frontend** on the same machine (API on 8000, frontend dev server on 5173 or static server on 8080):

```yaml
ingress:
  - hostname: api.nivogroup.se
    service: http://localhost:8000
  - hostname: app.nivogroup.se
    service: http://localhost:5173
  - service: http_status:404
```

If the API runs in Docker on the same host, `localhost:8000` is correct (Docker binds 8000 to the host). If you run `cloudflared` in a container, use the Docker host IP or the `api` service name if on the same Docker network.

---

## 5. Route DNS to the tunnel

Tell Cloudflare to send traffic for your hostname(s) to this tunnel.

**Option A – CLI (one hostname per call):**

```bash
cloudflared tunnel route dns nivo api.nivogroup.se
# If you use a separate hostname for the app:
cloudflared tunnel route dns nivo app.nivogroup.se
```

**Option B – Dashboard:**

1. Zero Trust (or Cloudflare Dashboard) → **Networks** → **Tunnels** → select tunnel **nivo**.
2. Open the **Public Hostname** tab and add:
   - **Subdomain:** `api` (or full hostname), **Domain:** your zone, **Service type:** HTTP, **URL:** `localhost:8000`.
   - Repeat for `app` if needed.

After this, `api.nivogroup.se` (and optionally `app.nivogroup.se`) will resolve to Cloudflare and be routed through your tunnel.

---

## 6. Run the tunnel

From the project root (or the directory that contains your `config/cloudflared.yml`):

```bash
cloudflared tunnel --config config/cloudflared.yml run nivo
```

Use your **tunnel name** (e.g. `nivo` or `internal-api`), not the Tunnel ID. The `--config` flag must come right after `tunnel`. Leave this running (foreground). For production, run it as a service (see §9).

Test:

```bash
curl -s https://api.nivogroup.se/health
```

You should get the API health response. If you see 404 or a Cloudflare error, check hostname and ingress rules.

---

## 7. Backend and frontend configuration

**Backend (`.env` on the Mac mini):**

- **CORS:** Add your **frontend** origin so the browser allows API calls. If the app is at `https://app.nivogroup.se`:
  ```bash
  CORS_ORIGINS=https://app.nivogroup.se
  ```
  If the frontend is on Vercel or another domain, add that origin (comma-separated if you have several).
- **Auth0:** In the Auth0 Dashboard, add to your SPA:
  - **Allowed Callback URLs:** `https://app.nivogroup.se/auth/callback`
  - **Allowed Logout URLs:** `https://app.nivogroup.se`
  - **Allowed Web Origins:** `https://app.nivogroup.se`
- No need to change `AUTH0_DOMAIN` / `AUTH0_AUDIENCE`; they stay the same. The API is just reached at a new URL.

**Frontend (build-time / `.env`):**

- Set the API base URL to the tunnel URL:
  ```bash
  VITE_API_BASE_URL=https://api.nivogroup.se
  ```
- Rebuild the frontend if you use a production build, or restart the dev server with this env set.

After this, the app in the browser will call `https://api.nivogroup.se/api/...` and CORS will allow it.

---

## 8. Checklist

- [ ] Domain DNS is on Cloudflare.
- [ ] `cloudflared` installed and `cloudflared tunnel login` done.
- [ ] Tunnel created (`cloudflared tunnel create nivo`).
- [ ] `config/cloudflared.yml` has correct `tunnel`, `credentials-file`, and `ingress` hostnames and `localhost` ports.
- [ ] DNS routed to tunnel (`cloudflared tunnel route dns nivo api.nivogroup.se` [and `app.nivogroup.se` if used]).
- [ ] Tunnel running: `cloudflared tunnel run --config config/cloudflared.yml nivo`.
- [ ] `curl https://api.nivogroup.se/health` returns the API response.
- [ ] Backend `CORS_ORIGINS` includes the frontend origin (e.g. `https://app.nivogroup.se`).
- [ ] Auth0 SPA has callback/logout/origins for the frontend URL.
- [ ] Frontend `VITE_API_BASE_URL=https://api.nivogroup.se` and app can log in and call the API.

---

## 9. Run the tunnel as a service (recommended)

If you run `cloudflared tunnel run ...` in a terminal (including Cursor’s), the tunnel stops when you close that terminal. To keep it running after you close Cursor and across reboots, run it as a **macOS LaunchAgent**. See [RUN_SERVICES_PERSISTENTLY.md](RUN_SERVICES_PERSISTENTLY.md) for step-by-step setup (including creating the plist from your repo path and loading it).

**macOS (LaunchAgent):** Use the script in [RUN_SERVICES_PERSISTENTLY.md](RUN_SERVICES_PERSISTENTLY.md) §2 to create the plist from your repo path and `which cloudflared`, then:

```bash
launchctl load ~/Library/LaunchAgents/com.cloudflare.cloudflared-nivo.plist
```

To stop: `launchctl unload ~/Library/LaunchAgents/com.cloudflare.cloudflared-nivo.plist`

**Linux (systemd):** See [Cloudflare: Run as a service](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/#run-as-a-service).

---

## 10. Troubleshooting

| Issue | Check |
|-------|--------|
| `curl https://api.../health` times out or connection refused | Tunnel not running; wrong hostname in ingress; DNS not pointing to tunnel. |
| 404 on `/api/me` or other routes | Ingress forwards to the right port (8000). Our API routes live under `/api/*`; no path stripping needed. |
| CORS error in browser | Backend `CORS_ORIGINS` must include the exact frontend origin (e.g. `https://app.nivogroup.se`). Restart API after changing `.env`. |
| Auth0 “redirect_uri_mismatch” | Add the frontend URL (e.g. `https://app.nivogroup.se/auth/callback`) in Auth0 SPA settings. |
| Tunnel disconnects | Check `cloudflared` logs; ensure credentials file path and tunnel ID in config are correct. |

For more, see [Cloudflare Tunnel docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/).

# Run all local services so they keep running after closing Cursor

You run every command from **Cursor’s terminal**. If you start a process there and then close Cursor, that terminal session ends and any process running in it stops. To have **Postgres, API, Cloudflare tunnel, and (optionally) the frontend** still running after you close Cursor, run them in a way that does **not** depend on the terminal:

1. **Docker (Postgres + API)** — run with `docker compose up -d`. Containers run in the background and keep running after you close Cursor.
2. **Cloudflare tunnel** — run as a **macOS LaunchAgent**, not in a terminal. It will start at login and keep running.
3. **Frontend (Vite)** — optional: run as a second LaunchAgent if you want the app always available; otherwise start it from Cursor when you need it (`npm run dev`).

---

## 1. Postgres + API (Docker)

From the project root in Cursor’s terminal:

```bash
docker compose up -d --build
```

Containers run in the background. Closing Cursor does **not** stop them. To stop later:

```bash
docker compose down
```

To see logs:

```bash
docker compose logs -f api
```

---

## 2. Cloudflare tunnel (LaunchAgent)

If you run `cloudflared tunnel run ...` in Cursor’s terminal, it will stop when you close Cursor. Run it as a **LaunchAgent** instead so it keeps running.

### One-time setup

1. Install and configure the tunnel (login, create tunnel, `config/cloudflared.yml`) as in [CLOUDFLARE_TUNNEL_SETUP.md](CLOUDFLARE_TUNNEL_SETUP.md).

2. Find paths (run in Cursor terminal):

   ```bash
   which cloudflared
   # e.g. /opt/homebrew/bin/cloudflared
   ```

   Use the **absolute path** to your config file, e.g.:

   - This Mac: `/Users/jeppe/nivo-web/config/cloudflared.yml`
   - Mac mini: `/srv/nivo/config/cloudflared.yml`

3. Create the LaunchAgent plist (replace paths and tunnel name if different):

   ```bash
   # Replace REPO_ROOT with your actual path, e.g. /Users/jeppe/nivo-web or /srv/nivo
   REPO_ROOT="/Users/jeppe/nivo-web"

   cat > ~/Library/LaunchAgents/com.cloudflare.cloudflared-nivo.plist << EOF
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
     <key>Label</key>
     <string>com.cloudflare.cloudflared-nivo</string>
     <key>ProgramArguments</key>
  <array>
    <string>$(which cloudflared)</string>
    <string>tunnel</string>
    <string>--config</string>
    <string>${REPO_ROOT}/config/cloudflared.yml</string>
    <string>run</string>
    <string>internal-api</string>
  </array>
     <key>RunAtLoad</key>
     <true/>
     <key>KeepAlive</key>
     <true/>
     <key>StandardOutPath</key>
     <string>${REPO_ROOT}/logs/cloudflared.log</string>
     <key>StandardErrorPath</key>
     <string>${REPO_ROOT}/logs/cloudflared.err.log</string>
   </dict>
   </plist>
   EOF
   ```

   Create the logs directory so the agent can write to it:

   ```bash
   mkdir -p "$REPO_ROOT/logs"
   ```

4. Load and start the service (run in Cursor terminal):

   ```bash
   launchctl load ~/Library/LaunchAgents/com.cloudflare.cloudflared-nivo.plist
   ```

The tunnel now runs in the background and will start again after reboot. It does **not** stop when you close Cursor.

Use your actual tunnel name in the plist (e.g. `internal-api`). If you created a tunnel named `nivo`, use `nivo` instead of `internal-api` in the plist.

**Useful commands (run in Cursor terminal):**

```bash
# Stop the tunnel
launchctl unload ~/Library/LaunchAgents/com.cloudflare.cloudflared-nivo.plist

# Start again
launchctl load ~/Library/LaunchAgents/com.cloudflare.cloudflared-nivo.plist

# Check it's running
launchctl list | grep cloudflared
```

---

## 3. Frontend (optional) — run when needed or as a service

**Option A – Run when you need it (from Cursor)**

When you want to work on the app, run in Cursor’s terminal:

```bash
npm run dev
```

Closing Cursor will stop the dev server. Start it again next time you open the project.

**Option B – Always-on frontend (LaunchAgent)**

If you want the Vite dev server to keep running after closing Cursor (e.g. so the app is always available at `http://localhost:5173` or via the tunnel):

1. Find your repo root and `npm` path (run in Cursor terminal):

   ```bash
   pwd   # e.g. /Users/jeppe/nivo-web
   which npm
   ```

2. Create the LaunchAgent (replace `REPO_ROOT` and `NPM_PATH`):

   ```bash
   REPO_ROOT="/Users/jeppe/nivo-web"
   NPM_PATH="$(which npm)"

   mkdir -p "$REPO_ROOT/logs"

   cat > ~/Library/LaunchAgents/com.nivo.vite-dev.plist << EOF
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
     <key>Label</key>
     <string>com.nivo.vite-dev</string>
     <key>ProgramArguments</key>
     <array>
       <string>$NPM_PATH</string>
       <string>run</string>
       <string>dev</string>
     </array>
     <key>WorkingDirectory</key>
     <string>$REPO_ROOT</string>
     <key>RunAtLoad</key>
     <true/>
     <key>KeepAlive</key>
     <true/>
     <key>StandardOutPath</key>
     <string>${REPO_ROOT}/logs/vite-dev.log</string>
     <key>StandardErrorPath</key>
     <string>${REPO_ROOT}/logs/vite-dev.err.log</string>
   </dict>
   </plist>
   EOF
   ```

3. Load it:

   ```bash
   launchctl load ~/Library/LaunchAgents/com.nivo.vite-dev.plist
   ```

To stop: `launchctl unload ~/Library/LaunchAgents/com.nivo.vite-dev.plist`

**Note:** If you use nvm or another node version manager, the `npm` used in the terminal might not be the same as the one in the plist (which uses your default PATH at login). In that case, set `ProgramArguments` to the full path to the `npm` or `node` you want (e.g. under `~/.nvm/versions/node/...`).

---

## 4. Quick reference (all from Cursor terminal)

| Goal | Command |
|------|--------|
| Start Postgres + API (keeps running) | `docker compose up -d --build` |
| Stop Postgres + API | `docker compose down` |
| Start Cloudflare tunnel (once) | `launchctl load ~/Library/LaunchAgents/com.cloudflare.cloudflared-nivo.plist` |
| Stop tunnel | `launchctl unload ~/Library/LaunchAgents/com.cloudflare.cloudflared-nivo.plist` |
| Start frontend when needed | `npm run dev` |
| (Optional) Start frontend as service | Create plist as in §3 then `launchctl load ~/Library/LaunchAgents/com.nivo.vite-dev.plist` |

Add `logs/` to `.gitignore` so log files from the LaunchAgents are not committed.

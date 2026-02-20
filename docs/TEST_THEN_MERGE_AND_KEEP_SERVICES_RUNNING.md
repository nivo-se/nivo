# Test in branch, then merge — and keep services running after closing Cursor

All commands below are meant to be run from **Cursor’s terminal**. When you close Cursor, any process you started in that terminal will stop — **except** if you run services as described here.

---

## 1. Test first in this branch, then merge to main

- **Do your testing on the current branch** (e.g. `mini-setup`). Deploy or use the tunnel so the frontend hits `https://api.nivogroup.se` and run through your test list.
- **When tests pass**, merge this branch into `main` and deploy from `main` (or your usual production branch).
- **Summary:** Test in branch → merge to main when done. Do not merge to main before you’re done testing.

---

## 2. Keep services running after you close Cursor

If you only run things in Cursor’s terminal, closing Cursor will close the terminal and stop any process running in it. To keep **Postgres, API, and the Cloudflare tunnel** running after you close Cursor:

### Run these commands in Cursor’s terminal (once)

**A. Docker (Postgres + API)** — runs in the background and survives closing Cursor:

```bash
docker compose up -d --build
```

**B. Cloudflare tunnel** — if you run `cloudflared tunnel run ...` in the terminal, it will stop when you close Cursor. Use a **LaunchAgent** instead so it keeps running. One-time setup and start:

1. **One-time setup** (paths, plist, logs dir): see [RUN_SERVICES_PERSISTENTLY.md](RUN_SERVICES_PERSISTENTLY.md) §2 (Cloudflare tunnel).
2. **Start the tunnel** (run in Cursor terminal):

   ```bash
   launchctl load ~/Library/LaunchAgents/com.cloudflare.cloudflared-nivo.plist
   ```

After that, both Docker and the tunnel keep running when you close Cursor. To stop the tunnel later (e.g. from another terminal): `launchctl unload ~/Library/LaunchAgents/com.cloudflare.cloudflared-nivo.plist`.

### Quick check before you close Cursor

| Check | Command (in Cursor terminal) |
|-------|------------------------------|
| Docker containers running | `docker compose ps` |
| Tunnel running | `launchctl list \| grep cloudflared` |
| API reachable | `curl -s http://127.0.0.1:8000/health` |

---

## 3. Summary

- **Testing:** Do it in this branch; merge to main when you’re satisfied.
- **Services after closing Cursor:** Use `docker compose up -d` for Postgres + API, and run the Cloudflare tunnel as a LaunchAgent (`launchctl load ...`). Full LaunchAgent setup is in [RUN_SERVICES_PERSISTENTLY.md](RUN_SERVICES_PERSISTENTLY.md).

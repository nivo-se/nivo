# Merge to main and branch cleanup

## 1. Admin in production
- Admin is determined by Postgres `user_roles` (or `VITE_ADMIN_EMAILS` in prod env).
- If needed: on Mac Mini, use Cursor or psql to ensure the production admin has a row in `user_roles` with `role = 'admin'` (and in `allowed_users` if `REQUIRE_ALLOWLIST=true`).

## 2. Merge and cleanup (done on this machine)

- [x] Commit any remaining work on current branch (`inverstor-page`)
- [x] Fetch latest and merge `inverstor-page` into main
- [x] Remove `.env.bak` and `nivo_dump.sql` from history (secrets + large file), add `.env.bak` to .gitignore
- [x] Push main: `git push origin main --force-with-lease`
- [x] Delete remote branches: `codex-check-db`, `supabase-prepare`, `mini-setup`, `inverstor-page`
- [x] Delete local branches: same list

## Laptop (next time you use it for dev)

```bash
git fetch origin --prune
git checkout main
git pull origin main
git branch -a   # delete any local branches that tracked deleted remotes, e.g. git branch -D inverstor-page
```

Then create a new branch from main for new work (e.g. `git checkout -b feature/your-feature`).

## 3. After deploy
- Log in as admin in production and confirm Admin link + admin functions work.

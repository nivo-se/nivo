# Merge to main and branch cleanup

## 1. Admin in production
- Admin is determined by Postgres `user_roles` (or `VITE_ADMIN_EMAILS` in prod env).
- If needed: on Mac Mini, use Cursor or psql to ensure the production admin has a row in `user_roles` with `role = 'admin'` (and in `allowed_users` if `REQUIRE_ALLOWLIST=true`).

## 2. Merge and cleanup (done on this machine)

- [x] Commit any remaining work on current branch (`inverstor-page`)
- [ ] Fetch latest: `git fetch origin`
- [ ] Merge `origin/main` into current branch (resolve conflicts if any): `git merge origin/main`
- [ ] Checkout main: `git checkout main`
- [ ] Pull main: `git pull origin main`
- [ ] Merge `inverstor-page` into main: `git merge inverstor-page`
- [ ] Push main: `git push origin main`
- [ ] Delete remote branches: `codex-check-db`, `supabase-prepare`, `mini-setup`, `inverstor-page`
- [ ] Delete local branches (after switching to main): same list
- [ ] Laptop: next time `git fetch origin && git checkout main && git pull origin main` and delete any local branches that tracked removed remotes

## 3. After deploy
- Log in as admin in production and confirm Admin link + admin functions work.

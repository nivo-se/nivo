-- OPTIONAL: Seed a placeholder admin. Not run by run_postgres_migrations.sh.
-- Preferred: do not use this file; insert your real sub manually after first login (see docs/BOOTSTRAP_ROLES.md).
-- If you use this file: replace 'auth0|REPLACE_ME' with your sub from GET /api/me, then run manually:
--   psql "$DATABASE_URL" -f database/migrations/021_seed_first_admin.sql
-- If REQUIRE_ALLOWLIST=true, also insert into allowed_users for the same sub.

INSERT INTO user_roles (sub, role)
VALUES ('auth0|REPLACE_ME', 'admin')
ON CONFLICT (sub) DO NOTHING;

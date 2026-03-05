-- RBAC: roles and allowlist keyed by Auth0 sub (local Postgres only).
-- Applied by: ./scripts/run_postgres_migrations.sh

-- Roles: one row per user (sub). role is admin or analyst.
CREATE TABLE IF NOT EXISTS user_roles (
  sub TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'analyst')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optional allowlist: when REQUIRE_ALLOWLIST=true, only subs listed and enabled can access.
CREATE TABLE IF NOT EXISTS allowed_users (
  sub TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Keep updated_at in sync (user_roles)
CREATE OR REPLACE FUNCTION set_user_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_roles_updated_at ON user_roles;
CREATE TRIGGER user_roles_updated_at
  BEFORE UPDATE ON user_roles
  FOR EACH ROW EXECUTE PROCEDURE set_user_roles_updated_at();

-- Keep updated_at in sync (allowed_users)
CREATE OR REPLACE FUNCTION set_allowed_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS allowed_users_updated_at ON allowed_users;
CREATE TRIGGER allowed_users_updated_at
  BEFORE UPDATE ON allowed_users
  FOR EACH ROW EXECUTE PROCEDURE set_allowed_users_updated_at();

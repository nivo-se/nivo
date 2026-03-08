-- user_profiles: captures sub + email for every authenticated user on first login.
-- This is populated by POST /api/enroll (no role check required).
-- Allows admin panel to show emails and a "pending users" list.
CREATE TABLE IF NOT EXISTS user_profiles (
  sub TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_profiles_email_idx ON user_profiles (email);

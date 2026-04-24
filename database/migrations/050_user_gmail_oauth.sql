-- Per-user Google OAuth (Gmail send) for CRM. Auth0 `sub` is the key.
-- Run after CRM migrations (e.g. 047+).

CREATE TABLE IF NOT EXISTS deep_research.user_gmail_credentials (
  user_id TEXT PRIMARY KEY,
  google_email TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_user_gmail_credentials_email_lower
  ON deep_research.user_gmail_credentials (lower(google_email));

DROP TRIGGER IF EXISTS trg_user_gmail_credentials_updated_at ON deep_research.user_gmail_credentials;
CREATE TRIGGER trg_user_gmail_credentials_updated_at
  BEFORE UPDATE ON deep_research.user_gmail_credentials
  FOR EACH ROW EXECUTE PROCEDURE deep_research.set_updated_at_timestamp();

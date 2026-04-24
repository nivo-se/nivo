-- Google Account display name at connect (from userinfo), used for outbound From: "Name" <email>

ALTER TABLE deep_research.user_gmail_credentials
  ADD COLUMN IF NOT EXISTS google_display_name TEXT;

COMMENT ON COLUMN deep_research.user_gmail_credentials.google_display_name IS
  'Name from Google userinfo (profile) at connect; used for CRM Gmail From display. Reconnect to populate if null.';

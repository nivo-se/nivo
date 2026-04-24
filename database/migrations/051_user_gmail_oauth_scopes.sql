-- Track OAuth scopes granted at connect time (Drive / Calendar require reconnect if added later).

ALTER TABLE deep_research.user_gmail_credentials
  ADD COLUMN IF NOT EXISTS granted_scopes TEXT;

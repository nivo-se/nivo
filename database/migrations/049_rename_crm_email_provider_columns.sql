-- Rename legacy Gmail column names on outbound email rows; drop unused thread id.
-- deep_research.emails: outbound_provider_message_id stores Resend (or other provider) message id.

ALTER TABLE deep_research.emails
  RENAME COLUMN gmail_message_id TO outbound_provider_message_id;

ALTER TABLE deep_research.emails
  DROP COLUMN IF EXISTS gmail_thread_id;

COMMENT ON COLUMN deep_research.emails.outbound_provider_message_id IS 'Provider outbound message id (e.g. Resend) after send';

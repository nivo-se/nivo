-- Rename legacy Gmail column names on outbound email rows; drop unused thread id.
-- deep_research.emails: outbound_provider_message_id stores Resend (or other provider) message id.
--
-- Idempotent: safe on DBs that never had gmail_message_id (e.g. partial applies), already
-- renamed columns, or re-running this script.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'deep_research'
      AND table_name = 'emails'
      AND column_name = 'gmail_message_id'
  ) THEN
    ALTER TABLE deep_research.emails
      RENAME COLUMN gmail_message_id TO outbound_provider_message_id;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'deep_research'
      AND table_name = 'emails'
      AND column_name = 'gmail_thread_id'
  ) THEN
    ALTER TABLE deep_research.emails
      DROP COLUMN gmail_thread_id;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'deep_research'
      AND table_name = 'emails'
      AND column_name = 'outbound_provider_message_id'
  ) THEN
    COMMENT ON COLUMN deep_research.emails.outbound_provider_message_id IS
      'Provider outbound message id (e.g. Resend) after send';
  END IF;
END
$$;

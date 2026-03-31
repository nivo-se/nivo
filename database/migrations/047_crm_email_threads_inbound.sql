-- CRM email threads + messages for Resend outbound/inbound correlation.
-- Depends on deep_research.deals, contacts, emails (026_crm_foundation.sql).

CREATE TABLE IF NOT EXISTS deep_research.crm_email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL,
  deal_id UUID NOT NULL REFERENCES deep_research.deals(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES deep_research.contacts(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES deep_research.companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'closed')),
  created_by_user_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_crm_email_threads_token UNIQUE (token),
  CONSTRAINT uq_crm_email_threads_deal_contact UNIQUE (deal_id, contact_id)
);

CREATE INDEX IF NOT EXISTS ix_crm_email_threads_deal_id ON deep_research.crm_email_threads(deal_id);
CREATE INDEX IF NOT EXISTS ix_crm_email_threads_contact_id ON deep_research.crm_email_threads(contact_id);

CREATE TABLE IF NOT EXISTS deep_research.crm_email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES deep_research.crm_email_threads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  provider TEXT NOT NULL DEFAULT 'resend',
  provider_message_id TEXT NULL,
  deep_research_email_id UUID NULL REFERENCES deep_research.emails(id) ON DELETE SET NULL,
  from_email TEXT NULL,
  to_emails TEXT[] NULL,
  subject TEXT NULL,
  text_body TEXT NULL,
  html_body TEXT NULL,
  raw_payload JSONB NULL,
  dedupe_key TEXT NULL,
  sent_at TIMESTAMPTZ NULL,
  received_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_crm_email_messages_dedupe_key UNIQUE (dedupe_key)
);

CREATE INDEX IF NOT EXISTS ix_crm_email_messages_thread_id ON deep_research.crm_email_messages(thread_id);
CREATE INDEX IF NOT EXISTS ix_crm_email_messages_email_id ON deep_research.crm_email_messages(deep_research_email_id);

CREATE TABLE IF NOT EXISTS deep_research.crm_email_inbound_unmatched (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_attempted TEXT NULL,
  from_email TEXT NULL,
  to_email TEXT NULL,
  subject TEXT NULL,
  provider_inbound_email_id TEXT NULL,
  raw_payload JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE deep_research.emails
  ADD COLUMN IF NOT EXISTS crm_thread_id UUID NULL REFERENCES deep_research.crm_email_threads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_dr_emails_crm_thread_id ON deep_research.emails(crm_thread_id);

DROP TRIGGER IF EXISTS trg_crm_email_threads_updated_at ON deep_research.crm_email_threads;
CREATE TRIGGER trg_crm_email_threads_updated_at
  BEFORE UPDATE ON deep_research.crm_email_threads
  FOR EACH ROW EXECUTE PROCEDURE deep_research.set_updated_at_timestamp();

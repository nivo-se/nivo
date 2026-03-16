-- Nivo Origination CRM foundation schema
-- Depends on deep_research.companies from 024_deep_research_persistence.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS deep_research;

CREATE OR REPLACE FUNCTION deep_research.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS deep_research.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES deep_research.companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN (
    'target_identified',
    'outreach_ready',
    'outreach_sent',
    'replied',
    'in_dialogue',
    'meeting_scheduled',
    'declined',
    'parked',
    'closed'
  )),
  owner_user_id UUID NULL,
  thesis_summary TEXT NULL,
  priority_score NUMERIC NULL,
  next_action_at TIMESTAMPTZ NULL,
  last_contacted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_dr_deals_company UNIQUE (company_id)
);
CREATE INDEX IF NOT EXISTS ix_dr_deals_company_id ON deep_research.deals(company_id);
CREATE INDEX IF NOT EXISTS ix_dr_deals_status ON deep_research.deals(status);
CREATE INDEX IF NOT EXISTS ix_dr_deals_next_action_at ON deep_research.deals(next_action_at);

CREATE TABLE IF NOT EXISTS deep_research.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES deep_research.companies(id) ON DELETE CASCADE,
  full_name TEXT NULL,
  first_name TEXT NULL,
  last_name TEXT NULL,
  title TEXT NULL,
  email TEXT NOT NULL,
  linkedin_url TEXT NULL,
  phone TEXT NULL,
  source TEXT NULL,
  confidence_score NUMERIC NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_dr_contacts_company_email UNIQUE (company_id, email)
);
CREATE INDEX IF NOT EXISTS ix_dr_contacts_company_id ON deep_research.contacts(company_id);
CREATE INDEX IF NOT EXISTS ix_dr_contacts_email ON deep_research.contacts(email);

CREATE TABLE IF NOT EXISTS deep_research.emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deep_research.deals(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES deep_research.contacts(id) ON DELETE CASCADE,
  direction TEXT NOT NULL DEFAULT 'outbound',
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT NULL,
  gmail_message_id TEXT NULL,
  gmail_thread_id TEXT NULL,
  tracking_id TEXT NOT NULL,
  ai_prompt_version TEXT NULL,
  generation_context JSONB NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent', 'bounced', 'failed', 'replied')),
  sent_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_dr_emails_tracking_id UNIQUE (tracking_id)
);
CREATE INDEX IF NOT EXISTS ix_dr_emails_deal_id ON deep_research.emails(deal_id);
CREATE INDEX IF NOT EXISTS ix_dr_emails_contact_id ON deep_research.emails(contact_id);

CREATE TABLE IF NOT EXISTS deep_research.interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deep_research.deals(id) ON DELETE CASCADE,
  contact_id UUID NULL REFERENCES deep_research.contacts(id) ON DELETE SET NULL,
  email_id UUID NULL REFERENCES deep_research.emails(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'email_generated',
    'email_sent',
    'email_opened',
    'email_clicked',
    'reply_received',
    'note_added',
    'reminder_created',
    'reminder_completed',
    'sequence_enrolled',
    'sequence_advanced',
    'meeting_logged',
    'status_changed'
  )),
  summary TEXT NOT NULL,
  metadata JSONB NULL,
  created_by_user_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_dr_interactions_deal_id ON deep_research.interactions(deal_id);
CREATE INDEX IF NOT EXISTS ix_dr_interactions_type ON deep_research.interactions(type);
CREATE INDEX IF NOT EXISTS ix_dr_interactions_created_at_desc ON deep_research.interactions(created_at DESC);

CREATE TABLE IF NOT EXISTS deep_research.tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id TEXT NOT NULL,
  email_id UUID NULL REFERENCES deep_research.emails(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('open', 'click', 'unsubscribe', 'bounce')),
  user_agent TEXT NULL,
  ip_address TEXT NULL,
  referer TEXT NULL,
  redirect_url TEXT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_dr_tracking_events_tracking_id ON deep_research.tracking_events(tracking_id);
CREATE INDEX IF NOT EXISTS ix_dr_tracking_events_event_type ON deep_research.tracking_events(event_type);
CREATE INDEX IF NOT EXISTS ix_dr_tracking_events_created_at_desc ON deep_research.tracking_events(created_at DESC);

CREATE TABLE IF NOT EXISTS deep_research.sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_dr_sequences_name UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS deep_research.sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES deep_research.sequences(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_type TEXT NOT NULL DEFAULT 'email',
  delay_days INTEGER NOT NULL DEFAULT 0,
  subject_template TEXT NULL,
  prompt_template TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_dr_sequence_steps UNIQUE (sequence_id, step_number)
);

CREATE TABLE IF NOT EXISTS deep_research.deal_sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deep_research.deals(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES deep_research.sequences(id) ON DELETE CASCADE,
  current_step_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'stopped')),
  next_run_at TIMESTAMPTZ NULL,
  last_run_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_dr_deal_sequence_enrollment UNIQUE (deal_id, sequence_id)
);

DROP TRIGGER IF EXISTS trg_dr_deals_updated_at ON deep_research.deals;
CREATE TRIGGER trg_dr_deals_updated_at BEFORE UPDATE ON deep_research.deals
FOR EACH ROW EXECUTE PROCEDURE deep_research.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_dr_contacts_updated_at ON deep_research.contacts;
CREATE TRIGGER trg_dr_contacts_updated_at BEFORE UPDATE ON deep_research.contacts
FOR EACH ROW EXECUTE PROCEDURE deep_research.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_dr_emails_updated_at ON deep_research.emails;
CREATE TRIGGER trg_dr_emails_updated_at BEFORE UPDATE ON deep_research.emails
FOR EACH ROW EXECUTE PROCEDURE deep_research.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_dr_sequences_updated_at ON deep_research.sequences;
CREATE TRIGGER trg_dr_sequences_updated_at BEFORE UPDATE ON deep_research.sequences
FOR EACH ROW EXECUTE PROCEDURE deep_research.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_dr_sequence_steps_updated_at ON deep_research.sequence_steps;
CREATE TRIGGER trg_dr_sequence_steps_updated_at BEFORE UPDATE ON deep_research.sequence_steps
FOR EACH ROW EXECUTE PROCEDURE deep_research.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_dr_deal_sequence_enrollments_updated_at ON deep_research.deal_sequence_enrollments;
CREATE TRIGGER trg_dr_deal_sequence_enrollments_updated_at BEFORE UPDATE ON deep_research.deal_sequence_enrollments
FOR EACH ROW EXECUTE PROCEDURE deep_research.set_updated_at_timestamp();

-- seed default sequence
INSERT INTO deep_research.sequences (name, description)
VALUES ('Default Origination Sequence', 'Initial outreach and 7-day follow-up sequence')
ON CONFLICT (name) DO NOTHING;

WITH default_sequence AS (
  SELECT id FROM deep_research.sequences WHERE name = 'Default Origination Sequence'
)
INSERT INTO deep_research.sequence_steps (sequence_id, step_number, step_type, delay_days, subject_template, prompt_template)
SELECT id, 1, 'email', 0, 'Quick introduction', 'Initial personalized outreach'
FROM default_sequence
ON CONFLICT (sequence_id, step_number) DO NOTHING;

WITH default_sequence AS (
  SELECT id FROM deep_research.sequences WHERE name = 'Default Origination Sequence'
)
INSERT INTO deep_research.sequence_steps (sequence_id, step_number, step_type, delay_days, subject_template, prompt_template)
SELECT id, 2, 'email', 7, 'Following up', 'Follow-up note referencing first message'
FROM default_sequence
ON CONFLICT (sequence_id, step_number) DO NOTHING;

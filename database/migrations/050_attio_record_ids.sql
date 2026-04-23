-- 050_attio_record_ids.sql
-- Phase 1A of the Attio integration: add a local cache column for the Attio
-- record id on each entity we push to Attio. Attio is the source of truth for
-- CRM data; this column exists only so we can skip a domain/email lookup on
-- subsequent push attempts and to render "Open in Attio" deep links.
--
-- Push direction is one-way (Nivo → Attio). No reverse sync, no audit table.
-- Assert endpoints (PUT …?matching_attribute=…) are idempotent, so the column
-- is purely an optimization; integration still works if it is NULL.

ALTER TABLE deep_research.companies
    ADD COLUMN IF NOT EXISTS attio_record_id TEXT NULL;

ALTER TABLE deep_research.contacts
    ADD COLUMN IF NOT EXISTS attio_record_id TEXT NULL;

CREATE INDEX IF NOT EXISTS ix_dr_companies_attio_record_id
    ON deep_research.companies(attio_record_id)
    WHERE attio_record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_dr_contacts_attio_record_id
    ON deep_research.contacts(attio_record_id)
    WHERE attio_record_id IS NOT NULL;

COMMENT ON COLUMN deep_research.companies.attio_record_id IS
    'Attio record_id (UUID) cached after a successful push. Source of truth lives in Attio.';

COMMENT ON COLUMN deep_research.contacts.attio_record_id IS
    'Attio record_id (UUID) cached after a successful push. Source of truth lives in Attio.';

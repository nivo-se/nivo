-- Dedicated verification audit trail for per-claim verification outcomes.
-- Each row records the result of a verification check for a single claim.
CREATE TABLE IF NOT EXISTS deep_research.claim_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES deep_research.claims(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('SUPPORTED', 'UNSUPPORTED', 'UNCERTAIN', 'CONFLICTING')),
  confidence_score NUMERIC(5, 4),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_ids JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_dr_claim_verifications_run ON deep_research.claim_verifications (run_id);
CREATE INDEX IF NOT EXISTS ix_dr_claim_verifications_claim ON deep_research.claim_verifications (claim_id);
CREATE INDEX IF NOT EXISTS ix_dr_claim_verifications_status ON deep_research.claim_verifications (status);

-- Deep Research run node-state persistence for LangGraph orchestration.

CREATE SCHEMA IF NOT EXISTS deep_research;

CREATE TABLE IF NOT EXISTS deep_research.run_node_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES deep_research.analysis_runs(id) ON DELETE CASCADE,
    node_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_dr_run_node_states_status CHECK (
        status IN ('running', 'completed', 'failed', 'skipped')
    ),
    CONSTRAINT uq_dr_run_node_states_run_node UNIQUE (run_id, node_name)
);

CREATE INDEX IF NOT EXISTS ix_dr_run_node_states_run_status
    ON deep_research.run_node_states(run_id, status);
CREATE INDEX IF NOT EXISTS ix_dr_run_node_states_node_name
    ON deep_research.run_node_states(node_name);


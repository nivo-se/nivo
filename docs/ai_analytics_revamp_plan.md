# AI Analytics Platform Revamp Plan

## 1. Executive Summary
The current AI Analytics tab surfaces static shortlist insights and occasionally broken AI output. To support Nivo's acquisition strategy we will deliver a fully automated workflow that:

1. Lets investment users select candidate companies from the filtering pipeline in the frontend.
2. Collects the latest financial and operational facts from Supabase (and, where needed, triggers data refresh jobs).
3. Orchestrates agentic GPT analyses that cover financial health, commercial positioning, product/market SWOT, integration plays, and risk checks.
4. Persists structured results into a dedicated Supabase schema for historical comparisons and governance.
5. Streams progress back to the dashboard and renders a rich, navigable analytics experience complete with drilldowns, AI recommendations, and export options.

## 2. Guiding Principles
- **Decision-grade output**: Every AI analysis must include sources, numeric context, and explicit confidence scores.
- **Composable services**: Separate shortlist computation, data hydration, LLM analysis, and reporting so each stage can evolve independently.
- **Observability-first**: Capture prompts, responses, and performance metrics for auditing and continuous improvement.
- **Human-in-the-loop**: Provide review checkpoints, edit capabilities, and the ability to rerun specific analysis modules.

## 3. Target Architecture
```
Frontend (Next.js)
└── AI Analytics Dashboard
    ├── Company selection panel (connected to shortlist API)
    ├── Live run status stream (Supabase Realtime / SSE)
    └── Insight workspace (summary cards, SWOT, financials, actions)

Backend (FastAPI + agentic pipeline)
└── /analysis-runs
    ├── POST /runs              # launch analysis job for selected companies
    ├── GET  /runs/{id}         # poll run status + results metadata
    ├── WS/SSE /runs/{id}/logs  # optional streaming events
    └── GET  /companies/{orgnr}/analysis/latest  # fetch merged dataset for dashboard

Workers (Celery / Temporal or lightweight async queue)
└── Tasks
    ├── hydrate_company_snapshot
    ├── run_financial_module
    ├── run_commercial_module
    ├── run_swot_module
    ├── upsert_analysis_results
    └── emit_run_event

Data (Supabase)
└── Schema ai_ops
    ├── ai_analysis_runs
    ├── ai_company_analysis
    ├── ai_analysis_sections
    ├── ai_analysis_metrics
    ├── ai_analysis_audit
    └── materialized views for dashboard consumption
```

## 4. Data Model & Storage
### 4.1 New Tables (schema: `ai_ops`)
| Table | Purpose | Key Columns |
| --- | --- | --- |
| `ai_analysis_runs` | Stores run metadata (triggering user, filters, status, timestamps). | `id (uuid pk)`, `initiated_by`, `status`, `model_version`, `filters_json`, `started_at`, `completed_at`, `error_message` |
| `ai_company_analysis` | One row per company per run containing the overall summary and scores. | `run_id fk`, `orgnr`, `summary`, `confidence`, `risk_score`, `recommendation`, `financial_grade`, `commercial_grade`, `operational_grade`, `next_steps`, `created_at` |
| `ai_analysis_sections` | Breaks down narrative sections (financial_outlook, commercial_outlook, SWOT, integration_actions, risks). | `run_id`, `orgnr`, `section_type`, `content_md`, `supporting_metrics_json`, `confidence`, `tokens_used` |
| `ai_analysis_metrics` | Structured numeric outputs computed alongside LLM text. | `run_id`, `orgnr`, `metric_name`, `metric_value`, `metric_unit`, `source`, `year`, `confidence` |
| `ai_analysis_audit` | Captures prompts/responses/traces for audit and debugging. | `run_id`, `orgnr`, `module`, `prompt`, `response`, `model`, `latency_ms`, `cost_usd` |

### 4.2 Views / Materializations
- `ai_company_analysis_latest` – View joining latest run per company with headline metrics.
- `ai_analysis_dashboard_feed` – Flattened dataset for quick dashboard queries (supports filters like segment, score, risk level).

### 4.3 ETL / Hydration Strategy
1. Fetch primary financials from `company_financials`, `company_kpis`, and `segments` tables.
2. Derive calculated metrics (YoY revenue growth, EBITDA margin trend, cash conversion) using `dbt` or Python transforms before LLM call.
3. Cache facts in `ai_analysis_company_snapshots` (JSONB) for reproducibility.
4. Provide a CLI (`backend/run_ai_analysis.py --orgnrs ...`) to backfill or rerun analyses.

## 5. Backend Implementation Roadmap
### Phase A – Foundations (Week 1)
1. **Supabase Schema Migration**
   - Author SQL migration for `ai_ops` tables, indexes on `(orgnr, created_at)` and `(run_id, section_type)`.
   - Configure Row Level Security policies ensuring only authenticated internal users access data.
2. **Data Access Layer**
   - Add `backend/agentic_pipeline/data_access.py` helpers to fetch enriched company contexts, returning dataclasses ready for LLM consumption.
   - Implement caching and fallback to Allabolag scraper when data staleness is detected (>30 days).
3. **LLM Analysis Modules**
   - Refine `AgenticLLMAnalyzer` to:
     - Accept structured `CompanyContext` objects.
     - Invoke specialized prompts per module (financial, commercial, SWOT, integration).
     - Aggregate outputs into schema-defined payloads.
   - Integrate cost tracking and error retries.

### Phase B – Job Orchestration (Week 2)
1. Introduce a lightweight task queue (RQ or Dramatiq) with Redis (already available via Supabase) or adopt Temporal if long-running flows are required.
2. Define workflow:
   - `create_run` → enqueue `hydrate_company_snapshot` tasks per orgnr.
   - Each hydration task triggers sequential `run_*` module tasks and writes results.
   - `upsert_analysis_results` updates Supabase tables + emits run progress events.
3. Expose REST endpoints via FastAPI (`api/routers/ai_analysis.py`). Include authentication middleware.
4. Add streaming run updates using Supabase Realtime channels; fallback to polling.

### Phase C – Frontend Revamp (Week 3)
1. **UI Architecture**
   - Convert AI tab to a dedicated `/ai-analytics` route using server components.
   - Implement layout:
     - Left rail: shortlist filter summary, run selector, rerun button.
     - Main area: cards for Financial Grade, Commercial Grade, SWOT, Integration Plays, Risks, Next Steps.
     - Bottom drawer: prompt/response audit log with copy-to-clipboard.
2. **State Management**
   - Use React Query to fetch run metadata and subscribe to updates.
   - Provide optimistic updates when rerunning analyses.
3. **Visualizations**
   - Leverage Nivo charts for trend lines (revenue growth, margin trajectory) and scoring heatmaps.
   - Add status badges ("Needs Attention", "High Potential") based on AI output thresholds.
4. **Interactions**
   - "Request Deep Dive" button to rerun modules with custom instructions.
   - Export to PDF/Notion with consolidated narratives.
   - Inline feedback (thumbs up/down) writing to `ai_analysis_feedback` table for reinforcement.

### Phase D – Quality & Governance (Week 4)
1. **Validation**
   - Automated tests for data access, prompt assembly, response parsing, and API contracts.
   - Golden-record tests verifying SWOT structure and metric extraction on fixture companies.
2. **Evaluation Harness**
   - Implement `backend/evaluation/ai_analysis_eval.py` to benchmark output quality vs. human-written references.
   - Track hallucination rate, factual accuracy (numerical comparisons), and readability scores.
3. **Monitoring**
   - Integrate OpenAI usage metrics with Supabase storage.
   - Set up Grafana dashboards for latency, cost, and error rate.
4. **Documentation & Playbooks**
   - Update runbooks, onboarding docs, and create Loom walkthrough once MVP is stable.

## 6. Prompt Engineering Strategy
- Maintain modular prompt templates per section stored in `backend/agentic_pipeline/prompts/`.
- Use JSON schema + `response_format` to enforce structural guarantees.
- Chain-of-thought hidden reasoning: use `logprobs` for auditing but only surface distilled output.
- Include explicit instructions to ground reasoning in the provided financial metrics (with tabular context in Markdown).
- Append `Company Snapshot` table in prompts with key numbers and growth indicators.

## 7. Security & Compliance
- Only service-role keys used on backend; frontend requests go through authenticated API.
- Encrypt stored prompts/responses containing sensitive data.
- Implement retention policy (auto-delete raw responses after 180 days unless flagged).
- Add audit trail for any manual edits of AI output.

## 8. Rollout Plan
1. Internal alpha with investment team on a subset of companies.
2. Collect qualitative feedback + log corrections for prompt tuning.
3. Beta release gating behind feature flag; monitor run success rate.
4. Full release once dashboard performance (<3s load) and accuracy (>85% fact-alignment) targets met.

## 9. Open Questions & Next Steps
- Confirm preferred task queue (existing infra vs. introducing Temporal Cloud).
- Decide on automatic reruns cadence (weekly refresh vs. manual trigger).
- Align on KPI thresholds that drive recommendation badges.
- Validate Supabase row-level security requirements with security team.

**Immediate Actions:**
1. Draft Supabase migration SQL for new tables.
2. Extend `AgenticLLMAnalyzer` to output per-section payloads + cost metrics.
3. Scaffold FastAPI router and queue integration for analysis runs.
4. Begin low-fidelity wireframes for new dashboard layout.

This plan provides a complete blueprint to deliver a high-quality, reliable AI analytics experience that aligns with Nivo's acquisition goals.

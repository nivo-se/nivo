# Next Phase Deep Research Roadmap

## Purpose

This document defines the concrete engineering roadmap for the next implementation phase of the Nivo Deep Research platform.

It is the authoritative planning document for Cursor implementation agents. Before implementing any workstream, read:

- [IMPLEMENTATION_INDEX.md](./IMPLEMENTATION_INDEX.md)
- [CURSOR_CONTEXT_PLAYBOOK.md](./CURSOR_CONTEXT_PLAYBOOK.md)
- [CURSOR_AGENT_RULES.md](./CURSOR_AGENT_RULES.md)
- The task-specific spec document for the workstream

---

## Current Baseline (Assumed Implemented)

The following are already in the repo and treated as the current baseline:

- Financial model grounding
- Richer AgentContext with historical_financials, derived_metrics, and market_data
- Stronger company profile validation and stage validators
- Tavily preferred in retrieval auto mode
- Query planner support for market and competitor queries
- Source scoring
- Proprietary input provenance
- OpenAI payload contract scaffolding
- Recompute fixes
- Analyst workbench backend routes
- Audit docs for sequential execution, payloads, and proprietary inputs

---

## A. Workstreams

Each workstream includes: objective, why it matters, dependencies, recommended PR order, and definition of done.

### 1. Company Understanding

**Objective:** Make company understanding a true first-class stage with LLM-driven extraction, structured output, quality thresholds, and gating of market retrieval.

**Why it matters:** Downstream market and competitor search is weak without knowing what the company does, sells, and to whom. The QueryPlanner produces generic queries when company understanding is absent or thin.

**Dependencies:** Identity resolution, source ingestion.

**Recommended PR order:** 1

**Definition of done:**

- Canonical `CompanyUnderstanding` payload persisted (company_description, products_services, business_model, target_customers, geographies, market_niche, confidence_score, source_refs)
- Minimum quality threshold enforced; market retrieval gated on threshold
- Debug visibility for company-understanding completeness
- Stage validator fails when business_model or market_niche is missing below threshold

**Reference:** [FINAL_DEEP_RESEARCH_ARCHITECTURE.md](./FINAL_DEEP_RESEARCH_ARCHITECTURE.md) Layer 3; [PLAN_ADDITIONS_FOR_CURSOR_PLANNER.md](./PLAN_ADDITIONS_FOR_CURSOR_PLANNER.md) Section 1.

---

### 2. Tavily / Web Intelligence

**Objective:** Integrate Tavily Search and Tavily Extract into the gated pipeline after company understanding; upgrade QueryPlanner to use company understanding for market and competitor queries.

**Why it matters:** Retrieval is currently pre-pipeline and generic. Tavily is preferred in auto mode but not pipeline-integrated. Market and competitor evidence discovery must run after company understanding is known.

**Dependencies:** Company Understanding (workstream 1).

**Recommended PR order:** 2

**Definition of done:**

- Company understanding drives Tavily query planning
- Tavily Search used for market/competitor evidence discovery
- Tavily Extract used on ranked URLs only (search first, rank, then extract top N)
- Evidence quality scored and persisted
- Degraded evidence states surfaced explicitly
- Costs bounded and inspectable

**Reference:** [TAVILY_INTEGRATION_SPEC.md](./TAVILY_INTEGRATION_SPEC.md).

---

### 3. Bounded Retrieval Loop

**Objective:** Implement supplemental retrieval rounds with hard limits, quality thresholds, and explicit degradation when evidence remains weak after the budget is exhausted.

**Why it matters:** Allow "research more when needed" without unbounded recursion. The system should be able to run one or two follow-up Tavily rounds when evidence is too thin, then stop or degrade.

**Dependencies:** Tavily integration (workstream 2), evidence scoring.

**Recommended PR order:** 3

**Definition of done:**

- 1 primary round + up to 2 supplemental rounds per stage
- Supplemental rounds triggered only by explicit weak-evidence conditions
- Evidence rescored after each round
- Stage stops when threshold reached or budget exhausted
- Degraded states explicit and persisted
- No unbounded research loop possible

**Hard limits (from spec):** max_primary_rounds=1, max_supplemental_rounds=2, max_queries_per_stage=6, max_extracted_urls_per_stage=10.

**Reference:** [BOUNDED_RETRIEVAL_LOOP_SPEC.md](./BOUNDED_RETRIEVAL_LOOP_SPEC.md).

---

### 4. Evidence Ranking

**Objective:** Strengthen source scoring, ranking policy, and evidence quality diagnostics.

**Why it matters:** Weak evidence still reaches downstream stages. The system must choose better evidence and surface quality in debug artifacts.

**Dependencies:** Source scoring exists; Tavily metadata.

**Recommended PR order:** 4

**Definition of done:**

- Source tiers enforced (company_site > government > trade_association > news_major > blog > unknown)
- Trust, relevance, and recency scoring applied
- Evidence quality surfaced in debug artifacts
- Ranking policy documented and configurable

**Reference:** [TAVILY_INTEGRATION_SPEC.md](./TAVILY_INTEGRATION_SPEC.md) Section 8; `backend/retrieval/source_scoring.py`.

---

### 5. Proprietary Input Integration

**Objective:** Merge proprietary sources into company understanding, market framing, value creation, and model assumptions.

**Why it matters:** Valuable facts from investor decks, CIMs, and internal notes never reach analysis. Provenance exists but merge rules are not fully defined.

**Dependencies:** Source taxonomy, ingestion contract (already exist).

**Recommended PR order:** 5

**Definition of done:**

- Payload merge rules documented (proprietary vs public precedence)
- Proprietary sources flow into company understanding and market framing
- Provenance labels in claims; no ambiguous merge behavior
- No silent overwrite of public evidence by proprietary when both exist

**Reference:** [proprietary-input-integration-spec.md](./proprietary-input-integration-spec.md); [FINAL_DEEP_RESEARCH_ARCHITECTURE.md](./FINAL_DEEP_RESEARCH_ARCHITECTURE.md) Proprietary Input Strategy.

---

### 6. OpenAI Payload Discipline

**Objective:** Enforce payload validation before every LLM call; block incomplete calls; document usage policy.

**Why it matters:** Avoid expensive low-value calls; ensure rich inputs before synthesis. OpenAI must not be called with incomplete payloads.

**Dependencies:** Payload contracts exist in `backend/llm/payload_contracts.py`.

**Recommended PR order:** 6

**Definition of done:**

- `validate_llm_payload()` enforced before every LLM call
- Missing-input blocker: do not call LLM when required fields absent
- Cost-control policy documented
- Blocked roles (financial_math, valuation_calculation, orchestration, raw_crawling, db_truth) enforced

**Reference:** [openai-payload-audit.md](./openai-payload-audit.md).

---

### 7. Financial Model Grounding Verification

**Objective:** Audit that model assumptions use 4-year actuals, derived trends, and market baseline; verify assumptions_source integrity.

**Why it matters:** Ensure grounding is real, not just scaffolding. The financial model must consume real historicals and market data.

**Dependencies:** Historical financials loader, AgentContext with historical_financials, derived_metrics, market_data.

**Recommended PR order:** 7

**Definition of done:**

- Audit passes: model receives real orgnr, 4y actuals, derived metrics
- assumptions_source inspectable in output
- Model input debug artifact includes completeness flags
- No synthetic assumptions preferred when actuals exist

**Reference:** [sequential-execution-audit.md](./sequential-execution-audit.md); [FINAL_DEEP_RESEARCH_ARCHITECTURE.md](./FINAL_DEEP_RESEARCH_ARCHITECTURE.md) Gate 4.

---

### 8. Analyst Workbench Frontend Completion

**Objective:** Complete competitor mutations, report versions list, and any remaining MVP gaps.

**Why it matters:** Gates C (can an analyst correct it?) and D (can an analyst work from it?) require full edit/recompute workflows. Competitor add/remove and report version history are documented gaps.

**Dependencies:** Backend mutation endpoints (POST/DELETE competitors, GET report versions).

**Recommended PR order:** 8

**Definition of done:**

- Competitor add/remove UI wired to backend endpoints
- Report versions list endpoint and UI
- Analyst can complete workflow without developer support
- Start Analysis button or equivalent (if not already present)

**Reference:** [frontend-integration-review.md](./frontend-integration-review.md); [DEEP_RESEARCH_STOP_CRITERIA.md](./DEEP_RESEARCH_STOP_CRITERIA.md) Section 2.

---

## B. Recommended Sequence

### Backend work (ordered)

1. Company Understanding
2. Tavily pipeline integration (Search + Extract, query planner)
3. Bounded Retrieval Loop
4. Evidence Ranking
5. Proprietary Input merge rules
6. OpenAI Payload enforcement
7. Financial Model Grounding audit

### Frontend work (can parallelize after backend mutations exist)

- Competitor mutation UI (depends on POST/DELETE competitors API)
- Report versions list (depends on GET versions API)
- Minor UX: company_name in header, Start Analysis button

### Validation / acceptance

- Run on 5–8 real companies
- Confirm Gates A–D ([DEEP_RESEARCH_STOP_CRITERIA.md](./DEEP_RESEARCH_STOP_CRITERIA.md) Section 5)
- Test weak-data and ambiguous-data cases

---

## C. Contract-Sensitive Areas

Freeze or document these contracts before parallel work. Changes to these areas require coordination.

| Area | Contract | Rationale |
|------|----------|-----------|
| Company understanding | `CompanyUnderstanding` payload shape: company_description, products_services, business_model, target_customers, geographies, market_niche, confidence_score, source_refs | Downstream stages consume it; QueryPlanner depends on it |
| Tavily | Query/result metadata: provider, retrieval_round, origin_query, query_family, evidence_quality_score | Debug artifacts, ranking, loop policy |
| Evidence quality | Source scoring output shape; quality threshold values (e.g. market_evidence=0.70, competitor_evidence=0.65) | Bounded loop triggers; degradation decisions |
| Debug artifacts | `analysis_input_debug` structure; retrieval-round diagnostics | Observability; analyst debugging |
| Verification | Claim payload; verification_status values | Report and verification panel |
| Report | Section schema; REPORT_UI_SCHEMA | Frontend rendering |
| Recompute | RecomputeRequest shape; section/competitor/assumption flows | Edit → recompute workflows |

---

## D. Hard Stop Boundary

### Must be completed for Deep Research MVP

- Company understanding gates market retrieval
- Tavily Search + Extract in pipeline; bounded supplemental retrieval
- Evidence ranking and quality thresholds
- Proprietary merge into company understanding and market
- OpenAI payload validation enforced
- Financial model grounding verified
- Analyst workbench: run status, report, verification, competitor edit, assumption override, recompute feedback
- Internal validation on 5–8 companies; Gates A–D pass

### Defer to Phase 2

- Tavily Map/Crawl
- Advanced evidence ranking (ML-based)
- Full report version diff/compare UI
- Dedicated assumption CRUD API
- Batch processing, portfolio views, export systems
- Sector templates, company ranking, watchlists

### Do not build now

- New core pipeline stages beyond company understanding
- Unbounded agent loops
- Tavily Research endpoint as orchestrator
- Broad platform expansion

---

## E. Risk Areas

| Risk | Mitigation |
|------|------------|
| Company understanding still too weak | Quality threshold gate; degrade explicitly; debug visibility for completeness |
| Retrieval loops too expensive or open-ended | Hard limits (max_supplemental_rounds=2, max_queries_per_stage=6); stop_if_threshold_met; degrade_if_budget_exceeded |
| Weak evidence reaches downstream | Evidence ranking; quality thresholds; degraded flags in report/verification |
| OpenAI called with incomplete payloads | validate_llm_payload() before every call; missing-input blocker |
| Proprietary merge rules ambiguous | Document merge precedence; provenance labels; no silent overwrite of public by proprietary |
| Frontend/backend contract drift | Freeze RUN_STATUS_API, REPORT_UI_SCHEMA, recompute payloads; document in roadmap |

---

## Key References

| Document | Purpose |
|----------|---------|
| [FINAL_DEEP_RESEARCH_ARCHITECTURE.md](./FINAL_DEEP_RESEARCH_ARCHITECTURE.md) | Layer 3 Company Understanding, Layer 4 Web Intelligence |
| [TAVILY_INTEGRATION_SPEC.md](./TAVILY_INTEGRATION_SPEC.md) | Tavily role, query planning, bounded loop |
| [BOUNDED_RETRIEVAL_LOOP_SPEC.md](./BOUNDED_RETRIEVAL_LOOP_SPEC.md) | Hard limits, thresholds, degradation |
| [DEEP_RESEARCH_STOP_CRITERIA.md](./DEEP_RESEARCH_STOP_CRITERIA.md) | MVP definition, hard stop |
| [frontend-integration-review.md](./frontend-integration-review.md) | Current frontend status, gaps |
| [PLAN_ADDITIONS_FOR_CURSOR_PLANNER.md](./PLAN_ADDITIONS_FOR_CURSOR_PLANNER.md) | Workstream definitions |

---

## Handoff for Cursor Implementation Agents

When implementing a workstream:

1. Read this roadmap and the workstream-specific spec.
2. Summarize scope and affected modules at the start.
3. Implement only the assigned workstream.
4. At the end: summary of changes, files changed, acceptance criteria status, blockers or follow-up items.

Do not redesign the architecture. Do not add unbounded agent loops. Preserve the hard stop.

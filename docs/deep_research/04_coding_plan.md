# Coding Plan (Cursor AI coding agents)

## Conventions (apply to every task)

- **Schema-first:** define Pydantic models before logic.
- **Determinism:** no hidden randomness; always log inputs/outputs.
- **Reproducibility:** every object includes `source_refs`, `version`, `created_at`, `created_by_agent`, `run_id`.
- **Tests:** unit tests per extractor/modeling module; integration tests per agent pipeline stage.

---

## Phase 1 — Core backend infrastructure

### Task 1.1: Repo skeleton + base dependencies

**Output**

- monorepo structure as previously defined
- `pyproject.toml`
- `Makefile` targets: `lint`, `test`, `fmt`, `run-api`
**Acceptance criteria**
- `make test` passes with placeholder tests
- CI placeholder workflow exists

### Task 1.2: Postgres schema + migrations

**Output**

- SQLAlchemy/SQLModel models or raw SQL migrations for:
  - `companies`, `financials`, `sources`, `claims`
  - `company_profile`, `market_analysis`, `competitor_rel`, `competitor_metrics`
  - `strategy`, `value_creation_initiatives`, `projections`, `valuations`, `reports`
- pgvector extension migration
**Acceptance criteria**
- migrations apply cleanly
- basic referential integrity enforced

### Task 1.3: FastAPI skeleton + authentication placeholder

**Output**

- `/health`
- `/companies/{id}/analysis` GET
- `/runs` POST (start analysis)
- basic auth stub
**Acceptance criteria**
- OpenAPI docs generate
- requests return structured errors

### Task 1.4: Run state + versioning model

**Output**

- `runs` table with state machine (`PENDING/RUNNING/FAILED/SUCCEEDED`)
- versioning strategy for outputs
**Acceptance criteria**
- re-running creates new versions without overwriting previous versions

---

## Phase 2 — Agent orchestration

### Task 2.1: Plan object + Planner agent scaffolding

**Output**

- Plan schema: nodes, deps, thresholds, timeouts
- Planner agent producing plan deterministically from company internal data
**Acceptance criteria**
- plan is JSON-serializable and stored in DB with run_id
- stable outputs for same inputs

### Task 2.2: LangGraph setup

**Output**

- skeleton graph wiring nodes (Identity→Research→Market→Comp→Strategy→Value→Model→Val→Verify→Report)
- node definitions accept/run/persist outputs
**Acceptance criteria**
- unit test that graph topological order is consistent
- basic run executes to “completed” with stub agent outputs

### Task 2.3: Temporal workflow integration (or interim queue)

**Option A (Temporal) Output**

- workflow definition per run_id
- activity functions for each agent stage
**Option B (RQ/Celery interim) Output**
- queues + task dispatch with retries
**Acceptance criteria**
- per-stage retry/backoff works
- long-running tasks can be resumed from latest persisted state

---

## Phase 3 — Retrieval layer (public sources only)

### Task 3.1: SerpAPI wrapper + caching

**Output**

- search wrapper with:
  - deterministic params
  - cache key strategy (query + plan_node + company_id)
- rate limiting safeguards
**Acceptance criteria**
- repeated query hits cache
- logs include cache hit/miss

### Task 3.2: Playwright/browserless renderer

**Output**

- fetch+render pipeline:
  - HTML snapshot stored to object store
  - extracted text stored to Postgres (for indexing/RAG)
  **Acceptance criteria**
- handles JS-heavy sites with timeout
- stores artifacts with stable keys

### Task 3.3: Extraction primitives

**Output**

- extractor modules:
  - company “about” text
  - geography keywords
  - product/brand keywords
- output schemas include confidence + rule type
**Acceptance criteria**
- unit tests with canned HTML inputs
- deterministic extraction results

---

## Phase 4 — Identity + Research + Market agents

### Task 4.1: Entity Resolution agent

**Output**

- canonical company record builder using:
  - orgnr
  - name variations
  - domain discovery
  **Acceptance criteria**
- confidence score computation exists
- low confidence triggers “manual review needed” flag

### Task 4.2: Research agent

**Output**

- structured `company_profile` with sources
- writes claims for key fields
**Acceptance criteria**
- at least 1 source per claim
- low confidence fields explicitly labeled

### Task 4.3: Market Analysis agent

**Output**

- `market_analysis` (industry tags, growth, trends)
- minimal industry classification even when TAM missing
**Acceptance criteria**
- deterministic industry classification with fallback labels
- verified sources linked

---

## Phase 5 — Competition agents

### Task 5.1: Competitor discovery agent

**Output**

- longlist + shortlist with evidence
- similarity scoring function
**Acceptance criteria**
- deterministic scoring
- supports “human override” competitor IDs

### Task 5.2: Parallel competitor profiling

**Output**

- competitor profiling runner:
  - parallel tasks
  - concurrency controls
- `competitor_metrics` + claims
**Acceptance criteria**
- avoids overload of search/render APIs
- if slow, returns placeholder with low confidence

### Task 5.3: Competitor editing pipeline

**Output**

- API endpoints:
  - add/remove competitor
  - merge duplicates
- incremental recompute orchestration
**Acceptance criteria**
- only affected stages re-run (not full pipeline)

---

## Phase 6 — Strategy & Value Creation agents

### Task 6.1: Strategy agent

**Output**

- `strategy` object:
  - SWOT with per-bullet confidence
  - moat thesis
  **Acceptance criteria**
- no generic SWOT allowed (unit test to detect boilerplate)
- structured output stored

### Task 6.2: Value creation agent

**Output**

- `value_creation_initiatives` + drivers
**Acceptance criteria**
- each initiative links to:
  - dependency (ERP first, etc.)
  - impact range
  - risk score

---

## Phase 7 — Financial modeling + valuation (code-first)

### Task 7.1: Deterministic projection engine

**Output**

- Python model: 7-year projections + scenarios
- inputs are explicit driver parameters
**Acceptance criteria**
- same inputs always produce same outputs
- unit tests cover:
  - CAGR computation
  - margin expansion logic
  - working capital/capex

### Task 7.2: Valuation engine

**Output**

- EV range + sensitivity tables
**Acceptance criteria**
- explicit disclosure: “uses public benchmarks” vs “insufficient data”
- no fabricated precision if benchmarks missing

---

## Phase 8 — Verification + report synthesis

### Task 8.1: Claim validation module

**Output**

- validation rules:
  - multi-source
  - recency
  - span support
  - agreement checks
  **Acceptance criteria**
- claims flagged unsupported
- threshold blocks synthesis

### Task 8.2: Report synthesis agent

**Output**

- report JSON with:
  - sections
  - inline references
  - chart descriptors
- stores report version
**Acceptance criteria**
- unsupported claims excluded from narrative
- UI renders references from source IDs

### Task 8.3: Chart generation pipeline

**Output**

- backend chart generator (Matplotlib) -> object store
**Acceptance criteria**
- charts generated deterministically from structured data
- validated content (no unverified numbers)

---

## Phase 9 — UI integration

### Task 9.1: Report viewer

**Output**

- report layout from JSON blocks
- references expansion component
**Acceptance criteria**
- clicking reference shows source metadata + snippet + open URL

### Task 9.2: Editing flows

**Output**

- competitor editor
- assumption editor
- run status/versions
**Acceptance criteria**
- edits trigger incremental recompute
- version history visible

---

## Phase 10 — Observability + cost control

### Task 10.1: Metrics + logging

**Output**

- per-stage metrics:
  - latency
  - cache hit rate
  - SerpAPI calls
  - LLM tokens
  **Acceptance criteria**
- dashboards show cost drivers
- alerts for excessive retries/timeouts

### Task 10.2: Cost guards

**Output**

- caps per company:
  - search queries
  - render operations
  - LLM calls
  **Acceptance criteria**
- pipeline degrades gracefully rather than running indefinitely
- logs why it degraded


# 1. Architecture Review (from `deep_research.md`)

### What works well

- **Clear end-to-end pipeline:** Company → Market → Competition → Strategy/SWOT → Value creation → Projections → Valuation → Report. This matches the shape of professional investment memos (including the Bruno Mathsson example which has a narrative + charts + structured sections).
- **Sources everywhere:** The insistence that “all claims must have sources” is the right constraint for reducing hallucination and increasing trust.
- **Interactive report + human review:** Right objective. The platform should not be “fully automated research”; it should be a draft generator + provenance layer.
- **PostgreSQL baseline:** A relational database is a solid default for internal financial data + structured agent outputs.
- **Competitor list editing:** Critical UX design that enables iterative refinement without re-running everything from scratch.

### What is missing / needs redesign

1. **Orchestration is underspecified and fragile**
  - The doc treats agent flow as purely sequential. In reality, you need:
    - retry policies per stage
    - timeouts
    - partial completion / fallback paths
    - caching of web queries and deduplicated extraction
    - idempotency (“run it again” yields stable results)
  - Sequential-only architectures become **slow** and expensive when scaled to 50–100 companies.
2. **No explicit planner / dependency graph**
  - Some agent outputs can be parallelized:
    - Market & competitor discovery can start once you have a credible industry classification.
    - Valuation can run in draft mode before projections are fully finalized.
  - A planner agent (or deterministic planner process) should generate the task graph.
3. **No verification / fact-check agent**
  - Saying “all claims must have sources” is not enough.
  - You need automated consistency checks:
    - sanity bounds (revenue, headcount, geography)
    - mismatched sources (e.g., 2022 data cited as 2024)
    - conflicting data between sources
    - detection of “unsupported claim” text
4. **No tooling layer for web extraction**
  - Web search alone doesn’t yield structured evidence.
  - You need:
    - crawling/HTML rendering (for JS-heavy pages)
    - de-duplication and canonicalization of company names (“Bruno Mathsson”, “Bruno Mathsson International”)
    - structured extraction pipelines (prompts + rules + regex + heuristics)
5. **No clear data model / storage strategy**
  - The doc uses `*.json` output files. For production, you need:
    - versioning
    - provenance (which agent, which model version, which tool config)
    - references normalized as first-class records
    - schema-driven enforcement (Pydantic/SQLModel)
6. **Financial modeling too vague**
  - “7-year projection” is fine, but methodology needs to be explicit and deterministic:
    - build a base case with limited assumptions and standard formulas
    - attach assumptions to drivers (pricing, volume, channel mix, COGS %, SG&A %, capex, working capital)

### Key scalability concerns

- Running multiple web searches per agent per company can explode cost. Without:
  - shared caches
  - deterministic retrieval
  - a source scoring mechanism
  - incremental updates (partial reruns)
  the system becomes slow and expensive.

---

# 2. Improved Agent Architecture (optimal design)

## Top-level structure: Hierarchical + partially parallel graph

- Use a **planner** to build a task graph for a company run.
- Execute nodes in parallel where possible.
- Require **minimum confidence thresholds** and **minimum sources** before downstream agents can “lock” their outputs.

## Agent roles (recommended)

### A. Planner Agent (or deterministic planner function)

**Responsibility:** Generate the job graph per company
**Inputs:** Company name, orgnr, internal financial snapshot
**Outputs:** Plan object (tasks, dependencies, required outputs)
**Dependencies:** none

**Plan object fields (short):**

- `graph_nodes` (unique ids)
- `deps` (edges)
- `required_min_confidence_by_stage`
- `timeout_per_stage`
- `retries_per_stage`
- `skip_rules` (if data missing)

---

### B. Entity Resolution Agent (canonical identity agent)

**Responsibility:** Normalize entity identity before any research
**Inputs:** company name, orgnr
**Outputs:** canonical company record + aliases + domains + key URLs
**Dependencies:** Planner

This prevents the classic failure mode where the system mixes up two similarly named Swedish companies.

---

### C. Web Retrieval + Extraction Layer (tooling, not “LLM agents”)

This is a set of services/tools the agents call:

- search API wrapper
- HTML renderer (playwright/browserless)
- extraction primitives (structured parse)
- caching + dedupe

*These should not be large language models making decisions in a black box; make them deterministic components with logging.*

---

### D. Research Agent (company profiling)

**Responsibility:** Company overview
**Inputs:** canonical company record, internal financials
**Outputs:** structured company profile object + source references
**Dependencies:** Entity Resolution

---

### E. Market Intelligence Agent

**Responsibility:** Industry classification + market size/growth + key trends
**Inputs:** company profile + retrieval tools
**Outputs:** market analysis object
**Dependencies:** Research Agent (needs industry hints)

---

### F. Competitor Discovery Agent

**Responsibility:** Competitor list (longlist + shortlist)
**Inputs:** company profile, market analysis
**Outputs:** competitor candidates with evidence + confidence
**Dependencies:** Market Intelligence

This should produce:

- “discovered competitor candidates”
- scoring (similarity, geography, product overlap)
- sources per candidate

---

### G. Competitor Profiling Agent (can parallelize per competitor)

**Responsibility:** For each competitor, pull comparable metrics
**Inputs:** competitor candidate record
**Outputs:** standardized competitor object (revenue range, gross margin range, geography, channels, positioning)
**Dependencies:** Competitor Discovery
Run in parallel; write to DB with concurrency controls.

---

### H. Strategy & Moat Synthesis Agent

**Responsibility:** Non-generic SWOT + thesis hooks
**Inputs:** company profile, market analysis, competition profile
**Outputs:** strategy object (SWOT, moat, barriers, channel dynamics)
**Dependencies:** Research + Market + Competition

---

### I. Value Creation Agent (thesis engine)

**Responsibility:** Convert strategy outputs into initiatives + quantified driver assumptions
**Inputs:** strategy object, internal financials
**Outputs:** value creation plan (initiatives, estimated impact ranges, risks, required investments)
**Dependencies:** Strategy

This should explicitly attach:

- driver category (D2C shift, assortment expansion, operational efficiency)
- confidence + dependency (e.g., needs ERP modernization first)
- leading indicators (traffic, conversion, CAC, retention)

---

### J. Financial Modeling Agent

**Responsibility:** Projection + scenario modeling (Base/Downside/Upside)
**Inputs:** internal financials, value creation drivers, benchmarks from competitors
**Outputs:** P&L projection, cash flow projection, key ratios, scenario table
**Dependencies:** Value Creation + Competitor profiling

This agent must be **deterministic**:

- drivers stored as structured params
- calculations done in Python (pandas/NumPy), not in LLM text generation

LLM can propose assumptions, but calculations should be actual code.

---

### K. Valuation Agent

**Responsibility:** EV calculation + sensitivity + peer range
**Inputs:** projections (EBITDA), benchmarks, required returns
**Outputs:** valuation object + sensitivities
**Dependencies:** Financial Modeling

---

### L. Verification / Fact-check Agent (critical)

**Responsibility:** Validate citations and sanity check outputs
**Inputs:** all prior objects + source references
**Outputs:** validation report + auto-adjusted confidence + “unsupported claims” list
**Dependencies:** Entire pipeline

This agent:

- runs rule checks
- runs redundancy checks (second sources)
- flags hallucination risk
- blocks report generation if unsupported claims exceed threshold

---

### M. Report Synthesis Agent

**Responsibility:** Convert structured objects into narrative + visuals + interactive report block JSON
**Inputs:** all objects + validation report
**Outputs:** versioned report JSON with interactive sections and references
**Dependencies:** Validation

---

## Data dependencies summary (short)

- Research depends on identity resolution
- Market depends on research
- Competitor discovery depends on market (industry terms)
- Competitor profiling depends on competitor discovery
- Strategy depends on company + market + competition
- Value creation depends on strategy
- Modeling depends on value creation + benchmarks
- Valuation depends on modeling
- Verification depends on everything
- Report depends on verification

---

# 3. External Services and APIs (stack recommendation)

## Recommended search + retrieval stack (production viable)

**Primary (paid, reliable):**

- **SerpAPI**: stable search wrapper over Google/Bing; deterministic enough for caching and rate-limited workloads
- **Tavily** (or similar) for high-level “research” summaries if needed, but I’d prefer deterministic extraction over summarized outputs in financial workflows

**Secondary / specialized sources (mix):**

- **OpenCorporates**: legal entity and basic company registry data (even if incomplete, useful for canonical references and anti-duplication)
- **Nordic company info sites** (need to verify legal terms per source): Allabolag/Proff/… (be careful with scraping; might violate ToS—prefer official API access where possible)
- **Industry reports**: ideally stored internally as a library; avoid live scraping paywalls
- **News**: instead of NewsAPI (often noisy), consider:
  - GDELT (massive, still noisy)
  - context-specific RSS ingestion per company (pulling PR/newsroom updates)
- **LinkedIn**: avoid scraping; use human-in-loop and allow manual linking to profiles (scraping has legal + stability risk)

## How to pick “best” sources

- **Reliability:** APIs with defined schema and uptime (SerpAPI, OpenCorporates)
- **Cost:** minimize web search volume via caching and a deterministic retrieval workflow
- **Quality:** prioritize primary sources (company website, annual reports, press releases) over SEO blogs

## Practical recommendation

- Start with **SerpAPI + browserless/playwright renderer** + internal extractor.
- Add specialized data vendors later if needed for scaling quality (PitchBook/Crunchbase are expensive and may require contracts).

---

# 4. Agent Orchestration Framework (framework recommendation)

## Recommended architecture: LangGraph + Temporal (or similar)

### LangGraph

**Pros**

- Great for graph-based workflows
- Introspectable state machine
- Works naturally with tool calls (retrieval tools) and multi-agent patterns
- Suitable for agent “planner + verifier + synthesis” structure

**Cons**

- You still need durability: if the process crashes, you need resume/retry outside the in-memory graph

### Temporal (or equivalent durable orchestrator)

**Pros**

- Durable workflows, retries, backoff
- Idempotency guarantees
- Recoverability and visibility into workflow state
- Good fit for 50–100 company batch runs with step restarts

**Cons**

- Added operational complexity
- Requires disciplined workflow design

### Recommendation

- **Use LangGraph for agent logic and decision graph**
- **Use Temporal for durable orchestration + retries + scheduling**
- Use a queue (Redis/Celery) for micro-tasks (per competitor profiling), orchestrated by Temporal workflows.

**Alternative (simpler start)**

- FastAPI + RQ/Redis queue + LangGraph (no Temporal initially)
- Upgrade to Temporal when workflows become complex and need durability.

---

# 5. Data Architecture (schema-driven)

## Storage technologies

- **PostgreSQL**: primary system of record
- **pgvector** (in Postgres) or **Postgres + vector column**: for retrieval augmentation cache
- **S3-compatible object store**: raw HTML snapshots, PDFs, screenshots for reproducibility
- **ElasticSearch/OpenSearch** (optional, later): full-text search across extracted content and sources
- **Neo4j** (optional, later): if relationship queries become first-class (company ↔ competitor ↔ product)

## When vector search is necessary

- When you need **RAG** (Retrieval Augmented Generation) for context chunks, especially for:
  - competitor positioning
  - market trend text extraction
- Not necessary for numeric financial modeling itself; necessary for evidence retrieval and contextual synthesis.

## Proposed core schema (short tables; stable keys)

**companies**

- id (pk)
- orgnr
- name
- canonical_name
- aliases (JSONB)
- domains (JSONB)

**financials**

- company_id (fk)
- year
- revenue
- ebitda
- ebit
- net_income
- gross_margin
- ebitda_margin
- opex
- capex
- working_capital
- source_internal_batch_id

**company_profile**

- company_id
- description (JSONB or structured fields)
- business_model
- products
- geography
- ownership
- sources_refs (JSONB)
- version
- created_at

**market_analysis**

- company_id
- industry
- tam
- growth_rate
- segments (JSONB)
- structural_trends (JSONB)
- sources_refs (JSONB)
- confidence_score
- version

**competitors**

- company_id (subject)
- competitor_id (fk to companies or “external company” table)
- similarity_score
- evidence_refs (JSONB)
- created_at

**competitor_metrics**

- competitor_id
- metric_year
- revenue_range
- ebitda_margin_range
- geography
- positioning
- sources_refs
- confidence_score

**value_creation_initiatives**

- company_id
- initiative_id
- category
- description
- driver_assumptions (JSONB)
- estimated_impact_range
- dependencies (JSONB)
- risk_score
- sources_refs

**projections**

- company_id
- scenario (base/downside/upside)
- year
- revenue
- ebitda
- capex
- working_capital_delta
- fcf
- created_at
- model_config (JSONB)

**valuation**

- company_id
- scenario
- ev_range
- multiple_applied
- peer_range
- sources_refs
- created_at

**sources**

- source_id (pk)
- company_id (nullable)
- url
- title
- publisher
- published_date
- credibility_score
- raw_content_location (S3 key)
- extracted_text (TEXT)
- ingestion_batch_id

**claims**

- claim_id
- subject_type (company/competitor/market/etc.)
- subject_id
- claim_text
- derived_from_agent
- sources_list (array of source_ids)
- confidence_score
- verification_status (supported/unsupported/flagged)

This creates a strong provenance layer: the report is a synthesis over `claims` and structured modeling outputs.

---

# 6. Report Generation System (interactive + dynamic)

## Output format

- Generate **versioned report JSON** consisting of ordered “blocks”:
  - `executive_summary`
  - `company_overview`
  - `market`
  - `competition`
  - `strategy`
  - `value_creation`
  - `financials`
  - `valuation`
  - `appendix_sources`

Each block contains:

- narrative (LLM generated from structured objects)
- key metrics
- charts (generated via backend or front-end chart lib)
- inline references: `references: [source_id,...]`

## Rendering architecture

- Backend:
  - Report API returns report JSON + signed URLs for charts + structured data.
  - Chart generation:
    - Use Matplotlib in backend to generate PNG/SVG
    - store in S3 and reference by signed URL
- Frontend (React/Next):
  - Render sections
  - Expandable references: click shows titles + publisher + date + snippet + “open source”
  - Inline editing:
    - competitor list
    - assumptions
    - value-creation initiatives
    - all edits create new versions

## Dynamic updates

- Changes to competitors trigger:
  - re-run competitor profiling for that new competitor only
  - update competition synthesis
  - optionally re-run valuation benchmarking
- Changes to assumptions trigger:
  - re-run projections (deterministic)
  - re-run valuation

Avoid re-running the entire pipeline; build **dependency-driven incremental recompute**.

---

# 7. Financial Modeling Strategy (deterministic + defensible)

## Projection methodology

### Step 1: Normalize historicals

- Use internal financials + any verified external data to build a “clean” historical series:
  - revenue
  - gross margin
  - EBITDA margin
  - capex %
  - working capital intensity (ΔWC/Revenue)

### Step 2: Build drivers (explicit assumptions)

Drivers should map to value creation initiatives:

- **Volume growth drivers**
  - market growth (industry-level baseline)
  - share gain via competitive advantage
  - channel expansion (D2C/Ecomm)
  - geography expansion
- **Pricing drivers**
  - premium positioning
  - inflation pass-through
- **Margin drivers**
  - gross margin improvement via mix/operations
  - opex leverage
  - cost efficiencies

### Step 3: Benchmarking

- Use competitor ranges as sanity bounds:
  - revenue growth compared to peer median
  - margin targets constrained by peer maximum unless a specific moat supports it
- Where competitor data is missing: widen ranges and lower confidence, not fabricate precision.

### Step 4: Scenarios

- Base / Downside / Upside:
  - vary growth, margin expansion, working capital
  - keep assumptions explicitly tied to sources or reasoned modeling notes
  - include downside triggers (fx risk, recession, supply chain)

### Step 5: Output

- 7-year annual projections
- Key charts:
  - Revenue CAGR
  - EBITDA margin vs peers
  - FCF profile
  - EV sensitivity to multiple and margin

---

# 8. Verification and Source Validation System

## Verification mechanisms

1. **Multi-source requirement**
  - Numeric claims must have >=2 independent sources OR be labeled “single-source low confidence”
2. **Confidence scoring**
  - Source credibility scoring:
    - regulatory filings > company website > reputable news > third-party blogs
  - Derived claim confidence is function of:
    - # sources
    - recency
    - agreement
    - credibility
3. **Consistency checks**
  - revenue and headcount sanity bounds
  - geography mismatch detection (company says Sweden-only but sources show exports)
  - year mismatch (2021 revenue cited as 2023)
4. **Claim-level verification**
  - verifier agent compares each claim to its sources:
    - checks existence of supporting spans
    - classifies as supported/unsupported
5. **Hallucination guardrails**
  - if verifier can’t validate, block that claim from the report or explicitly mark it as “unverified”
  - disallow “hard” financial numbers without evidence

## Source ranking

- per publisher + domain reputation
- per source type (primary vs secondary)
- recency weighting with decay

---

# 9. Human-in-the-Loop Controls (UI design)

## Human roles

- **Investment analyst**: edits competitor lists, approves assumptions
- **PM/Deal lead**: signs off on value-creation initiatives and risks
- **Finance**: checks modeling constraints

## UI features

- “Draft report” view with:
  - **Competitor editor** (add/remove/merge)
  - **Assumption panel**
    - revenue growth components
    - margin targets
    - working capital parameters
  - **Verification panel**
    - unsupported claims list
    - sources used
- Versioning:
  - every edit creates new report version and links to updated structured objects
- “Send for re-run” buttons:
  - re-run affected pipeline nodes only (not everything)

---

# 10. Technology Stack Recommendation

## Backend

- **FastAPI** (Python) for API and orchestration endpoints
- **LangGraph** for agent decision graph
- **Temporal** (or start with RQ/Celery + later upgrade) for durable execution
- **PostgreSQL** + `pgvector`
- **S3-compatible storage** (MinIO or cloud provider)
- **Redis** for caching and queues
- **Playwright/Browserless** for rendering JS sites

## LLM provider

- **OpenAI** for core reasoning + synthesis
- Consider `o3-mini` style models for cheaper tasks or verify with smaller models to reduce costs
- Keep models behind a strict schema contract; use Pydantic structured outputs.

## Search APIs

- **SerpAPI** as primary
- Consider Tavily-like augmentation if needed

## Hosting

- Containerized deployment (Docker)
- Kubernetes/EKS/GKE (or ECS) for scaling agents and worker pools
- Observability:
  - Prometheus + Grafana
  - ELK/OpenSearch for logs
  - workflow tracing (Temporal UI)

---

# 11. Implementation Roadmap (step-by-step)

## Phase 1 — Foundations (2–3 weeks)

- Set up Postgres + schemas + internal financial ingestion
- Implement `Entity Resolution` with deterministic canonicalization
- Build source ingestion + caching + S3 snapshots
- Build claim model and structured object storage with versioning

## Phase 2 — Web retrieval + extractor (2–4 weeks)

- Implement search wrapper, renderer, extractors
- Normalize extracted content to `sources` table
- Build internal evidence retrieval API for downstream agents

## Phase 3 — Core research agents (2–4 weeks)

- Research agent -> company profile
- Market intelligence agent
- Competitor discovery agent
- Parallel competitor profiling microtasks

## Phase 4 — Strategy + value creation (2–3 weeks)

- Strategy/moat + non-generic SWOT
- Value creation initiative model: drivers + risks + dependencies

## Phase 5 — Financial modeling (3–5 weeks)

- Deterministic projection engine in Python
- Benchmark constraints from competitor data
- Scenario generation and sensitivity

## Phase 6 — Valuation + verification (2–3 weeks)

- Valuation agent (multiples + peer range + sensitivity)
- Verification agent + claim validation dashboard
- enforce blocking rules

## Phase 7 — Report generation + UI integration (4–6 weeks)

- Report block JSON + rendering UI (React/Next)
- interactive references + editing + incremental recompute
- versioning and approval workflow

## Phase 8 — Scaling to 50–100 companies (ongoing)

- Caching/queue optimization
- rate limiting
- concurrency limits per company and per stage
- cost monitoring and model selection policies

---

# 12. Cursor Development Workflow (with AI coding agents)

## Principles

- Cursor AI agents should be used to generate **boilerplate**, but:
  - keep all agent prompts in version-controlled files
  - enforce strict schema outputs
  - run unit tests and integration tests for determinism

## Repository structure (monorepo)

```
/nivo
  /apps
    /api        # FastAPI app
    /worker     # LangGraph + Temporal workers
    /frontend   # Next.js/React
  /packages
    /domain     # Pydantic models, schemas
    /agents     # agent definitions + LangGraph graphs
    /retrieval  # search wrapper, playwright, extractors
    /verification # claim validation logic
    /modeling   # financial projection engine
    /valuation  # valuation methods
  /infra
    /k8s
    /terraform
  /docs
    agent_prompts.md
    system_architecture.md
    decision_log.md
```

## Cursor prompts

- Build prompts per agent in `docs/agent_prompts.md` with:
  - purpose
  - inputs schema
  - outputs schema
  - “forbidden behaviors”
  - citations rule
- Keep them stable and versioned; changes should be deliberate.

## Service boundaries

- Retrieval is a pure service (deterministic)
- Agents operate over structured data + references
- Modeling is code-only (no LLM math)

---

# 13. Risks and Failure Modes (with mitigations)

## Risk: hallucination / unsupported claims

**Mitigation**

- claim-level verification
- multi-source thresholds
- block report generation when unsupported claims exceed threshold
- “unverified” label in UI for claims that are kept

## Risk: entity confusion (mixing companies)

**Mitigation**

- canonicalization + alias tracking + domain/domain evidence
- never proceed with low-confidence identity resolution

## Risk: cost explosion from web search + rendering

**Mitigation**

- caching at query and extracted content level
- limit top-N results and sources
- batch processing in off-peak schedules
- use deterministic “primary sources first” retrieval strategy

## Risk: slow run time for 50–100 companies

**Mitigation**

- parallelize competitor profiling
- incremental recompute driven by dependency graph
- per-stage timeouts and fallbacks

## Risk: incorrect financial projections

**Mitigation**

- deterministic modeling engine
- benchmark constraints
- scenario ranges rather than single-point estimates
- human sign-off on key assumptions

## Risk: legal/ToS compliance (scraping)

**Mitigation**

- prefer APIs and permissioned sources
- store domain-specific compliance notes
- build fallbacks to manual ingestion if automated access is restricted

---

## What I need from you to finalize

1. Upload **Backend Deep Analysis.txt** (it may contain specific tool choices, constraints, or model version requirements).
2. Confirm whether you have access to any paid market/company data vendors (PitchBook/Crunchbase/Orbis) or if we must operate purely on public web data + internal financials.


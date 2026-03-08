It converts the Nivo backend concept into an implementation sequence grounded in the original architecture: PostgreSQL as core store, agent orchestration over the company → market → competition → strategy → value creation → projection → valuation → report flow, interactive report APIs, and source-backed claims.  It also reflects the report depth and section structure shown in the Bruno Mathsson memo, especially the need to support company profiling, market analysis, competitor benchmarking, value-creation logic, financial projections, valuation, and diligence-style follow-up.

⸻

Purpose

This document defines the backend implementation plan for the Nivo automated company analysis platform.

It is intended to be detailed enough that engineers can begin implementation in Cursor immediately.

The backend must support:
	•	ingestion of internal company financials
	•	agent orchestration for deep research
	•	public-web retrieval and source storage
	•	structured evidence and claim verification
	•	deterministic financial modeling
	•	interactive report generation
	•	human-in-the-loop edits and partial recompute

⸻

1. Target Backend Responsibilities

The backend is responsible for six core capabilities:
	1.	Company analysis run lifecycle
	•	create, schedule, track, retry, cancel runs
	2.	Structured data storage
	•	company data
	•	agent outputs
	•	sources
	•	claims
	•	reports
	•	versions
	3.	Agent execution
	•	orchestration of sequential + parallel tasks
	•	stage dependency management
	•	persistence after every stage
	4.	Retrieval and evidence
	•	search, fetch, render, extract, rank, store
	5.	Modeling and valuation
	•	deterministic scenario engine
	•	benchmark-aware valuation engine
	6.	Report serving
	•	structured report JSON
	•	source references
	•	version history
	•	edit-triggered recompute

⸻

1. Backend Service Architecture

Recommended services

apps/api           -> FastAPI public/internal API
apps/worker        -> orchestration and async agent runners
packages/domain    -> schemas and contracts
packages/retrieval -> search, fetch, render, extract
packages/agents    -> prompt-driven agent logic
packages/verification -> claim validation and confidence logic
packages/modeling  -> deterministic projection engine
packages/valuation -> valuation engine
packages/reporting -> report synthesis and charts

This maps directly to the architecture’s need for PostgreSQL-backed agent outputs, orchestrated research stages, web search integration, and report APIs.

⸻

1. Recommended Technology Choices

Core stack
	•	FastAPI for backend APIs
	•	PostgreSQL for source-of-truth structured storage
	•	pgvector for chunk embeddings and evidence retrieval
	•	Redis for caching and short-lived coordination
	•	LangGraph for agent graph execution
	•	Temporal for durable workflow orchestration
	•	Playwright for rendered retrieval
	•	Pydantic for all agent and API contracts
	•	SQLAlchemy or SQLModel for persistence layer
	•	Object storage for raw HTML, PDFs, screenshots, charts

Why

The original docs already point to PostgreSQL, LangGraph, Temporal, and public search integration as the core stack.

⸻

1. Build Order

Build in this order:
	1.	domain models
	2.	database + migrations
	3.	run lifecycle API
	4.	retrieval layer
	5.	orchestrator
	6.	research agents
	7.	competitor system
	8.	strategy/value creation
	9.	financial model
	10.	valuation
	11.	verification
	12.	report engine
	13.	UI-facing edit/recompute APIs

That order reduces compound failure risk and matches the natural dependency structure of the Nivo pipeline.

⸻

1. Phase-by-Phase Plan

Phase 1 — Domain and Data Foundations

Objective

Create the core schemas and persistence layer.

Deliverables
	•	Pydantic models
	•	DB schema
	•	Alembic migrations
	•	run/versioning framework

Required tables

companies
financials
runs
run_events
sources
source_chunks
claims
company_profiles
market_analyses
competitor_relations
competitor_profiles
strategies
value_creation_initiatives
financial_models
valuations
reports
report_versions
user_edits

Key schema rules

Every generated object should contain:
	•	id
	•	company_id
	•	run_id
	•	version
	•	created_at
	•	confidence_score
	•	source_refs
	•	created_by_agent

Definition of done
	•	migrations run locally
	•	seed script inserts one company + one financial history
	•	test query can retrieve full company object tree

⸻

Phase 2 — Run Lifecycle and API Skeleton

Objective

Stand up the backend shell before agent logic.

Deliverables

Endpoints:

POST /analysis/run
GET /analysis/run/{run_id}
GET /analysis/{company_id}
POST /analysis/update
POST /analysis/recompute
GET /companies/{company_id}/sources

Required behavior
	•	create a run
	•	set initial status
	•	store requested scope
	•	return run state
	•	list stage progress

Run status model

PENDING
PLANNED
RUNNING
PARTIAL_SUCCESS
FAILED
SUCCEEDED
CANCELLED

Definition of done
	•	run can be created and queried
	•	fake stage progress can be persisted and returned
	•	structured API errors exist

⸻

Phase 3 — Retrieval Layer

Objective

Implement evidence ingestion before any serious agent reasoning.

Deliverables
	•	SerpAPI wrapper
	•	query planner
	•	search cache
	•	fetcher
	•	renderer
	•	parser
	•	extractor primitives
	•	evidence store

Internal modules

packages/retrieval/
  query_planner.py
  search_service.py
  fetch_service.py
  render_service.py
  html_cleaner.py
  pdf_parser.py
  extractors/
  ranking.py
  evidence_store.py

Required outputs
	•	source metadata
	•	source chunks
	•	extracted field candidates
	•	quality scores

Definition of done
	•	given a company name, the system can:
	•	generate stage-aware search queries
	•	search
	•	fetch top sources
	•	store artifacts
	•	extract clean text
	•	repeated searches hit cache

This phase is essential because the original design depends on dynamic public-web research rather than a fixed source library.

⸻

Phase 4 — Planner + Orchestrator

Objective

Introduce execution control for the agent graph.

Deliverables
	•	Planner agent
	•	AnalysisState schema
	•	LangGraph graph definition
	•	Temporal workflow wrapper
	•	per-node persistence hooks

State object

class AnalysisState(TypedDict):
    company_id: str
    run_id: str
    company_profile: dict | None
    market_analysis: dict | None
    competitors: list | None
    competitor_profiles: list | None
    strategy: dict | None
    value_creation: dict | None
    financial_model: dict | None
    valuation: dict | None
    verification: dict | None
    report: dict | None
    errors: list

Node order

identity
company_profile
market_analysis
competitor_discovery
competitor_profiling
strategy
value_creation
financial_model
valuation
verification
report_generation

Definition of done
	•	one dummy company can run through all nodes with stub outputs
	•	node outputs persist after each stage
	•	failed nodes retry with backoff
	•	workflow can resume from persisted state

⸻

Phase 5 — Identity + Company Profiling

Objective

Solve company identity before broader research.

Deliverables
	•	entity resolution service
	•	canonical company object
	•	company profiling agent

Identity output

{
  "canonical_name": "",
  "org_number": "",
  "official_domain": "",
  "aliases": [],
  "identity_confidence": 0.0
}

Company profile output

{
  "description": "",
  "business_model": "",
  "products": [],
  "geography": [],
  "revenue_streams": [],
  "ownership": "",
  "history": "",
  "sources": []
}

These outputs mirror the original Nivo agent definitions.

Definition of done
	•	system can resolve and persist one canonical company
	•	low-confidence identity triggers analyst-review state
	•	company profile is backed by stored sources

⸻

Phase 6 — Market Analysis

Objective

Produce a structured market view.

Deliverables
	•	market analysis agent
	•	broad industry and niche labeling
	•	market-size candidate extraction
	•	growth-range support logic
	•	trend extraction

Output shape

{
  "industry": "",
  "niche": "",
  "market_size": "",
  "market_growth": "",
  "market_segments": [],
  "structural_trends": [],
  "digital_opportunities": [],
  "sources": []
}

This matches the original market-analysis requirements and supports the market/context sections seen in the Bruno Mathsson memo.

Definition of done
	•	market object stored with source-backed fields
	•	contradictory growth/TAM estimates are stored as candidates, not silently overwritten
	•	confidence score computed

⸻

Phase 7 — Competitor System

Objective

Build the most important benchmark layer.

Deliverables
	•	competitor discovery agent
	•	competitor similarity scoring
	•	competitor profile agent
	•	competitor edit endpoints
	•	recompute dependency mapping

Two-layer competitor model

Store:
	1.	operating comparables
	2.	positioning comparables

Competitor relation shape

{
  "competitor_name": "",
  "comparable_type": "operating|positioning",
  "similarity_score": 0.0,
  "include_rationale": "",
  "sources": []
}

Competitor profile shape

{
  "name": "",
  "description": "",
  "revenue_estimate": "",
  "margins_estimate": "",
  "geography": [],
  "positioning": "",
  "business_model": "",
  "sources": []
}

The original architecture makes competitor analysis editable and central to downstream report logic, so this phase must be implemented before strategy and valuation.

Definition of done
	•	discovery returns ranked competitor list
	•	per-competitor profiling can run in parallel
	•	user can add/remove competitor
	•	downstream recompute plan generated correctly

⸻

Phase 8 — Strategy + Value Creation

Objective

Turn evidence into an investment thesis.

Deliverables
	•	strategy agent
	•	value-creation agent
	•	anti-generic validation
	•	initiative scoring

Strategy output

{
  "strengths": [],
  "weaknesses": [],
  "opportunities": [],
  "threats": [],
  "moat_analysis": [],
  "sources": []
}

Value creation output

[
  {
    "initiative": "",
    "category": "revenue|operations|balance_sheet|digital|people",
    "impact_estimate": "",
    "risk_level": "",
    "required_capabilities": [],
    "time_to_impact": "",
    "sources": []
  }
]

This phase should explicitly support the five-pillar value-creation model in the source docs: revenue acceleration, operational efficiency, balance-sheet optimization, digitalization, and people/organization.

Definition of done
	•	strategy output contains evidence-backed, non-generic items
	•	value-creation initiatives map to categories and assumptions
	•	each initiative includes at least one operational mechanism

⸻

Phase 9 — Financial Modeling

Objective

Create deterministic 7-year projections.

Deliverables
	•	Python modeling engine
	•	scenario support
	•	assumption registry
	•	benchmark bounds

Key rule

LLMs may propose assumptions, but they do not perform the calculations.

Core model inputs
	•	historical financials
	•	market growth
	•	strategy/value-creation drivers
	•	competitor benchmarks
	•	working capital assumptions
	•	margin assumptions

Core outputs

{
  "base_case": {...},
  "downside_case": {...},
  "upside_case": {...},
  "assumptions": [...]
}

The original backend notes require a 7-year projection with explicit comment, reasoning, and source per assumption.

Definition of done
	•	deterministic projections from structured inputs
	•	unit tests cover growth, margin, WC, and capex logic
	•	assumptions stored as editable objects

⸻

Phase 10 — Valuation

Objective

Estimate enterprise value without fake precision.

Deliverables
	•	multiple-based valuation engine
	•	peer-range support
	•	sensitivity matrix
	•	methodology disclosure

Output

{
  "multiple_range": "",
  "peer_comparables": [],
  "enterprise_value_range": "",
  "sensitivity_matrix": {},
  "uncertainty_note": ""
}

This aligns with the original valuation methods and the investment memo’s emphasis on peer comparisons, operating value, downside protection, and scenario thinking.

Definition of done
	•	valuation references peer set
	•	uncertainty is explicit
	•	no single precise value output unless evidence supports it

⸻

Phase 11 — Verification Layer

Objective

Block hallucinated synthesis.

Deliverables
	•	claim table population
	•	support-span matching
	•	multi-source checks
	•	contradiction handling
	•	unsupported-claim blocking

Verification labels

SUPPORTED
UNSUPPORTED
UNCERTAIN
CONFLICTING

Required logic
	•	important numeric claims should have 2 sources when possible
	•	unsupported claims cannot appear in final report prose
	•	all claims link to source spans

Definition of done
	•	verification runs automatically before report synthesis
	•	unsupported claims visible through API
	•	report generation refuses unsupported hard facts

⸻

Phase 12 — Report Generation

Objective

Generate structured, interactive report JSON.

Deliverables
	•	report synthesis agent
	•	report block schema
	•	chart generation service
	•	source reference embedding
	•	report versioning

Report sections

Executive Summary
Company Overview
Market Analysis
Competitive Landscape
Strategic Position
Value Creation
Financial Projection
Valuation

That structure is explicitly called for in the original Nivo docs and mirrors the reference memo structure.

Suggested block schema

{
  "section_id": "market_analysis",
  "title": "Market Analysis",
  "body_blocks": [],
  "charts": [],
  "source_refs": []
}

Definition of done
	•	report JSON can be rendered by frontend
	•	references are clickable
	•	all narrative paragraphs map to verified claims

⸻

Phase 13 — Human-in-the-Loop APIs

Objective

Support analyst correction without rerunning everything.

Deliverables
	•	competitor edit endpoints
	•	assumption edit endpoints
	•	rerun-subgraph logic
	•	version diff endpoints

Recompute rules

Examples:
	•	competitor edit -> rerun competitor profiling, strategy, value creation, financial model, valuation, verification, report
	•	market override -> rerun market, competitors, strategy, value creation, financial model, valuation, verification, report
	•	assumption edit -> rerun financial model, valuation, verification, report

Definition of done
	•	partial recompute works
	•	old versions preserved
	•	analysts can compare before/after outputs

⸻

1. API Contract Plan

Run APIs

POST /analysis/run
GET /analysis/run/{run_id}
POST /analysis/run/{run_id}/cancel
POST /analysis/run/{run_id}/retry

Company/report APIs

GET /analysis/{company_id}
GET /analysis/{company_id}/report/latest
GET /analysis/{company_id}/report/{version}
GET /analysis/{company_id}/sources
GET /analysis/{company_id}/claims

Edit APIs

POST /analysis/{company_id}/competitors
DELETE /analysis/{company_id}/competitors/{competitor_id}
POST /analysis/{company_id}/assumptions
POST /analysis/{company_id}/market-override
POST /analysis/{company_id}/recompute

Admin/debug APIs

GET /runs
GET /runs/{run_id}/events
GET /sources/{source_id}
GET /claims/{claim_id}

⸻

1. Database Implementation Notes

Must-have indexes
	•	runs(company_id, created_at desc)
	•	sources(domain, published_date)
	•	claims(company_id, verification_status)
	•	competitor_relations(company_id, similarity_score desc)
	•	report_versions(company_id, version desc)

Vector index
	•	embeddings on source_chunks.embedding

Versioning rule

Never overwrite prior stage outputs; insert a new version row and mark it active.

⸻

1. Queue and Worker Design

Worker types
	•	retrieval_worker
	•	agent_worker
	•	modeling_worker
	•	report_worker
	•	verification_worker

Concurrency rules
	•	competitor profiling runs in parallel
	•	retrieval should be rate-limited per domain/provider
	•	report generation should be single-run per company version

Idempotency

Every task must use:
	•	run_id
	•	node_name
	•	version

to avoid duplicated writes.

⸻

1. Logging and Observability

Log every stage

Store:
	•	run_id
	•	company_id
	•	stage
	•	started_at
	•	completed_at
	•	duration_ms
	•	result_status
	•	source_count
	•	claim_count
	•	confidence_summary

Metrics
	•	run success rate
	•	stage failure rate
	•	search calls per company
	•	retrieval cache hit rate
	•	unsupported claim rate
	•	average time per run
	•	average time per competitor profile
	•	token usage by agent stage

⸻

1. Error Handling Rules

Soft fail

Continue with warnings if:
	•	one source times out
	•	one competitor cannot be profiled
	•	market size is uncertain
	•	some values remain unknown

Hard fail

Escalate or block if:
	•	identity confidence is too low
	•	no credible source exists for official company resolution
	•	verification finds too many unsupported critical claims
	•	financial model input integrity fails

Error object

{
  "run_id": "",
  "stage": "",
  "error_type": "",
  "message": "",
  "retryable": true,
  "created_at": ""
}

⸻

1. Testing Strategy

Unit tests
	•	query planner
	•	extraction logic
	•	similarity scoring
	•	financial formulas
	•	valuation sensitivity logic
	•	verification scoring

Integration tests
	•	run one company through full graph with stub sources
	•	competitor edit triggers partial recompute
	•	unsupported claim blocks report synthesis

Golden tests

Use one or two reference companies and verify stable output structure across code changes.

The Bruno Mathsson memo is a useful gold-standard reference for section depth, although not as a literal truth source for unrelated companies.

⸻

1. Cursor Execution Plan

How to use Cursor on this backend

Split implementation into small, schema-first tasks.

Good Cursor task pattern
	1.	define schema
	2.	define interface
	3.	implement service
	4.	add tests
	5.	wire endpoint or graph node

Bad Cursor task pattern
	•	“build the whole backend”
	•	“build all agents”
	•	“make the orchestration system”

Recommended order for Cursor tickets
	1.	domain models
	2.	migrations
	3.	run APIs
	4.	retrieval services
	5.	LangGraph state + nodes
	6.	identity/profile agent
	7.	market agent
	8.	competitor subsystem
	9.	strategy/value creation
	10.	financial model
	11.	valuation
	12.	verification
	13.	reporting

⸻

1. First 10 Engineering Tasks
  1. Create repo structure and base packages
  2. Implement domain schemas in /packages/domain
  3. Add DB models and migrations
  4. Add FastAPI app and run endpoints
  5. Add run state persistence
  6. Add SerpAPI wrapper and query cache
  7. Add fetch/render service
  8. Add source and chunk persistence
  9. Add LangGraph state + skeleton nodes
  10. Add identity resolution + company profile agent

⸻

1. Definition of Backend MVP

The backend MVP is done when it can:
	•	ingest one company’s internal financials
	•	run the pipeline through identity, company profile, market, competitors, strategy, value creation, projections, valuation, verification, and report
	•	store all outputs and sources
	•	expose the latest report via API
	•	support one analyst edit and partial recompute

That is the minimum useful backend consistent with the original Nivo objective of automated deep research with an interactive report and human review on top.

⸻

1. Frontend Handoff Notes

When this backend is connected to UI, the presentation layer should follow the current backend UX and not the frontpage 





1. Suggested Next File

The next most useful document is:

database-schema-spec.md

That file should define:
	•	full table-by-table schemas
	•	field types
	•	enum values
	•	foreign-key relations
	•	indexes
	•	versioning logic
	•	JSONB vs normalized-table decisions

That would let Cursor generate the migrations and models much more cleanly.
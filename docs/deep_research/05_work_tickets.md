# Nivo Platform — Engineering Work Breakdown Tickets

---

# EPIC 1 — Core Infrastructure

---

# Ticket 1.1 — Repository Bootstrap

## Description

Initialize the Nivo platform repository with the base project structure.

The repository must support:

- FastAPI backend
- agent worker services
- retrieval services
- deterministic modeling services
- frontend UI
- shared domain models

### Repository structure

```
/nivo
  /apps
     /api
     /worker
     /frontend
  /packages
     /domain
     /agents
     /retrieval
     /verification
     /modeling
     /valuation
     /reporting
  /infra
     /docker
     /terraform
  /docs
```

---

## Definition of Done

- repo builds locally
- lint + test scripts exist
- Dockerfiles exist
- FastAPI service runs
- README explains dev setup

---

## Dependencies

None

---

## Suggested Cursor Prompt

```
Create a Python monorepo structure for an AI agent system.

Tech stack:
FastAPI backend
LangGraph agents
PostgreSQL
Redis
Playwright
Pydantic models

Structure:

/apps/api
/apps/worker
/apps/frontend

/packages/domain
/packages/agents
/packages/retrieval
/packages/modeling
/packages/valuation
/packages/reporting
/packages/verification

Create:
pyproject.toml
Dockerfiles
Makefile
README

Ensure dependencies include:
fastapi
pydantic
sqlalchemy
psycopg
langgraph
redis
playwright
```

---

# Ticket 1.2 — Database Schema

## Description

Create the core database schema.

Tables must include:

```
companies
financials
company_profile
market_analysis
competitors
competitor_metrics
strategy
value_creation
projections
valuations
sources
claims
reports
runs
```

All objects must include:

```
created_at
version
run_id
confidence_score
```

---

## Definition of Done

- migrations run successfully
- foreign keys enforced
- test inserts pass
- pgvector enabled

---

## Dependencies

Ticket 1.1

---

## Suggested Cursor Prompt

```
Create SQLAlchemy models for the following tables:

companies
financials
company_profile
market_analysis
competitors
competitor_metrics
strategy
value_creation
projections
valuations
sources
claims
reports
runs

Requirements:

Use PostgreSQL
Use pgvector
Use UUID primary keys
Add timestamps
Add versioning fields

Generate migration scripts.
```

---

# EPIC 2 — Retrieval Layer

---

# Ticket 2.1 — SerpAPI Wrapper

## Description

Build a reusable **search service**.

Responsibilities:

- query Google via SerpAPI
- cache responses
- return structured search results

---

## Definition of Done

- search results cached
- identical query returns cached results
- API rate limits enforced

---

## Dependencies

Ticket 1.1

---

## Cursor Prompt

```
Create a Python search service that wraps SerpAPI.

Requirements:

Functions:
search(query: str)

Features:

rate limiting
Redis caching
structured output

Return fields:

title
url
snippet
domain
date

Ensure deterministic outputs.
```

---

# Ticket 2.2 — Web Page Renderer

## Description

Build a **web fetch + render service**.

Required for:

- JavaScript sites
- extracting structured content

Use **Playwright**.

---

## Definition of Done

- fetch HTML
- store raw HTML in object storage
- extract text content
- return metadata

---

## Dependencies

Ticket 2.1

---

## Cursor Prompt

```
Create a Playwright-based web renderer service.

Function:

fetch_page(url)

Return:

html
title
text_content
metadata

Store raw HTML to object storage.

Implement timeout protection.
```

---

# Ticket 2.3 — Extraction Pipeline

## Description

Extract structured information from web pages.

Fields:

```
company_description
products
geography
industry_keywords
revenue_estimates
employee_counts
```

---

## Definition of Done

- deterministic extraction
- confidence scores
- tests with example pages

---

## Cursor Prompt

```
Create an information extraction module.

Input:
HTML text

Output schema:

company_description
products
geography
industry_keywords
revenue_estimates
employee_counts

Include confidence scores.

Prefer rule-based extraction before LLM fallback.
```

---

# EPIC 3 — Agent System

---

# Ticket 3.1 — Planner Agent

## Description

The Planner Agent creates the task graph for company analysis.

Output example:

```
Plan:
 nodes:
   company_profile
   market_analysis
   competitor_discovery
   competitor_profiles
   strategy
   value_creation
   modeling
   valuation
   verification
   report
```

---

## Definition of Done

- plan stored in database
- plan reproducible for same input
- nodes validated

---

## Dependencies

Ticket 1.2

---

## Cursor Prompt

```
Create a planner agent that generates a task graph for company analysis.

Inputs:
company_id
financial_snapshot

Output:
Plan object with nodes and dependencies.

Nodes:

company_profile
market_analysis
competitor_discovery
competitor_profiles
strategy
value_creation
modeling
valuation
verification
report
```

---

# Ticket 3.2 — Company Profiling Agent

## Description

Agent builds company overview.

Fields:

```
description
products
geography
business_model
ownership
history
```

---

## Definition of Done

- outputs structured object
- includes sources
- includes confidence scores

---

## Cursor Prompt

```
Build a Company Profiling Agent.

Input:
company name
org number

Tasks:

search web
extract company description
identify products
identify geography
identify business model

Output structured JSON.
```

---

# Ticket 3.3 — Market Analysis Agent

## Description

Analyzes market context.

Fields:

```
industry
market_size
market_growth
segments
trends
```

---

## Definition of Done

- industry classification generated
- sources attached

---

## Cursor Prompt

```
Create a Market Analysis Agent.

Input:
company_profile

Tasks:

identify industry
estimate market size
estimate growth
identify trends

Return structured output.
```

---

# Ticket 3.4 — Competitor Discovery Agent

## Description

Find comparable companies.

Output:

```
competitors:
  name
  similarity_score
  sources
```

---

## Definition of Done

- returns competitor list
- ranked by similarity

---

## Cursor Prompt

```
Create a competitor discovery agent.

Input:
company profile
industry

Output:

list of competitors with similarity score.

Use search queries to find comparable companies.
```

---

# Ticket 3.5 — Strategy Agent

## Description

Generate deep strategic insights.

Outputs:

```
SWOT
moat analysis
competitive advantage
```

---

## Definition of Done

- insights specific
- no generic SWOT

---

## Cursor Prompt

```
Create a strategy analysis agent.

Input:

company profile
market analysis
competitor profiles

Output:

SWOT
moat analysis
strategic insights
```

---

# Ticket 3.6 — Value Creation Agent

## Description

Translate strategy into growth initiatives.

Example:

```
D2C ecommerce
international expansion
product portfolio expansion
```

These match the value creation themes seen in the Bruno Mathsson investment memo. 

---

## Definition of Done

- each initiative includes impact estimate
- initiative includes risk score

---

## Cursor Prompt

```
Create a Value Creation Agent.

Input:
strategy insights
financials

Output:

initiatives
impact estimate
risk score
dependencies
```

---

# Ticket 3.7 — Financial Modeling Engine

## Description

Deterministic projection engine.

Outputs:

```
revenue
EBITDA
cash flow
```

7-year projection.

---

## Definition of Done

- deterministic results
- scenario modeling

---

## Cursor Prompt

```
Build a deterministic financial projection engine.

Inputs:

historical financials
growth assumptions
margin assumptions

Outputs:

7 year projections
revenue
EBITDA
cash flow
```

---

# Ticket 3.8 — Valuation Agent

## Description

Estimate enterprise value.

Methods:

```
EBITDA multiples
peer comparison
sensitivity analysis
```

---

## Definition of Done

- produces valuation range
- references peers

---

## Cursor Prompt

```
Create a valuation engine.

Inputs:

financial projections
peer metrics

Outputs:

enterprise value range
multiple assumptions
sensitivity analysis
```

---

# Ticket 3.9 — Verification Agent

## Description

Fact-check claims.

Rules:

- multi-source verification
- span validation
- source credibility scoring

---

## Definition of Done

- unsupported claims flagged
- unsupported claims excluded from report

---

## Cursor Prompt

```
Create a claim verification system.

Inputs:

claims
sources

Output:

verification status

supported
unsupported
uncertain
```

---

# Ticket 3.10 — Report Synthesis Agent

## Description

Generate final analysis report.

Sections:

```
Executive summary
Company overview
Market
Competition
Value creation
Financials
Valuation
```

Matches investment memo format.

---

## Definition of Done

- report JSON generated
- charts generated
- references clickable

---

## Cursor Prompt

```
Create a report synthesis agent.

Inputs:

company profile
market analysis
competition
strategy
value creation
financial projections
valuation

Output:

report JSON with sections and references.
```

---

# EPIC 4 — UI

---

# Ticket 4.1 — Report Viewer

## Description

Render analysis report.

Features:

- expandable references
- charts
- section navigation

---

## Definition of Done

- report JSON renders correctly

---

# Ticket 4.2 — Competitor Editor

## Description

Users can:

- add competitor
- remove competitor
- trigger analysis rerun

---

## Definition of Done

- changes trigger incremental recompute

---

# EPIC 5 — Observability

---

# Ticket 5.1 — Metrics

Metrics:

```
agent runtime
search calls
LLM tokens
cache hit rate
```

---

# Ticket 5.2 — Cost Guardrails

Limits:

```
search calls per company
render calls per run
LLM tokens
```

---

# Next Step

Your **next step after this ticket plan** should be generating:

```
nivo-cursor-coding-plan.md
```

This file will contain **50+ Cursor prompts** that automatically generate:

- agent contracts
- schemas
- services
- LangGraph nodes
- retrieval pipelines

That document dramatically speeds up development.

---

If you'd like, I can also produce **the full agent system diagram (10x clearer)** used by companies building systems like:

- Palantir AIP
- Harvey AI
- AlphaSense
- Perplexity Deep Research

…and it will help your developers **avoid the common agent architecture mistakes**.
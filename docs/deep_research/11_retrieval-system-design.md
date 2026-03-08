Below is the full retrieval-system-design.md you should add to /docs/retrieval-system-design.md.

It turns the Nivo concept from a high-level agent flow into an implementable public-web retrieval system. It is grounded in the original architecture goal of dynamic public-source research with source-backed claims  ￼ and is designed to support reports with the same company → market → competition → value creation → valuation depth seen in the Bruno Mathsson memo.  ￼

⸻

retrieval-system-design.md

Purpose

This document defines the retrieval architecture for the Nivo automated company analysis platform.

The retrieval layer is responsible for:
	•	discovering relevant public sources
	•	fetching and rendering source content
	•	extracting structured facts
	•	storing raw artifacts and normalized evidence
	•	scoring source quality
	•	supplying verified evidence to downstream agents

This layer is the foundation of the entire system. If retrieval quality is poor, all downstream agents degrade.

⸻

1. Goals

The retrieval system must support the Nivo platform’s core objective:
	•	start from internal company financials
	•	enrich with public web research
	•	support 50–100 company analyses
	•	produce source-backed investment-style reports
	•	minimize hallucinations through evidence-first design

⸻

2. Design Principles

2.1 Evidence-first

Every downstream claim must be traceable to one or more stored sources.

2.2 Deterministic where possible

Use templates, ranking rules, and structured extractors before LLM synthesis.

2.3 Raw artifact preservation

Always store:
	•	raw HTML
	•	PDFs
	•	extracted text
	•	metadata
	•	screenshots when useful

2.4 Stage-aware retrieval

Different agents need different query strategies:
	•	company profiling
	•	market analysis
	•	competitor discovery
	•	competitor profiling
	•	valuation support

2.5 Cost-controlled

Public-source research can become expensive through search/render churn. Cache aggressively.

⸻

3. Retrieval Architecture Overview

flowchart TD
    A[Company Input] --> B[Query Planner]
    B --> C[Search Layer]
    C --> D[Result Ranker]
    D --> E[Fetcher / Renderer]
    E --> F[Extractor Layer]
    F --> G[Evidence Store]
    G --> H[Claim Support API]
    H --> I[Agents]
    G --> J[Verification Layer]


⸻

4. Core Components

4.1 Query Planner

Generates deterministic search queries based on:
	•	company identity
	•	current stage
	•	previously discovered facts
	•	known aliases
	•	geography
	•	industry hypotheses

4.2 Search Layer

Primary purpose:
	•	gather candidate URLs and documents

Recommended interfaces:
	•	SerpAPI wrapper
	•	optional fallback search provider
	•	direct site-targeted fetches for known domains

4.3 Result Ranker

Scores and prioritizes results based on:
	•	source type
	•	domain quality
	•	recency
	•	relevance to stage
	•	duplication risk

4.4 Fetcher / Renderer

Responsible for:
	•	HTML fetch
	•	JS rendering via Playwright
	•	PDF fetch
	•	response metadata capture
	•	timeout handling
	•	artifact persistence

4.5 Extractor Layer

Converts fetched content into:
	•	clean text
	•	structured fields
	•	extracted spans
	•	chunked evidence records
	•	table captures where needed

4.6 Evidence Store

Stores:
	•	raw source metadata
	•	extracted evidence
	•	chunks
	•	source scores
	•	field-level extracted facts
	•	retrieval lineage

4.7 Claim Support API

Allows agents to retrieve:
	•	top evidence for a fact
	•	top sources for a topic
	•	support spans for verification
	•	source quality summaries

⸻

5. Retrieval Stages by Agent

5.1 Identity / Company Profiling Retrieval

Purpose:
	•	confirm legal entity
	•	identify canonical domain
	•	gather company overview facts

Typical target sources
	•	official company website
	•	company “About” page
	•	contact/legal/footer pages
	•	registry/public corporate listings
	•	press/news section

Example query templates

"{company_name}" "{org_number}"
"{company_name}" official website
"{company_name}" about
"{company_name}" site:.se
"{company_name}" ownership
"{company_name}" products

Desired outputs
	•	canonical company name
	•	official domain
	•	business description
	•	product categories
	•	geography hints
	•	ownership hints
	•	founding year

⸻

5.2 Market Analysis Retrieval

Purpose:
	•	define industry, niche, TAM, growth, trends

Typical target sources
	•	industry associations
	•	trade organizations
	•	public market reports
	•	reputable consulting/public research summaries
	•	government/trade/export datasets

Query templates

"{company_name}" industry
"{industry_label}" market size
"{industry_label}" growth Europe
"{niche_label}" premium market size
"{niche_label}" Sweden market
"{niche_label}" trends 2025

Desired outputs
	•	broad industry label
	•	niche segment label
	•	market size estimates
	•	growth range
	•	demand drivers
	•	customer segments

⸻

5.3 Competitor Discovery Retrieval

Purpose:
	•	discover true comparable companies

Typical target sources
	•	“brands like” pages
	•	retailer / distributor sites
	•	industry lists
	•	design/manufacturer directories
	•	articles comparing brands / suppliers / producers

Query templates

"{company_name}" competitors
"brands like {company_name}"
"{product_category}" Sweden premium brands
"{niche_label}" Scandinavian competitors
"{company_name}" retailer brands

Desired outputs
	•	longlist of candidates
	•	evidence of similarity
	•	initial comparable classification

⸻

5.4 Competitor Profiling Retrieval

Purpose:
	•	profile each competitor consistently

Typical target sources
	•	official websites
	•	annual reports if public
	•	company presentations
	•	distributor pages
	•	media interviews
	•	public registry summaries

Desired outputs
	•	short company description
	•	positioning
	•	geography
	•	approximate scale
	•	business model hints
	•	possible revenue/margin ranges

⸻

5.5 Valuation Support Retrieval

Purpose:
	•	support peer benchmarking and valuation logic

Typical target sources
	•	annual reports
	•	investor presentations
	•	public transaction articles
	•	public market summaries
	•	sector multiple summaries

Desired outputs
	•	peer set quality
	•	valuation multiple ranges
	•	benchmark quality score
	•	caveats and uncertainty notes

⸻

6. Query Planning Logic

6.1 Query inputs

The Query Planner should consume:
	•	canonical company name
	•	aliases
	•	org number
	•	official domain if known
	•	geography
	•	stage name
	•	known industry hypothesis
	•	product/category keywords

6.2 Query generation strategy

Each stage generates:
	•	3–8 primary queries
	•	1–3 fallback queries
	•	1–3 domain-constrained queries

6.3 Query types

Identity queries

Precise and narrow

Discovery queries

Broader and exploratory

Verification queries

Specifically designed to confirm a claim with second-source evidence

6.4 Query deduplication

Before execution:
	•	normalize whitespace
	•	lowercase canonical cache key
	•	remove repeated alias variants
	•	hash by stage + company + normalized query

⸻

7. Source Ranking Model

Each source should be scored across four dimensions.

7.1 Source type score

Suggested ranking:
	1.	official company site
	2.	public filings / government / registries
	3.	annual reports / official investor materials
	4.	reputable trade associations
	5.	high-quality business media
	6.	niche industry media
	7.	marketplace / retailer pages
	8.	blogs / low-trust aggregators

7.2 Relevance score

How directly the source answers the current stage’s question.

7.3 Recency score

Important especially for:
	•	growth rates
	•	transaction comps
	•	management/team data
	•	valuation context

Less important for:
	•	founding year
	•	legacy brand history
	•	design heritage

7.4 Extraction quality score

Based on:
	•	parse cleanliness
	•	structured spans found
	•	table extraction quality
	•	duplication noise

7.5 Composite score

composite_score =
0.35 * source_type_score +
0.30 * relevance_score +
0.20 * recency_score +
0.15 * extraction_quality_score


⸻

8. Fetching and Rendering

8.1 HTTP fetch

Default first step for simple pages.

Capture:
	•	final URL
	•	redirect chain
	•	content type
	•	response status
	•	fetch timestamp

8.2 Playwright rendering

Use for:
	•	JS-heavy websites
	•	pages with lazy-loaded content
	•	pages where text extraction from raw HTML is weak

Capture:
	•	rendered HTML
	•	page title
	•	visible text
	•	selected screenshots if needed

8.3 PDF handling

For PDFs:
	•	store raw file in object store
	•	extract text
	•	chunk pages
	•	keep page references
	•	optionally render selected pages for review/verification

8.4 Timeouts

Recommended defaults:
	•	HTTP fetch timeout: 15s
	•	render timeout: 30–45s
	•	PDF parse timeout: 20s

8.5 Retry policy

Retry only for:
	•	timeouts
	•	5xx
	•	transient network failures

Do not repeatedly retry:
	•	404
	•	blocked content
	•	invalid mime types

⸻

9. Extraction Pipeline

9.1 Extraction flow

flowchart TD
    A[Raw Source] --> B[Boilerplate Removal]
    B --> C[Content Segmentation]
    C --> D[Rule-based Extractors]
    D --> E[LLM Fallback Extractors]
    E --> F[Field-level Evidence Records]
    F --> G[Chunk Store]

9.2 Boilerplate removal

Remove:
	•	nav bars
	•	footer junk
	•	cookie notices
	•	repeated site chrome
	•	unrelated menus

9.3 Content segmentation

Split into:
	•	headings
	•	paragraphs
	•	tables
	•	metadata blocks
	•	FAQ sections
	•	product cards

9.4 Rule-based extraction first

Use deterministic extraction for:
	•	founding year
	•	org number
	•	contact locations
	•	product keywords
	•	country names
	•	currency amounts
	•	years
	•	revenue mentions

9.5 LLM fallback extraction

Use only when deterministic extraction is insufficient.

Examples:
	•	identifying business model from descriptive prose
	•	mapping ambiguous company positioning
	•	extracting nuanced market trends

9.6 Field-level evidence record

Every extracted field should store:
	•	field name
	•	extracted value
	•	source_id
	•	source span/snippet
	•	extraction_method
	•	confidence_score

⸻

10. Evidence Model

10.1 Source object

{
  "source_id": "uuid",
  "url": "https://example.com",
  "title": "Example title",
  "domain": "example.com",
  "publisher": "Example Publisher",
  "content_type": "html",
  "source_type": "official_company_site",
  "fetch_timestamp": "2026-03-06T10:00:00Z",
  "published_date": "2025-11-14",
  "composite_score": 0.87
}

10.2 Evidence chunk

{
  "chunk_id": "uuid",
  "source_id": "uuid",
  "page_number": null,
  "section_title": "About us",
  "text": "Bruno Mathsson International sells...",
  "embedding": [],
  "chunk_order": 4
}

10.3 Extracted field

{
  "field_id": "uuid",
  "field_name": "business_model",
  "value": "Premium furniture brand with licensed and own-collection sales",
  "source_id": "uuid",
  "support_span": "Combination of licensing income and direct sales...",
  "extraction_method": "llm_fallback",
  "confidence_score": 0.81
}


⸻

11. Verification-Oriented Retrieval

The retrieval system must support not only discovery, but also fact validation.

11.1 Secondary-source check

For important numeric claims:
	•	market size
	•	growth rate
	•	export share
	•	competitor revenue
	•	valuation multiples

Require:
	•	at least 2 supporting sources when possible
	•	or explicit low-confidence label

11.2 Verification query mode

For any critical claim, generate targeted confirmation queries.

Examples:

"{company_name}" revenue
"{competitor_name}" annual report revenue
"{industry_label}" CAGR Europe
"{brand_name}" export share

11.3 Contradiction detection

Store competing extracted values when they disagree.

Do not overwrite silently.

Example:

{
  "field_name": "market_growth",
  "candidate_values": [
    {"value": "4-6%", "source_id": "a"},
    {"value": "6-8%", "source_id": "b"}
  ],
  "status": "conflicting"
}


⸻

12. Storage Architecture

12.1 PostgreSQL

Store:
	•	source metadata
	•	extracted fields
	•	claims
	•	retrieval jobs
	•	query logs
	•	ranking scores

12.2 Object storage

Store:
	•	raw HTML
	•	PDFs
	•	screenshots
	•	rendered artifacts

12.3 pgvector

Store embeddings for:
	•	evidence chunks
	•	semantic source retrieval
	•	support retrieval during verification and synthesis

⸻

13. Database Tables

Recommended retrieval-specific tables:

retrieval_queries
	•	id
	•	company_id
	•	run_id
	•	stage
	•	query_text
	•	normalized_query_key
	•	query_type
	•	created_at
	•	cache_hit

retrieval_results
	•	id
	•	retrieval_query_id
	•	url
	•	title
	•	domain
	•	rank_position
	•	search_provider
	•	raw_metadata

sources
	•	id
	•	url
	•	title
	•	domain
	•	publisher
	•	source_type
	•	content_type
	•	published_date
	•	fetch_timestamp
	•	composite_score
	•	object_storage_path

source_chunks
	•	id
	•	source_id
	•	page_number
	•	section_title
	•	text
	•	embedding
	•	chunk_order

extracted_fields
	•	id
	•	source_id
	•	company_id
	•	run_id
	•	stage
	•	field_name
	•	value_json
	•	support_span
	•	extraction_method
	•	confidence_score

field_candidates
	•	id
	•	canonical_field_id
	•	candidate_value
	•	source_id
	•	confidence_score
	•	conflict_flag

⸻

14. Retrieval APIs

14.1 Search API

POST /retrieval/search

Input:

{
  "company_id": "uuid",
  "stage": "market_analysis",
  "queries": ["premium furniture market size europe"]
}

14.2 Fetch API

POST /retrieval/fetch

Input:

{
  "url": "https://example.com"
}

14.3 Extract API

POST /retrieval/extract

Input:

{
  "source_id": "uuid",
  "fields": ["business_model", "products", "geography"]
}

14.4 Evidence lookup API

GET /evidence/company/{company_id}?field=business_model

Returns:
	•	best candidate values
	•	top sources
	•	support spans
	•	confidence

⸻

15. Caching Strategy

15.1 Search cache

Cache based on:
	•	normalized query
	•	company_id
	•	stage
	•	locale

15.2 Fetch cache

Avoid refetching identical URLs too frequently.

Suggested TTL:
	•	company websites: 7 days
	•	news pages: 3 days
	•	market reports: 14 days
	•	static heritage/history pages: 30 days

15.3 Extraction cache

If source content hash unchanged, reuse extracted fields.

⸻

16. Locale and Language Handling

Since Nivo focuses on Swedish SMEs, retrieval must handle:
	•	Swedish
	•	English
	•	mixed-language company/market content

Rules
	•	search both Swedish and English for market/industry terms
	•	preserve original source language
	•	store extracted text without forced translation
	•	translate only at synthesis layer if needed

⸻

17. Error Handling

17.1 Soft failures

Continue pipeline if:
	•	one source fails
	•	one page times out
	•	some fields remain unknown

17.2 Hard failures

Escalate if:
	•	official website cannot be identified
	•	source quality too low for identity resolution
	•	no usable sources found for a critical stage

17.3 Error object

Every retrieval error should store:

{
  "stage": "competitor_discovery",
  "url": "https://example.com",
  "error_type": "timeout",
  "retryable": true,
  "timestamp": "2026-03-06T10:30:00Z"
}


⸻

18. Observability

Track:
	•	queries per run
	•	cache hit rate
	•	fetch success rate
	•	render success rate
	•	average extraction confidence
	•	average source score
	•	percentage of verified claims supported by retrieval

Recommended telemetry:
	•	Prometheus metrics
	•	OpenTelemetry spans
	•	structured JSON logs

⸻

19. Cost Controls

To prevent public-web research from becoming too expensive:

Limits per company run
	•	max search queries per stage
	•	max rendered pages per stage
	•	max total fetched URLs
	•	max LLM fallback extractions

Degradation strategy

If limits are reached:
	•	stop broad exploration
	•	prioritize already-ranked high-quality sources
	•	mark lower-confidence fields as unknown
	•	continue with partial evidence instead of over-searching

⸻

20. Security and Compliance

Required controls
	•	validate URLs before fetch
	•	prevent SSRF through allow/block rules
	•	sanitize extracted HTML
	•	cap file sizes
	•	record robots/compliance notes where relevant
	•	distinguish between public fetch and restricted/private content

⸻

21. Recommended Implementation Order

Build retrieval in this order:
	1.	source metadata schema
	2.	SerpAPI wrapper
	3.	fetcher
	4.	renderer
	5.	boilerplate removal
	6.	deterministic extractors
	7.	evidence chunking + pgvector
	8.	verification query mode
	9.	contradiction handling
	10.	evidence lookup API

⸻

22. Definition of Success

The retrieval system is successful when it can:
	•	consistently identify the right company and domain
	•	retrieve high-quality evidence for company, market, and competitors
	•	store all raw artifacts and extracted facts
	•	support claim-level verification
	•	reduce hallucination risk in report generation
	•	power high-confidence analysis across 50–100 companies

⸻

23. Suggested Next File

After this, the most useful next document is:

backend-implementation-plan.md

That should convert the architecture, orchestrator, prompts, and retrieval design into:
	•	service-level build order
	•	module contracts
	•	API endpoints
	•	data migrations
	•	task-by-task engineering sequence

⸻

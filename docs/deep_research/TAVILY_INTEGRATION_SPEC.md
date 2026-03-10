# TAVILY_INTEGRATION_SPEC.md

## Purpose

This document defines how Tavily should be integrated into the Nivo Deep Research system.

It assumes:
- the backend pipeline already exists
- company resolution and historical financial loading are materially improved
- the next missing capability is better public-web evidence discovery after company understanding is known

Tavily should be added as the **web intelligence layer**, not as the orchestrator and not as the source of truth.

---

# 1. Architectural Role of Tavily

## Tavily should be used for
- public web search
- targeted URL discovery
- targeted content extraction
- bounded follow-up retrieval when evidence is too weak
- optional deeper domain exploration when justified

## Tavily should NOT be used for
- orchestration
- identity truth
- financial calculations
- valuation calculations
- verification logic
- final report composition
- uncontrolled autonomous recursion

## Division of labor

### Tavily
- Search
- Extract
- optional Map
- optional Crawl

### Nivo backend
- query planning
- stage gating
- source ranking
- dedupe
- evidence quality scoring
- completeness validation
- provenance tracking
- debug visibility

### OpenAI
- company understanding
- evidence interpretation
- market/competitor synthesis
- report narrative generation from verified structured input

---

# 2. Why Tavily Fits This System

Tavily's API exposes dedicated endpoints for Search, Extract, Map, Crawl, and Research. The docs also recommend a two-step pattern of Search first and Extract second for comprehensive extraction, which aligns very well with Deep Research's gated evidence pipeline. Tavily Search supports controls such as topic, time range, result count, raw content options, and automatic parameter handling; Extract can pull content from one or more URLs; Map provides site-structure discovery; and Crawl supports deeper content traversal. Tavily's usage endpoint also exposes per-endpoint consumption, which helps with cost controls. 

This makes Tavily especially suitable for:
- market evidence discovery
- competitor discovery
- trade association discovery
- targeted extraction from company/industry sites
- bounded complementary retrieval loops

---

# 3. Recommended Integration Sequence

## Phase 1 — Search + Extract only
Start with:
- Tavily Search
- Tavily Extract

Do not start with Crawl or Map unless needed.

### Why
This keeps:
- implementation smaller
- cost lower
- traceability better
- failure handling simpler

## Phase 2 — Add Map
Add Map when:
- you need to discover useful URLs on a company or industry site
- you know the domain but not the relevant path structure

## Phase 3 — Add Crawl
Add Crawl when:
- there is a narrow domain with valuable deeper content
- Extract on individual pages is insufficient
- the retrieval loop needs bounded domain exploration

## Do not start with Tavily Research
The Research endpoint is interesting, but for this system it is better to keep planning/orchestration in your own backend and use Tavily as a search-and-extract layer first.

---

# 4. Tavily Endpoints and Recommended Usage

## 4.1 Search
Use for:
- initial market discovery
- competitor source discovery
- trade association discovery
- news/trend discovery
- targeted follow-up search

### Recommended parameters
- `topic="general"` for most company/market work
- `topic="news"` only when recent developments matter
- explicit `max_results`
- explicit `search_depth` to control cost
- include/exclude domains where useful

### Query examples
After company understanding:
- "professional workwear market size Europe"
- "hospitality uniforms market growth Nordics"
- "chef clothing competitors Europe"
- "workwear trade association Europe"

## 4.2 Extract
Use for:
- extracting content from selected URLs found by Search
- focused extraction with a query on long pages
- batch extraction of high-value URLs

### Recommended usage
- Search first
- rank URLs
- Extract top N URLs only
- use query-constrained extraction on long documents when possible

## 4.3 Map
Use for:
- site structure discovery
- identifying relevant subpages before extraction

Best for:
- company sites
- trade association sites
- industry portals

## 4.4 Crawl
Use for:
- bounded deeper traversal of valuable domains
- cases where one site contains many relevant subpages

Do not use Crawl by default.
Crawl should only be used:
- on approved domains
- with bounded depth / limits
- when evidence quality still fails after Search + Extract

---

# 5. Where Tavily Fits in the Pipeline

Recommended flow:

1. Company resolution
2. Company understanding
3. Tavily query planning
4. Tavily Search
5. Nivo ranking + dedupe
6. Tavily Extract on top-ranked URLs
7. Evidence scoring
8. If below threshold, optional bounded supplemental Tavily search/extract
9. Market analysis / competitor discovery
10. Downstream strategy, model, valuation, verification, report

Tavily should not run before company understanding is good enough.

---

# 6. Tavily Query Planning Rules

## Inputs required before Tavily search
Minimum company understanding payload:
- business model
- products/services
- target customers
- geography
- market niche hypothesis

## Query families
### Market queries
- market size
- market growth
- demand drivers
- industry structure
- channel trends

### Competitor queries
- direct competitors
- similar brands
- supplier/manufacturer competitors
- positioning comparables

### Evidence-strengthening queries
- trade associations
- market reports
- industry articles
- niche-specific publications

## Domain targeting
Where useful:
- include trusted domains
- exclude junk domains
- prefer trade bodies, established business media, official sites

---

# 7. Bounded Complementary Retrieval Loop

This is the correct way to “keep searching until solid enough” without creating an endless recursive research process.

## Trigger conditions
Run a supplemental Tavily round only if:
- market evidence score below threshold
- competitor evidence score below threshold
- too few high-quality sources found
- contradictory low-quality evidence dominates

## Hard limits
Recommended defaults:
- `max_primary_search_rounds = 1`
- `max_supplemental_rounds = 2`
- `max_queries_per_stage = 6`
- `max_extracted_urls_per_stage = 10`
- `max_crawl_depth = 1 or 2`
- `stop_if_quality_threshold_met = true`
- `degrade_if_budget_exceeded = true`

## Behavior
- run initial Tavily search
- rank evidence
- validate evidence quality
- if weak, generate targeted supplemental queries
- rerun Tavily
- rerank
- continue or explicitly degrade

This must always be:
- bounded
- logged
- inspectable

---

# 8. Source Ranking and Quality Rules

Tavily finds sources; your backend must decide which to trust.

## Recommended source tiers
1. official company site
2. official filings / registries
3. industry associations / trade bodies
4. established business media
5. niche industry media
6. retailer/distributor pages
7. blogs / low-trust sources

## Quality factors
- trust
- relevance
- recency
- extraction quality
- duplication penalty

## Persisted metadata
For each Tavily-derived source, store:
- provider = tavily
- retrieval round
- originating query
- source type
- relevance score
- trust score
- recency score
- final composite score

---

# 9. Data Model Additions

Recommended additions or confirmations:

## Source metadata
- `provider = "tavily"`
- `retrieval_round`
- `origin_query`
- `query_family`
- `evidence_quality_score`
- `provenance = public`

## Debug visibility
Per run, persist:
- Tavily queries issued
- result counts
- extracted URL list
- ranked URL shortlist
- quality threshold decisions
- whether supplemental retrieval was triggered
- whether degradation was applied

---

# 10. Error Handling

## Tavily failures should be treated as retrieval failures, not system crashes

### Retry policy
Retry:
- transient HTTP failures
- provider timeouts

Do not repeatedly retry:
- clearly invalid queries
- repeated zero-result patterns without query refinement
- obviously blocked/unusable domains

## Degradation behavior
If Tavily evidence remains weak after bounded retries:
- mark market/competitor stage degraded
- surface degraded reason
- continue only if policy allows
- do not pretend evidence quality is high

---

# 11. Cost Control

Use Tavily in a cost-aware way.

## Controls
- explicit search depth
- explicit max results
- search before extract
- rank before extract
- no default crawling
- bounded supplemental loops
- usage monitoring through Tavily usage endpoint

## Monitoring
Track:
- Tavily searches per run
- extracted URLs per run
- crawl/map usage
- quality score achieved per cost unit

---

# 12. Recommended Initial Implementation Tasks

## Task 1
Add Tavily Search as first-class retrieval provider in the pipeline after company understanding.

## Task 2
Add Tavily Extract on ranked URLs only.

## Task 3
Persist Tavily query metadata and evidence scores.

## Task 4
Add bounded supplemental retrieval loop policy.

## Task 5
Add debug artifact fields for Tavily behavior.

## Task 6
Gate market and competitor analysis on evidence quality thresholds.

---

# 13. Definition of Done

Tavily integration is complete for MVP when:
- company understanding drives Tavily query planning
- Tavily Search is used for market/competitor evidence discovery
- Tavily Extract is used on ranked URLs
- evidence quality is scored and persisted
- bounded supplemental retrieval works
- degraded evidence states are surfaced explicitly
- costs are bounded and inspectable

At that point Tavily is successfully integrated into Deep Research as the web intelligence layer.

# 05. Query Compiler and Retrieval

## Purpose

This layer turns `report_spec` into disciplined retrieval behavior.

It should not ask:
- "What should I search?"
It should ask:
- "Which required metric needs evidence, under which scope, from which source types, with which freshness rules?"

## Key components

### 1. Scope / Spec builder
Produces the final `report_spec`.

### 2. Query compiler
Compiles required metrics into search requests.

### 3. Discovery service
Runs Tavily or equivalent search.

### 4. URL triage and dedupe
Filters the raw result set.

### 5. Extraction service
Extracts numeric and textual evidence from pages and PDFs.

## Canonical retrieval flow

```text
report_spec
  -> required_metrics
  -> query_templates
  -> concrete_queries
  -> search_results
  -> source_triage
  -> extraction
  -> evidence_items
```

## Query compiler responsibilities

For each required metric, the compiler should:
- generate English and Swedish variants when relevant
- add segment/geography qualifiers
- add year/period qualifiers
- bias toward PDFs when useful
- bias toward trusted domains when available
- encode operator hints like `site:` or `filetype:pdf` where supported
- attach recency targets
- map each query back to the originating metric

## Example query plan shape

```yaml
query_plan:
  report_id: "..."
  metric_queries:
    - metric_key: "market_cagr_5y"
      priority: 1
      queries:
        - text: "Nordics workflow automation software market CAGR 2026 2030 pdf"
          language: "en"
          query_type: "market_pdf"
        - text: "Nordic workflow automation market size CAGR industry report"
          language: "en"
          query_type: "market_web"
        - text: "Nordic workflow automation marknad CAGR rapport pdf"
          language: "sv"
          query_type: "market_pdf"
```

## Parameter retrieval patterns

### Pattern 1: Market CAGR
Search for:
- market report PDFs
- industry associations
- official statistics when proxying demand

### Pattern 2: TAM/SAM
Search for:
- market size reports
- segment-specific industry studies
- company/peer investor material when carefully scoped

### Pattern 3: Peer benchmarks
Search for:
- competitor filings
- investor presentations
- public listed peer metrics
- normalized data providers if licensed

## Source triage rules

Before extraction, each URL should be triaged for:
- domain trust
- likely relevance
- duplicate risk
- content type
- recency
- access feasibility

Statuses:
- accepted_for_extraction
- low_priority
- duplicate
- rejected

## PDF and semi-structured evidence

The retrieval layer must support PDF-first flows for market research.

Recommended extraction outputs:
- page references
- quoted passage
- nearby table cells if numeric
- extracted datapoint candidates

## Failure handling

### When retrieval is thin
- broaden query language
- relax domain constraints slightly
- try alternate parameter phrasings
- log retrieval gaps

### When evidence remains weak
Do not overcompensate with synthetic confidence.
Return:
- `insufficient_evidence`
- optional proxy suggestion if policy allows

## Caching

Cache at three layers:
- query results
- normalized sources
- extracted evidence items

Cache keys should include:
- metric key
- geography
- segment
- policy version where relevant
- freshness window

## Observability

Persist:
- generated queries
- hit rate by query
- accepted domains
- rejected domains
- evidence yield by metric
- query-template performance

## Suggested file paths

```text
backend/retrieval/query_planner.py
backend/services/web_intel/tavily_client.py
backend/services/web_intel/web_retrieval_service.py
backend/services/web_intel/source_normalizer.py
backend/services/web_intel/evidence_extractor.py
```

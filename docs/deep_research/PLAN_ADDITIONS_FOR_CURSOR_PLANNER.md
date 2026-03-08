# PLAN_ADDITIONS_FOR_CURSOR_PLANNER.md

## Purpose

This document defines the additions that should now be incorporated into the Cursor planning workflow for Deep Research.

It assumes:
- the backend chain has been significantly hardened
- orgnr resolution and stage gating have improved
- historical financials can now reach the payload
- the next step is to make the system truly strong at company understanding and public evidence discovery

---

## 1. Add a Dedicated Company Understanding Workstream

### Why
The system still risks searching for market data before it fully understands:
- what the company does
- what it sells
- who it sells to
- what niche it belongs to

Without that, downstream market and competitor search will be weak.

### Workstream: Company Understanding
Scope:
- extract structured company understanding from company website and uploaded company materials
- classify product/service categories
- identify business model
- identify target customers
- identify target geography
- identify market/niche label
- persist this as a canonical object
- gate market retrieval on minimum acceptable quality

Deliverables:
- company understanding contract
- minimum quality thresholds
- source-backed company-understanding payload
- debug visibility for company-understanding completeness

---

## 2. Add a Web Intelligence / Tavily Workstream

### Why
The audit showed retrieval is generic and pre-pipeline, not yet targeted by actual company understanding.

### Workstream: Web Intelligence Layer
Scope:
- integrate Tavily Search first
- add Tavily Extract
- optionally add Crawl/Map where justified
- generate market-specific queries after company understanding
- generate competitor-specific queries after company understanding
- dedupe and rank evidence
- only pass top evidence into downstream analysis
- support bounded complementary retrieval runs if evidence is too weak

Deliverables:
- Tavily integration service
- query planner upgrade
- source ranking rules
- evidence extraction pipeline
- retrieval metrics
- bounded retry / complement loop policy

Recommended role split:
- Tavily = retrieval engine
- backend = ranking + gating + orchestration
- OpenAI = interpretation and synthesis

---

## 3. Add an Evidence Ranking and Source Quality Workstream

### Why
Finding more data is not enough.
The system must choose better evidence.

### Workstream: Evidence Ranking
Scope:
- rank official company sources highly
- rank trade associations and credible market sources highly
- downrank low-quality blogs and irrelevant pages
- score source trust, relevance, and recency
- surface source quality in debug artifacts and verification

Deliverables:
- source scoring model
- ranking policy
- source confidence metadata
- evidence quality diagnostics

---

## 4. Add Proprietary Input as First-Class Structured Evidence

### Why
Many valuable company-specific facts will never be available online.
Investor decks, CIMs, management notes, and internal findings must be usable as refinement inputs.

### Workstream: Proprietary Input Integration
Scope:
- support ingestion of proprietary company materials
- classify them by source_type
- chunk and store them like evidence
- merge them into company understanding, market framing, value creation, assumptions, and reporting

Deliverables:
- proprietary source taxonomy
- ingestion contract
- payload merge rules
- provenance rules (public vs proprietary vs inferred)

---

## 5. Add OpenAI Payload Discipline

### Why
You do not want to spend heavily on OpenAI calls unless inputs are verified and rich enough.

### Workstream: OpenAI Payload Discipline
Scope:
- identify every LLM-facing stage
- define required payloads
- verify complete financial/history/market/competitor inputs before calling OpenAI
- define model selection and usage policy
- minimize expensive low-value calls

Deliverables:
- LLM payload contract
- usage policy
- missing-input blocker rules
- cost-control policy

Recommended OpenAI role:
- company understanding
- market/competitor evidence interpretation
- report narrative synthesis

Do not use OpenAI for:
- raw internet crawling
- DB truth
- financial math
- orchestration

---

## 6. Add Financial Model Grounding as the Final Backend-Quality Workstream

### Why
Even after the orgnr fix, the assumptions/model path still needs explicit grounding in:
- 4 years actuals
- derived trends
- market growth baseline
- benchmark context
- assumptions source labels

### Workstream: Financial Model Grounding
Scope:
- verify that model assumptions are built after actuals and market inputs exist
- ensure assumptions_source is inspectable
- ensure 3-year projections remain standard
- ensure report sections consume the full assembled input

Deliverables:
- financial input audit
- assumptions source integrity
- model input debug artifact
- richer financial report sections

---

## 7. Add a Living Dossier Model

### Why
Deep Research should not be a one-shot report only.
It should behave like a living, versioned evidence-backed dossier.

### Workstream: Living Dossier Model
Scope:
- combine public evidence, internal DB facts, and proprietary docs
- preserve versions
- allow analyst edits and reruns
- maintain evidence traceability over time

Deliverables:
- dossier update rules
- evidence provenance model
- version comparison behavior

---

## 8. Update the Hard Stop

Deep Research is complete when:
- company understanding is reliable enough to drive market search
- public web evidence can be discovered and ranked through Tavily or equivalent
- proprietary company materials can refine the analysis
- real historicals and market data reach the model
- analyst workbench supports run/report/verification/edit/recompute
- analysts can use the system without developer support

After that, stop core scope and move all further improvements to phase 2.

---

## 9. Recommended New Planning Sequence

Update Cursor planning to include these bounded workstreams:

1. Company understanding implementation
2. Tavily/web intelligence integration
3. Evidence ranking and source quality
4. Proprietary input integration
5. OpenAI payload discipline
6. Financial model grounding verification
7. Analyst workbench completion

This sequence focuses on the highest-value missing capability: better evidence discovery and interpretation.

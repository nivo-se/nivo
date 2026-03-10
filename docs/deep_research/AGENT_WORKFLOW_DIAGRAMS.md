# AGENT_WORKFLOW_DIAGRAMS.md

## Purpose

This document provides workflow diagrams, orchestration logic, state transitions, retry loops, and JSON schema references for the Nivo deep research system built on the OpenAI Responses API and Agents SDK.

It is intended to accelerate implementation by giving Cursor a concrete blueprint for:

- agent sequencing
- tool usage
- state management
- retry and escalation behavior
- validation checkpoints
- final memo generation flow

---

# 1. End-to-End System Diagram

```mermaid
flowchart TD
    A[Input: company name + org number + financials] --> B[Company Resolver Agent]
    B --> C[Research Orchestrator]
    C --> D[Market Agent]
    C --> E[Competitor Agent]
    C --> F[Product Agent]
    C --> G[Transaction Agent]

    D --> H[Evidence Store]
    E --> H
    F --> H
    G --> H

    H --> I[Evidence Validator]
    I --> J{Evidence quality passed?}

    J -- No --> K[Retry / Expand Search / Escalate]
    K --> C

    J -- Yes --> L[Financial Engine]
    L --> M[Valuation Agent]
    M --> N[Valuation Validator]

    N --> O{Valuation sane?}
    O -- No --> P[Re-open research on comps / transactions / assumptions]
    P --> C

    O -- Yes --> Q[Research Packet Assembler]
    Q --> R[Memo Writer Agent]
    R --> S[Memo Reviewer Agent]

    S --> T{Memo quality passed?}
    T -- No --> U[Return comments / re-run section agents]
    U --> Q

    T -- Yes --> V[Final Investment Memo]
```

---

# 2. Agent Ownership Diagram

```mermaid
flowchart LR
    A[Resolver Agent] --> A1[Identity]
    A --> A2[Website]
    A --> A3[Industry]

    B[Market Agent] --> B1[Market size]
    B --> B2[Growth]
    B --> B3[Trends]
    B --> B4[Segment split]

    C[Competitor Agent] --> C1[Peer set]
    C --> C2[Revenue]
    C --> C3[Margin]
    C --> C4[Positioning]

    D[Product Agent] --> D1[Portfolio]
    D --> D2[Pricing]
    D --> D3[Positioning]

    E[Transaction Agent] --> E1[Deals]
    E --> E2[Multiples]
    E --> E3[Buyers]
    E --> E4[Dates]

    F[Valuation Agent] --> F1[DCF]
    F --> F2[Multiple cross-check]
    F --> F3[Scenario range]

    G[Memo Writer Agent] --> G1[Narrative]
    G --> G2[Assumptions]
    G --> G3[Investment case]

    H[Reviewer Agent] --> H1[Evidence gaps]
    H --> H2[Unsupported claims]
    H --> H3[Missing sections]
```

---

# 3. Tool Usage Flow

```mermaid
flowchart TD
    A[Agent Request] --> B{What is needed?}
    B -- Identity / website --> C[Web Search / Tavily Search]
    B -- Website structure --> D[Tavily Map]
    B -- Website content --> E[Tavily Crawl / Extract]
    B -- Internal documents --> F[File Search]
    B -- Internal DB values --> G[Custom Function Call]
    B -- Current market facts --> H[Web Search]
    B -- Final prose --> I[Responses API generation]
```

---

# 4. Research Run State Machine

```mermaid
stateDiagram-v2
    [*] --> initialized
    initialized --> resolving_company
    resolving_company --> gathering_market
    resolving_company --> failed

    gathering_market --> gathering_competitors
    gathering_competitors --> gathering_products
    gathering_products --> gathering_transactions

    gathering_transactions --> validating_evidence
    validating_evidence --> evidence_failed
    validating_evidence --> financial_analysis

    evidence_failed --> retrying_research
    retrying_research --> gathering_market
    retrying_research --> manual_review

    financial_analysis --> valuation
    valuation --> valuation_failed
    valuation --> packet_assembly

    valuation_failed --> retrying_research
    valuation_failed --> manual_review

    packet_assembly --> memo_generation
    memo_generation --> memo_review
    memo_review --> memo_failed
    memo_review --> completed

    memo_failed --> packet_assembly
    manual_review --> [*]
    completed --> [*]
    failed --> [*]
```

---

# 5. Retry Logic Diagram

```mermaid
flowchart TD
    A[Agent output] --> B{Pass validation?}
    B -- Yes --> C[Commit results]
    B -- No --> D{Retry count < max?}
    D -- Yes --> E[Broaden search / change query / add domains]
    E --> F[Re-run same agent]
    F --> B
    D -- No --> G[Escalate to manual review or downstream caveat]
```

Recommended retry policy:

- resolver agent: max 2 retries
- market agent: max 2 retries
- competitor agent: max 2 retries
- transaction agent: max 3 retries
- memo writer: max 1 rewrite
- reviewer loop: max 2 cycles

---

# 6. Evidence Validation Flow

```mermaid
flowchart TD
    A[Collected facts] --> B[Check source count]
    B --> C[Check domain diversity]
    C --> D[Check confidence score]
    D --> E[Check numeric consistency]
    E --> F[Check provenance completeness]
    F --> G{All checks passed?}
    G -- Yes --> H[Validated evidence]
    G -- No --> I[Flag failed facts]
    I --> J[Retry relevant research agent]
```

Validation gates:

- minimum 2 independent sources for important external facts
- confidence score >= configured threshold
- numeric disagreement inside tolerance band
- every claim carries source metadata

---

# 7. Valuation Control Flow

```mermaid
flowchart TD
    A[Normalized financials] --> B[Compute EBITDA variants]
    B --> C[Load transactions]
    C --> D[Load comparable company range]
    D --> E[Apply sector sanity range]
    E --> F[Run DCF]
    F --> G[Compute implied EV/EBITDA]
    G --> H[Valuation validator]

    H --> I{Inside sanity bands?}
    I -- Yes --> J[Accept valuation]
    I -- No --> K[Investigate comps / assumptions / EBITDA normalization]
    K --> L[Re-open research or adjust assumptions]
    L --> F
```

Sanity checks:

- EV to equity bridge
- net debt sign correctness
- implied EV/EBITDA in plausible range
- terminal value dominance warning
- scenario outputs consistent with directionality

---

# 8. Memo Generation Flow

```mermaid
flowchart TD
    A[Validated research packet] --> B[Memo Writer Agent]
    B --> C[Draft memo]
    C --> D[Reviewer Agent]
    D --> E{Approved?}
    E -- Yes --> F[Final memo]
    E -- No --> G[Section-level comments]
    G --> H[Revise targeted sections]
    H --> D
```

Writer should never invent unsupported figures.
Reviewer should explicitly mark:

- unsupported
- inferred
- validated
- requires DD confirmation

---

# 9. Orchestrator Pseudocode

```python
def run_deep_research(company_name: str, org_number: str, financials: dict):
    state = init_state(company_name, org_number, financials)

    state.company_profile = resolver_agent.run(state)

    for agent in [market_agent, competitor_agent, product_agent, transaction_agent]:
        state = run_with_retry(agent, state)

    validation = evidence_validator.run(state)
    if not validation.passed:
        state = retry_failed_research(state, validation)

    state.financial_packet = financial_engine.run(state)
    state.valuation_packet = valuation_agent.run(state)

    valuation_check = valuation_validator.run(state)
    if not valuation_check.passed:
        state = retry_valuation_research(state, valuation_check)

    state.research_packet = assemble_packet(state)
    state.memo_draft = memo_writer.run(state)

    review = memo_reviewer.run(state)
    if not review.passed:
        state.memo_draft = memo_writer.revise(state, review.comments)

    return state.memo_draft
```

---

# 10. Suggested Run State Object

```json
{
  "run_id": "uuid",
  "company_name": "string",
  "org_number": "string",
  "company_profile": {},
  "market_facts": [],
  "competitors": [],
  "product_facts": [],
  "transactions": [],
  "evidence_validation": {},
  "financial_packet": {},
  "valuation_packet": {},
  "research_packet": {},
  "memo_draft": "",
  "review_comments": [],
  "status": "initialized|running|retrying|manual_review|completed|failed"
}
```

---

# 11. Example JSON Schemas Per Agent

## CompanyProfile

```json
{
  "company_name": "Example AB",
  "org_number": "556123-4567",
  "website": "https://example.se",
  "industry": "Premium furniture",
  "description": "Designer and manufacturer of premium furniture",
  "headquarters": "Sweden",
  "confidence_score": 0.88,
  "sources": [
    {
      "url": "https://example.se",
      "title": "Official website"
    }
  ]
}
```

## MarketFact

```json
{
  "fact_type": "market_size",
  "value": "SEK 270bn",
  "region": "Europe",
  "confidence_score": 0.74,
  "source_count": 3,
  "sources": [
    {
      "url": "https://source1.com",
      "title": "Market report"
    }
  ]
}
```

## CompetitorRecord

```json
{
  "name": "Peer Co",
  "revenue_msek": 420,
  "ebitda_margin_pct": 11.5,
  "segment": "Premium furniture",
  "geography": "Nordics",
  "positioning": "Design-led"
}
```

## TransactionRecord

```json
{
  "target": "Peer Co",
  "buyer": "Strategic Buyer",
  "year": 2024,
  "ev_msek": 580,
  "ebitda_msek": 96,
  "ev_ebitda": 6.0,
  "source_url": "https://example.com/deal"
}
```

## ValuationPacket

```json
{
  "primary_method": "precedent_transactions",
  "ev_low_msek": 420,
  "ev_base_msek": 470,
  "ev_high_msek": 530,
  "implied_ev_ebitda": 5.9,
  "sector_range_low": 4.1,
  "sector_range_high": 8.0,
  "lint_passed": true,
  "warnings": []
}
```

---

# 12. Handoff Rules

Handoffs should occur only when upstream outputs meet minimum thresholds.

Examples:

- Resolver Agent → Research Agents only if identity confidence >= 0.8
- Research Agents → Evidence Validator only if at least one result exists
- Evidence Validator → Valuation only if critical market / comp / transaction facts meet threshold
- Memo Writer → Reviewer only after research packet is complete

If thresholds fail, the orchestrator should either:
- retry,
- widen search,
- or mark section as incomplete with explicit caveat

---

# 13. Search Expansion Strategy

If first-pass research fails:

## Resolver Agent
- add org number to query
- constrain to official / known domains
- search language variants

## Market Agent
- broaden from niche market to adjacent market
- search geography-specific variants
- use segment keywords

## Competitor Agent
- search by product category
- search by customer type
- search by geography

## Transaction Agent
- widen date range
- search synonyms for M&A / acquisition / sale
- search industry subsegments

---

# 14. Manual Review Triggers

The run should pause or mark output as limited when any of the following occur:

- no verified website found
- company identity confidence below threshold
- market section has fewer than 2 acceptable external sources
- competitor set has fewer than 3 plausible peers
- no transaction data found and DCF produces outlier multiple
- evidence validator fails after max retries
- reviewer detects unsupported critical claims

---

# 15. Folder / Documentation Suggestion

```text
docs/
  deep_research/
    AGENTIC_RESEARCH_ARCHITECTURE.md
    AGENT_PROMPTS.md
    DATABASE_SCHEMA.md
    IMPLEMENTATION_TASKS.md
    AGENT_WORKFLOW_DIAGRAMS.md
```

---

# 16. Implementation Priority

Recommended order:

1. Add run state object
2. Add research fact storage
3. Implement resolver agent
4. Implement market / competitor / transaction agents
5. Add evidence validator
6. Add valuation validator
7. Add research packet assembler
8. Add memo writer
9. Add reviewer loop
10. Add traces and monitoring

---

# 17. Summary

These diagrams define the operating model for the Nivo deep research system.

The core principle is:

- research first
- validate second
- value third
- write last

That is the main shift required to move from a report generator to an investment-grade research workflow.

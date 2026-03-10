
# NIVO DEEP RESEARCH SYSTEM — MASTER SPECIFICATION v2
Status: Architecture & Implementation Specification
Format: Markdown
Target Stack: OpenAI Responses API + Agents SDK + Tavily + Supabase/Postgres
Purpose: Produce investment‑grade research memos comparable to professional PE investment memos (e.g., Bruno‑style deep analysis).

---

# 1. System Objective

Transform Nivo from a **report generator** into an **agentic investment research platform**.

Key capabilities:

- Autonomous company research
- Structured evidence gathering
- Market intelligence synthesis
- Competitor benchmarking
- Transaction multiple discovery
- Multi‑method valuation
- Investment memo generation
- Evidence validation
- Continuous improvement through stored research facts

---

# 2. Core Design Principle

The system follows this philosophy:

Research → Validate → Value → Write

Never the reverse.

---

# 3. High Level Architecture

INPUT
company_name
org_number
financials

Pipeline:

1. Company Resolver Agent
2. Market Research Agent
3. Competitor Research Agent
4. Product Research Agent
5. Transaction Research Agent
6. Evidence Validator
7. Financial Engine
8. Valuation Agent
9. Valuation Validator
10. Research Packet Assembler
11. Memo Writer Agent
12. Memo Reviewer Agent

OUTPUT

Investment Memo

---

# 4. Technology Stack

Core orchestration

OpenAI Responses API

Agent management

OpenAI Agents SDK

External research

- Tavily
- OpenAI Web Search

Storage

PostgreSQL / Supabase

Optional infrastructure

- Redis for run states
- S3 storage for documents

---

# 5. Database Schema

## companies

id
name
org_number
website
industry

## research_facts

id
company_id
fact_type
fact_value
confidence_score
source_url
retrieved_at
agent

## competitors

id
company_id
competitor_name
revenue_estimate
margin_estimate
segment

## transactions

id
industry
target
buyer
year
EV
EBITDA
multiple

## valuation_outputs

company_id
ev_low
ev_base
ev_high
implied_multiple
method

---

# 6. Run State Object

Each research run maintains a structured state.

Example

{
run_id,
company_profile,
market_facts,
competitors,
products,
transactions,
financial_packet,
valuation_packet,
memo_draft,
status
}

Status options

initialized
running
retrying
manual_review
completed
failed

---

# 7. Agent Specifications

## Company Resolver Agent

Goal

Resolve identity and locate website.

Tools

web_search
tavily_search

Outputs

company_profile

Fields

company_name
org_number
website
industry
description
confidence_score

---

## Market Research Agent

Goal

Build market analysis.

Queries

"{industry} market size"
"{industry} CAGR"
"{industry} segment growth"

Outputs

market_facts

Fields

market_size
market_growth
segments
geography_split
key_trends

---

## Competitor Agent

Goal

Construct peer set.

Tasks

Identify competitors
Estimate revenue
Estimate margins
Determine positioning

Output

competitors list

Fields

name
revenue
margin
segment
geography

---

## Product Agent

Goal

Understand portfolio.

Tasks

Identify products
Detect price range
Detect brand positioning

Output

product_portfolio

---

## Transaction Agent

Goal

Find precedent transactions.

Queries

"{industry} acquisition multiple"
"{industry} EV EBITDA deal"

Output

transaction records

Fields

target
buyer
year
EV
EBITDA
multiple

---

# 8. Evidence Validation

Checks

Source diversity ≥ 2

Confidence threshold ≥ 0.6

Numeric consistency tolerance ±30%

Provenance required for all numeric values

If validation fails

Retry research or widen search scope.

---

# 9. Financial Engine

Responsibilities

Normalize financial statements

Compute metrics

EBITDA
Margins
Growth rates

Detect anomalies

Outputs

financial_packet

---

# 10. Valuation Engine

Methods

1 Precedent transactions

2 Comparable companies

3 Sector sanity ranges

4 DCF

Typical Nordic SME EV/EBITDA

5‑7x

Industry range

4.1‑8.0x

Compute implied multiple

implied_multiple = EV / EBITDA

Flag outliers.

---

# 11. Valuation Validator

Checks

EV to equity bridge

Net debt sign correctness

Multiple sanity range

Terminal value dominance

If checks fail

Re‑run research or adjust assumptions.

---

# 12. Research Packet

Aggregated structure passed to memo writer.

Fields

company_profile
market_analysis
competitors
products
transactions
financials
valuation
evidence_sources
unresolved_questions

---

# 13. Memo Writer Agent

Goal

Generate full investment memo.

Sections

Executive Summary

Company Overview

Market Analysis

Competitive Landscape

Products & Pricing

Value Creation Plan

Financial Analysis

Valuation

Scenario Analysis

Key Assumptions

Risks

Due Diligence Questions

---

# 14. Memo Reviewer Agent

Purpose

Quality control.

Checks

Unsupported claims

Weak evidence

Missing sections

Numeric inconsistencies

If issues found

Send comments back to writer agent.

---

# 15. Orchestration Flow

resolve_company()

research_market()

research_competitors()

research_products()

research_transactions()

validate_evidence()

load_financials()

run_valuation()

assemble_research_packet()

write_memo()

review_memo()

---

# 16. Retry Logic

Each agent can retry.

Resolver agent max retries = 2

Research agents max retries = 2

Transaction agent max retries = 3

Memo writer rewrite = 1

Reviewer loops = 2

If still failing → manual review.

---

# 17. Workflow Diagram (Conceptual)

INPUT → Resolver → Research Agents → Evidence Validator → Financial Engine → Valuation → Packet Assembler → Memo Writer → Reviewer → Final Memo

---

# 18. Implementation Phases

Phase 1

Stabilize current system

Phase 2

Implement research fact database

Phase 3

Add research agents

Phase 4

Integrate Responses API orchestration

Phase 5

Add memo writer agent

Phase 6

Add reviewer agent

---

# 19. Success Metrics

Market section quantified in >70% of reports

Competitor table contains >5 companies

Transactions found in >40% of runs

Valuation sanity flags <10%

Memo length 6k‑12k words

---

# 20. Future Enhancements

Porter Five Forces generation

TAM triangulation

Deal database integration

Supply chain mapping

Customer sentiment analysis

---

# 21. Repository Layout

docs/

deep_research/

AGENTIC_RESEARCH_ARCHITECTURE.md

AGENT_PROMPTS.md

DATABASE_SCHEMA.md

IMPLEMENTATION_TASKS.md

AGENT_WORKFLOW_DIAGRAMS.md

NIVO_DEEP_RESEARCH_MASTER_SPEC.md

---

# 22. Summary

This system upgrades Nivo from:

simple report generation

to

agent‑driven investment research capable of producing professional‑grade analysis.

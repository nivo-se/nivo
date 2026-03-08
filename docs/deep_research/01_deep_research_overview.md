# Nivo Automated Company Analysis System

### Architecture, Agent Workflow, and Implementation Plan

## Overview

This document defines the architecture and workflow for the **Nivo automated company analysis system**.

The goal is to build an **agent-driven analysis platform** that automatically produces **80% of a full investment analysis report** for Swedish small and medium-sized companies.

The system will:

1. Start with **internal financial data**
2. Dynamically gather **public external data**
3. Iteratively enrich analysis through multiple agents
4. Produce an **interactive report** used internally by Nivo

The final system will support evaluating **50–100 companies efficiently** and identifying those with **high value-creation potential**.

---

# System Philosophy

### Core Principles

1. **Agents perform the heavy lifting**
  - Target: 80% automated analysis
  - Human review: final 20%
2. **Data-driven analysis**
  - All claims must have sources available
3. **Iterative intelligence**
  - Each agent builds upon previous outputs
4. **Dynamic information gathering**
  - Agents must search the web dynamically
  - No predefined source list
5. **Interactive report output**
  - Not static PDFs
  - Web UI with expandable source references

---

# Data Sources

## Internal Data (Starting Point)

Stored in **PostgreSQL database**

Includes:

- Company name
- Organization number
- Financial statements
- Revenue
- EBITDA
- Margins
- Historical financials

This data is used to **select companies for deeper analysis**.

---

## External Data (Agent Discovered)

Agents gather public data dynamically using web search:

Possible sources:

- Company websites
- News articles
- Industry reports
- Market research
- Competitor websites
- Government data
- LinkedIn
- Public databases
- Market analytics platforms

Agents must remain **industry-agnostic**.

Example:


| Company Type        | Required Market Data     |
| ------------------- | ------------------------ |
| Furniture company   | Premium furniture market |
| Restaurant supplier | Restaurant industry      |
| Industrial supplier | Manufacturing sector     |


---

# Overall System Flow

```
Company Financial Data
        ↓
Agent 1: Company Profiling
        ↓
Agent 2: Market Research
        ↓
Agent 3: Competitive Landscape
        ↓
Agent 4: SWOT & Strategic Analysis
        ↓
Agent 5: Value Creation Analysis
        ↓
Agent 6: Financial Projection
        ↓
Agent 7: Valuation Model
        ↓
Agent 8: Report Generation
```

Each agent receives **all prior agent outputs**.

---

# Report Structure

The analysis follows **five core segments**.

These come from the investment case structure discussed in the Bruno Mathsson example.

### 1. Company Overview

### 2. Market Analysis

### 3. Competitive Positioning

### 4. Value Creation

### 5. Transaction & Valuation

This mirrors professional private-equity investment reports.

Example: the Bruno Mathsson analysis includes sections for company description, market overview, competition, value creation, and transaction structure .

---

# Agent Architecture

## Agent 1 — Company Profiling

### Goal

Build a structured **company overview**.

### Inputs

- Company name
- Organization number
- Financial data

### Tasks

Agent searches for:

- Company history
- Founding year
- Business model
- Product categories
- Revenue streams
- Key geographies
- Export exposure
- Ownership structure

### Output

```
Company_Profile:
  description
  business_model
  products
  geography
  revenue_streams
  ownership
  history
  sources[]
```

---

# Agent 2 — Market Analysis

### Goal

Understand the **industry and market context**.

### Tasks

Agent identifies:

- Industry classification
- Market size (TAM)
- Growth rates
- Structural trends
- Digital transformation potential
- Customer segments

### Output

```
Market_Analysis:
  industry
  market_size
  market_growth
  market_segments
  structural_trends
  digital_opportunities
  sources[]
```

---

# Agent 3 — Competitive Landscape

### Goal

Identify competitors and their market position.

### Tasks

Agent must:

- Identify comparable companies
- Gather competitor metrics
- Evaluate positioning

### Output

```
Competitor_Set:
  competitors[]
     name
     revenue
     margins
     geography
     positioning
```

---

# Interactive Competitor Editing

Users must be able to:

- Add competitors
- Remove competitors
- Trigger new analysis

Example workflow:

```
User adds competitor
↓
Agent fetches company data
↓
Table updates automatically
```

Competitor lists propagate through the **entire report**.

---

# Agent 4 — Strategic Analysis (SWOT)

### Goal

Produce **deep strategic analysis**.

Not generic SWOT.

Each category must contain **specific operational insights**.

Example:

```
Strengths
Weaknesses
Opportunities
Threats
```

Example insight:

```
High entry barriers due to design heritage
Limited competition in premium niche
```

---

# Agent 5 — Value Creation Analysis

This is the **core of Nivo's investment thesis**.

The value creation model contains **five pillars**.

---

## Value Creation Model

### 1. Revenue Acceleration

Examples:

- Digital sales channels
- International expansion
- Product portfolio expansion

Example strategies:

```
D2C ecommerce
International licensing
Archive product relaunch
```

---

### 2. Operational Efficiency

Agent analyzes:

- Procurement
- Inventory turnover
- Production outsourcing
- Supply chain optimization

---

### 3. Balance Sheet Optimization

Focus areas:

- Working capital
- Inventory levels
- Debt capacity

Example constraint:

```
Net Debt ≤ 2x EBITDA
```

---

### 4. Digitalization

Agent evaluates:

- ecommerce potential
- CRM systems
- ERP maturity
- digital marketing
- product configurators

Digitalization often enables revenue acceleration.

---

### 5. Organization / People

This area is mostly **human input**.

Agents may attempt to identify:

- leadership team
- executives
- LinkedIn profiles
- management background

But manual input will dominate here.

---

# Agent 6 — Financial Projection

Agents attempt a **7-year projection**.

Inputs:

- historical financials
- market growth
- strategy initiatives

Example logic:

```
Revenue_growth =
market_growth
+ digital_expansion
+ internationalization
```

Each assumption must contain:

```
comment
reasoning
source
```

Example:

```
Margin improvement due to D2C shift
```

---

# Agent 7 — Valuation

Agent calculates:

### Enterprise value

Methods:

- EBITDA multiples
- peer comparisons
- market transactions

Output:

```
Valuation:
  EBITDA_multiple
  peer_range
  estimated_value
```

---

# Agent 8 — Report Generation

Final agent compiles the **interactive report**.

Report sections:

```
Executive Summary
Company Overview
Market
Competition
Strategic Position
Value Creation
Financial Projection
Valuation
```

---

# Source Referencing

Every data point must include source metadata.

Example:

```
{
  value: "Market size $270B",
  source: "industry report",
  url: "...",
  confidence: "medium"
}
```

Users can click sources inside the UI.

---

# Backend Architecture

## Core Components

### PostgreSQL

Stores:

- financial data
- analysis results
- agent outputs

---

### Agent Orchestrator

Coordinates agents sequentially.

Example stack:

```
LangGraph
OpenAI Agents
Temporal
```

---

### Web Search Integration

Agents use:

```
Tavily
SerpAPI
Custom search APIs
```

---

### Report API

Backend exposes:

```
GET /analysis/{company}
POST /analysis/run
POST /analysis/update
```

---

# Data Pipeline

```
Internal Company Data
      ↓
Company Agent
      ↓
Market Agent
      ↓
Competition Agent
      ↓
Strategy Agent
      ↓
Value Creation Agent
      ↓
Projection Agent
      ↓
Valuation Agent
      ↓
Report Generator
```

---

# Expected Output

Each company generates a structured analysis:

```
analysis/
   company_profile.json
   market_analysis.json
   competitors.json
   swot.json
   value_creation.json
   financial_projection.json
   valuation.json
   report.json
```

---

# Implementation Roadmap

## Phase 1 — Foundations

- Data schema
- Financial ingestion
- Agent orchestration

---

## Phase 2 — Market Intelligence

- web search integration
- competitor detection

---

## Phase 3 — Value Creation Engine

- strategic analysis
- opportunity scoring

---

## Phase 4 — Financial Modeling

- projections
- valuation

---

## Phase 5 — UI Integration

- interactive report
- source references
- editable competitors

---

# Final Goal

Nivo gains a **scalable investment analysis platform** capable of:

```
Analyzing 100 companies
Automatically generating deep research
Identifying high-value opportunities
Reducing manual analysis workload by 80%
```

---

If you'd like, I can also generate **three additional MD files that will massively help your Cursor build**, such as:

1️⃣ `agent-system-architecture.md`
2️⃣ `agent-prompts.md`
3️⃣ `backend-implementation-plan.md`

These will make your **Cursor agent coding workflow 10× easier.**
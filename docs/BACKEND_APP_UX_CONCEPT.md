# Nivo Backend App – IA + UX Concept

**Core idea:** One primary workflow + three supporting centers. Make the database "talk", surface what we know vs don't know, unify screening → enrichment → IC outputs.

---

## 1. Primary Workflow

**Discover → Shortlist → Enrich → Decide → Execute**

Plus three hubs:
- **Intel Coverage** – Know what we know / missing data
- **Runs & Jobs** – Async truth + audit trail
- **Admin & Ops** – Users, roles, integrations, settings

---

## 2. Navigation (7 items max)

| # | Nav Item | Purpose |
|---|----------|---------|
| 1 | **Home** | Today's status + priorities |
| 2 | **Universe** | Explore + segment + analytics (primary) |
| 3 | **Pipeline** | Shortlists → stages → acquisition runs |
| 4 | **Company** | Detail view (opens from anywhere) |
| 5 | **Reports** | IC memos, teasers, portfolio packs, exports |
| 6 | **Runs & Jobs** | Enrichment runs, AI reports, failures, retries |
| 7 | **Admin** | Roles, integrations, data sources, health |

*Universe = primary. Pipeline = execution layer.*

---

## 3. Key Screens

### A) Home (CEO view, 60 seconds)

- Universe snapshot: #companies, #with KPIs, #with AI profile, #with website, #missing key fields
- Pipeline snapshot: Stage 1/2/3 counts, what moved this week
- Runs: active enrichments + failures needing attention
- Top signals: "High growth + margin outliers", "Newly enriched high-fit companies", "New segments trending"

### B) Universe ("Bloomberg terminal" for SMEs)

- **Top:** Segment chips (segment_names, NACE, size/growth/profitability buckets)
- **Left:** Filters (financial + operational + data completeness + AI scores)
- **Center:** Company table (fast, column config, pinned columns)
- **Right:** Insights panel (auto charts based on current filter)

**Visualizations:**
- Scatter: Revenue (x) vs EBITDA margin (y), sized by employees, colored by growth
- Distribution: revenue CAGR, margin, profit, size buckets
- Cohorts: segment performance (median KPIs)
- Coverage: "% with website", "% enriched", "% missing last-year financials"

**Data Coverage Mode toggle:**
- Switch from "screen targets" to "what do we not know?"
- Missing: homepage, employees_latest, 3-year financial history, ai_profile, llm_analysis, stale enrichment

### C) Pipeline (repeatable screening machine)

**Board columns:**
- Inbox (incoming lists / AI filters / imports)
- Stage 1: Screen (scorecards only)
- Stage 2: Research (website + basic intel)
- Stage 3: IC Prep (AI memo + valuation + risks)
- LOI / Diligence / Close (future-ready)

**Card = company:** KPI strip, strategic_fit_score, defensibility_score, last enrichment date, tags, owner.

**Batch actions:** Enrich (Light AI report vs Full), Export, Create IC pack (5–10 companies).

### D) Company Detail

**Tabs (5):**
1. Overview – KPI snapshot, segment, tags, status
2. Financials – trends, waterfall, margins, quality flags
3. AI & Web Intel – ai_profiles + enrichment artifacts + confidence
4. Risks & Flags – AI + hard rules + missing data
5. IC Output – memo, teaser, export

**Provenance:** Source run, model, date, scraped pages count, "needs refresh" badge.

### E) Reports

- IC memo (1–2 pages)
- Founder teaser / outreach one-pager
- Portfolio operating pack (future)
- Exports: Sheets, PDF, Copper CRM

### F) Runs & Jobs

- Enrichment runs list (status, progress, failures, cost/LLM if tracked)
- Per-company job timeline
- Retry/continue, "Why failed" with actionable errors

### G) Admin

- Users & roles (Admin / Partner / Analyst)
- Integrations (Copper, OpenAI, SerpAPI, Puppeteer, Redis/RQ, Supabase)
- Data health (DB counts, schema version, coverage dashboard)
- Audit (lightweight logging)

---

## 4. High-ROI Additions

1. **Coverage metrics table (materialized)** – orgnr, has_homepage, has_ai_profile, has_3y_financials, last_enriched_at, data_quality_score
2. **Freshness policy** – last_enriched_at > 180 days → "stale" badge + batch refresh
3. **LLM segment normalizer** – messy segment_names / NACE → internal taxonomy
4. **Value-creation levers tagging** – AI outputs 5–10 standardized levers (pricing, sales ops, etc.) for Universe filtering

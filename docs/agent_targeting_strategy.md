# Agent-Orchestrated Target Selection and Due Diligence Plan

## 1. Current Capabilities Recap
- The backend already assembles enriched company views that merge KPIs, financial accounts, and enrichment metadata into Excel-ready reports (`final_filter_companies.py`).【F:backend/final_filter_companies.py†L13-L94】
- AI scoring currently evaluates filtered companies with a single OpenAI call per record to produce qualitative insights (`analyze_top_companies.py`).【F:backend/analyze_top_companies.py†L9-L124】
- The broader platform combines scraping, KPI calculation, segmentation assets, and Supabase-backed storage that feeds a Next.js frontend for exploration.【F:README.md†L5-L143】

These pieces form the foundation for a richer, agent-coordinated workflow that can surface, evaluate, and report on the most attractive targets in a repeatable manner.

## 2. Objectives for the Enhanced Solution
1. **Segment Intelligently** – Systematically cluster and rank companies by strategic fit, growth profile, and operational similarity.
2. **Surface Top Contenders** – Produce a focused short list with transparent scoring logic and explainability.
3. **Automate Due Diligence** – Use specialized agents to build market and financial briefs from public data with minimal manual effort.
4. **Operationalize** – Deliver outputs in database tables, CSV/Excel artifacts, and Supabase views consumable by the frontend and downstream tooling.

## 3. Data Foundation & Feature Store Plan
1. **Ingestion**
   - Continue scraping Allabolag.se data (`fetch_allabolag.py`) into `companies`, `company_accounts`, and `company_kpis` staging tables.
   - Introduce scheduled pulls for complementary datasets (e.g., news sentiment APIs, job postings, patent filings) stored in new Supabase tables (`company_news_sentiment`, `company_hiring_trends`).
2. **Normalization & Feature Engineering**
   - Extend the enrichment pipeline to compute normalized metrics (e.g., revenue percentile within segment, 3-year CAGR, cash conversion cycle, web traffic estimates) and store results in a `company_feature_store` table with a version tag.
   - Add binary/continuous signals for strategic theses (e.g., export intensity, digital readiness, sustainability indices) using third-party datasets or heuristic scoring agents.
3. **Quality Gates**
   - Reuse `final_filter_companies.py` filters as baseline, but parameterize thresholds so agents can adjust guardrails per campaign while logging overrides for auditability.【F:backend/final_filter_companies.py†L48-L56】

## 4. Target Segmentation Framework
1. **Segment Profiles**
   - Define canonical segment templates (e.g., High-Growth SaaS, B2B Industrials, E-commerce Niche Players) with required metrics ranges and qualitative descriptors.
   - Store templates in Supabase (`target_segment_templates`) with JSON schema capturing metric thresholds, keywords, and weighting vectors.
2. **Clustering & Matching**
   - Apply semi-supervised clustering (e.g., HDBSCAN or k-prototypes) on the feature store to identify natural cohorts.
   - Use cosine similarity between company feature vectors and template vectors to assign fit scores, generating a `company_segment_fit` table with per-segment probabilities.
3. **Top Contender Selection**
   - Combine quantitative fit score, growth momentum, risk-adjusted profitability, and data completeness into a composite ranking algorithm.
   - Publish the ranked list into `target_company_shortlist_v{date}` tables. Persist the underlying factors for transparency.

## 5. Agent Task Architecture
### 5.1 Orchestrator Agent
- Oversees pipeline execution, kicks off segment scoring runs, and coordinates specialist agents.
- Maintains campaign context (investment thesis, geography focus, target size) to parameterize downstream tasks.

### 5.2 Data Validation Agent
- Verifies freshness of source tables and checks missing data patterns.
- Generates data quality reports and halts pipeline if anomalies are detected (e.g., sudden revenue drops due to scraping errors).

### 5.3 Segmentation Analyst Agent
- Reviews feature distributions, adjusts thresholds, and documents rationale for segment assignments.
- Suggests new segment templates when clusters exhibit emergent behavior.

### 5.4 Market Intelligence Agent
- Pulls external public data: industry reports, news articles, web traffic, social signals.
- Summarizes market positioning, competitive landscape, and macro tailwinds/headwinds for each shortlisted company.

### 5.5 Financial Analyst Agent
- Deep-dives into financial statements: margin trends, cash flow health, leverage, and forecast projections.
- Runs scenario stress tests and calculates valuation multiples using comparable sets derived from the segment cohort.

### 5.6 Risk & Compliance Agent
- Screens for red flags: legal disputes, sanction lists, ESG controversies, credit alerts.
- Produces a risk score and recommended follow-up actions.

### 5.7 Synthesis & Reporting Agent
- Assembles agent findings into structured investment memos, populates Supabase tables, and exports PDF/Excel summaries.
- Writes insights back into `ai_company_analysis` and generates highlight cards for the frontend dashboard.

## 6. Workflow Automation Blueprint
1. **Campaign Kick-off**
   - Orchestrator ingests campaign brief → updates configuration tables.
2. **Data Refresh & QA**
   - Data Validation Agent ensures the latest feature store snapshot passes quality checks.
3. **Segmentation & Ranking**
   - Segmentation Analyst Agent computes fit scores → orchestrator writes `target_company_shortlist`.
4. **Agentic Due Diligence Sprint**
   - For each candidate (batched to manage API costs):
     1. Market Intelligence Agent compiles external brief.
     2. Financial Analyst Agent updates financial scorecard (DCF, comparables).
     3. Risk Agent runs compliance screenings.
   - Agents exchange intermediate artifacts via Supabase storage or object store for traceability.
5. **Synthesis & Delivery**
   - Reporting Agent merges outputs into campaign package (dashboard tiles, memo PDFs, Excel exports).
   - Notifications triggered (e.g., Slack, email) to stakeholders with summary and next actions.

## 7. Implementation Roadmap
1. **Phase 0 – Foundations (1-2 weeks)**
   - Document existing data schemas, ensure repeatable data refresh jobs.
   - Stand up Supabase tables for feature store, segment templates, agent logs.
2. **Phase 1 – Segmentation Upgrade (2-3 weeks)**
   - Build feature engineering scripts, develop clustering & template matching notebooks.
   - Deploy segmentation service/API callable by agents.
3. **Phase 2 – Agent Framework (3-4 weeks)**
   - Integrate orchestration platform (e.g., LangGraph, crewAI) with specialized agent prompts and toolsets.
   - Implement Market & Financial agents with access to scraping utilities, financial APIs, and modeling templates.
4. **Phase 3 – Reporting & Frontend Integration (2 weeks)**
   - Extend `ai_company_analysis` schema to capture multi-agent outputs (market summary, financial verdict, risk notes).【F:backend/analyze_top_companies.py†L13-L122】
   - Update frontend to surface new shortlists, agent memos, and KPI comparisons (future PR).
5. **Phase 4 – Continuous Improvement**
   - Add reinforcement signals (user feedback loops), automate benchmarking, and refine prompts/models based on outcomes.

## 8. Governance & Observability
- Maintain an `agent_run_log` table capturing prompts, outputs, latency, and confidence.
- Implement cost tracking per campaign and agent to monitor API spend.
- Establish human-in-the-loop checkpoints where analysts can override scores or flag anomalies before final memos are published.

## 9. Deliverables Summary
- **Documentation**: Campaign playbook, agent prompt templates, configuration schemas.
- **Data Assets**: Feature store snapshots, segment fit tables, shortlist tables, agent logs.
- **Dashboards**: Target pipeline tracker with drill-down into market, financial, and risk findings.
- **Automation**: Scheduled orchestrator workflows with restart/resume capabilities.

## 10. Implementation Snapshot
- **Agentic Targeting Pipeline** – Executable orchestrator that loads enriched company data, engineers features, runs clustering-based segmentation, computes composite scores, and generates deterministic market & financial briefs (`backend/agentic_pipeline`).【F:backend/agentic_pipeline/orchestrator.py†L1-L94】【F:backend/agentic_pipeline/analysis.py†L1-L88】
- **Operational Entry Point** – CLI for analysts or automation runners to execute the full shortlist workflow and persist outputs to SQLite/CSV/Excel (`backend/run_agentic_targeting_pipeline.py`).【F:backend/run_agentic_targeting_pipeline.py†L1-L40】
- **Dependencies** – Requirements file updated with numerical and workbook packages needed for clustering, scoring, and Excel exports (`backend/requirements.txt`).【F:backend/requirements.txt†L1-L10】

This plan now pairs strategic guidance with the concrete agentic pipeline implementation, positioning the branch for integration into `main` once validated end-to-end.

## 11. How to Run and Test the Pipeline
1. **Install dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
   Ensure you are using Python 3.10+ so the `dataclasses` and typing features used by the pipeline are available.
2. **Verify syntax**
   Run the same compilation check used in CI to catch import or syntax errors early:
   ```bash
   python -m compileall agentic_pipeline run_agentic_targeting_pipeline.py
   ```
3. **Execute the pipeline**
   From the repository root (or inside `backend/`), run the CLI entry point. Point `--db-path` to the SQLite database that contains `company_kpis`, `company_accounts`, and `companies_enriched` tables.
   ```bash
   python backend/run_agentic_targeting_pipeline.py --db-path allabolag.db --top 30
   ```
   Use `--no-db`, `--no-csv`, or `--no-excel` flags if you want to skip writing outputs to those destinations during dry runs.
4. **Review outputs**
   - **Terminal** – The command prints a JSON summary listing any data-quality warnings and the size of the produced shortlist.
   - **Database** – When `--no-db` is omitted, new tables/views defined in the pipeline configuration are created/updated inside the provided SQLite database.
   - **Filesystem** – Unless disabled, CSV and Excel files are written to `outputs/agentic_targeting/` with timestamped filenames for traceability.
5. **Validate data quality**
   The pipeline emits structured issues (e.g., missing tables, sparse data) collected from the quality gate. Treat any non-empty `quality_issues` entries as blockers until investigated.

Following the steps above will recreate the same end-to-end flow that the automated orchestration agent runs, giving you confidence that segmentation, scoring, and reporting behave as expected before merging the branch.

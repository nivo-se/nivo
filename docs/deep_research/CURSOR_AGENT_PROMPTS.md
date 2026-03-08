Nivo Deep Research — Cursor Agent Implementation Prompts

These prompts are executed sequentially using Cursor Cloud Agents.

Each prompt must be run in a separate agent session.

⸻

GLOBAL INSTRUCTIONS (prepend to every prompt)

Every Cursor agent must start by loading the repository context.

Before making any changes, read the following files carefully:

AGENTS.md

docs/deep_research/IMPLEMENTATION_INDEX.md  
docs/deep_research/CURSOR_CONTEXT_PLAYBOOK.md  
docs/deep_research/CURSOR_AGENT_EXECUTION_PLAN.md  
docs/deep_research/CURSOR_AGENT_RULES.md  

These documents define:

• system architecture
• module boundaries
• database schema
• API contracts
• development workflow
• agent implementation rules

These documents are binding for this task.

Important rules:

1. Do NOT redesign the architecture.
2. Do NOT rename core domain entities.
3. Follow module boundaries defined in the docs.
4. Implement only the scope of this task.
5. If a conflict between docs is discovered, document it rather than inventing a new architecture.
6. Keep changes minimal and reviewable.

After reading the docs, briefly summarize:

• what the task is
• which modules are affected
• what you will implement

Then proceed with implementation.


⸻

Prompt 1 — Planning Agent

Purpose: Convert documentation into a clear engineering execution plan.

You are acting as a senior AI systems architect reviewing the Nivo Deep Research system.

Follow the GLOBAL INSTRUCTIONS first.

Your task is to analyze the repository and produce a detailed engineering execution plan.

The documentation defining the system is located in:

docs/deep_research/

These documents define:

• system architecture
• database schema
• API contracts
• retrieval design
• agent orchestration
• verification pipeline
• report generation

Treat these documents as the system source of truth.

---

Tasks

1. Inspect the repository structure.

2. Read all documentation in:

docs/deep_research/

3. Identify the modules required to implement the platform.

4. Produce the following planning documents:

docs/deep_research/execution-plan.md  
docs/deep_research/module-dependency-map.md  
docs/deep_research/open-questions.md

5. Define recommended backend module structure.

Expected modules include:

backend/api  
backend/agents  
backend/orchestrator  
backend/retrieval  
backend/verification  
backend/report_engine  
backend/services  
backend/models  
backend/db  

6. Identify implementation order.

7. Identify architectural inconsistencies across docs.

8. Recommend branch strategy.

Example:

feature/db-schema  
feature/api-contracts  
feature/retrieval  
feature/orchestrator  

---

Do NOT implement major code changes.

Only generate planning documents.

---

Definition of Done

The repository contains:

execution-plan.md  
module-dependency-map.md  
open-questions.md

These documents clearly describe the engineering roadmap.


⸻

Prompt 2 — Repository Foundations

Purpose: create backend project structure.

Follow GLOBAL INSTRUCTIONS first.

You are implementing the base architecture for the Nivo Deep Research backend.

Follow architecture described in docs/deep_research.

---

Tasks

Create backend module layout:

backend/
    api/
    agents/
    orchestrator/
    retrieval/
    verification/
    report_engine/
    services/
    models/
    db/
    common/
    config/

Add configuration modules:

settings.py  
logging setup  
environment loader

Add dependency management.

Support:

FastAPI  
PostgreSQL  
Redis  
LangGraph

Add project startup scripts.

---

Do NOT implement research logic yet.

Focus only on scaffolding.

---

Definition of Done

The repository contains a clean backend architecture that builds successfully.


⸻

Prompt 3 — Database Layer

Follow GLOBAL INSTRUCTIONS first.

Implement the persistence layer.

Use schema defined in:

docs/deep_research/database-schema-spec.md

---

Tasks

Implement database models using SQLAlchemy.

Create migrations.

Tables include:

companies  
analysis_runs  
sources  
source_chunks  
claims  
company_profiles  
market_analysis  
competitors  
competitor_profiles  
strategy  
value_creation  
financial_models  
valuations  
report_versions  
report_sections  

Add appropriate indexes.

---

Do not implement agent logic.

Focus only on persistence.

---

Definition of Done

Database models compile and migrations run successfully.


⸻

Prompt 4 — API Contracts

Follow GLOBAL INSTRUCTIONS first.

Implement the API layer using FastAPI.

Use:

docs/deep_research/api-contract-spec.md

---

Tasks

Create routers:

analysis  
reports  
competitors  
verification  
sources  
recompute  

Implement request/response models.

Follow response wrapper conventions.

Return stub responses where needed.

---

Definition of Done

All API routes compile and validate requests.


⸻

Prompt 5 — Retrieval System

Follow GLOBAL INSTRUCTIONS first.

Implement the research retrieval system.

Use architecture described in:

docs/deep_research/retrieval-system-design.md

---

Tasks

Implement modules:

query_planner  
web_search  
source_fetcher  
content_extractor  
source_storage  
chunking  
embedding  

Add wrappers for:

SerpAPI or Tavily  
HTTP fetching  
HTML extraction  

Store:

sources  
chunks  
metadata

---

Definition of Done

System can search a company and store retrieved sources.


⸻

Prompt 6 — Orchestration System

Follow GLOBAL INSTRUCTIONS first.

Implement the agent orchestration system.

Follow:

docs/deep_research/langgraph-agent-orchestrator.md

---

Tasks

Create LangGraph state graph.

Nodes include:

identity  
company_profile  
market_analysis  
competitor_discovery  
strategy  
value_creation  
financial_model  
valuation  
verification  
report_generation  

Implement run state persistence.

---

Definition of Done

The system can execute a basic run pipeline.


⸻

Prompt 7 — Core Research Agents

Follow GLOBAL INSTRUCTIONS first.

Implement the core research agents.

Agents:

identity agent  
company profile agent  
market analysis agent  

Each agent must:

consume sources  
generate structured output  
store results in database  
attach claims and sources  

---

Definition of Done

Agents produce structured research outputs.


⸻

Prompt 8 — Competitive Analysis + Strategy

Follow GLOBAL INSTRUCTIONS first.

Implement competitive intelligence agents.

Agents include:

competitor discovery  
competitor profiling  
strategy analysis  
value creation identification  

Ensure outputs connect with database models.

Competitor discovery should use semantic similarity and research sources.


⸻

Prompt 9 — Financial Modeling + Valuation

Follow GLOBAL INSTRUCTIONS first.

Implement deterministic financial modeling.

Modules:

assumptions engine  
projection engine  
valuation engine  

Produce:

7-year projections  
scenario analysis  
valuation ranges  

Store results in database.


⸻

Prompt 10 — Supervisor Integration Agent

This is the most important step.

Follow GLOBAL INSTRUCTIONS first.

You are a principal engineer reviewing the Nivo Deep Research platform.

Your task is to integrate all modules created by prior prompts.

---

Steps

1. Inspect modules:

backend/api  
backend/agents  
backend/retrieval  
backend/orchestrator  
backend/verification  
backend/report_engine  

2. Verify consistency between:

database models  
API models  
agent outputs  
report structures  

3. Resolve integration issues.

4. Ensure the full pipeline works:

company → research → analysis → report

5. Generate integration report:

docs/deep_research/integration-review.md

This report must include:

remaining issues  
technical debt  
missing components  
recommended improvements

---

Definition of Done

The system can run an end-to-end analysis pipeline.


⸻

Execution Order

Run prompts sequentially:

1 Planning
2 Repo Foundations
3 Database
4 API
5 Retrieval
6 Orchestrator
7 Core Agents
8 Competitive Analysis
9 Financial Modeling
10 Supervisor Integration


⸻

Important rule

Run each prompt in a new Cursor cloud-agent session.

This prevents context overflow and architecture drift.

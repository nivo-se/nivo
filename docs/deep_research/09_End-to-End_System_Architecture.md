Below is the End-to-End System Architecture diagram for the Nivo Automated Company Analysis Platform.

This is the “single architecture diagram” that typically appears in technical documentation, investor decks, and system design docs. It ties together everything we designed earlier:  
	•	UI  
	•	API  
	•	Agent system  
	•	Retrieval layer  
	•	Data storage  
	•	Report generation

It reflects the agent-driven workflow described in the Nivo architecture document  ￼ and produces reports structured like the investment memo example (company → market → competition → value creation → valuation)  ￼.

⸻

Nivo End-to-End System Architecture

flowchart LR

%% USER  
User[Investment Analyst]

%% UI  
UI[Nivo Web Interface]

%% API  
API[FastAPI Backend]

%% ORCHESTRATION  
Planner[Planner Agent]  
Orchestrator[LangGraph Orchestrator]

%% AGENTS  
CompanyAgent[Company Profiling Agent]  
MarketAgent[Market Analysis Agent]  
CompetitorDiscovery[Competitor Discovery Agent]  
CompetitorProfile[Competitor Profiling Agent]  
StrategyAgent[Strategy Analysis Agent]  
ValueCreationAgent[Value Creation Agent]  
FinancialModelAgent[Financial Modeling Agent]  
ValuationAgent[Valuation Agent]  
VerificationAgent[Verification Agent]  
ReportAgent[Report Generation Agent]

%% RETRIEVAL  
SearchAPI[Search APIs]  
Scraper[Web Scraper]  
Parser[Document Parser]

%% DATA  
Postgres[(PostgreSQL)]  
Vector[(Vector DB)]  
ObjectStore[(Object Storage)]

%% INTERNET  
Internet[Public Web Sources]

%% FLOW  
User --> UI  
UI --> API

API --> Planner  
Planner --> Orchestrator

Orchestrator --> CompanyAgent  
CompanyAgent --> MarketAgent  
MarketAgent --> CompetitorDiscovery  
CompetitorDiscovery --> CompetitorProfile

CompetitorProfile --> StrategyAgent  
StrategyAgent --> ValueCreationAgent  
ValueCreationAgent --> FinancialModelAgent  
FinancialModelAgent --> ValuationAgent  
ValuationAgent --> VerificationAgent  
VerificationAgent --> ReportAgent

ReportAgent --> API  
API --> UI

%% Retrieval connections  
CompanyAgent --> SearchAPI  
MarketAgent --> SearchAPI  
CompetitorDiscovery --> SearchAPI

SearchAPI --> Internet

SearchAPI --> Scraper  
Scraper --> Parser  
Parser --> ObjectStore

%% Data storage  
CompanyAgent --> Postgres  
MarketAgent --> Postgres  
CompetitorProfile --> Postgres  
StrategyAgent --> Postgres  
ValueCreationAgent --> Postgres  
FinancialModelAgent --> Postgres  
ValuationAgent --> Postgres  
VerificationAgent --> Postgres

Parser --> Vector  
Vector --> VerificationAgent  
ObjectStore --> VerificationAgent

⸻

Architecture Layers

1️⃣ User Layer

Investment Analyst

Capabilities:  
	•	run company analysis  
	•	review reports  
	•	edit competitors  
	•	adjust assumptions  
	•	rerun agents

⸻

2️⃣ UI Layer

Nivo Web App

Technology:

Next.js / React

Features:

interactive reports  
source references  
editable competitors  
financial charts

⸻

3️⃣ API Layer

FastAPI Backend

Endpoints:

POST /analysis/run  
GET /analysis/{company}  
POST /analysis/update  
GET /analysis/run/{run_id}

Responsibilities:

authentication  
analysis orchestration  
run tracking  
versioning

⸻

4️⃣ Agent Orchestration Layer

Central control system.

Planner Agent  
↓  
LangGraph Task Graph  
↓  
Agent Worker Pool

Responsibilities:

task scheduling  
parallel execution  
retries  
partial recompute

⸻

5️⃣ Agent Intelligence Layer

Core analysis pipeline.

Company Profiling  
↓  
Market Research  
↓  
Competitor Discovery  
↓  
Competitor Profiling  
↓  
Strategy Analysis  
↓  
Value Creation  
↓  
Financial Modeling  
↓  
Valuation  
↓  
Verification  
↓  
Report Generation

This matches the analysis flow defined in the Nivo architecture document  ￼.

⸻

6️⃣ Retrieval Layer

Agents must dynamically gather information.

Components:

Search API (SerpAPI / Tavily)  
Web Scraping (Playwright)  
Document Parsing (HTML/PDF)

Data sources:

company websites  
news articles  
industry reports  
government data  
competitor websites

⸻

7️⃣ Data Layer

PostgreSQL

Stores:

company data  
agent outputs  
financial models  
valuations  
reports

⸻

Vector Database

Used for:

semantic search  
document retrieval  
source verification

Example:

pgvector

⸻

Object Storage

Stores:

raw HTML  
PDF reports  
charts  
screenshots

⸻

8️⃣ Verification Layer

Prevents hallucinated information.

Checks:

multi-source validation  
source credibility  
claim support  
confidence scoring

Only verified claims reach the report.

⸻

9️⃣ Report Generation Layer

Creates the final report.

Structure follows investment memo format  ￼:

Executive Summary  
Company Overview  
Market Analysis  
Competitive Landscape  
Value Creation Plan  
Financial Projections  
Valuation

Output format:

report.json  
charts  
references

⸻

Parallel Processing

Competitor profiling runs concurrently.

Example:

flowchart TD

CompetitorDiscovery --> C1  
CompetitorDiscovery --> C2  
CompetitorDiscovery --> C3  
CompetitorDiscovery --> C4

C1 --> Strategy  
C2 --> Strategy  
C3 --> Strategy  
C4 --> Strategy

This dramatically improves performance.

⸻

Observability

Track:

agent runtime  
web search calls  
LLM tokens  
verification scores  
analysis completion rate

Tools:

Prometheus  
Grafana  
OpenTelemetry

⸻

Expected System Capacity

The platform can analyze:

50–100 companies

Producing:

institutional-grade investment analysis

With approximately:

80% automated research  
20% human review

Matching the original platform goal described in the architecture document  ￼.

⸻

Recommended Next Step

The next document that will dramatically accelerate development is:

retrieval-system-design.md

This will define:  
	•	search query strategies  
	•	scraping architecture  
	•	extraction pipelines  
	•	verification pipelines

Without a robust retrieval system, the agents cannot reliably produce deep company research.
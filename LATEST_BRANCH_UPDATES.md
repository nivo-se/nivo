# Latest Branch Updates Summary

**Date:** 2025-01-XX  
**Branch:** `feature-ai-chat-2`  
**Latest Commit:** `08a3f786` - "feat: implement stateful AI filtering with RAG and vector search"

---

## 🎯 Major Feature: Stateful AI Filtering with RAG

### Overview
The remote branch introduced a **stateful AI filtering system** that allows users to iteratively refine search results using natural language. This is powered by:
- **RAG (Retrieval-Augmented Generation)** using ChromaDB for context retrieval
- **Vector embeddings** for intelligent context matching
- **Stateful filtering** that remembers previous filters and allows refinement

---

## 🆕 New Components

### 1. **RAG Service** (`backend/utils/rag_service.py`)
- **Purpose:** Provides intelligent context retrieval using vector embeddings
- **Technology:** ChromaDB with OpenAI embeddings (`text-embedding-3-small`)
- **Features:**
  - Automatically indexes `data/rag_context.md` (database schema and business logic)
  - Re-indexes when content changes (hash-based detection)
  - Queries return relevant context chunks for LLM prompts
  - Ensures critical "Valid Fields" section is always included

**Key Methods:**
- `query(text, n_results=3)` - Retrieves relevant context for a query
- `_ensure_indexed()` - Auto-indexes content when file changes
- `_index_content()` - Chunks markdown by H2 headers and stores in ChromaDB

### 2. **Analysis Workflow** (`backend/analysis/`)
A complete 3-stage analysis pipeline:

#### **Stage 1: Filter** (`stage1_filter.py`)
- `FilterCriteria` - Dataclass for filter parameters
- `FinancialFilter` - Executes SQL filters based on criteria
- `IntentAnalyzer` - Parses natural language into filter criteria
- Supports revenue, margins, growth, industry, location filters

#### **Stage 2: Research** (`stage2_research.py`)
- `ResearchData` - Stores web research results
- `research_batch()` - Parallel web scraping and research
- Discovers homepages, scrapes content, performs digital scoring
- Stores results in `company_research` table

#### **Stage 3: Analysis** (`stage3_analysis.py`)
- `AIAnalyzer` - Deep AI analysis of companies
- `AnalysisResult` - Structured analysis output
- Generates business model, SWOT, strategic fit, investment memo
- Stores results in `company_analysis` table

#### **Workflow Orchestrator** (`workflow.py`)
- `AnalysisWorkflow` - Coordinates all 3 stages
- Manages run state in `acquisition_runs` table
- Handles parallel processing with semaphores
- Tracks progress through stages

### 3. **Chat API** (`backend/api/chat.py`)
- **Endpoint:** `POST /api/analysis/chat`
- **Purpose:** Interactive chat interface for refining filters
- **Features:**
  - Accepts natural language messages
  - Parses intent using `IntentAnalyzer`
  - Refines existing criteria or creates new ones
  - Returns updated criteria, match count, sample companies, suggestions

**Request:**
```json
{
  "message": "remove property companies",
  "current_criteria": { ... }
}
```

**Response:**
```json
{
  "message": "Filtered description",
  "criteria": { ... },
  "count": 123,
  "sample_companies": [ ... ],
  "suggestions": [ ... ]
}
```

### 4. **Analysis API** (`backend/api/analysis.py`)
- **Endpoints:**
  - `POST /api/analysis/run` - Start a full 3-stage workflow
  - `GET /api/analysis/runs` - List all runs
  - `GET /api/analysis/runs/{run_id}` - Get run details
  - `GET /api/analysis/runs/{run_id}/results` - Get analysis results

### 5. **Saved Lists API** (`backend/api/saved_lists.py`)
- **Endpoints:**
  - `GET /api/saved-lists` - Get all saved lists
  - `POST /api/saved-lists` - Save a new list
  - `DELETE /api/saved-lists/{id}` - Delete a list
- **Storage:** Uses `stage1_shortlists` table in Supabase

### 6. **Frontend Chat Interface** (`frontend/src/components/analysis/ChatInterface.tsx`)
- Interactive chat UI for refining filters
- Shows current criteria, match count, sample companies
- Provides suggestions for further refinement
- Integrates with the chat API endpoint

### 7. **Analysis Page** (`frontend/src/pages/AnalysisPage.tsx`)
- New page at `/analysis` route
- Full workflow management interface
- View runs, results, and analysis details

---

## 🔄 Enhanced AI Filter (`backend/api/ai_filter.py`)

### Stateful Filtering
- **New Parameter:** `current_where_clause` - Accepts existing SQL WHERE clause
- **Behavior:** LLM now combines existing filters with new user input
- **Example Flow:**
  1. Initial search: "companies with 100M revenue" → `WHERE f.max_revenue_sek >= 100000000`
  2. Refinement: "remove property companies" → `WHERE f.max_revenue_sek >= 100000000 AND c.nace_categories NOT LIKE '%fastigheter%'`

### RAG Integration
- Uses `retrieve_context()` to get relevant database schema info
- LLM prompt includes context about valid fields, business logic, examples
- Better SQL generation with schema awareness

### Enhanced Prompt
- Includes RAG context about:
  - Valid SQL fields and table aliases
  - Business logic (margins, growth calculations)
  - Example prompt translations
  - Warnings about invalid fields

---

## 📊 Database Schema Updates

### New Tables

#### `acquisition_runs`
- Tracks workflow execution
- Fields: `id`, `criteria`, `stage`, `status`, `started_at`, `completed_at`, `created_by`
- Progress tracking through stages

#### `company_research`
- Stores web research results
- Fields: `orgnr`, `run_id`, `homepage_url`, `website_content`, `about_text`, `products_text`, `search_results`, `digital_score`, `scrape_success`, `search_success`

#### `company_analysis`
- Stores AI analysis results
- Fields: `orgnr`, `run_id`, `business_model`, `products_summary`, `market_position`, `swot_*`, `strategic_fit_score`, `recommendation`, `investment_memo`, `raw_analysis`

### Schema Files
- `database/acquisition_schema.sql` - Full schema for acquisition workflow
- `database/sqlite_schema.sql` - SQLite-specific schema

---

## 🗂️ RAG Context File (`data/rag_context.md`)

Contains structured documentation for the LLM:
- **Valid Fields:** SQL table aliases and column names
- **Business Logic:** How margins, growth, buckets are calculated
- **Warnings:** What NOT to do (hallucinate fields, interpret "Nivo" as company)
- **Examples:** Prompt → SQL translations
- **Strategic Fit Criteria:** Used in deeper analysis

This file is automatically indexed in ChromaDB and retrieved during queries.

---

## 🔧 Configuration Updates

### Agentic Pipeline (`backend/agentic_pipeline/`)
- Updated to use `data/nivo_optimized.db` instead of `allabolag.db`
- Added financial filtering criteria (min_revenue, min_ebitda, min_growth, min_employees)
- Enhanced data access to use `financials` and `companies` tables
- Improved feature engineering and quality checks

### API Main (`backend/api/main.py`)
- Added new routers:
  - `ai_filter` - Enhanced AI filtering
  - `enrichment` - Company enrichment
  - `export` - CRM export
  - `analysis` - Analysis workflow
  - `chat` - Chat interface
  - `saved_lists` - Saved lists management

---

## 🎨 Frontend Updates

### New Routes
- `/analysis` - Analysis workflow page
- `/companies/:orgnr` - Company detail page (already existed, enhanced)

### Components
- `ChatInterface.tsx` - Interactive chat for filter refinement
- Enhanced `CompanyExplorer.tsx` - Better company display
- Updated `AISourcingDashboard.tsx` - Stateful filtering support

### API Service (`frontend/src/lib/apiService.ts`)
- Added chat API methods
- Added analysis workflow methods
- Enhanced company batch fetching

---

## 📝 Utility Scripts

### `check_data.py`
- Verifies database connection
- Checks table row counts
- Useful for debugging

### `check_db.py`
- Checks if required tables exist
- Validates database structure

### `debug_filter.py`
- Debugging tool for AI filter
- Tests SQL generation
- Validates filter logic

### `inspect_financials.py`
- Inspects financials table structure
- Shows column names and sample data

---

## 🚀 Key Workflows

### 1. **Stateful Filtering Workflow**
```
User: "Find companies with 100M revenue"
  → AI generates: WHERE f.max_revenue_sek >= 100000000
  → Returns 866 companies

User: "Remove property companies"
  → AI combines: WHERE f.max_revenue_sek >= 100000000 AND c.nace_categories NOT LIKE '%fastigheter%'
  → Returns refined list
```

### 2. **Full Analysis Workflow**
```
1. User defines criteria (via chat or form)
2. Stage 1: Financial filtering → Get org numbers
3. Stage 2: Web research → Scrape websites, get content
4. Stage 3: AI analysis → Generate investment memos
5. Store results in database
6. Display in frontend
```

### 3. **RAG Context Retrieval**
```
User prompt → RAG query → Vector search → Relevant chunks → LLM prompt
  → Better SQL generation with schema awareness
```

---

## 🔍 Technical Details

### Vector Database
- **Technology:** ChromaDB (persistent storage)
- **Location:** `data/chroma_db/`
- **Embeddings:** OpenAI `text-embedding-3-small`
- **Collection:** `nivo_context`
- **Chunking:** By H2 headers (##) in markdown

### State Management
- Frontend tracks `current_where_clause` in state
- Passes to backend on each refinement
- Backend combines with new user input
- Returns updated WHERE clause for next iteration

### Parallel Processing
- Stage 2 (Research): Max 10 concurrent requests
- Stage 3 (Analysis): Max 5 concurrent AI calls
- Uses `asyncio.Semaphore` for rate limiting

---

## 📈 Benefits

1. **Iterative Refinement:** Users can drill down step-by-step
2. **Context-Aware:** RAG provides schema knowledge to LLM
3. **Better SQL:** More accurate SQL generation with context
4. **Full Pipeline:** Complete workflow from filter to analysis
5. **Stateful:** Remembers previous filters
6. **Scalable:** Parallel processing for large batches

---

## 🔄 Integration with Existing Features

### Works With:
- ✅ Existing AI filter endpoint (enhanced, not replaced)
- ✅ Company enrichment pipeline
- ✅ Lightweight auto-enrichment
- ✅ Company context display
- ✅ Saved lists functionality

### New Capabilities:
- 🆕 Stateful filtering (refine previous results)
- 🆕 RAG-powered context retrieval
- 🆕 Full 3-stage analysis workflow
- 🆕 Chat interface for filter refinement
- 🆕 Analysis results storage and retrieval

---

## 📚 Files Changed/Added

### Backend
- `backend/utils/rag_service.py` - NEW
- `backend/utils/retrieve_context.py` - NEW
- `backend/analysis/*` - NEW (4 files)
- `backend/api/chat.py` - NEW
- `backend/api/analysis.py` - NEW
- `backend/api/saved_lists.py` - NEW
- `backend/api/ai_filter.py` - ENHANCED (stateful filtering, RAG)
- `backend/api/enrichment.py` - ENHANCED
- `backend/agentic_pipeline/*` - UPDATED (7 files)

### Frontend
- `frontend/src/components/analysis/ChatInterface.tsx` - NEW
- `frontend/src/pages/AnalysisPage.tsx` - NEW
- `frontend/src/components/CompanyExplorer.tsx` - ENHANCED
- `frontend/src/lib/apiService.ts` - ENHANCED
- `frontend/src/App.tsx` - UPDATED (new routes)

### Data & Config
- `data/rag_context.md` - NEW
- `data/chroma_db/*` - NEW (vector database)
- `database/acquisition_schema.sql` - NEW
- `database/sqlite_schema.sql` - NEW

### Scripts
- `check_data.py` - NEW
- `check_db.py` - NEW
- `debug_filter.py` - NEW
- `inspect_financials.py` - NEW

---

## 🎯 Next Steps

1. **Test Stateful Filtering:**
   - Try iterative refinement in the dashboard
   - Verify WHERE clause combination works correctly

2. **Test RAG System:**
   - Verify ChromaDB is indexing correctly
   - Check that context retrieval improves SQL generation

3. **Test Analysis Workflow:**
   - Run a full 3-stage workflow
   - Verify results are stored correctly
   - Check frontend display

4. **Review Database Schema:**
   - Ensure new tables are created (if using Supabase)
   - Or verify local SQLite fallback works

---

## 📝 Notes

- **RAG Context:** The `data/rag_context.md` file is automatically indexed. Update it to improve LLM context.
- **Vector DB:** ChromaDB persists to disk, so embeddings are cached.
- **Stateful Filtering:** Frontend must track and pass `current_where_clause` for iterative refinement.
- **Workflow Runs:** All runs are stored in `acquisition_runs` table for audit trail.

---

**All changes merged successfully!** The branch now includes both your local work (company context, auto-enrichment) and the remote RAG/vector search features. 🎉


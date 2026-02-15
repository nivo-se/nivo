# Implementation Start Guide
## Best Practice Setup for Nivo Intelligence Overhaul

---

## Phase 0: Infrastructure & Services Setup

### 1. Required Services

#### A. Redis (for Job Queue)
**Option 1: Local Development**
```bash
# macOS
brew install redis
brew services start redis

# Verify
redis-cli ping  # Should return "PONG"
```

**Option 2: Redis Cloud (Production)**
- Sign up at https://redis.com/try-free/
- Create free tier database (30MB, sufficient for development)
- Get connection URL: `redis://default:password@host:port`

**Option 3: Docker**
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

#### B. External API Keys

**Required APIs:**
1. **SerpAPI** (Google search, SEO metrics)
   - Sign up: https://serpapi.com/users/sign_up
   - Free tier: 100 searches/month
   - Get API key from dashboard

2. **BuiltWith** (Tech stack detection)
   - Sign up: https://builtwith.com/api
   - Free tier: 50 lookups/month
   - Pro plan: $295/month (unlimited)

3. **Perplexity API** (Web search with citations)
   - Sign up: https://www.perplexity.ai/settings/api
   - Free tier: Limited
   - Pro: $20/month for 5,000 queries

4. **OpenAI** (Already have this)
   - Verify API key works
   - Ensure access to: `gpt-4o-mini`, `text-embedding-3-small`

**Optional APIs:**
- **Browserless.io** (Dynamic scraping): $75/month
- **LinkedIn API**: Requires business verification

### 2. Environment Variables

Create/update `.env` files:

**Backend `.env`** (in `/backend/`):
```bash
# Existing
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key

# New - Redis
REDIS_URL=redis://localhost:6379/0
# Or for Redis Cloud:
# REDIS_URL=redis://default:password@host:port

# New - External APIs
SERPAPI_KEY=your_serpapi_key
BUILTWITH_API_KEY=your_builtwith_key
PERPLEXITY_API_KEY=your_perplexity_key

# Optional
BROWSERLESS_API_KEY=your_browserless_key
LINKEDIN_API_KEY=your_linkedin_key
```

**Frontend `.env`** (in `/frontend/`):
```bash
# Existing
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# New - Backend API (if separate FastAPI server)
VITE_API_BASE_URL=http://localhost:8000
# Or if using existing Express server:
# VITE_API_BASE_URL=http://localhost:3001
```

### 3. Supabase Setup

**Enable pgvector extension:**
```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;
```

**Verify extension:**
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

---

## Phase 1: Database Schema (Foundation First)

### Step 1: Create Migration File

**File: `database/migrations/005_add_intelligence_tables.sql`**

This migration adds all intelligence-related tables. Run it in Supabase SQL Editor or via migration tool.

**Key tables:**
- `company_intel` - Core intelligence data
- `intel_artifacts` - Raw data from sources
- `company_embeddings` - Vector embeddings (pgvector)
- `ai_reports` - Structured AI analysis
- `playbooks` - Action plans
- `decision_log` - Audit trail
- `company_rankings` - Composite scores

### Step 2: Create Vector Search Function

**File: `database/migrations/006_add_vector_search_function.sql`**

This adds the pgvector similarity search function.

---

## Phase 2: Backend Foundation

### Step 1: Update Python Dependencies

**File: `backend/requirements.txt`** (add these):
```
# Job queue
rq>=1.15.0
redis>=5.0.0

# FastAPI (for new API endpoints)
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
python-multipart>=0.0.9

# HTTP clients for enrichment
aiohttp>=3.9.0
httpx>=0.27.0

# Embeddings
tiktoken>=0.7.0

# Optional: Better async support
asyncio>=3.4.3
```

**Install:**
```bash
cd backend
pip install -r requirements.txt
```

### Step 2: Create Backend API Structure

**Directory structure:**
```
backend/
├── api/                    # NEW - FastAPI application
│   ├── __init__.py
│   ├── main.py            # FastAPI app entry point
│   ├── dependencies.py    # Shared dependencies (Supabase client, etc.)
│   ├── filters.py         # Financial filter endpoints
│   ├── companies.py       # Company intelligence endpoints
│   ├── jobs.py            # Background job endpoints
│   └── search.py          # Vector search endpoints
├── workers/                # NEW - Background workers
│   ├── __init__.py
│   ├── enrichment_worker.py
│   └── ai_worker.py
├── agentic_pipeline/
│   └── enrichment/         # NEW - Enrichment adapters
│       ├── __init__.py
│       ├── orchestrator.py
│       ├── serpapi_client.py
│       ├── builtwith_client.py
│       ├── classifier.py
│       └── ...
└── ...
```

### Step 3: Create FastAPI Application

**File: `backend/api/main.py`**
- FastAPI app with CORS
- Health check endpoint
- Router registration

**File: `backend/api/dependencies.py`**
- Shared Supabase client
- Redis connection
- Dependency injection

---

## Phase 3: Frontend Foundation

### Step 1: Create Service Layer

**File: `frontend/src/lib/intelligenceService.ts`**
- Unified service for all intelligence operations
- TypeScript types for API responses
- Error handling

### Step 2: Create Type Definitions

**File: `frontend/src/types/intelligence.ts`**
- TypeScript interfaces for:
  - CompanyIntel
  - AIReport
  - FilterWeights
  - Ranking
  - etc.

### Step 3: Set Up TanStack Query

**File: `frontend/src/lib/queryClient.ts`**
- Configure React Query client
- Default options (staleTime, cacheTime)
- Error handling

---

## Phase 4: Development Workflow

### Running Services

**Terminal 1: Redis**
```bash
redis-server
# Or if using Docker:
docker run -d -p 6379:6379 redis:7-alpine
```

**Terminal 2: Backend API (FastAPI)**
```bash
cd backend
uvicorn api.main:app --reload --port 8000
```

**Terminal 3: Backend Workers (RQ)**
```bash
cd backend
rq worker enrichment ai_analysis --url redis://localhost:6379/0
```

**Terminal 4: Frontend Dev Server**
```bash
cd frontend
npm run dev
```

### Testing Setup

**Backend:**
```bash
cd backend
pytest tests/ -v
```

**Frontend:**
```bash
cd frontend
npm test
```

---

## Implementation Order (Recommended)

### Week 1: Foundation
1. ✅ Set up Redis (local or cloud)
2. ✅ Get API keys (SerpAPI, BuiltWith, Perplexity)
3. ✅ Update environment variables
4. ✅ Run database migrations
5. ✅ Install Python dependencies
6. ✅ Create FastAPI app structure
7. ✅ Create frontend service layer

### Week 2: Financial Filters (MVP)
1. ✅ Implement `/api/filters/analytics` endpoint
2. ✅ Create `FinancialFilterPanel` component
3. ✅ Add scatter plot visualization
4. ✅ Connect to Stage 1 workflow

### Week 3: Intelligence Layer
1. ✅ Implement enrichment adapters
2. ✅ Create RQ workers
3. ✅ Build `CompanyIntelDrawer` component
4. ✅ Add job status polling

### Week 4: AI Reports
1. ✅ Implement AI report generation
2. ✅ Create `AIDeepDivePanel` component
3. ✅ Add streaming/progress updates

### Week 5+: Ranking & Advanced Features
1. ✅ Implement ranking system
2. ✅ Add vector search
3. ✅ Polish UI/UX

---

## Quick Start Checklist

- [ ] Redis installed and running
- [ ] API keys obtained (SerpAPI, BuiltWith, Perplexity)
- [ ] Environment variables configured
- [ ] Supabase pgvector extension enabled
- [ ] Database migrations run
- [ ] Python dependencies installed
- [ ] FastAPI app structure created
- [ ] Frontend service layer created
- [ ] Development servers can start

---

## Next Steps

Once foundation is set up, start with:
1. **Financial Filter Panel** (easiest win, immediate value)
2. **Basic Enrichment** (SerpAPI + BuiltWith)
3. **AI Reports** (leverages existing OpenAI setup)

Each component can be built and tested independently!


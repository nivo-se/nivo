# Quick Start Guide
## Get Nivo Intelligence System Running in 15 Minutes

---

## Prerequisites Check

- [ ] Python 3.9+ installed
- [ ] Node.js 18+ installed
- [ ] Redis installed (or Docker)
- [ ] Supabase project with admin access
- [ ] API keys ready (OpenAI, SerpAPI, BuiltWith)

---

## Step 1: Install Redis (2 minutes)

**macOS:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Docker:**
```bash
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

**Verify:**
```bash
redis-cli ping
# Should return: PONG
```

---

## Step 2: Get API Keys (5 minutes)

1. **SerpAPI**: https://serpapi.com/users/sign_up (Free: 100 searches/month)
2. **BuiltWith**: https://builtwith.com/api (Free: 50 lookups/month)
3. **Perplexity** (optional): https://www.perplexity.ai/settings/api
4. **OpenAI**: Already have this ✅

---

## Step 3: Set Up Environment (2 minutes)

```bash
# Copy example env file
cp .env.example .env

# Edit .env and add your keys
# Required:
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
# - OPENAI_API_KEY
# - REDIS_URL (default: redis://localhost:6379/0)
# - SERPAPI_KEY
# - BUILTWITH_API_KEY
```

---

## Step 4: Run Database Migrations (2 minutes)

1. Open Supabase Dashboard → SQL Editor
2. Run `database/migrations/005_add_intelligence_tables.sql`
3. Run `database/migrations/006_add_vector_search_function.sql`
4. Verify: Check that tables exist in `ai_ops` schema

---

## Step 5: Install Dependencies (2 minutes)

```bash
# Backend
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

---

## Step 6: Start Services (2 minutes)

**Terminal 1 - Redis:**
```bash
redis-server
# Or if using Docker: docker start redis
```

**Terminal 2 - Backend API:**
```bash
cd backend
source venv/bin/activate
uvicorn api.main:app --reload --port 8000
```

**Terminal 3 - Backend Workers:**
```bash
cd backend
source venv/bin/activate
rq worker enrichment ai_analysis --url redis://localhost:6379/0
```

**Terminal 4 - Frontend:**
```bash
cd frontend
npm run dev
```

---

## Step 7: Verify Setup

1. **Backend API**: http://localhost:8000/health
   - Should return: `{"status": "healthy", "service": "nivo-intelligence-api"}`

2. **Frontend**: http://localhost:5173
   - Should load dashboard

3. **Redis**: `redis-cli ping` → `PONG`

4. **Workers**: Check terminal 3 for "Listening for jobs..."

---

## Troubleshooting

**Redis connection error:**
- Check Redis is running: `redis-cli ping`
- Verify REDIS_URL in .env matches your setup

**Supabase connection error:**
- Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
- Check Supabase project is active

**Import errors:**
- Make sure virtual environment is activated
- Reinstall dependencies: `pip install -r requirements.txt`

**Port already in use:**
- Backend API: Change port in `uvicorn api.main:app --port 8001`
- Update VITE_API_BASE_URL in frontend .env

---

## Next Steps

Once everything is running:

1. ✅ Test financial filter endpoint (when implemented)
2. ✅ Trigger first enrichment job (when implemented)
3. ✅ View company intelligence (when implemented)

See `docs/IMPLEMENTATION_START_GUIDE.md` for detailed implementation plan.

---

## Development Workflow

**Making changes:**
- Backend: Auto-reloads with `--reload` flag
- Frontend: Hot-reloads automatically
- Workers: Restart manually after code changes

**Testing:**
```bash
# Backend
cd backend
pytest tests/

# Frontend
cd frontend
npm test
```

---

## Need Help?

- Check `docs/IMPLEMENTATION_START_GUIDE.md` for detailed setup
- Review `docs/NIVO_DASHBOARD_INTELLIGENCE_OVERHAUL.md` for architecture
- Verify all services are running: Redis, Backend API, Workers, Frontend


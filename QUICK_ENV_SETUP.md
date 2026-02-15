# Quick Environment Setup

**TL;DR:** Copy `.env.example` to `.env`, fill in your keys, run verification script.

## 1. Create `.env` File

```bash
# Copy the example (if it exists) or create manually
cp .env.example .env  # or create .env manually
```

## 2. Required Variables (Minimum)

Add these to your `.env` file:

```bash
# Database
DATABASE_SOURCE=local
LOCAL_DB_PATH=data/nivo_optimized.db

# OpenAI (REQUIRED)
OPENAI_API_KEY=sk-your-key-here

# Supabase (REQUIRED for ai_profiles table)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis (for background jobs)
REDIS_URL=redis://localhost:6379/0
```

## 3. Optional (But Recommended)

```bash
# SerpAPI - for website lookup
SERPAPI_KEY=your-serpapi-key

# Puppeteer - for deep scraping (see PUPPETEER_SERVICE_SETUP.md)
# Option 1: Browserless.io (easiest)
PUPPETEER_SERVICE_URL=https://chrome.browserless.io/scrape
PUPPETEER_SERVICE_TOKEN=your-browserless-token

# CORS - for frontend
CORS_ORIGINS=http://localhost:8080,http://localhost:5173
```

## 4. Verify Setup

```bash
python3 scripts/verify_env_setup.py
```

## 5. Get Your Keys

### OpenAI
- Go to: https://platform.openai.com/api-keys
- Create new key
- Copy to `OPENAI_API_KEY`

### Supabase
- Go to: https://supabase.com/dashboard
- Select your project → Settings → API
- Copy `URL` → `SUPABASE_URL`
- Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### SerpAPI (Optional)
- Go to: https://serpapi.com/dashboard
- Copy API key → `SERPAPI_KEY`
- Free tier: 100 searches/month

### Puppeteer (Optional - Recommended)
**Easiest option: Browserless.io**
1. Sign up: https://www.browserless.io/
2. Get token from dashboard
3. Set:
   ```bash
   PUPPETEER_SERVICE_URL=https://chrome.browserless.io/scrape
   PUPPETEER_SERVICE_TOKEN=your-token
   ```
- Free tier: 6 hours/month

## 6. Test

```bash
# Start backend
cd backend
source venv/bin/activate
uvicorn api.main:app --reload

# In another terminal, test
curl http://localhost:8000/health
```

## Troubleshooting

**"SUPABASE_URL must be set"**
- Make sure `.env` is in project root
- Restart backend after changing `.env`

**"Failed to connect to Redis"**
- Install Redis: `brew install redis` (Mac) or `sudo apt install redis` (Linux)
- Start Redis: `redis-server`
- Test: `redis-cli ping` (should return `PONG`)

**Puppeteer not working?**
- It's optional! Enrichment will use SerpAPI's basic scraping
- See `PUPPETEER_SERVICE_SETUP.md` for full setup

## Next Steps

1. ✅ Set required variables
2. ✅ Run verification: `python3 scripts/verify_env_setup.py`
3. ✅ Start backend
4. ✅ Start frontend: `npm run dev`
5. ✅ Test AI filter in dashboard

For detailed guides:
- **Full setup:** See `ENV_SETUP_GUIDE.md`
- **Puppeteer:** See `PUPPETEER_SERVICE_SETUP.md`


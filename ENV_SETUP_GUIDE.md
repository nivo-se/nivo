# Environment Variables Setup Guide

This guide helps you configure all required environment variables for the Nivo platform.

## Quick Start

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Fill in your values** (see sections below)

3. **Verify your setup:**
   ```bash
   python3 scripts/verify_env_setup.py
   ```

---

## Required Variables

### ✅ **Critical (Must Have)**

These are required for the platform to function:

#### Database
- `DATABASE_SOURCE` - Set to `local` (for SQLite) or `supabase` (for PostgreSQL)
- `LOCAL_DB_PATH` - Path to your SQLite database (default: `data/nivo_optimized.db`)

#### Supabase
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (or use `SUPABASE_ANON_KEY`)

#### OpenAI
- `OPENAI_API_KEY` - Your OpenAI API key
- `OPENAI_MODEL` - Model to use (default: `gpt-4o-mini`)

#### Redis
- `REDIS_URL` - Redis connection string (default: `redis://localhost:6379/0`)

---

## Optional Variables

### 🔧 **Enrichment Services**

#### SerpAPI (Recommended)
- `SERPAPI_KEY` - For website lookup when company homepage is missing
- **Get it:** https://serpapi.com/dashboard
- **Cost:** Free tier available (100 searches/month)

#### Puppeteer Service (Optional)
- `PUPPETEER_SERVICE_URL` - URL of your Puppeteer scraping service
- `PUPPETEER_SERVICE_TOKEN` - API token (if required)

**Puppeteer Setup Options:**

1. **Browserless.io (Easiest - Recommended)**
   - Sign up: https://www.browserless.io/
   - Get your token from dashboard
   - Set:
     ```bash
     PUPPETEER_SERVICE_URL=https://chrome.browserless.io/scrape
     PUPPETEER_SERVICE_TOKEN=your-browserless-token
     ```
   - **Cost:** Free tier available (6 hours/month)

2. **Deploy Your Own (Railway)**
   - Create a simple Node.js service that uses Puppeteer
   - Deploy to Railway
   - Set:
     ```bash
     PUPPETEER_SERVICE_URL=https://your-puppeteer-worker.railway.app/scrape
     PUPPETEER_SERVICE_TOKEN=your-api-token-if-needed
     ```
   - See `PUPPETEER_SERVICE_SETUP.md` for details

3. **Local Development (Skip for now)**
   - You can skip Puppeteer setup initially
   - Enrichment will use SerpAPI's basic text extraction
   - Dynamic sites (React/SPA) may not scrape fully

### 📤 **CRM Export**
- `COPPER_API_TOKEN` - For exporting companies to Copper CRM
- **Get it:** https://app.copper.com/settings/api
- **Optional:** Only needed if you want to export companies

### 🌐 **CORS**
- `CORS_ORIGINS` - Comma-separated list of allowed frontend origins
- **Default:** `http://localhost:8080,http://localhost:5173`
- **Production:** Add your Vercel deployment URL

---

## Frontend Variables

Set these in `frontend/.env.local` or in Vercel dashboard:

```bash
# Backend API URL
VITE_API_BASE_URL=http://localhost:8000  # Local dev
# VITE_API_BASE_URL=https://your-backend.railway.app  # Production

# Supabase (for auth)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## Verification

Run the verification script to check your setup:

```bash
python3 scripts/verify_env_setup.py
```

This will:
- ✅ Check all required variables are set
- ✅ Test database connections
- ✅ Test Supabase connection
- ✅ Test Redis connection
- ✅ Test OpenAI API
- ⚠️  Warn about missing optional services

---

## Railway Deployment

When deploying to Railway, set these variables in the Railway dashboard:

**Backend Service:**
- All backend variables (DATABASE_SOURCE, SUPABASE_URL, etc.)
- `CORS_ORIGINS` should include your Vercel frontend URL

**Frontend Service (Vercel):**
- `VITE_API_BASE_URL` - Your Railway backend URL
- `VITE_SUPABASE_URL` - Your Supabase URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key

---

## Troubleshooting

### "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
- Make sure `.env` file exists in project root
- Check variable names are correct (no typos)
- Restart your backend server after changing `.env`

### "Failed to connect to Redis"
- Make sure Redis is running: `redis-cli ping`
- Check `REDIS_URL` format: `redis://localhost:6379/0`
- For Railway: Use the Redis connection string from Railway dashboard

### "OPENAI_API_KEY not set"
- Get your key from: https://platform.openai.com/api-keys
- Make sure it starts with `sk-`

### Puppeteer not working
- **Option 1:** Skip it for now - SerpAPI will handle basic scraping
- **Option 2:** Set up Browserless.io (5 minutes)
- **Option 3:** Deploy your own Puppeteer service (see guide)

---

## Next Steps

1. ✅ Set up required variables
2. ✅ Run verification script
3. ✅ Start backend: `python3 -m uvicorn backend.api.main:app --reload`
4. ✅ Start frontend: `npm run dev`
5. ✅ Test AI filter in dashboard
6. ⚠️  Set up Puppeteer (optional, for better enrichment)


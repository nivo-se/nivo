# Setup Next Steps

## ✅ What's Been Done

1. **Environment variable templates created:**
   - `.env.example` - Template with all variables documented
   - `ENV_SETUP_GUIDE.md` - Comprehensive setup guide
   - `QUICK_ENV_SETUP.md` - Quick reference
   - `PUPPETEER_SERVICE_SETUP.md` - Puppeteer setup options

2. **Verification script updated:**
   - `scripts/verify_env_setup.py` - Now checks Puppeteer configuration

## 🚀 Your Next Steps

### Step 1: Create Your `.env` File

```bash
# Copy the example
cp .env.example .env

# Edit with your actual values
nano .env  # or use your preferred editor
```

### Step 2: Fill in Required Variables

**Minimum required:**
```bash
OPENAI_API_KEY=sk-your-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_SOURCE=local
LOCAL_DB_PATH=data/nivo_optimized.db
REDIS_URL=redis://localhost:6379/0
```

### Step 3: Add Optional Services

**SerpAPI (Recommended):**
- Get key: https://serpapi.com/dashboard
- Add: `SERPAPI_KEY=your-key`

**Puppeteer (Optional - Can Skip for Now):**
- **Easiest:** Use Browserless.io (5 minutes)
  1. Sign up: https://www.browserless.io/
  2. Get token from dashboard
  3. Add to `.env`:
     ```bash
     PUPPETEER_SERVICE_URL=https://chrome.browserless.io/scrape
     PUPPETEER_SERVICE_TOKEN=your-token
     ```
- **Or skip it:** Enrichment will still work with SerpAPI's basic scraping

### Step 4: Verify Setup

```bash
python3 scripts/verify_env_setup.py
```

This will check:
- ✅ All required variables are set
- ✅ Database connection works
- ✅ Supabase connection works
- ✅ Redis connection works
- ✅ OpenAI API key is valid
- ⚠️  Optional services (SerpAPI, Puppeteer)

### Step 5: Start Services

**Terminal 1 - Redis:**
```bash
redis-server
# Or if using Docker:
# docker run -d -p 6379:6379 redis
```

**Terminal 2 - Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn api.main:app --reload
```

**Terminal 3 - Frontend:**
```bash
npm run dev
```

**Terminal 4 - Redis Worker (for enrichment jobs):**
```bash
cd backend
source venv/bin/activate
rq worker
```

### Step 6: Test

1. **Backend health:**
   ```bash
   curl http://localhost:8000/health
   ```

2. **AI Filter:**
   - Open frontend: http://localhost:8080
   - Go to Dashboard
   - Try: "Find profitable IT companies in Sweden with >100M SEK revenue"

3. **Enrichment:**
   - Select companies in Explorer
   - Click "Enrich selection"
   - Check job status in Redis worker terminal

## 📚 Documentation Reference

- **Quick setup:** `QUICK_ENV_SETUP.md`
- **Detailed guide:** `ENV_SETUP_GUIDE.md`
- **Puppeteer setup:** `PUPPETEER_SERVICE_SETUP.md`
- **Project status:** `PROJECT_STATUS.md`

## ⚠️ Common Issues

### "Redis connection failed"
- Make sure Redis is running: `redis-cli ping`
- Check `REDIS_URL` in `.env`

### "Supabase connection failed"
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Check Supabase dashboard → Settings → API

### "Puppeteer not working"
- **It's optional!** Enrichment will use SerpAPI's basic scraping
- To enable: See `PUPPETEER_SERVICE_SETUP.md`

### "OpenAI API error"
- Check your API key is valid
- Check you have credits: https://platform.openai.com/usage

## 🎯 Priority Order

1. **Required (Do First):**
   - ✅ OpenAI API key
   - ✅ Supabase credentials
   - ✅ Redis running

2. **Recommended (Do Next):**
   - ✅ SerpAPI key (for website lookup)

3. **Optional (Can Wait):**
   - ⚪ Puppeteer service (for deep scraping)
   - ⚪ Copper CRM token (for export)

## 💡 Tips

- **Start without Puppeteer:** The system works fine with just SerpAPI
- **Add Puppeteer later:** When you need better scraping of dynamic sites
- **Use Browserless.io:** Easiest Puppeteer option (free tier available)
- **Test incrementally:** Get basic flow working first, then add optional services

## ✅ Checklist

- [ ] Created `.env` file from `.env.example`
- [ ] Added OpenAI API key
- [ ] Added Supabase credentials
- [ ] Redis is running
- [ ] Ran verification script: `python3 scripts/verify_env_setup.py`
- [ ] Backend starts without errors
- [ ] Frontend connects to backend
- [ ] AI filter works in dashboard
- [ ] (Optional) SerpAPI key added
- [ ] (Optional) Puppeteer service configured

---

**Need help?** Check the detailed guides or run the verification script to see what's missing.


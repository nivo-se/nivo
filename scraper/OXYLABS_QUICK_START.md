# Oxylabs Quick Start Guide

## 3-Step Setup

### Step 1: Get Credentials

1. Go to https://dashboard.oxylabs.io/
2. Navigate to "Proxy Settings" or "API Integration"
3. Create a proxy user and note:
   - Username (e.g., `customer-USERNAME`)
   - Password

### Step 2: Configure

Edit `scraper/allabolag-scraper/.env.local`:

```env
OXYLABS_ENABLED="true"
OXYLABS_USERNAME="customer-USERNAME"
OXYLABS_PASSWORD="your-password"
OXYLABS_PROXY_TYPE="residential"
OXYLABS_COUNTRY="se"
OXYLABS_SESSION_TYPE="rotate"
```

### Step 3: Install & Run

```bash
cd scraper/allabolag-scraper
npm install
npm run dev
```

✅ **Done!** The scraper will automatically use Oxylabs proxy for all requests.

## Test It

1. Start a small scraping job (10-50 companies)
2. Check logs for: `✅ Oxylabs residential proxy initialized`
3. Verify requests succeed
4. Check statistics in logs

## For Large Scale (50-200M SEK)

Same configuration works for large-scale scraping. The proxy will:
- ✅ Rotate IPs automatically
- ✅ Handle rate limits
- ✅ Track usage and costs
- ✅ Retry on errors

## Need Help?

- **Full Setup Guide**: `scraper/OXYLABS_SETUP.md`
- **Integration Plan**: `scraper/OXYLABS_INTEGRATION_PLAN.md`
- **Oxylabs Docs**: https://developers.oxylabs.io/


# Puppeteer Service Setup Guide

The Nivo platform uses a Puppeteer service for deep scraping of dynamic websites (React, Vue, etc.). This guide shows you how to set it up.

## Option 1: Browserless.io (Recommended - 5 minutes)

**Easiest option, perfect for getting started.**

1. **Sign up:** https://www.browserless.io/
2. **Get your token:**
   - Go to Dashboard → API Tokens
   - Copy your token
3. **Add to `.env`:**
   ```bash
   PUPPETEER_SERVICE_URL=https://chrome.browserless.io/scrape
   PUPPETEER_SERVICE_TOKEN=your-token-here
   ```
4. **Done!** ✅

**Pricing:** Free tier includes 6 hours/month (enough for testing)

---

## Option 2: Deploy Your Own (Railway)

If you want full control or need more capacity, deploy your own Puppeteer service.

### Step 1: Create the Service

Create a new directory `puppeteer-service/`:

```bash
mkdir puppeteer-service
cd puppeteer-service
```

### Step 2: Create `package.json`

```json
{
  "name": "nivo-puppeteer-service",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "puppeteer": "^21.5.0",
    "cors": "^2.8.5"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Step 3: Create `server.js`

```javascript
import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

const app = express();
const PORT = process.env.PORT || 3000;
const API_TOKEN = process.env.API_TOKEN; // Optional auth

app.use(cors());
app.use(express.json());

let browser = null;

// Initialize browser on startup
async function initBrowser() {
  browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
  console.log('Browser initialized');
}

initBrowser().catch(console.error);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', browser: browser ? 'ready' : 'initializing' });
});

// Scrape endpoint
app.post('/scrape', async (req, res) => {
  // Optional: Check API token
  if (API_TOKEN && req.headers.authorization !== `Bearer ${API_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { url, selectors = ['main', 'article', 'body'], max_length = 20000 } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  if (!browser) {
    return res.status(503).json({ error: 'Browser not ready' });
  }

  let page = null;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Extract text from specified selectors
    const textParts = [];
    for (const selector of selectors) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          const text = await element.evaluate((el) => el.innerText);
          if (text) textParts.push(text);
        }
      } catch (e) {
        // Selector not found, skip
      }
    }

    const fullText = textParts.join('\n\n').trim();
    const truncated = fullText.substring(0, max_length);

    res.json({
      text: truncated,
      length: truncated.length,
      url,
    });
  } catch (error) {
    console.error('Scrape error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (page) await page.close();
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (browser) await browser.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Puppeteer service listening on port ${PORT}`);
});
```

### Step 4: Deploy to Railway

1. **Create new Railway project:**
   - Go to Railway dashboard
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your `puppeteer-service` directory

2. **Set environment variables:**
   - `API_TOKEN` (optional) - For authentication
   - Railway will auto-detect Node.js and deploy

3. **Get the service URL:**
   - Railway will provide a URL like: `https://puppeteer-service-production.up.railway.app`
   - Add `/scrape` endpoint: `https://puppeteer-service-production.up.railway.app/scrape`

4. **Add to Nivo `.env`:**
   ```bash
   PUPPETEER_SERVICE_URL=https://puppeteer-service-production.up.railway.app/scrape
   PUPPETEER_SERVICE_TOKEN=your-api-token-if-set
   ```

### Step 5: Test

```bash
curl -X POST https://your-puppeteer-service.railway.app/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{"url": "https://example.com"}'
```

---

## Option 3: Skip Puppeteer (For Now)

You can skip Puppeteer setup initially. The enrichment pipeline will:

1. ✅ Use SerpAPI for website lookup
2. ✅ Use SerpAPI's basic text extraction
3. ⚠️  May miss content on dynamic sites (React/SPA)

**To skip:**
- Don't set `PUPPETEER_SERVICE_URL`
- Enrichment will still work, just with limited scraping

---

## Testing Your Setup

Once configured, test with:

```bash
# Test Browserless.io
curl -X POST https://chrome.browserless.io/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{"url": "https://example.com"}'

# Test your own service
curl -X POST https://your-service.railway.app/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

---

## Troubleshooting

### "Browser not ready"
- Wait a few seconds after deployment
- Check Railway logs for browser initialization errors

### "Timeout"
- Some sites take longer to load
- Increase timeout in `server.js` if needed

### "Memory issues"
- Railway free tier has memory limits
- Consider using Browserless.io for production

---

## Recommendation

**For development/testing:** Use Browserless.io (free tier is enough)

**For production:** 
- Start with Browserless.io
- Deploy your own if you need more control/capacity


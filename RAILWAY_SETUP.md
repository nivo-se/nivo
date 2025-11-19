# Railway Setup for FastAPI Backend

## Quick Start

1. **Install Railway CLI:**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login:**
   ```bash
   railway login
   ```

3. **Initialize project:**
   ```bash
   railway init
   ```
   - Select "Empty Project"
   - Name it "nivo-backend" or similar

4. **Set environment variables:**
   ```bash
   railway variables set SUPABASE_URL=your_url
   railway variables set SUPABASE_SERVICE_ROLE_KEY=your_key
   railway variables set OPENAI_API_KEY=your_key
   railway variables set REDIS_URL=redis://localhost:6379  # Optional
   ```

5. **Deploy:**
   ```bash
   railway up
   ```

6. **Get your backend URL:**
   ```bash
   railway domain
   ```
   This gives you something like: `https://nivo-backend-production.up.railway.app`

7. **Set in Vercel:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add: `VITE_API_BASE_URL=https://your-railway-url.com`

8. **Redeploy frontend** - Vercel will pick up the new env var

## Why Railway?

- ✅ **No package size limits** - pandas/numpy work fine
- ✅ **Always-on** - No cold starts
- ✅ **Easy setup** - Just `railway up`
- ✅ **Free tier** - 500 hours/month free
- ✅ **Background jobs** - Can add Redis later

## Alternative: Render

If Railway doesn't work, Render is similar:
1. Go to render.com
2. Create new "Web Service"
3. Connect GitHub repo
4. Set:
   - **Build Command**: `cd backend && pip install -r requirements.txt`
   - **Start Command**: `cd backend && uvicorn api.main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables
6. Deploy

## Cost

- **Railway Free Tier**: 500 hours/month (enough for development)
- **Render Free Tier**: 750 hours/month
- Both have paid plans if you need more


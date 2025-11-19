# Deployment Status

## Current Setup

✅ **Frontend**: Deployed on Vercel  
❌ **Backend**: Needs to be deployed separately (Railway/Render)

## Why Not Vercel Serverless Functions?

1. **Package Size**: pandas (70MB) + numpy (32MB) = 102MB > Vercel's 50MB limit
2. **Runtime Error**: Vercel Python runtime configuration issues
3. **Better Solution**: FastAPI backend gives more control and flexibility

## Solution: Deploy FastAPI to Railway

### Quick Setup

1. **Install Railway CLI:**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login:**
   ```bash
   railway login
   ```

3. **Initialize:**
   ```bash
   railway init
   ```
   - Select "Empty Project"
   - Name: "nivo-backend"

4. **Set Environment Variables:**
   ```bash
   railway variables set SUPABASE_URL=your_supabase_url
   railway variables set SUPABASE_SERVICE_ROLE_KEY=your_key
   railway variables set OPENAI_API_KEY=your_key  # Optional, for AI features
   ```

5. **Deploy:**
   ```bash
   railway up
   ```

6. **Get Backend URL:**
   ```bash
   railway domain
   ```
   You'll get something like: `https://nivo-backend-production.up.railway.app`

7. **Configure Vercel:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add: `VITE_API_BASE_URL=https://your-railway-url.com`
   - Redeploy frontend

## What Changed

- ✅ Removed Python serverless functions from `vercel.json` (they were causing errors)
- ✅ Frontend now expects `VITE_API_BASE_URL` environment variable
- ✅ FastAPI backend ready to deploy (in `backend/api/`)

## API Endpoints (After Railway Deployment)

Once backend is deployed, these will work:
- `GET /api/filters/analytics` - Filter analytics
- `POST /api/filters/apply` - Apply filters and generate shortlist
- `GET /api/shortlists/stage1` - Get Stage 1 shortlists
- `GET /api/status` - API health check

## Testing Locally

Backend runs locally on `http://localhost:8000`:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn api.main:app --reload
```

Frontend will automatically use `http://localhost:8000` in development mode.


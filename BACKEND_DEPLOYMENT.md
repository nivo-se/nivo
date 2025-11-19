# Backend API Deployment Guide

## Current Issue

The Financial Filters feature requires the backend API to be running. Currently:
- ✅ **Local Development**: Backend runs on `http://localhost:8000`
- ❌ **Vercel Production**: Backend is not deployed, so Financial Filters won't work

## Solution Options

### Option 1: Deploy Backend to Railway/Render (Recommended)

1. **Railway** (easiest):
   ```bash
   # Install Railway CLI
   npm i -g @railway/cli
   
   # Login and create project
   railway login
   railway init
   
   # Deploy
   railway up
   ```

2. **Render**:
   - Create new Web Service
   - Connect GitHub repo
   - Set build command: `cd backend && pip install -r requirements.txt`
   - Set start command: `cd backend && uvicorn api.main:app --host 0.0.0.0 --port $PORT`
   - Add environment variables from `.env`

3. **After deployment**, set in Vercel:
   - Environment Variable: `VITE_API_BASE_URL=https://your-backend-url.com`

### Option 2: Use Vercel Serverless Functions

Convert the FastAPI endpoints to Vercel serverless functions (more work, but keeps everything in one place).

### Option 3: Disable Feature in Production

Hide Financial Filters in production until backend is deployed.

## Environment Variables Needed

When deploying backend, ensure these are set:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `REDIS_URL` (optional, for background jobs)

## Current CORS Configuration

The backend now allows:
- All localhost ports (for development)
- All `*.vercel.app` domains (for Vercel previews)
- Can be extended via `CORS_ORIGINS` environment variable

## Testing

After deployment:
1. Set `VITE_API_BASE_URL` in Vercel environment variables
2. Redeploy frontend
3. Test Financial Filters in Vercel preview


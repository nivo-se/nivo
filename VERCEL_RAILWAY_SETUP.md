# Vercel + Railway Setup Guide

## ✅ Railway Backend (DONE)
- **URL**: `https://vitereactshadcnts-production-fad5.up.railway.app`
- **Status**: ✅ Running (Uvicorn on port 8080)
- **Environment Variables**: ✅ Added to Railway

## 🔧 Vercel Frontend Setup

### Step 1: Add Environment Variable in Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

2. Add new variable:
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: `https://vitereactshadcnts-production-fad5.up.railway.app`
   - **Environment**: Select all (Production, Preview, Development)

3. **Save** the variable

### Step 2: Redeploy Frontend

After adding the environment variable, you need to redeploy:

1. Go to **Deployments** tab
2. Click **"..."** on the latest deployment → **Redeploy**
3. Or push a new commit to trigger a redeploy

### Step 3: Verify Connection

Once redeployed, test the connection:

1. Visit your Vercel frontend URL
2. Open browser DevTools → Console
3. Try using the **Financial Filters** feature
4. Check Network tab for API calls to Railway backend

## 🔍 Testing the Backend

Test the Railway backend directly:

```bash
# Health check
curl https://vitereactshadcnts-production-fad5.up.railway.app/health

# Should return:
# {"status":"healthy","service":"nivo-intelligence-api"}
```

## 📋 Environment Variables Checklist

### Railway (Backend) - ✅ Done
- [x] `SUPABASE_URL`
- [x] `SUPABASE_SERVICE_ROLE_KEY`
- [x] `OPENAI_API_KEY`
- [x] `REDIS_URL` (optional)
- [x] `CORS_ORIGINS` (optional - for custom domains)

### Vercel (Frontend) - ⏳ Next Step
- [ ] `VITE_API_BASE_URL` = `https://vitereactshadcnts-production-fad5.up.railway.app`
- [ ] `VITE_SUPABASE_URL` (if not already set)
- [ ] `VITE_SUPABASE_ANON_KEY` (if not already set)

## 🐛 Troubleshooting

### Frontend can't connect to backend
- Check `VITE_API_BASE_URL` is set correctly in Vercel
- Verify Railway backend is running (check Railway logs)
- Check browser console for CORS errors

### CORS errors
- Railway backend already allows `*.vercel.app` domains
- If using custom domain, add it to `CORS_ORIGINS` in Railway

### Backend not responding
- Check Railway logs for errors
- Verify environment variables are set in Railway
- Test health endpoint: `curl https://vitereactshadcnts-production-fad5.up.railway.app/health`


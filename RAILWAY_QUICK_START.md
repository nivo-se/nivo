# Railway Quick Start Guide

## Step 1: Create New Service in Railway

1. Go to https://railway.app/dashboard
2. Click **"New Project"** (or **"New"** → **"Project"**)
3. Select **"Deploy from GitHub repo"**
4. Choose your repository: `Smooother/nivo-web`
5. Railway will ask which branch - select: **`feature-two-stage-ai`**

## Step 2: Configure the Service

After Railway creates the service, you need to configure it:

1. Click on the service (it might be named after your repo)
2. Go to **Settings** tab
3. Set the following:

   **Root Directory:**
   - Set to: `backend`
   
   **Start Command:**
   - Set to: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`
   
   **Build Command:**
   - Set to: `pip install -r requirements.txt`

## Step 3: Set Environment Variables

1. In the service, go to **Variables** tab
2. Add these environment variables:

   ```
   SUPABASE_URL=your_supabase_url_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   OPENAI_API_KEY=your_openai_key_here  # Optional, for AI features
   ```

   **Where to find Supabase credentials:**
   - Go to your Supabase project dashboard
   - Settings → API
   - Copy "Project URL" → `SUPABASE_URL`
   - Copy "service_role" key → `SUPABASE_SERVICE_ROLE_KEY`

## Step 4: Deploy

1. Railway should automatically start deploying when you connect the repo
2. If not, click **"Deploy"** button
3. Watch the build logs - it should install dependencies and start the server

## Step 5: Get Your Backend URL

1. Go to **Settings** tab in your Railway service
2. Scroll down to **"Networking"** section
3. Click **"Generate Domain"** (or it might auto-generate)
4. Copy the URL (something like: `https://nivo-backend-production.up.railway.app`)

## Step 6: Configure Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add new variable:
   - **Name:** `VITE_API_BASE_URL`
   - **Value:** Your Railway URL (from Step 5)
   - **Environment:** Production, Preview, Development (check all)
3. Click **Save**
4. Go to **Deployments** tab and click **"Redeploy"** on the latest deployment

## Step 7: Test

1. Visit your Vercel deployment
2. Go to Financial Filters page
3. It should now connect to your Railway backend!

## Troubleshooting

**Build fails:**
- Check build logs in Railway
- Make sure `backend/requirements.txt` exists
- Verify Python version (Railway uses Python 3.11 by default)

**Can't find URL:**
- Go to Settings → Networking
- Click "Generate Domain" if no domain exists
- The URL appears in the Networking section

**Connection errors:**
- Verify `VITE_API_BASE_URL` is set in Vercel
- Check Railway logs to see if backend is running
- Test backend directly: `https://your-railway-url.com/health`

## What Branch?

**Deploy from:** `feature-two-stage-ai` branch

This branch has:
- ✅ FastAPI backend (`backend/api/`)
- ✅ Frontend configured to use external API
- ✅ All the Financial Filters code


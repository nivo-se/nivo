# Railway Deployment Fix

## Problem

Railway is trying to build the frontend (`npm run build`) instead of running the FastAPI backend. This happens because Railway detects both Python and Node.js in the repo.

## Solution: Configure Railway Settings

In your Railway dashboard:

1. **Go to your service** → **Settings** tab

2. **Set Root Directory:**
   - Set to: `backend`
   - This tells Railway to only look in the `backend/` folder

3. **Verify Start Command:**
   - Should be: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`
   - Railway should auto-detect this from `backend/Procfile`

4. **Remove Build Command:**
   - If there's a build command set, remove it
   - The backend doesn't need a build step, just `pip install -r requirements.txt`

5. **Redeploy:**
   - After changing settings, Railway will automatically redeploy
   - Or click "Redeploy" button

## Alternative: Use railway.json

If Railway settings don't work, we can use `railway.json` at the root, but it needs to point to the backend directory.

## What Should Happen

After fixing:
- ✅ Railway installs Python dependencies (`pip install -r requirements.txt`)
- ✅ Railway starts FastAPI (`uvicorn api.main:app`)
- ✅ No npm/node errors

## Check Logs

After redeploy, check the logs. You should see:
```
Successfully installed ... (all Python packages)
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:PORT
```

Not:
```
npm run build  ❌
```


# Railway Deployment Fix

## Problem

Railway is trying to build the frontend (`npm run build --workspace=vite_react_shadcn_ts`) instead of running the FastAPI backend. This happens because Railway detects the root `package.json` with workspaces, even when the root directory is set to `backend`.

## Solution: Configure Railway Settings

**CRITICAL:** Railway is detecting the monorepo structure. Follow these steps:

### Step 1: Railway Dashboard Settings

1. **Go to your service** → **Settings** tab

2. **Set Root Directory:**
   - Set to: `backend`
   - This tells Railway to only look in the `backend/` folder

3. **Clear/Remove Custom Build Command:**
   - **IMPORTANT:** Delete any custom build command completely
   - Leave it **empty/blank**
   - Railway will use `backend/railway.json` which has the correct build command

4. **Start Command:**
   - Should be: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`
   - Or leave blank - Railway will auto-detect from `backend/Procfile`

5. **Redeploy:**
   - After changing settings, Railway will automatically redeploy
   - Or click "Redeploy" button

### Step 2: Verify Files

✅ `backend/railway.json` exists (moved from root)  
✅ `backend/Procfile` exists  
✅ `backend/runtime.txt` exists  
✅ `.railwayignore` exists at root (excludes frontend)

### Why This Happens

The root `package.json` has `"workspaces": ["frontend"]`, which makes Railway think this is a Node.js monorepo. Even with root directory set to `backend`, Railway's auto-detection might still see the workspace config.

**Solution:** By moving `railway.json` to `backend/` and clearing any custom build commands, Railway will:
1. Only see files in `backend/` directory
2. Use `backend/railway.json` for build configuration
3. Use `backend/Procfile` for start command
4. Ignore the root `package.json` workspace config

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


# Vercel Environment Variables Check

## 🔍 Issue: Database Not Connected on Vercel

The Vercel deployment needs the Supabase environment variables to connect to the database.

## ✅ Required Environment Variables

Your frontend needs these variables (check `frontend/.env.local`):

```bash
VITE_SUPABASE_URL=https://clysgodrmowieximfaab.supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
```

## 🔧 How to Add/Check in Vercel Dashboard

### Step 1: Go to Vercel Project Settings
1. Visit: https://vercel.com/jesper-kreugers-projects
2. Find your "nivo-web" project
3. Click on the project

### Step 2: Navigate to Environment Variables
1. Click **Settings** tab (top navigation)
2. Click **Environment Variables** in the left sidebar

### Step 3: Add Required Variables

Add these environment variables for **all environments** (Production, Preview, Development):

| Variable Name | Value |
|---------------|-------|
| `VITE_SUPABASE_URL` | `https://clysgodrmowieximfaab.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `[copy from frontend/.env.local]` |

**Important:** 
- Make sure the variable names start with `VITE_` (Vite requirement)
- Select all three environments: Production, Preview, Development
- Click "Save" after adding each variable

### Step 4: Redeploy

After adding environment variables:
1. Go to **Deployments** tab
2. Find the latest deployment
3. Click the **⋯** (three dots) menu
4. Click **Redeploy**
5. Wait for deployment to complete (~2-3 minutes)

## 📋 Verification Steps

After redeployment:

1. **Visit Vercel URL**
   - https://nivo-web-git-test-ai-analysis-[your-project].vercel.app/

2. **Open Browser Console (F12)**
   - Look for: "Loaded analytics" or "Companies with financial data"
   - Should see: 8436 companies
   - Should NOT see: "Failed to load" or connection errors

3. **Check Dashboard**
   - Total companies should show ~8,400
   - Company search should return results with revenue/profit

## 🆘 If Still Not Working

### Check 1: Verify Environment Variables Are Set
In Vercel dashboard, under Settings → Environment Variables, you should see:
- ✅ VITE_SUPABASE_URL
- ✅ VITE_SUPABASE_ANON_KEY

### Check 2: Verify Deployment Used Latest Commit
In Vercel Deployments tab:
- Latest deployment should show commit: "fix(data): migrate all financial data..."
- Build should have succeeded (green checkmark)

### Check 3: Check Build Logs
In Vercel:
1. Go to the deployment
2. Click "View Build Logs"
3. Look for any errors during build

### Check 4: Verify Branch
The Vercel deployment should be tracking the `test-ai-analysis` branch.

## 🔐 Finding Your Supabase Anon Key

If you need to find the anon key again:

```bash
# From your local machine:
cat frontend/.env.local | grep VITE_SUPABASE_ANON_KEY
```

Or:
1. Go to Supabase Dashboard
2. Project Settings → API
3. Copy the "anon public" key

---

**After fixing:** The Vercel deployment should connect to Supabase and show all 8,436 companies with complete financial data!


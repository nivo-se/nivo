# Database Connection Issue - Diagnosis

## Problem
The frontend is showing placeholder/demo data instead of live data from Supabase.

## Root Cause
The application has a fallback mechanism:
- When `supabaseConfig.isConfigured` returns `false`
- It falls back to showing 12 demo companies from `sampleData.ts`
- These are the placeholder companies you're seeing (Nordic Solar Solutions AB, Scandi Robotics Systems AB, etc.)

## What's Happening

The code in `frontend/src/lib/supabaseDataService.ts` has this check:

```typescript
if (!supabaseConfig.isConfigured) {
  const filtered = filterLocalCompanies(filters)
  return { companies: filtered, total: filtered.length, error: null }
}
```

And in `frontend/src/lib/supabase.ts`, the configuration is considered valid only if:

```typescript
isConfigured:
  typeof resolvedUrl === 'string' &&
  resolvedUrl.length > 0 &&
  !resolvedUrl.includes('placeholder.supabase.co') &&
  typeof resolvedAnonKey === 'string' &&
  resolvedAnonKey.length > 0 &&
  resolvedAnonKey !== 'public-anon-key'
```

## Likely Issue

The environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are **not being picked up by Vite** at runtime.

## Quick Fix

1. **Stop the dev server** (Ctrl+C in the terminal where it's running)

2. **Verify .env.local is in the correct location:**
   ```bash
   ls -la /Users/jesper/nivo/frontend/.env.local
   ```

3. **Verify it has the correct content:**
   ```bash
   cat /Users/jesper/nivo/frontend/.env.local | grep VITE_SUPABASE
   ```
   
   Should show:
   ```
   VITE_SUPABASE_URL=https://clysgodrmowieximfaab.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...
   ```

4. **Restart the dev server:**
   ```bash
   cd /Users/jesper/nivo/frontend
   npm run dev
   ```

5. **Open browser console** (F12) and check for the warning:
   ```
   [supabase] Supabase credentials were not found. Using in-memory fallback client...
   ```
   
   - If you see this warning → env vars not loaded
   - If you don't see this warning → Supabase is configured but may have connection issues

## Alternative: Check in Browser

Open http://localhost:8080 and in the browser console, run:

```javascript
// Check if env vars are loaded
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Has anon key:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);

// Check supabase config
const checkSupabase = async () => {
  const { supabaseConfig } = await import('./src/lib/supabase.ts');
  console.log('Supabase configured:', supabaseConfig.isConfigured);
  console.log('URL:', supabaseConfig.url);
  console.log('Has key:', !!supabaseConfig.anonKey);
};
checkSupabase();
```

## Expected Behavior

**With Working Connection:**
- Dashboard shows 8,438+ companies
- Company names are real Swedish companies
- No "Nordic Solar Solutions" or "Scandi Robotics" (these are demo data)
- Analytics show real numbers

**With Fallback (Current State):**
- Shows exactly 12 companies
- All have organization numbers like "5590001111", "5590001112", etc.
- Company names are obviously fictional
- Limited filtering capabilities

## Next Steps

1. Restart the dev server (most likely fix)
2. Check browser console for Supabase warnings
3. Verify .env.local file location and content
4. Test a simple query in the browser console
5. If still not working, check Supabase project status

## Debug Command

Run this to test the connection directly:

```bash
cd /Users/jesper/nivo/frontend
node -e "
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1];
console.log('URL found:', !!url);
console.log('Key found:', !!key);
console.log('URL:', url);
"
```


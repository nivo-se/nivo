# Quick Start: Deploy Feature-Scraper to Vercel

## Prerequisites
- Vercel account (free tier works)
- GitHub repository connected to Vercel
- Environment variables ready (see below)

## Quick Steps

### 1. Configure Vercel Project
1. Go to https://vercel.com/dashboard
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure:
   - **Root Directory**: `scraper/allabolag-scraper`
   - **Framework**: Next.js
   - **Branch**: `feature-scraper`

### 2. Set Environment Variables
In Vercel Dashboard → Settings → Environment Variables:

```
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
```

### 3. Deploy
- Push to `feature-scraper` branch → Auto-deploy
- Or manually trigger from Vercel dashboard

### 4. Test
Visit your Vercel deployment URL and test:
- Homepage loads
- Can start scraping job
- Progress updates work
- Validation data displays

## ⚠️ Important: SQLite Limitation

The scraper currently uses SQLite (`better-sqlite3`) which **won't persist** on Vercel serverless functions.

**Options:**
1. **Use Supabase PostgreSQL** (recommended) - Modify `local-staging.ts` to use `DATABASE_URL`
2. **Use Vercel Postgres** - Use `@vercel/postgres` adapter
3. **Test locally first** - Verify functionality before deploying

## Next Steps
See `scraper/VERCEL_DEPLOYMENT.md` for detailed instructions.


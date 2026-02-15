# Vercel Deployment Guide for Feature-Scraper

## Overview
This guide covers deploying the `feature-scraper` branch to Vercel for testing before merging to main.

## Project Structure
- **Scraper App**: `scraper/allabolag-scraper/` (Next.js 15.5.4)
- **Database**: Uses `better-sqlite3` for local staging (SQLite files)
- **Production DB**: Supabase (PostgreSQL)

## Important Considerations

### 1. better-sqlite3 on Vercel
⚠️ **Warning**: `better-sqlite3` is a native module that requires compilation. On Vercel serverless functions:
- SQLite files are **ephemeral** (not persisted between function invocations)
- Each function invocation gets a fresh filesystem
- Database files stored in `/tmp` or project directory will be lost

**Options:**
- **Option A**: Use Vercel's file system storage (limited, not recommended for production)
- **Option B**: Use Supabase PostgreSQL for staging database (recommended)
- **Option C**: Use Vercel Postgres for staging (if available)

### 2. Environment Variables Required

Based on `env.example`:
```env
# Database (if using Supabase for staging)
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"

# Supabase (for production)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
```

### 3. Vercel Configuration

Create `scraper/allabolag-scraper/vercel.json`:
```json
{
  "buildCommand": "cd scraper/allabolag-scraper && npm run build",
  "outputDirectory": "scraper/allabolag-scraper/.next",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "scraper/allabolag-scraper/src/app/api/**/*.ts": {
      "maxDuration": 300
    }
  }
}
```

Or configure via Vercel Dashboard:
- **Root Directory**: `scraper/allabolag-scraper`
- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

## Deployment Steps

### Step 1: Prepare Branch
```bash
# Ensure you're on feature-scraper
git checkout feature-scraper
git pull origin feature-scraper

# Verify branch is up to date
git status
```

### Step 2: Configure Vercel Project

#### Option A: Via Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Import your GitHub repository
3. Select **"feature-scraper"** branch
4. Configure project settings:
   - **Root Directory**: `scraper/allabolag-scraper`
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next` (default)

#### Option B: Via Vercel CLI
```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Navigate to scraper directory
cd scraper/allabolag-scraper

# Link to existing project or create new
vercel link

# Deploy feature-scraper branch
vercel --prod
```

### Step 3: Set Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables:

**Required Variables:**
```
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
```

**For Each Environment:**
- Production
- Preview
- Development

### Step 4: Handle SQLite Database

**Recommended: Use Supabase for Staging**

Modify `local-staging.ts` to use Supabase PostgreSQL when `DATABASE_URL` is set:
```typescript
// Check if DATABASE_URL is set (Vercel/production)
if (process.env.DATABASE_URL) {
  // Use PostgreSQL via Supabase
  // Fall back to SQLite only in local development
}
```

**Alternative: Use Vercel Postgres**
- Use `@vercel/postgres` (already in dependencies)
- Configure Vercel Postgres database
- Update `local-staging.ts` to use Vercel Postgres adapter

### Step 5: Deploy

#### Via Dashboard:
1. Push to `feature-scraper` branch
2. Vercel will auto-deploy (if auto-deploy is enabled)
3. Or manually trigger deployment from dashboard

#### Via CLI:
```bash
cd scraper/allabolag-scraper
vercel --prod
```

### Step 6: Test Deployment

Test the following endpoints:
- ✅ `GET /` - Main page loads
- ✅ `GET /api/test-connection` - Database connection test
- ✅ `POST /api/segment/start` - Start segmentation job
- ✅ `GET /api/segment/status?jobId={id}` - Check job status
- ✅ `GET /api/sessions` - List sessions
- ✅ `GET /api/validation/data?jobId={id}` - Validation data

## Testing Checklist

### Basic Functionality
- [ ] Homepage loads correctly
- [ ] Session modal displays
- [ ] Can start a scraping job
- [ ] Progress updates work
- [ ] Validation data displays

### Database Operations
- [ ] Jobs are created and stored
- [ ] Company data is saved
- [ ] Financial data is stored
- [ ] Sessions are tracked

### API Endpoints
- [ ] All API routes respond correctly
- [ ] CORS headers are set properly
- [ ] Error handling works
- [ ] Rate limiting functions (if implemented)

### UI/UX
- [ ] Financial data displays correctly
- [ ] Currency formatting (kkr) works
- [ ] Dates are formatted properly
- [ ] Search parameters display correctly
- [ ] Stall detection works

## Troubleshooting

### Build Errors
- Check Node.js version (should be 20.x)
- Verify all dependencies are installed
- Check for TypeScript errors

### Runtime Errors
- Check environment variables are set
- Verify database connection
- Check function timeout limits (increase if needed)

### SQLite Errors
- Switch to Supabase PostgreSQL for staging
- Or use Vercel Postgres
- SQLite won't persist on serverless functions

## Next Steps After Testing

1. **Fix any issues** found during testing
2. **Commit fixes** to `feature-scraper` branch
3. **Re-deploy** to Vercel
4. **Re-test** until all issues resolved
5. **Merge to main** when ready

## Production Considerations

Before merging to main:
- [ ] All tests pass
- [ ] No critical errors
- [ ] Performance is acceptable
- [ ] Database operations work correctly
- [ ] Error handling is robust
- [ ] Environment variables are documented
- [ ] Monitoring is set up (if needed)


# Vercel Python Serverless Functions Setup

## Overview

We've converted the FastAPI endpoints to Vercel serverless functions. This allows the backend to run on Vercel without needing a separate deployment.

## Structure

```
api/
├── _utils.py              # Shared utilities (Supabase client, CORS)
├── filters/
│   ├── analytics.py       # GET /api/filters/analytics
│   └── apply.py           # POST /api/filters/apply
├── shortlists/
│   └── stage1.py          # GET /api/shortlists/stage1
├── status.py              # GET /api/status
└── requirements.txt       # Python dependencies
```

## Configuration

### vercel.json

The `vercel.json` file has been updated to:
1. Define Python runtime for each function
2. Route `/api/*` requests to the appropriate serverless function

### Environment Variables

Set these in Vercel dashboard:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_ANON_KEY`)
- `OPENAI_API_KEY` (if using AI features)

## Testing Locally

Vercel CLI can run these functions locally:

```bash
npm i -g vercel
vercel dev
```

## Deployment

1. Push to GitHub
2. Vercel will automatically detect the Python functions
3. Install dependencies from `api/requirements.txt`
4. Deploy

## Notes

- Python functions run in isolated serverless environments
- No Redis support (background jobs would need separate solution)
- Cold starts may add latency (first request)
- 50MB package size limit (pandas/numpy are large)

## Troubleshooting

If functions fail:
1. Check Vercel function logs
2. Verify environment variables are set
3. Check `api/requirements.txt` includes all dependencies
4. Ensure imports work (path issues)


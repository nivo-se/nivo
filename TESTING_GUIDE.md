# Testing Guide: Verify All Connections

**Backend runs on Mac Mini only (Railway removed).**

## Quick Test Script

Run the automated test script:

```bash
chmod +x scripts/test_connections.sh
./scripts/test_connections.sh
```

This will test:
- ✅ Backend (Mac Mini) health endpoint
- ✅ Backend API status
- ✅ Database config (Postgres)
- ✅ Vercel frontend accessibility
- ✅ Environment variables
- ✅ API endpoints

Set `VITE_API_BASE_URL` or `BACKEND_URL` in `.env` to your Mac Mini API URL, or the script uses `http://localhost:8000` for local testing.

## Manual Testing Steps

### 1. Test Backend Directly (Mac Mini or local)

```bash
# Replace with your Mac Mini API URL, or use localhost for local dev
BACKEND_URL="${VITE_API_BASE_URL:-http://localhost:8000}"

# Health check
curl $BACKEND_URL/health
# Should return: {"status":"healthy","service":"nivo-intelligence-api"}

# API status
curl $BACKEND_URL/api/status
```

### 2. Test from Browser Console

1. **Visit your Vercel frontend** (or localhost)
2. **Open Browser DevTools** (F12 or Cmd+Option+I) → Console
3. Run:

```javascript
// Test if API URL is configured
console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL);

// Test backend connection (use your Mac Mini URL or leave empty for local)
const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
fetch(apiUrl + '/health')
  .then(r => r.json())
  .then(data => console.log('✅ Backend:', data))
  .catch(err => console.error('❌ Backend Error:', err));
```

### 3. Test Financial Filters Feature

1. **Visit your Vercel frontend**
2. **Navigate to Financial Filters**
3. **Open DevTools → Network tab**
4. **Adjust filter weights**, then **Click "Run Stage 1"**
5. **Check Network tab**: request to your backend URL (e.g. `.../api/filters/apply`), status `200 OK`, company data in response

### 4. Check for Common Issues

#### CORS Errors
- **Fix:** On the Mac Mini backend, set `CORS_ORIGINS` or `CORS_ALLOW_VERCEL_PREVIEWS=true` so your Vercel domain is allowed.

#### 404 Errors
- **Fix:** Set `VITE_API_BASE_URL` in Vercel to your Mac Mini API URL. Redeploy after adding.

#### Connection Refused
- **Fix:** Ensure the backend is running on the Mac Mini; check process and logs.

#### 500 Internal Server Error
- **Fix:** Check backend logs on the Mac Mini; verify env vars (Postgres, Redis, OpenAI, etc.).

## Testing Checklist

- [ ] Backend health check returns 200
- [ ] Backend API status endpoint works
- [ ] Vercel frontend loads correctly
- [ ] No CORS errors in browser console
- [ ] Financial Filters page loads; sliders and "Run Stage 1" work
- [ ] Network tab shows successful API calls to backend
- [ ] Company data appears in results

## Quick Debug Commands

```bash
# Local backend
curl http://localhost:8000/health
curl http://localhost:8000/api/status

# Mac Mini (replace with your URL)
curl https://api.yourdomain.com/health
curl -v https://api.yourdomain.com/health
```

## Next Steps After Testing

1. ✅ Test all features end-to-end
2. ✅ Check backend logs on the Mac Mini for errors
3. ✅ Check Vercel analytics for frontend performance
4. ✅ Set up monitoring/alerts if needed


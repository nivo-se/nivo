# Testing Guide: Verify All Connections

## Quick Test Script

Run the automated test script:

```bash
chmod +x scripts/test_connections.sh
./scripts/test_connections.sh
```

This will test:
- ✅ Railway backend health endpoint
- ✅ Railway API status
- ✅ Supabase configuration
- ✅ Vercel frontend accessibility
- ✅ Environment variables
- ✅ API endpoints

## Manual Testing Steps

### 1. Test Railway Backend Directly

```bash
# Health check
curl https://vitereactshadcnts-production-fad5.up.railway.app/health

# Should return:
# {"status":"healthy","service":"nivo-intelligence-api"}
```

```bash
# API status
curl https://vitereactshadcnts-production-fad5.up.railway.app/api/status

# Should return status of Supabase and Redis connections
```

### 2. Test from Browser Console

1. **Visit your Vercel frontend**: `https://nivo-web.vercel.app` (or your custom domain)

2. **Open Browser DevTools** (F12 or Cmd+Option+I)

3. **Go to Console tab** and run:

```javascript
// Test if API URL is configured
console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL);

// Test Railway backend connection
fetch('https://vitereactshadcnts-production-fad5.up.railway.app/health')
  .then(r => r.json())
  .then(data => console.log('✅ Railway Backend:', data))
  .catch(err => console.error('❌ Railway Backend Error:', err));
```

### 3. Test Financial Filters Feature

1. **Visit your Vercel frontend**
2. **Navigate to Financial Filters** (from the menu)
3. **Open DevTools → Network tab**
4. **Adjust filter weights** (move sliders)
5. **Click "Run Stage 1"**
6. **Check Network tab** for:
   - Request to Railway: `https://vitereactshadcnts-production-fad5.up.railway.app/api/filters/apply`
   - Status should be `200 OK`
   - Response should contain company data

### 4. Check for Common Issues

#### CORS Errors
**Symptom**: Browser console shows:
```
Access to fetch at 'https://...' from origin 'https://...' has been blocked by CORS policy
```

**Fix**: 
- Railway backend already allows `*.vercel.app` domains
- If using custom domain, add it to `CORS_ORIGINS` in Railway environment variables

#### 404 Errors
**Symptom**: Network tab shows `404 Not Found` for API calls

**Fix**:
- Verify `VITE_API_BASE_URL` is set in Vercel environment variables
- Should be: `https://vitereactshadcnts-production-fad5.up.railway.app`
- Redeploy Vercel after adding the variable

#### Connection Refused
**Symptom**: Network tab shows `Failed to fetch` or `Connection refused`

**Fix**:
- Check Railway logs to ensure backend is running
- Verify Railway URL is correct
- Check Railway service is not paused

#### 500 Internal Server Error
**Symptom**: API returns `500` status

**Fix**:
- Check Railway logs for errors
- Verify environment variables are set in Railway:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`

## Expected Behavior

### ✅ Working Correctly

1. **Health Check**: Returns `{"status":"healthy","service":"nivo-intelligence-api"}`
2. **Financial Filters**: 
   - Sliders work
   - Analytics show scatter plot
   - "Run Stage 1" button generates shortlist
   - Companies appear in results
3. **Network Tab**: 
   - API calls go to Railway URL
   - Status codes are `200 OK`
   - Response times are reasonable (< 2 seconds)

### ❌ Common Problems

1. **CORS Error**: Frontend can't call backend
   - Solution: Check Railway CORS settings

2. **404 Error**: API endpoint not found
   - Solution: Verify `VITE_API_BASE_URL` in Vercel

3. **500 Error**: Backend error
   - Solution: Check Railway logs, verify env vars

4. **Timeout**: Request takes too long
   - Solution: Check Railway service is running, not paused

## Testing Checklist

- [ ] Railway backend health check returns 200
- [ ] Railway API status endpoint works
- [ ] Vercel frontend loads correctly
- [ ] Browser console shows no CORS errors
- [ ] Financial Filters page loads
- [ ] Sliders adjust analytics in real-time
- [ ] "Run Stage 1" button works
- [ ] Network tab shows successful API calls to Railway
- [ ] Company data appears in results
- [ ] No errors in Railway logs
- [ ] No errors in browser console

## Quick Debug Commands

```bash
# Test Railway health
curl https://vitereactshadcnts-production-fad5.up.railway.app/health

# Test Railway API status
curl https://vitereactshadcnts-production-fad5.up.railway.app/api/status

# Test with verbose output
curl -v https://vitereactshadcnts-production-fad5.up.railway.app/health

# Test from local machine (if Railway allows)
curl -H "Origin: https://nivo-web.vercel.app" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     https://vitereactshadcnts-production-fad5.up.railway.app/health
```

## Next Steps After Testing

Once everything is working:

1. ✅ Test all features end-to-end
2. ✅ Monitor Railway logs for any errors
3. ✅ Check Vercel analytics for frontend performance
4. ✅ Set up monitoring/alerts if needed
5. ✅ Document any issues found


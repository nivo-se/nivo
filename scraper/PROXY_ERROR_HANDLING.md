# Proxy Error Handling & Job Resume Guide

## Overview

When Oxylabs proxy fails, the scraper **stops the job immediately** (no fallback to regular fetch). The job can be **resumed** once the proxy is working again.

## Error Handling

### Proxy Errors Stop Jobs

When proxy fails:
1. ✅ Job status set to `error`
2. ✅ Error message saved with details
3. ✅ Progress saved (page number, companies processed)
4. ✅ Job stops immediately
5. ✅ No data loss - all progress is saved

### Error Types

#### 1. Authentication Error (407)
**Cause**: Wrong username/password
**Action**: Fix credentials, resume job

#### 2. Bad Gateway (502)
**Cause**: Proxy temporarily unavailable
**Action**: Wait and resume job once proxy is back

#### 3. No Exit Found (525)
**Cause**: No proxy exit node available
**Action**: Check country settings, resume job

#### 4. Connection Errors
**Cause**: Network or proxy issues
**Action**: Check proxy status, resume job

## Resuming Jobs

### Method 1: Via API (Recommended)

Use the monitoring control endpoint:

```bash
POST /api/monitoring/control
{
  "jobId": "your-job-id",
  "action": "resume"
}
```

### Method 2: Via UI

1. Go to the sessions page
2. Find the stopped job (status: `error`)
3. Click "Resume" button
4. Job will continue from last saved page

### How Resume Works

1. **Loads saved progress**:
   - Last page number
   - Companies already processed
   - Company IDs already resolved
   - Financial data already fetched

2. **Skips completed work**:
   - Won't re-process companies already done
   - Continues from where it stopped

3. **Uses current proxy**:
   - Checks proxy is working before resuming
   - Fails immediately if proxy still down

## Example Workflow

### Scenario: Proxy Goes Down During Scraping

1. **Job Running**: Scraping page 150 of 1000
2. **Proxy Fails**: Network error at page 150
3. **Job Stops**: Status → `error`, saved at page 150
4. **Fix Proxy**: Check Oxylabs status, fix credentials
5. **Resume Job**: Click "Resume" or call API
6. **Job Continues**: Starts from page 150, skips 0-149

### Scenario: Wrong Credentials

1. **Job Starts**: Begins scraping
2. **Auth Fails**: 407 error immediately
3. **Job Stops**: Status → `error`, saved at page 1
4. **Fix Credentials**: Update `.env.local` with correct username/password
5. **Restart Job**: Click "Resume" or call API
6. **Job Continues**: Starts from beginning (page 1)

## Job Status Values

- `running` - Job is active
- `error` - Job stopped due to error (can resume)
- `stopped` - Job manually stopped (can resume)
- `paused` - Job manually paused (can resume)
- `done` - Job completed successfully

## Error Messages

When proxy fails, error messages include:
- What went wrong
- Which page/company failed
- How to fix it
- How to resume

Example:
```
Proxy error: Oxylabs proxy authentication failed (407). 
Please check your OXYLABS_USERNAME and OXYLABS_PASSWORD. 
Scraping stopped. Fix credentials and resume job.
```

## Best Practices

1. **Monitor Jobs**: Check status regularly
2. **Save Progress**: Jobs auto-save progress
3. **Fix Quickly**: Resolve proxy issues ASAP
4. **Resume Immediately**: Jobs resume from exact stopping point
5. **No Data Loss**: All progress is saved in database

## Troubleshooting

### Job Won't Resume

**Check:**
- Proxy is working (test manually)
- Credentials are correct
- Job status is `error`, `stopped`, or `paused`
- Database is accessible

### Resume Starts from Beginning

**Cause**: Job was restarted, not resumed
**Fix**: Use `resume` action, not `restart`

### Proxy Still Failing After Resume

**Check:**
- Oxylabs dashboard status
- Network connectivity
- Credentials are correct
- Proxy type is correct (residential/ISP)

## API Endpoints

### Resume Job
```bash
POST /api/monitoring/control
Content-Type: application/json

{
  "jobId": "your-job-id",
  "action": "resume"
}
```

### Check Job Status
```bash
GET /api/segment/status?jobId=your-job-id
```

### Stop Job
```bash
POST /api/monitoring/control
{
  "jobId": "your-job-id",
  "action": "stop"
}
```

## Summary

- ✅ **No fallback** - Proxy is required
- ✅ **Jobs stop** on proxy errors
- ✅ **Progress saved** - No data loss
- ✅ **Easy resume** - Continue from stopping point
- ✅ **Clear errors** - Know what went wrong


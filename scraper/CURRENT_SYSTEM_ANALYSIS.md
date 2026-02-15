# Current System Analysis: Allabolag Scraper

## Document Purpose

This document provides a detailed analysis of the current system state, including actual code implementations, observed behaviors, and identified issues. This serves as supplementary context for the Codex analysis request.

---

## System Performance Metrics

### Actual Test Results (14 Companies)

**Test Configuration:**
- Revenue filter: 100-101M SEK
- EBIT filter: 3-5M SEK
- Companies found: 14
- Test date: October 2024

**Measured Performance:**
```
Stage 1 (Segmentation):
- Duration: ~30 seconds
- Companies found: 14
- Success rate: 100%
- API calls: ~3-4 (pagination)

Stage 2 (Company ID Resolution):
- Duration: ~2 minutes
- Companies processed: 14
- IDs resolved: 14
- Success rate: 100%
- Rate: ~7 companies/minute
- Delay: 500ms between requests

Stage 3 (Financial Data Fetching):
- Duration: ~5 minutes
- Financial records fetched: 70 (5 years × 14 companies)
- Success rate: 100%
- Rate: ~14 records/minute
- Concurrency: 3 simultaneous requests
- Delay: 200ms between batches

Total Duration: ~7-8 minutes
Total Success Rate: 100%
```

### Observed Bottlenecks

1. **Stage 2 is the slowest per-company:**
   - 500ms delay between each company
   - Sequential processing (no parallelization)
   - Search API sometimes returns no results (name matching issues)

2. **Stage 3 has highest volume:**
   - 5 financial records per company
   - 50+ metrics per record
   - Parsing complexity
   - API response time varies (200-500ms per request)

3. **Session management:**
   - Build ID must be fetched before each session
   - Cookies must be maintained throughout
   - No automatic session refresh

---

## Code Implementation Details

### API Endpoint Structure

**Stage 1: `/api/segment/start`**
```typescript
// Current implementation creates a job and starts segmentation
POST /api/segment/start
Body: {
  revenueMin: number,
  revenueMax: number,
  ebitMin: number,
  ebitMax: number,
  industry?: string
}

Response: {
  jobId: string,
  status: "running",
  stage: "stage1_segmentation"
}

// Process:
1. Create job in database
2. Fetch build ID from Allabolag.se
3. Paginate through search results
4. Insert companies into staging_companies table
5. Update job status to "done"
```

**Stage 2: `/api/enrich/company-ids`**
```typescript
// Current implementation resolves company IDs
POST /api/enrich/company-ids?jobId={jobId}

Response: {
  jobId: string
}

// Process:
1. Get all companies from staging_companies
2. For each company:
   a. Search Allabolag.se for company name
   b. Match by organization number
   c. Extract company ID
   d. Insert into staging_company_ids
   e. Wait 500ms (rate limiting)
3. Update job status to "done"

// Issues:
- Sequential processing (slow)
- No retry on failure
- Search may not find company (name variations)
- No progress tracking during execution
```

**Stage 3: `/api/financial/fetch`**
```typescript
// Current implementation fetches financial data
POST /api/financial/fetch?jobId={jobId}

Response: {
  jobId: string
}

// Process:
1. Get all company IDs from staging_company_ids
2. Process in batches of 50:
   a. Take 3 companies at a time (concurrency)
   b. Fetch financial data for each
   c. Extract 50+ metrics
   d. Insert into staging_financials
   e. Wait 200ms between batches
3. Update job status to "done"

// Issues:
- Fixed concurrency (not adaptive)
- No retry on failure
- Complex data extraction
- No progress tracking during execution
```

### Database Schema Issues

**Current Schema (SQLite):**

```sql
-- staging_jobs table
CREATE TABLE staging_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'pending', 'running', 'done', 'error'
  stage TEXT NOT NULL,   -- 'stage1_segmentation', 'stage2_enrichment', 'stage3_financials'
  last_page INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  total_companies INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  rate_limit_stats TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Issues:
-- 1. No checkpoint data (can't resume)
-- 2. No stage-specific progress tracking
-- 3. No error categorization
-- 4. No session state storage
```

**Missing Indexes:**
```sql
-- Current: Only primary keys are indexed
-- Needed:
CREATE INDEX idx_companies_status ON staging_companies(status);
CREATE INDEX idx_companies_job_id ON staging_companies(job_id);
CREATE INDEX idx_company_ids_status ON staging_company_ids(status);
CREATE INDEX idx_financials_company_id ON staging_financials(company_id);
```

**File Size Observations:**
- 14 companies: ~2MB database file
- Projected 10,000 companies: ~1.4GB database file
- Projected 50,000 companies: ~7GB database file

---

## Session Management Details

### Current Implementation

**Session Creation:**
```typescript
// lib/allabolag.ts
export async function createSession(): Promise<AllabolagSession> {
  const response = await fetch('https://www.allabolag.se/');
  const cookies = response.headers.get('set-cookie');
  const html = await response.text();
  
  // Extract CSRF token from HTML
  const tokenMatch = html.match(/__RequestVerificationToken.*?value="([^"]+)"/);
  const token = tokenMatch?.[1];
  
  return { cookies, token };
}
```

**Build ID Fetching:**
```typescript
export async function getBuildId(session: AllabolagSession): Promise<string> {
  const response = await fetch('https://www.allabolag.se/', {
    headers: {
      'Cookie': session.cookies,
      'X-Request-Verification-Token': session.token
    }
  });
  
  const html = await response.text();
  const buildIdMatch = html.match(/"buildId":"([^"]+)"/);
  return buildIdMatch?.[1] || '';
}
```

**Issues:**
1. Session created once at start, never refreshed
2. Build ID fetched once, may become stale
3. No session expiry detection
4. No session pooling for concurrent requests
5. Cookies may expire during long runs (10 hours)

---

## Error Handling Analysis

### Current Error Handling

**Stage 2 Example:**
```typescript
try {
  const searchResults = await fetchSearchPage(buildId, company.companyName, session);
  const matchingCompany = searchResults.companies.find(c => c.orgnr === company.orgnr);
  
  if (matchingCompany) {
    localDb.insertCompanyIds([{
      orgnr: company.orgnr,
      companyId: matchingCompany.companyId,
      status: 'resolved'
    }]);
  } else {
    localDb.updateCompanyStatus(jobId, company.orgnr, 'id_not_found');
  }
} catch (error) {
  localDb.updateCompanyStatus(jobId, company.orgnr, 'error', error.message);
}
```

**Issues:**
1. No retry mechanism
2. No error categorization (network vs. data quality)
3. No exponential backoff
4. Errors logged but not acted upon
5. No dead letter queue for failed items

### Error Categories Observed

**Network Errors (Retryable):**
- `ECONNRESET` - Connection reset
- `ETIMEDOUT` - Request timeout
- `ENOTFOUND` - DNS lookup failed

**Rate Limit Errors (Wait and Retry):**
- `429 Too Many Requests`
- No current detection or handling

**Data Quality Errors (Manual Review):**
- Company not found in search
- Organization number mismatch
- Missing financial data
- Invalid data format

**Critical Errors (Stop Process):**
- Session expired
- Build ID invalid
- Database locked
- Out of memory

---

## UI/UX Current State

### Main Interface (`page.tsx`)

**Current Layout:**
```
┌─────────────────────────────────────────────────┐
│ Allabolag Scraper                               │
│ Company data extraction and analysis            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Session: abc123...  ● running                   │
│ [Select Session] [Test Workflow] [Dashboard]   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Tabs: [Scraper] [Validation]                    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Session Status                                   │
│                                                  │
│ Companies: 14                                    │
│ Company IDs: 14                                  │
│ Financial Records: 70                            │
│                                                  │
│ Overall Progress: 100%                           │
│ ████████████████████████████████████████        │
│                                                  │
│ [Stop] [Resume]                                  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ [Start Stage 2: Company ID Resolution]          │
│ [Start Stage 3: Financial Data Fetch]           │
└─────────────────────────────────────────────────┘
```

**Current Issues:**
1. No real-time progress during stage execution
2. No indication of which stage is running
3. No processing rate metrics
4. No time estimates
5. No error visualization
6. No bottleneck identification
7. Polling every 3 seconds (may be too frequent for 10-hour runs)

### Session Modal

**Current Features:**
- Lists all available sessions
- Shows basic metadata (created date, company count)
- Shows stage status (pending/running/completed)
- Manual refresh button

**Missing Features:**
- No filtering or search
- No sorting options
- No session comparison
- No data quality indicators
- No error summary per session

---

## Performance Bottleneck Analysis

### Stage 1: Segmentation

**Current Performance:**
- 14 companies in ~30 seconds
- ~2 seconds per company

**Bottleneck:**
- Sequential page fetching
- API response time (200-500ms per page)

**Optimization Opportunities:**
1. Parallel page fetching (if API allows)
2. Caching of search results
3. Smarter pagination (detect last page early)

**Projected Performance (10,000 companies):**
- Assuming 50 companies per page: 200 pages
- Sequential: 200 pages × 0.5s = 100 seconds = ~2 minutes
- Parallel (5 concurrent): 200 pages ÷ 5 × 0.5s = 20 seconds

### Stage 2: Company ID Resolution

**Current Performance:**
- 14 companies in ~2 minutes
- ~8.5 seconds per company (including 500ms delay)

**Bottleneck:**
- 500ms delay between requests (rate limiting)
- Sequential processing
- Search API response time

**Optimization Opportunities:**
1. Batch search requests (if API supports)
2. Reduce delay if API allows
3. Parallel processing with rate limiting
4. Cache search results

**Projected Performance (10,000 companies):**
- Current: 10,000 × 8.5s = 85,000s = ~24 hours (unacceptable)
- With 500ms delay only: 10,000 × 0.5s = 5,000s = ~83 minutes
- With 3 concurrent + 500ms delay: 10,000 ÷ 3 × 0.5s = ~28 minutes

**This is the primary bottleneck for scale.**

### Stage 3: Financial Data Fetching

**Current Performance:**
- 70 records in ~5 minutes
- ~4.3 seconds per record

**Bottleneck:**
- API response time (200-500ms per request)
- Data extraction complexity (50+ metrics)
- 3 concurrent requests (could be higher?)

**Optimization Opportunities:**
1. Increase concurrency (test API limits)
2. Optimize data extraction (parsing)
3. Batch processing
4. Streaming data to database

**Projected Performance (50,000 records for 10,000 companies):**
- Current: 50,000 × 4.3s = 215,000s = ~60 hours (unacceptable)
- With 10 concurrent: 50,000 ÷ 10 × 0.5s = 2,500s = ~42 minutes
- With 20 concurrent: 50,000 ÷ 20 × 0.5s = 1,250s = ~21 minutes

---

## Memory Usage Analysis

### Current Memory Profile (14 Companies)

**Measured:**
- Initial: ~30MB
- After Stage 1: ~35MB
- After Stage 2: ~40MB
- After Stage 3: ~50MB
- Peak: ~55MB

**Memory per Company:**
- ~3.5MB per company (includes all stages)

**Projected (10,000 Companies):**
- 10,000 × 3.5MB = 35GB (unacceptable)

**Issue:**
- Likely loading all data into memory
- No streaming or chunking
- Database results not paginated

**Optimization Needed:**
1. Stream data instead of loading all
2. Process in smaller batches
3. Clear memory between batches
4. Use database cursors for large result sets

---

## Database Performance Analysis

### Query Performance (14 Companies)

**Measured Query Times:**
```
INSERT company: ~1-2ms
SELECT companies: ~5ms (14 rows)
INSERT company_id: ~1-2ms
SELECT company_ids: ~5ms (14 rows)
INSERT financial: ~1-2ms
SELECT financials: ~10ms (70 rows)
```

**Projected (10,000 Companies):**
```
SELECT companies: ~500ms (10,000 rows, no index)
SELECT company_ids: ~500ms (10,000 rows, no index)
SELECT financials: ~2,500ms (50,000 rows, no index)
```

**Issues:**
1. No indexes on foreign keys
2. No indexes on status columns
3. Full table scans for status queries
4. No query optimization

### Database Locking Issues

**Observed:**
- Occasional "database is locked" errors
- Occurs during concurrent writes
- SQLite limitation: single writer at a time

**Impact:**
- Cannot have multiple workers writing simultaneously
- Limits parallelization opportunities
- May cause data loss if not handled

---

## Rate Limiting Strategy

### Current Strategy

**Stage 1:**
- No explicit rate limiting
- Natural throttling from sequential processing

**Stage 2:**
- Fixed 500ms delay between requests
- No adaptive rate limiting
- No detection of 429 responses

**Stage 3:**
- 3 concurrent requests
- 200ms delay between batches
- No adaptive rate limiting

### Issues

1. **No 429 Detection:**
   - Don't detect when we're rate limited
   - Don't back off when rate limited
   - Don't track rate limit headers

2. **Fixed Delays:**
   - May be too conservative (wasting time)
   - May be too aggressive (getting rate limited)
   - No adjustment based on API response

3. **No Token Bucket:**
   - Could implement token bucket algorithm
   - Would allow bursts while respecting limits
   - More efficient than fixed delays

---

## Checkpoint/Resume Analysis

### Current State

**No checkpoint system exists.**

**What happens on failure:**
1. Process stops
2. Data is saved up to last successful company
3. Cannot resume from exact point
4. Must restart entire stage
5. May re-process companies (wasted time)

**What's needed:**
1. Save progress after each batch
2. Mark companies as "processing" vs "completed"
3. Resume from last incomplete company
4. Skip already-completed companies
5. Handle in-flight requests on crash

### Proposed Checkpoint Data

```typescript
interface Checkpoint {
  jobId: string;
  stage: 'stage1' | 'stage2' | 'stage3';
  lastProcessedIndex: number;
  lastProcessedCompany: string; // orgnr
  inFlightCompanies: string[]; // companies being processed when stopped
  timestamp: string;
  sessionState: {
    cookies: string;
    token: string;
    buildId: string;
  };
}
```

---

## Monitoring and Observability Gaps

### Current Monitoring

**What we have:**
- Console.log statements
- Basic error logging
- 3-second status polling

**What we don't have:**
1. Structured logging
2. Log levels (debug, info, warn, error)
3. Request/response logging
4. Performance metrics
5. Error rate tracking
6. Memory usage tracking
7. Database query performance
8. API response time tracking
9. Alerting system
10. Real-time dashboards

### Production Requirements

**Logging:**
- Structured JSON logs
- Log aggregation (e.g., ELK stack)
- Log retention policy
- Search and filter capabilities

**Metrics:**
- Processing rates (companies/min, IDs/min, financials/min)
- Error rates by category
- API response times (p50, p95, p99)
- Database query times
- Memory usage over time
- Success rates per stage

**Alerting:**
- Process stuck (no progress for 5 minutes)
- High error rate (>10% failures)
- Memory threshold exceeded
- Database issues
- Session expiry

---

## Scalability Limits

### Current System Limits

**Hard Limits:**
1. **Serverless Timeout:** 10 minutes (Vercel)
   - Blocks long-running processes
   - Forces workarounds (background jobs)

2. **SQLite Write Concurrency:** 1 writer
   - Blocks parallel processing
   - Limits throughput

3. **Memory:** 1GB (Vercel serverless)
   - May run out with large datasets
   - Forces streaming/chunking

4. **Session Expiry:** Unknown (likely 1-2 hours)
   - Will fail on long runs
   - No refresh mechanism

**Soft Limits:**
1. **Rate Limiting:** Unknown exact limits
   - Conservative delays may be too slow
   - Aggressive delays may get blocked

2. **Database Size:** No hard limit
   - 7GB for 50k companies (large but manageable)
   - Query performance degrades with size

3. **UI Polling:** 3-second intervals
   - May be too frequent for 10-hour runs
   - Increases server load

### Breaking Points

**10,000 Companies:**
- Estimated time: 5-10 hours
- Will hit session expiry
- Will hit serverless timeout (if using Vercel)
- Database size: ~1.4GB (manageable)
- Memory: May exceed limits without streaming

**50,000 Companies:**
- Estimated time: 25-50 hours
- Definitely hits session expiry
- Definitely hits serverless timeout
- Database size: ~7GB (large but manageable)
- Memory: Will exceed limits without optimization

**100,000 Companies:**
- Estimated time: 50-100 hours
- Not feasible with current architecture
- Requires distributed processing
- Database size: ~14GB
- Memory: Requires significant optimization

---

## Recommendations Summary

### Critical Issues to Address

1. **Architecture:** Move away from serverless for long-running processes
2. **Database:** Migrate to PostgreSQL for production
3. **Checkpoint:** Implement checkpoint/resume system
4. **Rate Limiting:** Implement adaptive rate limiting
5. **Session Management:** Implement session refresh mechanism
6. **Error Recovery:** Implement retry with exponential backoff
7. **Monitoring:** Implement structured logging and metrics
8. **UI:** Redesign for long-running process monitoring

### Quick Wins

1. Add indexes to database (immediate performance boost)
2. Increase Stage 3 concurrency (test API limits)
3. Implement batch processing for memory efficiency
4. Add progress tracking during stage execution
5. Implement basic retry for network errors

---

## Appendix: Test Data

### Sample Session Data

```json
{
  "sessionId": "354dd590-fe70-4d22-90ec-f8731b9d553e",
  "status": "completed",
  "totalCompanies": 14,
  "totalCompanyIds": 14,
  "totalFinancials": 70,
  "createdAt": "2024-10-24T10:30:00Z",
  "updatedAt": "2024-10-24T10:38:00Z",
  "stages": {
    "stage1": {
      "status": "completed",
      "completedAt": "2024-10-24T10:30:30Z",
      "companies": 14
    },
    "stage2": {
      "status": "completed",
      "completedAt": "2024-10-24T10:32:30Z",
      "companyIds": 14
    },
    "stage3": {
      "status": "completed",
      "completedAt": "2024-10-24T10:38:00Z",
      "financials": 70
    }
  }
}
```

### Sample Error Data

```json
{
  "orgnr": "556789-0123",
  "companyName": "Test Company AB",
  "stage": "stage2",
  "error": "Company not found in search results",
  "errorType": "data_quality",
  "timestamp": "2024-10-24T10:32:15Z",
  "retryable": false
}
```

---

**Document Version:** 1.0  
**Last Updated:** January 2024  
**Purpose:** Supplementary context for Codex analysis

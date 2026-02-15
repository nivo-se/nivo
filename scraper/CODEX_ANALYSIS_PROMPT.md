# Codex Analysis Request: Allabolag Scraper System

## Executive Summary

We have built a 3-stage web scraping system for extracting company data from Allabolag.se (Swedish company registry). The system currently works well for small-scale operations (14 companies) but needs to scale to **10,000-50,000 companies** with **2-10 hour runtimes**. We need your expertise to analyze our workflow, identify bottlenecks, and propose a production-ready architecture with a UI designed for monitoring long-running processes.

**Key Focus Areas:**
1. UI/UX for real-time monitoring of long-running processes
2. Complete architectural redesign if needed for production scale
3. Error recovery and process control mechanisms
4. Performance optimization for 10k-50k company operations

---

## Section A: Current System Context

### Architecture Overview

**3-Stage Pipeline:**
1. **Stage 1: Segmentation** - Search and filter companies based on criteria (revenue, EBIT, industry)
2. **Stage 2: Company ID Resolution** - Resolve actual company IDs from search results
3. **Stage 3: Financial Data Fetching** - Extract 50+ financial metrics per company per year

**Technology Stack:**
- Frontend: Next.js 14, React, TypeScript, Tailwind CSS
- Backend: Next.js API Routes
- Database: SQLite (local staging), PostgreSQL (planned for production)
- Data Source: Allabolag.se API (requires VPN, Swedish IP)
- Session Management: Cookie-based with CSRF tokens

**Current Performance (14 companies):**
- Stage 1: ~30 seconds
- Stage 2: ~2 minutes (10 companies/batch, 500ms delay)
- Stage 3: ~5 minutes (3 concurrent requests, 200ms delay)
- Total: ~7-8 minutes for 14 companies

**Projected Performance (10,000 companies):**
- Stage 1: ~5-10 minutes
- Stage 2: ~80-160 minutes (with current rate limiting)
- Stage 3: ~200-400 minutes (with current concurrency)
- **Total: 5-10 hours**

### Current Limitations

1. **Rate Limiting Constraints:**
   - Stage 2: 500ms delay between requests = 120 companies/minute max
   - Stage 3: 3 concurrent requests with 200ms delay = ~900 requests/minute max
   - No adaptive rate limiting based on API responses

2. **Error Recovery:**
   - No checkpoint/resume functionality
   - Failed companies are marked but not automatically retried
   - Session expiry during long runs causes complete failure
   - No partial completion support

3. **Database:**
   - SQLite file locking issues with concurrent access
   - No connection pooling
   - Single-file database per session (could grow to 500MB+ for 50k companies)
   - No data partitioning strategy

4. **Session Management:**
   - Cookie-based sessions may expire during 10-hour runs
   - No session refresh mechanism
   - Build ID (required for API calls) may change during long runs

5. **Monitoring:**
   - Basic polling every 3 seconds
   - No real-time progress tracking
   - No bottleneck identification
   - No predictive analytics for completion time

6. **UI Limitations:**
   - Not designed for long-running processes
   - No visual indication of which stage is the bottleneck
   - Limited error visualization
   - No process control (pause/resume)

---

## Section B: Analysis Requirements

### 1. Workflow Efficiency Analysis

**Please analyze:**

**Stage 1 (Segmentation):**
- Current approach: Paginated API calls to search endpoint
- Bottleneck: Sequential page fetching
- Question: Can we parallelize page fetching? What's the optimal concurrency?

**Stage 2 (Company ID Resolution):**
- Current approach: Sequential search for each company name
- Bottleneck: 500ms delay between requests = 120 companies/minute
- Question: Can we batch search requests? What's the optimal batch size?
- Current issue: Some companies not found due to name variations

**Stage 3 (Financial Data Fetching):**
- Current approach: 3 concurrent requests, 200ms delay between batches
- Bottleneck: Rate limiting and API response time
- Question: What's the optimal concurrency level? Should we implement adaptive rate limiting?
- Current issue: Financial data extraction returns 50+ metrics but parsing is complex

**Cross-Stage Concerns:**
- Should stages run sequentially or can Stage 3 start as soon as Stage 2 completes for a batch?
- How do we handle dependencies between stages?
- Should we implement a pipeline pattern where data flows continuously?

### 2. Error Handling & Recovery

**Current State:**
- Errors are logged to database with status flags
- No automatic retry mechanism
- No checkpoint system
- Session expiry causes complete failure

**Please propose:**
1. Checkpoint system design for resume capability
2. Automatic retry strategy with exponential backoff
3. Partial completion handling (e.g., 8,000 of 10,000 companies completed)
4. Session refresh mechanism for long runs
5. Error categorization and prioritization (which errors should stop the process vs. continue?)
6. Data consistency guarantees during failures

### 3. Scalability Analysis

**Memory Usage:**
- Current: ~50MB for 14 companies
- Projected: ~350MB-700MB for 10,000 companies
- Question: Is this acceptable? Should we implement streaming/chunking?

**Database Performance:**
- SQLite limitations: File locking, no connection pooling, single-threaded writes
- Question: At what scale should we migrate to PostgreSQL?
- Question: Should we use PostgreSQL from the start for production?

**API Rate Limiting:**
- Current: Fixed delays (500ms, 200ms)
- Question: Should we implement adaptive rate limiting based on 429 responses?
- Question: Should we implement a token bucket algorithm?

**Session Management:**
- Current: Single session for entire run
- Question: Should we implement session pooling or rotation?
- Question: How do we handle session expiry mid-run?

---

## Section C: UI/UX Design Requirements

### Context
Users need to monitor 10,000-50,000 company scraping operations that run for 2-10 hours. They need to:
- See real-time progress without overwhelming detail
- Identify bottlenecks quickly
- Intervene when processes get stuck
- Resume after interruptions
- Understand data quality in real-time

### Required UI Components

#### 1. Real-Time Monitoring Dashboard

**Must Show:**
- Overall progress: X of Y companies completed (across all stages)
- Per-stage progress: Stage 1 (100%), Stage 2 (75%), Stage 3 (45%)
- Processing rates: 
  - Companies/minute for Stage 1
  - IDs resolved/minute for Stage 2
  - Financial records/minute for Stage 3
- Time estimates:
  - Elapsed time
  - Estimated time remaining (based on current rate)
  - Estimated completion time
- Current bottleneck identification: "Stage 2 is the current bottleneck (slowest)"

**Visual Design Considerations:**
- Clean, minimal interface (OpenAI-style)
- Progress bars for each stage
- Real-time updating numbers (not overwhelming)
- Color coding: gray/black for normal, red for errors, no bright colors
- Large, readable metrics for glanceability

**Questions for Codex:**
1. How should we visualize 3 stages running in parallel/sequence?
2. What's the best way to show "Stage 2 is 75% done but Stage 3 has already started on completed IDs"?
3. Should we use a pipeline visualization or separate progress bars?
4. How do we show progress without polling too frequently (performance concern)?

#### 2. Error Visualization

**Must Show:**
- Error count by category:
  - Network errors (retryable)
  - Rate limit errors (wait and retry)
  - Data quality errors (manual review needed)
  - Session expiry (critical)
- Failed company list with:
  - Company name and org number
  - Error message
  - Stage where it failed
  - Retry button
- Error trend: Are errors increasing over time?

**Questions for Codex:**
1. Should errors be shown inline with progress or in a separate panel?
2. How do we alert users to critical errors without interrupting monitoring?
3. What's the best way to bulk retry failed companies?

#### 3. Process Control

**Must Have:**
- **Pause**: Stop processing, save state, allow resume
- **Resume**: Continue from last checkpoint
- **Stop**: Gracefully stop with data integrity
- **Restart Stage**: Restart a specific stage (e.g., retry all Stage 2 failures)

**Questions for Codex:**
1. How do we ensure data integrity when pausing mid-batch?
2. Should pause be immediate or graceful (finish current batch)?
3. How do we visualize the "paused" state?
4. What happens to in-flight requests when stopping?

#### 4. Data Quality Indicators

**Must Show:**
- Completeness per company:
  - Stage 1 data: ✓ (basic info)
  - Stage 2 data: ✓ (company ID)
  - Stage 3 data: 3/5 years (partial financial data)
- Overall data quality score
- Missing data visualization (which companies are incomplete?)

**Questions for Codex:**
1. How do we show data quality without overwhelming the user?
2. Should we show a summary or detailed view?
3. How do we prioritize which incomplete data to show?

---

## Section D: Architecture Redesign Considerations

### Current Architecture Issues

1. **Next.js API Routes Limitations:**
   - Serverless functions have timeout limits (10 minutes on Vercel)
   - No built-in job queue or background processing
   - Difficult to implement long-running processes
   - No worker pool pattern

2. **SQLite Limitations:**
   - File locking with concurrent writes
   - No connection pooling
   - Single-threaded writes
   - Not ideal for production scale

3. **No Queue System:**
   - All processing is synchronous
   - No job prioritization
   - No retry queue
   - No dead letter queue for failed jobs

4. **Session Management:**
   - Cookie-based sessions may expire
   - No session refresh mechanism
   - No session pooling

### Alternative Architectures to Consider

**Option 1: Dedicated Backend Service**
- Separate Node.js/Express backend for long-running jobs
- Next.js frontend for UI only
- Pros: No serverless timeout, better control, easier debugging
- Cons: More infrastructure, deployment complexity

**Option 2: Queue-Based Architecture**
- BullMQ + Redis for job queue
- Worker processes for each stage
- Pros: Scalable, retry logic built-in, distributed processing
- Cons: Redis dependency, more complex setup

**Option 3: Event-Driven Architecture**
- Event bus (e.g., EventEmitter, Redis Pub/Sub)
- Stage completion triggers next stage
- Pros: Decoupled stages, easier to scale individual stages
- Cons: More complex debugging, eventual consistency

**Option 4: Hybrid Approach**
- Keep Next.js for UI and API
- Background worker service for processing
- PostgreSQL for shared state
- Redis for job queue and caching
- Pros: Best of both worlds, production-ready
- Cons: Most complex, highest infrastructure cost

### Specific Architecture Questions

1. **Should we move from Next.js API routes to a dedicated backend service?**
   - Consider: Serverless timeout limits, long-running processes, deployment complexity
   - Our constraint: 10-hour runtimes

2. **Is SQLite sufficient for 50k companies, or should we migrate to PostgreSQL immediately?**
   - Consider: Concurrent access, data size (500MB+), connection pooling
   - Our constraint: Multiple users may run scrapes simultaneously

3. **What's the optimal concurrency level for each stage?**
   - Stage 1: Currently sequential
   - Stage 2: Currently 1 request at a time (500ms delay)
   - Stage 3: Currently 3 concurrent requests
   - Consider: API rate limits, memory usage, error rates

4. **How should we handle session expiry during 10-hour runs?**
   - Current: Session expires, entire run fails
   - Options: Session refresh, session pooling, session rotation

5. **What's the best approach for checkpoint/resume functionality?**
   - Consider: Transaction boundaries, data consistency, performance overhead
   - Requirements: Resume from exact point of failure, no data loss

6. **Should we implement a job queue system (e.g., BullMQ with Redis)?**
   - Pros: Built-in retry, distributed processing, job prioritization
   - Cons: Additional infrastructure, learning curve
   - Consider: Is it overkill for our use case?

7. **How can we improve the UI to show real-time progress without overwhelming the user?**
   - Consider: Polling frequency, data aggregation, visual design
   - Constraint: 10-hour runtimes, thousands of companies

8. **What error recovery strategies work best for web scraping at scale?**
   - Consider: Network errors, rate limits, data quality issues
   - Requirements: Automatic retry, manual intervention, data consistency

---

## Section E: Database Strategy

### Current Schema (SQLite)

**4 Main Tables:**
1. `staging_jobs` - Job metadata and status
2. `staging_companies` - Company basic info (Stage 1)
3. `staging_company_ids` - Resolved company IDs (Stage 2)
4. `staging_financials` - Financial data with 50+ metrics (Stage 3)

**Current Issues:**
- File locking with concurrent writes
- No connection pooling
- Single database file per session (could be 500MB+ for 50k companies)
- No partitioning strategy

### Questions for Codex

1. **Database Choice:**
   - At what scale should we migrate from SQLite to PostgreSQL?
   - Should we use PostgreSQL from the start for production?
   - Consider: Concurrent access, data size, query performance

2. **Data Partitioning:**
   - Should we partition by job_id, date, or company count?
   - How do we handle cross-partition queries?

3. **Indexing Strategy:**
   - Current indexes: Primary keys only
   - What additional indexes would improve performance?
   - Consider: Query patterns (status lookups, company searches, financial data retrieval)

4. **Connection Pooling:**
   - What's the optimal pool size for 10k-50k operations?
   - How do we handle connection exhaustion?

5. **Transaction Boundaries:**
   - Should we commit after each company or in batches?
   - How do we balance performance vs. data consistency?

---

## Section F: State Management & Checkpointing

### Requirements

1. **Resume Capability:**
   - User stops process at any point
   - System crashes mid-run
   - Session expires
   - Network interruption
   - Resume from exact point of failure

2. **Data Consistency:**
   - No duplicate processing
   - No data loss
   - No partial records (atomic operations)

3. **Performance:**
   - Minimal overhead for checkpointing
   - Fast resume (no re-processing)

### Questions for Codex

1. **Checkpoint Frequency:**
   - After each company?
   - After each batch?
   - Time-based (every 5 minutes)?
   - Consider: Performance overhead vs. resume granularity

2. **Checkpoint Data:**
   - What state needs to be saved?
   - Job progress (last processed company)
   - Stage status (which stage is running)
   - Error state (which companies failed)
   - Session state (cookies, build ID)

3. **Idempotency:**
   - How do we ensure operations can be safely retried?
   - How do we detect and skip already-processed companies?

4. **Transaction Design:**
   - Should each stage be a separate transaction?
   - Should each company be a separate transaction?
   - How do we handle rollbacks?

---

## Section G: Monitoring & Observability

### Current State
- Basic console logging
- 3-second polling for status updates
- No metrics collection
- No alerting

### Production Requirements

1. **Logging:**
   - Structured logging (JSON format)
   - Log levels (debug, info, warn, error)
   - Request/response logging
   - Error stack traces
   - Performance metrics

2. **Metrics:**
   - Processing rates (companies/min, IDs/min, financials/min)
   - Error rates by category
   - API response times
   - Database query times
   - Memory usage
   - Session health

3. **Alerting:**
   - Process stuck (no progress for 5 minutes)
   - High error rate (>10% failures)
   - Session expiry
   - Memory threshold exceeded
   - Database connection issues

4. **Debugging:**
   - Request tracing
   - Performance profiling
   - Error reproduction

### Questions for Codex

1. **Logging Strategy:**
   - What logging library should we use? (Winston, Pino, etc.)
   - Where should logs be stored? (File, database, cloud service)
   - What log retention policy?

2. **Metrics Collection:**
   - Should we use Prometheus, StatsD, or custom solution?
   - How do we expose metrics for monitoring?
   - What's the overhead of metrics collection?

3. **Real-Time Updates:**
   - How do we push updates to UI without polling?
   - WebSockets, Server-Sent Events, or polling?
   - Consider: Scalability, browser compatibility

4. **Performance Profiling:**
   - How do we identify bottlenecks in production?
   - What profiling tools should we use?

---

## Section H: UI Design Mockup Requirements

### 1. Main Dashboard View

**Layout Proposal Request:**

Please describe a UI layout that shows:
- **Top Section**: Overall progress and key metrics
  - Total progress: "8,543 / 10,000 companies (85%)"
  - Elapsed time: "4h 23m"
  - Estimated remaining: "1h 12m"
  - Current status: "Running - Stage 3 in progress"
  
- **Middle Section**: 3-Stage Pipeline Visualization
  - Stage 1: Segmentation [████████████] 100% (10,000 companies)
  - Stage 2: ID Resolution [██████████░░] 95% (9,500 IDs resolved)
  - Stage 3: Financial Data [████████░░░░] 85% (42,715 / 50,000 financial records)
  
- **Bottom Section**: Quick Stats and Controls
  - Processing rates: 150 companies/min, 120 IDs/min, 500 financials/min
  - Error count: 23 errors (view details)
  - Control buttons: Pause, Stop, View Errors
  
- **Side Panel**: System Health
  - Memory: 450MB / 2GB
  - API rate limit: OK (80% capacity)
  - Database: OK (250ms avg query time)
  - Session: Active (expires in 2h)

**Questions:**
1. Should stages be shown horizontally (pipeline) or vertically (list)?
2. How do we show that Stage 3 can start before Stage 2 is 100% complete?
3. What's the best way to show "current bottleneck" (slowest stage)?
4. Should we use a single progress bar or separate bars per stage?

### 2. Stage Detail View

**When user clicks on a stage, show:**
- Detailed progress for that stage
- List of companies being processed
- Recent completions (last 10 companies)
- Recent errors (last 10 errors)
- Stage-specific metrics (e.g., API response times for Stage 3)
- Performance graph (processing rate over time)

**Questions:**
1. Should this be a modal, slide-out panel, or separate page?
2. How much detail is too much for a 10,000 company run?
3. Should we show all companies or just a sample?

### 3. Error Management Panel

**Layout:**
- Error summary: 23 total errors (15 network, 5 rate limit, 3 data quality)
- Error list with filters:
  - Filter by stage
  - Filter by error type
  - Search by company name
- Bulk actions:
  - Retry all network errors
  - Retry selected companies
  - Export error report
- Individual error details:
  - Company name and org number
  - Error message and stack trace
  - Stage where it failed
  - Timestamp
  - Retry button

**Questions:**
1. Should errors be shown in real-time or on-demand?
2. How do we prioritize which errors to show first?
3. Should we auto-retry certain error types?

### 4. Process Control Interface

**Pause/Resume:**
- Pause button: "Pause after current batch completes"
- Paused state: "Paused at 8,543 / 10,000 companies"
- Resume button: "Resume from checkpoint"
- Visual indication: Gray out progress bars when paused

**Stop:**
- Stop button: "Stop and save progress"
- Confirmation dialog: "Are you sure? Progress will be saved."
- Stopped state: "Stopped at 8,543 / 10,000 companies"
- Resume option: "Resume from last checkpoint"

**Restart:**
- Restart stage button: "Restart Stage 2 for failed companies"
- Restart all button: "Restart entire job (lose progress)"

**Questions:**
1. Should pause be immediate or graceful (finish current batch)?
2. How do we visualize the "paused" state?
3. Should we show a confirmation dialog for destructive actions?

---

## Section I: Sample Data Context

### Typical Company Data Structure

**Stage 1 Output (Basic Info):**
```json
{
  "orgnr": "556016-0680",
  "companyName": "Volvo Group",
  "homepage": "https://www.volvogroup.com",
  "foundationYear": 1927,
  "revenueSek": 473000000000,
  "profitSek": 45000000000,
  "naceCategories": "29.10 - Tillverkning av motorfordon",
  "segmentName": "Large Manufacturing"
}
```

**Stage 2 Output (Company ID):**
```json
{
  "orgnr": "556016-0680",
  "companyId": "5560160680",
  "source": "allabolag_search",
  "confidenceScore": "1.0"
}
```

**Stage 3 Output (Financial Data - 50+ metrics per year):**
```json
{
  "companyId": "5560160680",
  "orgnr": "556016-0680",
  "year": 2023,
  "period": "2023-01-01 - 2023-12-31",
  "currency": "SEK",
  "revenue": 473000000000,
  "profit": 45000000000,
  "employees": 95000,
  "be": 12500000000,
  "tr": 8500000000,
  "sdi": 473000000000,
  "dr": 45000000000,
  "ant": 95000,
  // ... 40+ more financial metrics
  "rawData": "{...}"
}
```

### Performance Benchmarks (14 Companies)

- **Stage 1**: 30 seconds (14 companies found)
- **Stage 2**: 2 minutes (14 IDs resolved, 100% success rate)
- **Stage 3**: 5 minutes (70 financial records, 5 years per company)
- **Total**: ~7-8 minutes
- **Error Rate**: 0% (all companies successfully processed)

### Projected Performance (10,000 Companies)

- **Stage 1**: 5-10 minutes (assuming 50 companies per page, 200 pages)
- **Stage 2**: 80-160 minutes (10,000 companies, 500ms delay = 120/min)
- **Stage 3**: 200-400 minutes (50,000 financial records, 3 concurrent = ~900/min)
- **Total**: 5-10 hours
- **Expected Error Rate**: 5-10% (network issues, missing data, rate limits)

---

## Section J: Expected Deliverables from Codex

### 1. Architecture Recommendation

**Please provide:**
- Recommended architecture (with diagram description)
- Pros and cons of recommended approach
- Comparison with current architecture
- Migration complexity assessment
- Infrastructure requirements (servers, databases, queues, etc.)
- Cost implications (if applicable)
- Scalability limits of recommended architecture

**Format:**
```
Recommended Architecture: [Name]

Overview: [2-3 sentence description]

Components:
- Component 1: [Description, purpose, technology]
- Component 2: [Description, purpose, technology]
...

Pros:
- Pro 1
- Pro 2
...

Cons:
- Con 1
- Con 2
...

Why this architecture:
[Explanation of why this is best for our use case]

Scalability:
- Can handle up to [X] companies
- Can scale to [Y] with [modifications]
```

### 2. Detailed UI Wireframe Descriptions

**Please provide text-based wireframe descriptions for:**
1. Main Dashboard View (described in Section H.1)
2. Stage Detail View (described in Section H.2)
3. Error Management Panel (described in Section H.3)
4. Process Control Interface (described in Section H.4)

**Format:**
```
Component: Main Dashboard View

Layout:
[Describe layout using ASCII art or detailed text description]

Elements:
- Element 1: [Position, purpose, behavior]
- Element 2: [Position, purpose, behavior]
...

Interactions:
- User action 1 → System response
- User action 2 → System response
...

Visual Design:
- Color scheme: [Description]
- Typography: [Description]
- Spacing: [Description]
```

### 3. Implementation Roadmap

**Please provide prioritized roadmap:**

**Phase 1: Critical (Week 1-2)**
- Task 1: [Description, effort estimate, dependencies]
- Task 2: [Description, effort estimate, dependencies]
...

**Phase 2: Important (Week 3-4)**
- Task 1: [Description, effort estimate, dependencies]
...

**Phase 3: Nice-to-Have (Week 5+)**
- Task 1: [Description, effort estimate, dependencies]
...

### 4. Code Snippets for Critical Improvements

**Please provide code examples for:**
1. Checkpoint/resume mechanism
2. Adaptive rate limiting
3. Session refresh logic
4. Error retry strategy
5. Real-time progress updates (WebSocket or SSE)
6. Database migration (SQLite to PostgreSQL)

**Format:**
```typescript
// Feature: Checkpoint/Resume Mechanism
// Purpose: Save progress and resume from last checkpoint

// 1. Save checkpoint
async function saveCheckpoint(jobId: string, state: CheckpointState) {
  // Implementation
}

// 2. Load checkpoint
async function loadCheckpoint(jobId: string): Promise<CheckpointState> {
  // Implementation
}

// 3. Resume from checkpoint
async function resumeJob(jobId: string) {
  // Implementation
}
```

### 5. Migration Strategy

**If architecture change is recommended, provide:**
1. Step-by-step migration plan
2. Data migration approach (SQLite → PostgreSQL)
3. Zero-downtime migration strategy (if applicable)
4. Rollback plan
5. Testing strategy for new architecture
6. Timeline estimate

### 6. Performance Estimates

**Please provide estimates for recommended solution:**
- Processing time for 10,000 companies
- Processing time for 50,000 companies
- Memory usage estimates
- Database size estimates
- Infrastructure costs (if applicable)
- Scalability limits

**Format:**
```
Performance Estimates (Recommended Architecture):

10,000 Companies:
- Stage 1: [X] minutes
- Stage 2: [Y] minutes
- Stage 3: [Z] minutes
- Total: [T] hours
- Memory: [M] MB
- Database: [D] MB

50,000 Companies:
- Stage 1: [X] minutes
- Stage 2: [Y] minutes
- Stage 3: [Z] minutes
- Total: [T] hours
- Memory: [M] GB
- Database: [D] GB

Scalability Limit: [Max companies before needing to scale horizontally]
```

---

## Section K: Constraints and Considerations

### Technical Constraints

1. **API Constraints:**
   - Allabolag.se requires VPN (Swedish IP)
   - Rate limiting (unknown exact limits, we use conservative delays)
   - Session-based authentication with CSRF tokens
   - Build ID changes periodically (requires refresh)

2. **Data Constraints:**
   - 50+ financial metrics per company per year
   - Typically 5 years of data per company
   - Company names may have variations (matching issues)
   - Some companies may not have financial data

3. **Infrastructure Constraints:**
   - Currently running on local development machine
   - No production infrastructure yet
   - Budget considerations for cloud hosting
   - Need to support multiple concurrent users

### Business Constraints

1. **User Experience:**
   - Users are non-technical (need simple UI)
   - Users need to monitor progress without constant attention
   - Users need to intervene when issues occur
   - Users need to export data for analysis

2. **Reliability:**
   - Must handle 10-hour runtimes without failure
   - Must recover from network interruptions
   - Must handle API rate limiting gracefully
   - Must preserve data integrity

3. **Scalability:**
   - Start with 10k-50k companies
   - May scale to 100k+ in future
   - Multiple users may run scrapes simultaneously
   - Need to support historical data (multiple scraping sessions)

---

## Section L: Questions and Clarifications

### Critical Questions for Codex

1. **Architecture Decision:**
   - Given our constraints (10-hour runtimes, serverless limitations), should we move away from Next.js API routes entirely?
   - If yes, what's the simplest production-ready architecture you recommend?

2. **Database Decision:**
   - At what company count should we switch from SQLite to PostgreSQL?
   - Can SQLite handle 50k companies with proper optimization, or is PostgreSQL mandatory?

3. **Queue System:**
   - Is a job queue (BullMQ + Redis) overkill for our use case?
   - Can we achieve similar reliability with simpler patterns?

4. **UI Complexity:**
   - How do we balance real-time updates with performance?
   - What's the optimal polling frequency for 10-hour runs?
   - Should we use WebSockets, SSE, or stick with polling?

5. **Error Recovery:**
   - What's the best pattern for automatic retry with exponential backoff?
   - How do we categorize errors (retryable vs. manual intervention)?
   - Should we implement a dead letter queue?

6. **Session Management:**
   - How do we keep sessions alive for 10 hours?
   - Should we implement session pooling or rotation?
   - What's the best way to refresh expired sessions?

7. **Performance Optimization:**
   - What's the optimal concurrency level for each stage?
   - Should we implement adaptive rate limiting?
   - How do we balance speed with API respect?

8. **Monitoring:**
   - What's the minimum viable monitoring for production?
   - Should we implement custom monitoring or use existing tools?
   - How do we alert users to critical issues?

---

## Section M: Success Criteria

### Your analysis and recommendations will be successful if they provide:

1. **Clear Architecture Decision:**
   - Specific recommendation (not "it depends")
   - Justification based on our constraints
   - Migration path from current system

2. **Actionable UI Design:**
   - Detailed enough to implement
   - Addresses long-running process monitoring
   - Balances detail with simplicity

3. **Production-Ready Patterns:**
   - Checkpoint/resume implementation
   - Error recovery strategy
   - Session management approach

4. **Performance Confidence:**
   - Realistic estimates for 10k-50k companies
   - Identification of bottlenecks
   - Optimization recommendations

5. **Implementation Roadmap:**
   - Prioritized tasks
   - Effort estimates
   - Dependencies identified

---

## Additional Context

### Current System Documentation

Please refer to `scraper/README.md` for:
- Complete API endpoint documentation
- Database schema details
- Current implementation details
- Technology stack information

### Repository Structure

```
scraper/allabolag-scraper/
├── src/
│   ├── app/
│   │   ├── api/              # API endpoints
│   │   │   ├── segment/      # Stage 1
│   │   │   ├── enrich/       # Stage 2
│   │   │   ├── financial/    # Stage 3
│   │   │   ├── sessions/     # Session management
│   │   │   └── monitoring/   # Monitoring endpoints
│   │   ├── components/       # React components
│   │   └── page.tsx         # Main UI
│   └── lib/
│       ├── allabolag.ts     # Allabolag.se integration
│       └── db/
│           └── local-staging.ts  # Database operations
└── staging/                 # SQLite database files
```

---

## Final Request

Please analyze our system comprehensively and provide:

1. **Architecture recommendation** with clear justification
2. **UI wireframe descriptions** for monitoring long-running processes
3. **Implementation roadmap** with priorities and estimates
4. **Code snippets** for critical improvements
5. **Migration strategy** if architecture change is needed
6. **Performance estimates** for recommended solution

Focus on:
- **Production-ready solutions** (not prototypes)
- **Simplicity where possible** (avoid over-engineering)
- **Scalability to 50k companies** (with path to 100k+)
- **UI/UX for long-running processes** (2-10 hours)
- **Error recovery and reliability** (must handle failures gracefully)

Thank you for your analysis and recommendations!

---

**Document Version:** 1.0  
**Date:** January 2024  
**Contact:** Development Team

# Allabolag Scraper System

A comprehensive 3-stage company data extraction system that scrapes financial and company information from Allabolag.se (Swedish company registry).

## 🏗️ System Architecture

### Overview
The scraper system is built as a Next.js application with a 3-stage processing pipeline:

1. **Stage 1: Segmentation** - Company search and filtering
2. **Stage 2: Company ID Resolution** - Resolve actual company IDs from search results
3. **Stage 3: Financial Data Fetching** - Extract detailed financial information

### Technology Stack
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: SQLite (local staging), PostgreSQL (production)
- **Data Source**: Allabolag.se API
- **Session Management**: Cookie-based with CSRF protection

### Project Structure
```
scraper/allabolag-scraper/
├── src/
│   ├── app/
│   │   ├── api/                    # API endpoints
│   │   ├── components/             # React components
│   │   └── page.tsx               # Main UI
│   └── lib/
│       ├── allabolag.ts           # Allabolag.se integration
│       ├── db/
│       │   └── local-staging.ts   # SQLite database operations
│       └── hash.ts                # Utility functions
├── staging/                       # SQLite database files
└── package.json
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- VPN connection (required for Allabolag.se access)

### Installation
```bash
cd scraper/allabolag-scraper
npm install
npm run dev
```

The application will be available at `http://localhost:3000`

### Environment Setup
Create `.env.local` with:
```env
# Optional: For production database
DATABASE_URL=postgresql://...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

## 📊 Data Flow

### 3-Stage Processing Pipeline

```mermaid
graph TD
    A[User Input: Filters] --> B[Stage 1: Segmentation]
    B --> C[Company Search Results]
    C --> D[Stage 2: Company ID Resolution]
    D --> E[Resolved Company IDs]
    E --> F[Stage 3: Financial Data Fetching]
    F --> G[Complete Financial Records]
    G --> H[Data Validation & Export]
```

### Stage Details

#### Stage 1: Segmentation
- **Purpose**: Search and filter companies based on criteria
- **Input**: Revenue range, EBIT range, industry filters
- **Output**: List of companies with basic information
- **API**: `/api/segment/start`
- **Database**: `staging_companies` table

#### Stage 2: Company ID Resolution
- **Purpose**: Resolve actual company IDs from search results
- **Input**: Company names and organization numbers
- **Output**: Mapped company IDs for financial data access
- **API**: `/api/enrich/company-ids`
- **Database**: `staging_company_ids` table

#### Stage 3: Financial Data Fetching
- **Purpose**: Extract detailed financial information
- **Input**: Resolved company IDs
- **Output**: Complete financial records (50+ data points per year)
- **API**: `/api/financial/fetch`
- **Database**: `staging_financials` table

## 🗄️ Database Schema

### SQLite Staging Database
Each scraping session creates a separate SQLite database file: `staging/staging_{jobId}.db`

#### Tables

**staging_jobs**
```sql
CREATE TABLE staging_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  stage TEXT NOT NULL,
  last_page INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  total_companies INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  rate_limit_stats TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**staging_companies**
```sql
CREATE TABLE staging_companies (
  id TEXT PRIMARY KEY,
  orgnr TEXT NOT NULL,
  company_name TEXT NOT NULL,
  company_id TEXT,
  company_id_hint TEXT,
  homepage TEXT,
  foundation_year INTEGER,
  revenue_sek REAL,
  profit_sek REAL,
  nace_categories TEXT,
  segment_name TEXT,
  status TEXT DEFAULT 'pending',
  job_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES staging_jobs (id)
);
```

**staging_company_ids**
```sql
CREATE TABLE staging_company_ids (
  id TEXT PRIMARY KEY,
  orgnr TEXT NOT NULL,
  company_id TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence_score TEXT,
  scraped_at TEXT NOT NULL,
  job_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES staging_jobs (id)
);
```

**staging_financials**
```sql
CREATE TABLE staging_financials (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  orgnr TEXT NOT NULL,
  year INTEGER NOT NULL,
  period TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  currency TEXT DEFAULT 'SEK',
  revenue REAL,
  profit REAL,
  employees INTEGER,
  be REAL,
  tr REAL,
  -- 50+ additional financial metrics
  raw_data TEXT,
  validation_status TEXT DEFAULT 'pending',
  scraped_at TEXT NOT NULL,
  job_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES staging_jobs (id)
);
```

## 🔌 API Endpoints

### Core Scraping Endpoints

#### POST `/api/segment/start`
Start Stage 1: Company segmentation and search
```json
{
  "revenueMin": 100000000,
  "revenueMax": 101000000,
  "ebitMin": 3000000,
  "ebitMax": 5000000,
  "industry": "technology"
}
```

#### POST `/api/enrich/company-ids?jobId={jobId}`
Start Stage 2: Company ID resolution
- Resolves company IDs for all companies in the session
- Updates `staging_company_ids` table
- Returns: `{"jobId": "session-id"}`

#### POST `/api/financial/fetch?jobId={jobId}`
Start Stage 3: Financial data fetching
- Fetches financial data for all resolved company IDs
- Extracts 50+ financial metrics per year
- Updates `staging_financials` table
- Returns: `{"jobId": "session-id"}`

### Status and Monitoring

#### GET `/api/segment/status?jobId={jobId}`
Get current job status and progress
```json
{
  "id": "job-id",
  "status": "running",
  "stage": "stage2_enrichment",
  "stats": {
    "companies": 150,
    "companyIds": 120,
    "financials": 600
  }
}
```

#### GET `/api/sessions`
List all scraping sessions
```json
{
  "sessions": [
    {
      "sessionId": "uuid",
      "status": "completed",
      "totalCompanies": 150,
      "totalCompanyIds": 120,
      "totalFinancials": 600,
      "createdAt": "2024-01-01T00:00:00Z",
      "stages": {
        "stage1": {"status": "completed"},
        "stage2": {"status": "completed"},
        "stage3": {"status": "completed"}
      }
    }
  ]
}
```

#### GET `/api/sessions/{sessionId}/companies`
Get detailed company data for a session
```json
{
  "companies": [...],
  "pagination": {
    "page": 1,
    "totalPages": 10,
    "totalItems": 150
  }
}
```

### Monitoring and Control

#### GET `/api/monitoring/dashboard?jobId={jobId}`
Real-time monitoring dashboard data
```json
{
  "jobId": "session-id",
  "timestamp": "2024-01-01T00:00:00Z",
  "status": {
    "current": "running",
    "isRunning": true,
    "isCompleted": false
  },
  "progress": {
    "total": {
      "companies": 150,
      "companyIds": 120,
      "financials": 600
    },
    "rates": {
      "companiesPerMinute": 25.5,
      "idsPerMinute": 20.0,
      "financialsPerMinute": 100.0
    }
  },
  "stages": {
    "stage1": {"completed": 150, "total": 150, "percentage": 100},
    "stage2": {"completed": 120, "total": 150, "percentage": 80},
    "stage3": {"completed": 600, "total": 750, "percentage": 80}
  }
}
```

#### POST `/api/monitoring/control`
Control scraping process (stop/resume/restart)
```json
{
  "jobId": "session-id",
  "action": "stop" // or "resume" or "restart"
}
```

## 🎨 User Interface

### Main Components

#### ScraperInterface (`page.tsx`)
- **Purpose**: Main application interface
- **Features**: 
  - Session selection modal
  - 3-stage process control
  - Real-time monitoring dashboard
  - Data validation and export
- **Design**: Clean, minimal OpenAI-style interface

#### SessionModal (`components/SessionModal.tsx`)
- **Purpose**: Session selection and management
- **Features**:
  - List all available sessions
  - Show session status and progress
  - Clean, minimal design
- **Usage**: Click "Select Session" to open

### User Flow

1. **Session Selection**: Choose existing session or start new one
2. **Stage Control**: Use buttons to start Stage 2 and Stage 3
3. **Monitoring**: Real-time progress tracking
4. **Validation**: Review extracted data
5. **Export**: Download results

### Key UI Features

- **Real-time Updates**: 3-second polling for status updates
- **Progress Tracking**: Visual progress bars and counters
- **Error Handling**: Clear error messages and recovery options
- **Responsive Design**: Works on desktop and mobile
- **Clean Interface**: Minimal colors, focused on functionality

## 🔧 Configuration

### Rate Limiting
- **Stage 1**: 1 request per 2 seconds
- **Stage 2**: 1 request per 500ms
- **Stage 3**: 3 concurrent requests, 200ms delay between batches

### Batch Sizes
- **Stage 1**: 50 companies per page
- **Stage 2**: 10 companies per batch
- **Stage 3**: 50 companies per batch, 3 concurrent

### Session Management
- **Cookie-based**: Uses `__RequestVerificationToken` for CSRF protection
- **Build ID**: Fetched dynamically from Allabolag.se
- **Session Persistence**: Maintains session across requests

## 🧪 Testing

### Manual Testing
1. **Start Scraper**: `npm run dev`
2. **Select Session**: Use existing session or create new one
3. **Test Stages**: Run Stage 2 and Stage 3
4. **Monitor Progress**: Check real-time updates
5. **Validate Data**: Review extracted information

### API Testing
```bash
# Test Stage 2
curl -X POST "http://localhost:3000/api/enrich/company-ids?jobId=session-id"

# Test Stage 3
curl -X POST "http://localhost:3000/api/financial/fetch?jobId=session-id"

# Check status
curl "http://localhost:3000/api/segment/status?jobId=session-id"
```

### Test Workflow
- **Endpoint**: `/api/test-complete-workflow`
- **Purpose**: End-to-end testing of all stages
- **Coverage**: Session management, segmentation, financial data

## 🚨 Error Handling

### Common Issues

#### VPN Required
- **Error**: "Failed to fetch" or network errors
- **Solution**: Ensure VPN is connected to Swedish IP

#### Rate Limiting
- **Error**: 429 Too Many Requests
- **Solution**: System automatically handles with delays

#### Session Expiry
- **Error**: Invalid session or build ID
- **Solution**: System automatically refreshes session

#### Database Errors
- **Error**: SQLite file locked or corrupted
- **Solution**: Restart application, check file permissions

### Error Recovery
- **Automatic Retry**: Built-in retry logic for failed requests
- **Graceful Degradation**: Continues processing other companies
- **Error Logging**: Detailed error messages in console
- **Status Updates**: Real-time error reporting in UI

## 📈 Performance

### Scalability
- **Concurrent Processing**: Up to 3 concurrent requests in Stage 3
- **Batch Processing**: Efficient batch operations
- **Memory Management**: Streaming data processing
- **Database Optimization**: Indexed queries, prepared statements

### Monitoring
- **Real-time Metrics**: Processing rates, completion estimates
- **System Health**: Memory usage, uptime tracking
- **Progress Tracking**: Stage-by-stage progress monitoring
- **Error Reporting**: Comprehensive error logging

## 🔒 Security

### Data Protection
- **Local Storage**: SQLite databases stored locally
- **Session Security**: CSRF token protection
- **Rate Limiting**: Prevents abuse of external APIs
- **Error Sanitization**: No sensitive data in error messages

### Access Control
- **VPN Requirement**: Geographic access restrictions
- **Session Management**: Secure session handling
- **API Protection**: Input validation and sanitization

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Environment Variables
```env
# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# Optional: Supabase integration
SUPABASE_URL=https://project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

## 📝 Data Export

### Available Formats
- **CSV**: Company and financial data
- **JSON**: Complete data with metadata
- **Excel**: Formatted spreadsheets

### Export Endpoints
- **Companies**: `/api/sessions/{sessionId}/companies`
- **Financial Data**: `/api/validation/data?sessionId={sessionId}`
- **Complete Export**: Custom export functionality

## 🤝 Contributing

### Code Standards
- **TypeScript**: Strict type checking
- **ESLint**: Code quality enforcement
- **Prettier**: Code formatting
- **Testing**: Comprehensive test coverage

### Development Workflow
1. Create feature branch
2. Implement changes
3. Add tests
4. Update documentation
5. Submit pull request

## 📞 Support

### Troubleshooting
1. Check VPN connection
2. Verify server is running
3. Check browser console for errors
4. Review API endpoint responses
5. Check database file permissions

### Common Commands
```bash
# Start development server
npm run dev

# Check server status
curl http://localhost:3000/api/sessions

# View logs
tail -f logs/scraper.log
```

---

**Last Updated**: January 2024  
**Version**: 1.0.0  
**Maintainer**: Development Team
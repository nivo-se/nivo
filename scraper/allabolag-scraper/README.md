# Allabolag Scraper

A Next.js 14 application for scraping Swedish company data from Allabolag.se with controlled pagination, rate limiting, and data enrichment.

## Features

- **Segmentation Scraping**: Scrape companies based on revenue and profit filters
- **Controlled Rate Limiting**: Built-in retry logic with exponential backoff
- **Data Enrichment**: Enrich company data with canonical company IDs
- **Real-time Progress**: Live job status updates and progress tracking
- **Resume Capability**: Jobs can be resumed from the last processed page
- **Deduplication**: UPSERT operations prevent duplicate data

## Tech Stack

- **Next.js 14** with App Router and TypeScript
- **Drizzle ORM** for database operations
- **PostgreSQL** for data storage
- **Tailwind CSS** for styling
- **Vercel** for deployment

## Setup

### 1. Environment Variables

Copy the example environment file and configure your database:

```bash
cp env.example .env.local
```

Update `.env.local` with your database connection string:

```env
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"
```

### 2. Database Setup

Generate and run database migrations:

```bash
npm run db:generate
npm run db:push
```

Or use the Drizzle Studio for database management:

```bash
npm run db:studio
```

### 3. Development

Start the development server:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to access the application.

## Usage

### 1. Configure Filters

Set your segmentation filters:
- **Revenue Range**: From and to values in SEK
- **Profit Range**: From and to values in SEK
- **Company Type**: Currently supports "AB" (Aktiebolag)

### 2. Start Scraping

Click "Start Scraping" to begin the segmentation job. The system will:
- Discover the current Allabolag.se build ID
- Paginate through the segmentation endpoint
- Extract and normalize company data
- Store data in the `raw_companies` table
- Update progress in real-time

### 3. Enrich Company IDs

After segmentation is complete, click "Enrich Company IDs" to:
- Search for canonical company IDs using organization numbers
- Fall back to company name search if needed
- Store mappings in the `company_ids` table
- Update `raw_companies` with found IDs

## Database Schema

### Tables

- **`jobs`**: Tracks scraping and enrichment job progress
- **`raw_companies`**: Stores scraped company data
- **`company_ids`**: Maps organization numbers to canonical company IDs

### Key Fields

- **`orgnr`**: Swedish organization number (primary key)
- **`companyName`**: Company display name
- **`companyId`**: Canonical Allabolag company ID
- **`revenueSek`**: Revenue in SEK
- **`profitSek`**: Profit in SEK
- **`naceCategories`**: Industry classification codes
- **`segmentName`**: Industry segment names

## API Endpoints

### Segmentation

- **`POST /api/segment/start`**: Start a new segmentation job
- **`GET /api/segment/status?jobId=<id>`**: Get job status and progress

### Enrichment

- **`POST /api/enrich/company-ids?jobId=<id>`**: Start company ID enrichment

## Rate Limiting & Resilience

- **Concurrency**: 5-10 concurrent requests
- **Retry Logic**: Exponential backoff starting at 2s, max 60s
- **Max Retries**: 5 attempts per request
- **429 Handling**: Automatic rate limit detection and backoff
- **Checkpointing**: Progress saved after each page

## Deployment

### Vercel

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Environment Variables for Production

```env
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"
```

## Monitoring

- Check job status in the UI for real-time progress
- Monitor server logs for detailed scraping information
- Use Drizzle Studio to inspect database contents

## Safety Features

- **Duplicate Prevention**: UPSERT operations prevent data duplication
- **Job Resumption**: Running jobs are detected and resumed
- **Error Handling**: Comprehensive error logging and recovery
- **Page Limits**: Hard cap of 3000 pages per job
- **Empty Page Detection**: Stops after 3 consecutive empty pages

## Development Notes

- All scraping is done via JSON endpoints (no headless browsers)
- Build ID detection is robust with multiple fallback methods
- Data normalization handles various input formats
- Swedish number formatting is applied throughout

## Troubleshooting

### Common Issues

1. **Database Connection**: Ensure `DATABASE_URL` is correctly formatted
2. **Rate Limiting**: Check server logs for 429 errors and backoff behavior
3. **Build ID**: Verify Allabolag.se structure hasn't changed
4. **Memory**: Large jobs may require serverless function timeout adjustments

### Debug Mode

Enable detailed logging by checking the browser console and server logs for:
- Page processing details
- Company data extraction
- API response status codes
- Retry attempts and backoff timing
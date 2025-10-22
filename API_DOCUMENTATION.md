# Nivo API Documentation

## Overview
The Nivo API provides comprehensive endpoints for Swedish company intelligence, valuation analysis, AI insights, and saved lists management.

## Base URL
- **Development**: `http://localhost:3001`
- **Production**: `https://your-vercel-domain.vercel.app`

## Authentication
Currently using mock authentication with UUID `00000000-0000-0000-0000-000000000000`. Future versions will implement proper user authentication.

## Endpoints

### Company Search & Data

#### `GET /api/companies`
Search and filter companies with advanced criteria.

**Query Parameters:**
- `search` (string): Company name search
- `industry` (string): Industry filter
- `minRevenue` (number): Minimum revenue in MSEK
- `maxRevenue` (number): Maximum revenue in MSEK
- `minProfit` (number): Minimum profit in MSEK
- `maxProfit` (number): Maximum profit in MSEK
- `minEmployees` (number): Minimum employee count
- `maxEmployees` (number): Maximum employee count
- `limit` (number): Results limit (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "OrgNr": "5591431530",
      "name": "Example Company AB",
      "segment_name": "Teknik - IT",
      "city": "Stockholm",
      "employees": 25,
      "SDI": 149913,
      "DR": 6645,
      "ORS": 9009,
      "Revenue_growth": 0.15,
      "EBIT_margin": 0.12,
      "NetProfit_margin": 0.08
    }
  ]
}
```

#### `GET /api/analytics`
Get dashboard analytics and aggregate metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCompanies": 8479,
    "averageRevenueGrowth": 0.15,
    "averageEBITMargin": 0.12,
    "averageNetProfitMargin": 0.08,
    "averageNetProfitGrowth": 0.18,
    "averageRevenue": 25000,
    "averageCAGR4Y": null
  }
}
```

### Valuation Analysis

#### `POST /api/valuation`
Perform multi-model valuation analysis on selected companies.

**Request Body:**
```json
{
  "companyIds": ["5591431530", "5560001234"],
  "mode": "default"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valuationSessionId": "f8ad7f1c-...",
    "mode": "default",
    "generatedAt": "2025-10-22T15:53:47.293Z",
    "overallSummary": "AI-generated summary...",
    "companies": [
      {
        "orgnr": "5591431530",
        "name": "Example Company AB",
        "industry": "Teknik",
        "employees": 25,
        "metrics": {
          "enterpriseValue": 179895.6,
          "equityValue": 179895.6,
          "revenueLatest": 149913,
          "revenueCagr3Y": null,
          "evToEbit": null,
          "evToEbitda": null,
          "peRatio": null,
          "pbRatio": null,
          "psRatio": null,
          "equityRatio": null
        },
        "history": [],
        "chartSeries": []
      }
    ]
  }
}
```

#### `GET /api/valuation/preview`
Get individual company valuation preview.

**Query Parameters:**
- `orgnr` (string): Company organization number

**Response:**
```json
{
  "success": true,
  "data": {
    "orgnr": "5591431530",
    "name": "Example Company AB",
    "industry": "Teknik",
    "employees": 25,
    "metrics": {
      "enterpriseValue": 179895.6,
      "revenueLatest": 149913
    },
    "valuations": [
      {
        "modelKey": "revenue_multiple",
        "valueEv": 179895.6,
        "valueEquity": 179895.6,
        "multiple": 1.2,
        "basis": "Revenue (149.9M SEK) × 1.2x multiple"
      }
    ]
  }
}
```

#### `POST /api/valuation/commit`
Save valuation session to database.

**Request Body:**
```json
{
  "companyIds": ["5591431530"],
  "mode": "default",
  "valuationPayload": { /* full valuation data */ }
}
```

#### `GET /api/valuation/advice`
Get AI-powered valuation advice for a company.

**Query Parameters:**
- `orgnr` (string): Company organization number

### Saved Lists Management

#### `GET /api/saved-lists`
Retrieve all saved company lists for the user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "b156459a-1442-44e1-a59a-175d5599436f",
      "user_id": "00000000-0000-0000-0000-000000000000",
      "name": "Tech Companies",
      "description": "Technology companies in Stockholm",
      "companies": [
        {
          "OrgNr": "5591431530",
          "name": "Example Company AB"
        }
      ],
      "filters": {},
      "created_at": "2025-10-22T15:53:47.293Z",
      "updated_at": "2025-10-22T15:53:47.293Z"
    }
  ]
}
```

#### `POST /api/saved-lists`
Create a new saved company list.

**Request Body:**
```json
{
  "name": "My Company List",
  "description": "Description of the list",
  "companies": [
    {
      "OrgNr": "5591431530",
      "name": "Example Company AB"
    }
  ],
  "filters": {}
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "b156459a-1442-44e1-a59a-175d5599436f",
    "user_id": "00000000-0000-0000-0000-000000000000",
    "name": "My Company List",
    "description": "Description of the list",
    "companies": [...],
    "filters": {},
    "created_at": "2025-10-22T15:53:47.293Z",
    "updated_at": "2025-10-22T15:53:47.293Z"
  }
}
```

#### `PUT /api/saved-lists/:id`
Update an existing saved company list.

**Request Body:**
```json
{
  "name": "Updated List Name",
  "description": "Updated description",
  "companies": [...],
  "filters": {}
}
```

#### `DELETE /api/saved-lists/:id`
Delete a saved company list.

**Response:**
```json
{
  "success": true,
  "message": "List deleted successfully"
}
```

### AI Analysis

#### `POST /api/ai-analysis`
Generate AI-powered company insights.

**Request Body:**
```json
{
  "companyIds": ["5591431530"],
  "mode": "default"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysisRunId": "f8ad7f1c-...",
    "mode": "default",
    "generatedAt": "2025-10-22T15:53:47.293Z",
    "companies": [
      {
        "orgnr": "5591431530",
        "name": "Example Company AB",
        "aiInsights": {
          "summary": "AI-generated company summary...",
          "valuationView": "Indicativt företagsvärde omkring 179.9 MSEK",
          "valuationRange": "150000000–200000000 SEK",
          "riskFlags": ["Låg soliditet"],
          "opportunities": ["Skalbar exportaffär"],
          "mode": "default"
        }
      }
    ]
  }
}
```

#### `GET /api/analysis-runs`
Retrieve historical AI analysis runs.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "f8ad7f1c-...",
      "company_ids": ["5591431530"],
      "mode": "default",
      "generated_at": "2025-10-22T15:53:47.293Z",
      "overall_summary": "AI-generated summary..."
    }
  ]
}
```

#### `GET /api/analysis-runs/:id`
Get specific analysis run details.

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common HTTP Status Codes
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `404`: Not Found (company/list not found)
- `500`: Internal Server Error

## Rate Limiting
Currently no rate limiting implemented. Future versions will include rate limiting for production use.

## Data Formats

### Financial Data
- **Revenue (SDI)**: Stored in thousands of SEK, displayed in MSEK
- **Profit (DR)**: Stored in thousands of SEK, displayed in MSEK
- **EBITDA (ORS)**: Stored in thousands of SEK, displayed in MSEK
- **Valuation**: Calculated in thousands of SEK, displayed in MSEK

### Date Formats
- All timestamps use ISO 8601 format: `2025-10-22T15:53:47.293Z`

### UUIDs
- All IDs use standard UUID v4 format
- User ID: `00000000-0000-0000-0000-000000000000` (mock)

## Environment Variables

Required environment variables:
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key
- `OPENAI_API_KEY`: OpenAI API key for AI features

## Security

- Row-level security (RLS) policies configured for saved lists
- Proper UUID validation and sanitization
- Error handling prevents information leakage
- CORS configured for production deployment

## Future Enhancements

- User authentication and authorization
- Rate limiting and API quotas
- Webhook support for real-time updates
- Advanced filtering and search capabilities
- Bulk operations for large datasets

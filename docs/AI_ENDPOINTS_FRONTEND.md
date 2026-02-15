# AI Endpoints – Frontend Contract

Endpoints the frontend calls and their expected payload shapes.

## Endpoints Used

| Endpoint | Frontend method | Component |
|----------|-----------------|-----------|
| `GET /api/companies/{orgnr}/intel` | `intelligenceService.getCompanyIntel(orgnr)` | (Available; may not be rendered) |
| `GET /api/companies/{orgnr}/ai-report` | `intelligenceService.getAIReport(orgnr)` | `AIDeepDivePanel` |
| `POST /api/companies/batch` | `apiService` (batch fetch) | Various |
| `POST /api/ai-reports/generate` | `intelligenceService.generateAIReport(orgnr)` | `AIDeepDivePanel` |
| `POST /api/ai-reports/generate-batch` | `intelligenceService.generateAIReportsBatch(orgnrs)` | - |

## Expected Payload Shapes

### CompanyIntel (`/intel`)

```ts
interface CompanyIntel {
  orgnr: string
  company_id: string | null
  domain: string | null
  industry: string | null
  tech_stack: string[]
  digital_maturity_score: number | null
  artifacts: IntelArtifact[]
}

interface IntelArtifact {
  id: string
  source: string
  artifact_type: string
  url: string | null
  content: string
  created_at: string
}
```

**Postgres response:** Now includes these fields (from ai_profiles + company_enrichment) plus `ai_profile` and `enrichment` for extended use.

### AIReport (`/ai-report`)

```ts
interface AIReport {
  orgnr: string
  business_model: string | null
  weaknesses: string[]
  uplift_ops: Array<{
    name: string
    impact: string
    effort: 'Low' | 'Medium' | 'High'
  }>
  impact_range: 'Low' | 'Medium' | 'High' | null
  outreach_angle: string | null
}
```

**Note:** `uplift_ops` expects objects. If backend returns strings, frontend may need adaptation.

# Codex AI Analysis Fix Prompt

## Title
Fix Deep Analysis JSON Schema and End-to-End Persistence/Rendering

## Context
- **Frontend**: Vite/React/TS/Tailwind/Shadcn. Key component: `frontend/src/components/AIAnalysis.tsx`
- **Local API server**: `frontend/server/enhanced-server.ts` (Express). This mirrors `api/ai-analysis.ts` on Vercel and adds endpoints:
  - POST `/api/ai-analysis` (screening | deep)
  - GET `/api/ai-analysis?history=1&limit=10`
  - GET `/api/analyzed-companies`
  - GET `/api/test-enhanced`
  - POST `/api/migrate-enhanced-fields` (helper; columns now applied directly)
- **DB**: Supabase. Tables (public): `ai_analysis_runs`, `ai_company_analysis`, `ai_analysis_audit`, `ai_screening_results`, `master_analytics`. RLS set up. Migration for enhanced fields is now applied.

## What's Working
- **Screening**: builds profile from `master_analytics`. Real data used.
- **Deep analysis**: profile generation OK, run records created, basic fields persisted.
- **GET `/api/analyzed-companies`**: now returns enhanced fields in the API response mapping.

## The Problem to Fix (Root Cause)
- **OpenAI returns 400 on deep analysis with structured output**:
  ```
  Error: "Invalid schema for response_format 'DeepCompanyAnalysis': In context=(), 'additionalProperties' is required to be supplied and to be false."
  ```
- As a result, deep analyses fall back to empty companies array or enhanced fields end up null.
- We need to fix `deepAnalysisSchema` and the call to `openai.chat.completions.create` (JSON schema mode) to match OpenAI's current required schema format.

## Evidence (Logs)
From `enhanced-server.ts`:
```
Error processing company 5562642362: BadRequestError: 400 Invalid schema for response_format 'DeepCompanyAnalysis': In context=(), 'additionalProperties' is required to be supplied and to be false.
    at async invokeDeepAnalysisModel (/Users/jesper/nivo/frontend/server/enhanced-server.ts:455:20)
```

## Goals
1) **Update `deepAnalysisSchema`** to a valid OpenAI JSON schema object, including:
   - top-level name
   - strict schema with `"type": "object"`, `"properties"`, and `"additionalProperties": false`
   - correct enums/types for: executive_summary, key_findings[], narrative, strengths[], weaknesses[], opportunities[], risks[], acquisition_interest ('Hög'|'Medel'|'Låg'), financial_health_score (1-10), growth_outlook, market_position ('Marknadsledare'|'Utmanare'|'Följare'|'Nischaktör'), target_price_msek (number), next_steps[]
   - any nested arrays as arrays of strings with minItems where sensible

2) **Ensure `invokeDeepAnalysisModel`** uses the correct `response_format` per OpenAI's current API (json_schema mode) and parses the content robustly.

3) **Map parsed fields** via `buildCompanyResult` to the response and persist with `persistCompanyResult` into `ai_company_analysis` (enhanced columns already exist).

4) **Populate audit**: prompt, response, token usage, cost, latency in `ai_analysis_audit`.

5) **Verify GET `/api/analyzed-companies`** returns enhanced fields (already added to select and mapping).

6) **Minimal UI change**: confirm `AIAnalysis.tsx` renders ExecutiveSummaryCard, KeyFindingsCard, SWOTAnalysisCard, NarrativeCard, FinancialMetricsCard, ValuationCard with the new fields once non-null.

## Constraints/Notes
- Keep Swedish outputs and prompts.
- Don't reintroduce mock data anywhere.
- Deep analysis must be resilient: if schema parse fails, log and include a meaningful error; don't silently return empty results.
- Preserve existing endpoints and signatures.

## Where to Implement
- **`frontend/server/enhanced-server.ts`**
  - Fix `deepAnalysisSchema`
  - Fix `invokeDeepAnalysisModel` response_format usage for OpenAI
  - Ensure `buildCompanyResult` handles the updated parsed object
  - Ensure `persistCompanyResult` persists all enhanced fields and adds an audit row
- Optional: add explicit server log lines showing prompt_tokens, completion_tokens, latency, and runId.
- No changes needed to database schema (already migrated).

## Acceptance Criteria
- Running deep analysis returns populated:
  - executiveSummary, keyFindings[], narrative
  - strengths[], weaknesses[], opportunities[], risks[]
  - acquisitionInterest, financialHealth (1–10), growthPotential, marketPosition
  - audit with tokens, cost, latency
- GET `/api/analyzed-companies` shows these fields non-null for new runs.
- UI at `/dashboard?page=ai-insights` renders the cards with real content.
- No 400 errors from OpenAI; latency and token usage logged and saved.

## Repro Steps After Fix
1) Start server: `cd frontend && npx tsx server/enhanced-server.ts`
2) POST deep analysis:
   ```bash
   curl -X POST http://localhost:3001/api/ai-analysis \
     -H "Content-Type: application/json" \
     -d '{"companies":[{"OrgNr":"5562642362","name":"Segers Fabriker Aktiebolag"}],"analysisType":"deep","initiatedBy":"codex-validation"}'
   ```
3) Verify output contains enhanced fields and audit.
4) GET `/api/analyzed-companies` and confirm the latest row includes enhanced fields populated.
5) Open UI: `http://localhost:8080/dashboard?page=ai-insights` and verify the cards are filled.

## Deliverables
- Edits to `frontend/server/enhanced-server.ts` fixing schema and model invocation.
- Brief note in code comments: why schema changed, link to OpenAI JSON schema response_format requirements.

## Question for Codex
If OpenAI's json_schema mode requirements changed recently, please align our schema to the current spec (include required fields, additionalProperties: false, and name). If the client library requires a different property name for the schema payload, adjust accordingly.

## Current File Structure
```
frontend/server/enhanced-server.ts  # Main file to fix
frontend/src/components/AIAnalysis.tsx  # UI component (minimal changes needed)
api/ai-analysis.ts  # Reference implementation (Vercel API)
```

## Database Schema (Already Applied)
```sql
-- Enhanced columns in ai_company_analysis table:
executive_summary TEXT,
key_findings JSONB,
narrative TEXT,
strengths JSONB,
weaknesses JSONB,
opportunities JSONB,
risks JSONB,
acquisition_interest TEXT,
financial_health_score NUMERIC,
growth_outlook TEXT,
market_position TEXT,
target_price_msek NUMERIC

-- Audit table:
ai_analysis_audit (
  id SERIAL PRIMARY KEY,
  analysis_id INTEGER REFERENCES ai_company_analysis(id),
  prompt_text TEXT,
  response_text TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd NUMERIC,
  latency_ms INTEGER,
  created_at TIMESTAMP
)
```

## Expected Schema Format
The `deepAnalysisSchema` should follow OpenAI's current JSON schema format:
```typescript
const deepAnalysisSchema = {
  name: "DeepCompanyAnalysis",
  schema: {
    type: "object",
    properties: {
      executive_summary: { type: "string", minLength: 50, maxLength: 200 },
      key_findings: { 
        type: "array", 
        items: { type: "string" },
        minItems: 3,
        maxItems: 6
      },
      // ... other properties
    },
    required: ["executive_summary", "key_findings", "narrative", "strengths", "weaknesses", "opportunities", "risks", "acquisition_interest", "financial_health_score", "growth_outlook", "market_position"],
    additionalProperties: false
  }
}
```

## Success Metrics
- ✅ No 400 errors from OpenAI API
- ✅ Enhanced fields populated in database
- ✅ UI displays rich analysis content
- ✅ Audit trail complete with cost tracking
- ✅ Swedish language maintained throughout

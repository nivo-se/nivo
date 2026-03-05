# AI Analysis workflow (AI-insikter)

How the two-step AI analysis (screening → deep) works and how to get it running in production.

## Flow

1. **Frontend (AIAnalysis.tsx)**  
   User picks a saved list, selects companies, and runs **screening** or **deep** analysis.

2. **API choice**  
   - If **`VITE_API_BASE_URL`** is set (e.g. production): requests go to the **backend** at `{VITE_API_BASE_URL}/api/ai-analysis`.  
   - If not set (e.g. local dev with same-origin): requests go to **same-origin** `/api/ai-analysis` (Vite proxy or Vercel serverless).

3. **Backend (Mac Mini)**  
   - **POST /api/ai-analysis**  
     - Body: `companies` (array), `analysisType` (`screening` | `deep`), optional `instructions`, `filters`, `initiatedBy`.  
     - Uses `backend/agentic_pipeline/ai_analysis.py` (OpenAI). Runs and results are persisted to Postgres (`acquisition_runs`, `company_analysis`).  
     - Returns `{ success, run, analysis: { results } }` for screening or `{ analysis: { companies } }` for deep.  
   - **GET /api/ai-analysis**  
     - `?history=1&limit=10` → returns `{ success, history, data }` from Postgres.  
     - `?runId=...` → returns run detail and analysis results from Postgres.

4. **Company data**  
   Companies come from **saved lists** (Postgres). The frontend sends the selected company objects in the POST body; the backend does not need to load them from Postgres for this flow.

## Production (deployed frontend)

- Set **VITE_API_BASE_URL** in Vercel to your Mac Mini API URL (e.g. `https://api.yourdomain.com`).  
- Ensure the backend has **OPENAI_API_KEY** and **CORS** allows the Vercel origin.  
- Then the “Kör screening” / “Kör djupanalys” actions call the Mac Mini; screening and deep results are returned and shown in the UI.  
- **History** and **load run by ID** read from Postgres (`acquisition_runs` + `company_analysis`); ensure these tables exist (migration `018_create_analysis_tables.sql`).

## If analysis fails in production

1. **No data / “Välj minst ett företag”**  
   - User must pick a **saved list** and then select at least one company.  
   - If lists are empty, create a list with companies first (e.g. from Universe or filters).

2. **Request never completes / 500**  
   - Check backend logs on the Mac Mini.  
   - Confirm **OPENAI_API_KEY** is set on the Mac Mini.  
   - Confirm **CORS** includes your Vercel domain so the browser allows the request.

3. **CORS or “Failed to fetch”**  
   - Backend: set `CORS_ORIGINS` (or `CORS_ALLOW_VERCEL_PREVIEWS`) so the frontend origin is allowed.  
   - Frontend: confirm `VITE_API_BASE_URL` is the correct Mac Mini API base (no trailing slash).

4. **Results not shown**  
   - Backend returns the shape the frontend expects (`analysis.results` for screening, `analysis.companies` for deep).  
   - If you see a 200 but empty results, check the backend response body and that the frontend is using the backend (network tab: request URL should be `{VITE_API_BASE_URL}/api/ai-analysis`).

## Files

- Frontend: `frontend/src/components/AIAnalysis.tsx` (uses `API_BASE` + `fetchWithAuth` for `/api/ai-analysis`).  
- Backend: `backend/api/ai_analysis_api.py` (POST/GET), `backend/agentic_pipeline/ai_analysis.py` (screening + deep).  
- Vercel serverless (fallback when no backend URL): `frontend/api/ai-analysis.ts` (different contract; screening/deep work best via backend).

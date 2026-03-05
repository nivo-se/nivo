# Scraper service vs backend

## Scraper service (admin-only)

- **Location:** `scraper/` (e.g. Allabolag 3-stage pipeline, staging DB, sessions).
- **Purpose:** Add new companies to the DB. Admin-only; not exposed to normal app users.
- **Status:** Not fully implemented yet.
- **External lookups:** Any website lookup (e.g. DuckDuckGo) or discovery of company URLs belongs **only** in the scraper service when/if implemented. No SerpAPI.

The main backend must **not** call or depend on the scraper service. The scraper is a separate tool for populating the database.

## Backend (main app)

- **Location:** `backend/` (API, RQ workers, analysis workflow).
- **Rule:** Do **not** mix in the scraper. No external lookups for “finding” company websites.
- **Data sources:**
  - **Only** data we already have: DB (companies, ai_profiles, financials, etc.) and prompt/input.
  - **Direct URL fetch** only when we already have a URL (e.g. `companies.homepage` or `ai_profiles.website`). Then we may fetch that URL’s content (e.g. for enrichment or stage2 research). No 3rd‑party search or scraper service calls.

So: **scraper service** = admin tool for adding companies; **backend** = DB + existing URLs + AI (e.g. OpenAI) for analytics.

# Company Identity & CRM Architecture

## 1. Recommended Company Identity Solution

**Chosen approach: Use `orgnr` as the canonical bridge (Option A – already in place)**

`deep_research.companies` already has `orgnr` with a unique constraint. No mapping table is needed.

- **public.companies**: `orgnr` (PK) – Universe, coverage, financials
- **deep_research.companies**: `id` (UUID PK), `orgnr` (unique) – Deep Research, CRM
- **Bridge**: `orgnr` links both. Lookup: `orgnr` → `deep_research.companies` → `id`

**Why not a mapping table (Option B)?**
- Redundant: `orgnr` is already in `deep_research.companies`
- Extra join on every lookup
- Sync complexity when both tables could drift

**Implementation:**
- View `public.company_identity` – FULL OUTER JOIN on orgnr for unified view
- Functions: `resolve_deep_research_company_id(orgnr)`, `resolve_orgnr_from_deep_research(uuid)`
- CRM accepts both UUID and orgnr in `GET /crm/company/:companyId`

---

## 2. SQL Migration Plan

**Migration: `032_company_identity_and_prospects_crm_link.sql`**

1. Create `public.company_identity` view (FULL OUTER JOIN public.companies ⟷ deep_research.companies on orgnr)
2. Ensure `public.prospects` table exists (CREATE TABLE IF NOT EXISTS)
3. Add `deep_research_company_id` (nullable FK) to prospects
4. Backfill prospects from `deep_research.companies` where `company_id = orgnr`
5. Add trigger to keep `deep_research_company_id` in sync on INSERT/UPDATE
6. Add helper functions for orgnr ⟷ UUID resolution

**Migration order:** Run after 026_crm_foundation, 027_crm_tracking_page_section.

**Script update:** `run_postgres_migrations.sh` now includes 026_crm_foundation, 027_crm_tracking_page_section, and 032.

---

## 3. Updated Table Relationships

```
public.companies (orgnr PK)
       │
       │ orgnr (canonical bridge)
       ▼
deep_research.companies (id UUID PK, orgnr UNIQUE)
       │
       ├── deep_research.deals (company_id → companies.id)
       ├── deep_research.contacts (company_id → companies.id)
       ├── deep_research.emails (deal_id, contact_id)
       └── ...

public.prospects (company_id = orgnr, deep_research_company_id → deep_research.companies.id)
       │
       └── public.prospect_notes (prospect_id → prospects.id)
```

**Single source of truth:** `orgnr` for public/Universe; `deep_research.companies.id` for CRM. Use `orgnr` to resolve between them.

---

## 4. Required Backend Changes

| Component | Change |
|-----------|--------|
| **Prospects API** | Include `deepResearchCompanyId` in response; trigger backfills new prospects |
| **CRM PostgresCrmDb** | Add `getCompanyByOrgnr(orgnr)` |
| **CRM routes** | `GET /crm/company/:companyId` accepts UUID or orgnr; resolves orgnr → UUID |
| **CrmCompanyListItem** | Add `orgnr` for frontend linking |
| **Prospect type** | Add `deepResearchCompanyId?: string \| null` |

---

## 5. Service Boundary Review (CRM: Express vs FastAPI)

### Current split
- **Express (frontend/server)**: CRM routes (`/crm/*`), tracking (`/track/*`), Gmail send
- **FastAPI (backend)**: Analysis, Deep Research, companies, prospects, universe, lists

### Option A: Keep CRM in Express

**Pros:**
- No migration risk; CRM already works
- Express shares Vite dev server; simpler local dev
- Gmail/Node ecosystem fits email tooling

**Cons:**
- Two backends to maintain
- Auth must be consistent across both
- Company resolution logic duplicated (now mitigated by shared DB + helpers)

### Option B: Migrate CRM to FastAPI

**Pros:**
- Single backend; one auth, one deployment
- Python/SQLAlchemy for deep_research models
- Easier to add CRM logic to analysis pipeline

**Cons:**
- Large migration; CRM routes, Gmail, tracking, AI draft generation
- Gmail API from Python (google-api-python-client) vs Node
- Frontend proxy config changes

### Recommendation

**Keep CRM in Express for now.** The identity layer (view, functions, prospects link) unifies data without moving code. Revisit migration when:
- CRM features grow significantly
- Gmail sync or other Python-native integrations are needed
- Single-backend deployment becomes a priority

---

## 6. Risks and Edge Cases

| Risk | Mitigation |
|------|------------|
| **deep_research.companies with tmp-* orgnr** | Excluded from view and `resolve_deep_research_company_id`; CRM lookup by orgnr returns 404 |
| **Prospects with orgnr not in deep_research** | `deep_research_company_id` stays NULL; backfill when company is created |
| **Migration runs before 026_crm_foundation** | Migration script order ensures 026_crm_foundation runs first |
| **prospects table created by API before migration** | Migration uses `ADD COLUMN IF NOT EXISTS`; safe |
| **Backward compatibility** | All existing CRM endpoints unchanged; new orgnr support is additive |

---

## 7. Validation Checklist

- [ ] Run `./scripts/run_postgres_migrations.sh` – no errors
- [ ] `GET /crm/company/:uuid` – returns overview (unchanged)
- [ ] `GET /crm/company/:orgnr` – returns overview when company exists in deep_research
- [ ] `GET /api/prospects` – includes `deepResearchCompanyId` when linked
- [ ] Create prospect with orgnr that exists in deep_research – trigger sets `deep_research_company_id`
- [ ] `SELECT * FROM company_identity` – returns rows

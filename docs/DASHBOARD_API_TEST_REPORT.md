# Dashboard API Test Report

**Date:** 2025-11-17 20:11:37   
**Base URL:** http://localhost:3001  
**Local DB:** data/new_schema_local.db (present)  
**Supabase credentials:** Loaded from env files  
**OpenAI key:** Loaded from env files

## Summary

| Result | Count |
|--------|------:|
| Passed | 25 |
| Failed | 0 |
| Skipped | 0 |
| Errors | 0 |
| **Total** | **25** |

## Passing Endpoints

- `/api/companies` (list/search/single fetch)
- `/api/analytics-local`
- `/api/analytics`
- `/api/ai-analysis` + results/detail/list/delete
- `/api/analysis-companies`
- `/api/valuation` create/preview/commit/get/select/advice
- Valuation assumptions CRUD
- Saved list CRUD

## Failed/Skipped Endpoints

_None_

## Next Steps

1. Keep Supabase data in sync using `scripts/sync_local_to_supabase.py` when local DB updates.
2. Add script to CI for regular dashboard API regression coverage.
3. Optionally seed deterministic test orgnr set for faster runs.

## Artifacts

- Test config: `scripts/dashboard_api_test_config.json`
- Test runner: `scripts/test_dashboard_apis.py`
- Raw results: `scripts/dashboard_api_test_results.json`

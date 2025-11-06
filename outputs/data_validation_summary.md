# Data Readiness Verification Summary

## Datasets
- `job50`: 151e5a04-14f6-48db-843e-9dad22f371d0 (Revenue 50–100 MSEK)
- `job100`: af674a42-4859-4e15-a641-9da834ddbb09 (Revenue 100–200 MSEK)
- `legacy`: de2cea99-ce04-4fce-bc15-695c672e4c22 (Revenue 50–200 MSEK, earlier full-range run)

## Coverage & Counts
| Dataset | Companies | Company IDs | Financial Records | Notes |
|---------|-----------|-------------|-------------------|-------|
| job50 | 8 663 | 8 663 | 42 324 | OC Bygg AB (orgnr 5568686835) now flagged as `id_not_found` with placeholder company_id |
| job100 | 4 947 | 4 947 | 24 290 | Complete coverage |
| Combined (job50 ∪ job100) | **13 610** | **13 610** | **66 614** | Matches Allabolag count for 50–200 MSEK (13 610) |
| legacy (old full-range job) | 10 000 | 9 998 | 48 947 | Previous dataset truncated at Allabolag limit |

### Duplicate Check (job50 vs job100)
```
Overlap (orgnr) between job50 and job100: 0
```

### Company ID Edge Case
- Orgnr `5568686835` (OC Bygg AB) lacked an Allabolag ID. We inserted a manual row in `staging_company_ids` with `company_id = 'NOT_FOUND_5568686835'` and status `id_not_found` so the ETL can retain the company while clearly flagging the gap.

## Financial Coverage
- Both new jobs fetched the latest financial year per company and stored the raw JSON payload (`raw_data`).
- Combined financial record count exceeds the legacy job by **17 667** records, eliminating the earlier 10k-company ceiling.

## Conclusion
- New jobs provide complete 50–200 MSEK coverage without overlap.
- Data is ready for schema migration once the single missing company ID is addressed/flagged.


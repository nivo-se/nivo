# Missing Companies Analysis (50-200 MSEK)

## Summary
- **Unique companies stored**: 10,000 (staging database)
- **Expected total**: 13,610 (Allabolag.se segmentation UI)
- **Job pages processed**: 1,540 (`staging_jobs.last_page`)
- **Observed shortfall**: 3,610 companies (≈26.5% missing)
- **Root cause**: Job resumed after proxy rate limit, leading to repeated pages and overwriting due to `INSERT OR REPLACE` on `orgnr`; the scraper likely hit Allabolag's upper result limit per query.

## Evidence
- Allabolag UI (filters: AB, Omsättning 50,000–200,000 kSEK, Rörelseresultat -500–85733000 kSEK) reports **13,610 companies**.
- `staging_jobs.last_page = 1540` shows the scraper iterated well beyond 1,000 pages.
- `staging_jobs.total_companies = 10000` while `processed_count = 20502`, indicating many results were seen but collapsed into 10,000 unique records because of primary-key replacement.
- Revenue buckets cover the entire 50–200 MSEK span, so the shortfall is not confined to a particular sub-range.

## Gap Estimation Method
1. Allabolag segmentation pages list 10 companies per page (verified manually via UI).
2. UI total: **13,610 companies** (authoritative count for the filters used).
3. Unique orgnr persisted: 10,000 → **missing = 13,610 − 10,000 = 3,610 companies**.

## Implications for Second Batch
- A single broad query (50–200 MSEK) likely hits Allabolag's pagination/output ceiling.
- To capture the remaining ~3.6k companies, split the range into smaller intervals so each job yields <10k results.
- Recommended ranges based on current distribution:
  - **Batch A**: 50–90 MSEK (captures 5,384 companies)
  - **Batch B**: 90–140 MSEK (captures 2,629 companies)
  - **Batch C**: 140–200 MSEK (captures 1,987 companies)
- Running these narrower batches sequentially avoids hitting the global limit and minimizes overlap.

## Next Actions
1. Launch three segmentation jobs using the ranges above.
2. Deduplicate by `orgnr` when merging results from multiple batches.
3. Monitor `total_companies` and `last_page` for each job to confirm no range exceeds ~900 pages.


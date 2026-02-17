# Postgres Integrity Audit Report

**Generated:** 2026-02-17T20:23:43.421237+00:00
**Database:** postgresql://nivo:***@localhost:5433/nivo

## Row counts

| Table | Count |
|-------|-------|
| companies | 13610 |
| financials | 66130 |
| company_kpis | 13610 |
| ai_profiles | 85 |

---

## 1. Duplicate checks

**Status:** ✅ PASS

| Table | Key | Duplicate groups | Top offenders |
|-------|-----|------------------|---------------|
| companies | orgnr | 0 | — |
| company_kpis | orgnr | 0 | — |
| ai_profiles | org_number | 0 | — |
| financials | orgnr, year, period | 0 | — |

---

## 2. Orphan checks

**Status:** ✅ PASS

| Check | Count |
|-------|-------|
| financials.orgnr not in companies | 0 |
| company_kpis.orgnr not in companies | 0 |
| ai_profiles.org_number not in companies | 0 |
| saved_list_items.orgnr not in companies | 0 |
| company_analysis.orgnr not in companies | 0 |

---

## 3. Orgnr integrity

**Status:** ✅ PASS

- **companies.orgnr with non-digits:** 0

- **companies.orgnr with length ≠ 10:** 0

- **Normalization collisions** (same orgnr_norm, different raw values): 0 groups

---

## 4. KPI vs financials sampling

**Status:** ✅ PASS

- Sampled: 200 companies (max 200)
- Mismatches (abs diff > 1 AND rel diff > 0.5%%): 0
- Mismatch rate: 0.0%%

---

## 5. Coverage sanity

- coverage_metrics view exists: ✅
- has_homepage alignment mismatches (sample 500): 0

---

## 6. Performance sniff (EXPLAIN only)

**Universe base query:**
```
Limit  (cost=61420.83..61420.96 rows=50 width=15)
  ->  Sort  (cost=61420.83..61454.86 rows=13610 width=15)
        Sort Key: (((CASE WHEN ((c.homepage IS NOT NULL) AND (c.homepage <> ''::text)) THEN 1 ELSE 0 END + CASE WHEN (a.org_number IS NOT NULL) THEN 2 ELSE 0 END) + CASE WHEN ((SubPlan 1) >= 3) THEN 1 ELSE 0 END))
        ->  Hash Left Join  (cost=6.75..60968.72 rows=13610 width=15)
              Hash Cond: (c.orgnr = a.org_number)
              ->  Seq Scan on companies c  (cost=0.00..872.10 rows=13610 width=34)
              ->  Hash  (cost=5.78..5.78 rows=78 width=11)
                    ->  Seq Scan on ai_profiles a  (cost=0.00..5.78 rows=78 width=11)
              SubPlan 1
                ->  Aggregate  (cost=4.39..4.40 rows=1 width=8)
                      ->  Index Only Scan Backward using financials_orgnr_year_idx on financials f  (cost=0.29..4.38 rows=5 width=4)
                            Index Cond: (orgnr = c.orgnr)
```

**Financials drilldown:**
```
Limit  (cost=0.29..15.39 rows=5 width=1321)
  ->  Index Scan using financials_orgnr_year_idx on financials  (cost=0.29..15.39 rows=5 width=1321)
        Index Cond: (orgnr = '5561377564'::text)
```

---

## Summary

| Overall | **PASS** |

- **PASS:** All critical checks pass; mismatch/orphans under thresholds.
- **WARN:** Minor issues (orphans present but <0.1%%; mismatch 2–10%%).
- **FAIL:** Duplicates on core keys, or orphans >0.1%%, or mismatch >10%%, or orgnr normalization collisions.

---

## How to run

```
python3 scripts/audit_postgres_integrity.py
```

**Exit codes:**
- `0` = PASS (no blocking issues)
- `1` = WARN (non-blocking issues)
- `2` = FAIL (blocking issues)

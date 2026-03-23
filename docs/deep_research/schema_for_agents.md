# Universe / screening schema for agents (Phase B)

This catalog supports **structured `FilterItem` rules** proposed by an LLM and validated by `POST /api/screening/validate-filters` before human approval.

## Core idea

- **PostgreSQL is source of truth.** Filters compile to SQL fragments on `coverage_metrics` (see `backend/api/universe.py` `FILTER_FIELDS`).
- **Allowed fields** match `FILTER_FIELDS` keys: `revenue_latest`, `employees_latest`, `nace_codes`, `segment_names`, `name`, scoring fields, etc.
- **Operators** depend on `type`: for numbers use `>=`, `<=`, `between`, `=`; for `nace_codes` use `excludes_prefixes` with `type: "nace"` and `value: ["49","64",…]`.
- **Revenue** values are **SEK** (not MSEK). Example floor: `{"field":"revenue_latest","op":">=","value":50000000,"type":"number"}`.

## Main relations (logical)

| Logical source | Role |
|----------------|------|
| `public.companies` | `orgnr` PK, `company_name`, `nace_codes` (JSON array of strings) |
| Coverage / metrics layer | Exposed as `cm` in universe SQL — typically `coverage_metrics` or merged view supplying `revenue_latest`, `employees_latest`, `nace_codes`, `segment_names`, profile scores |
| `screening_profiles` / `screening_profile_versions` | Versioned mandate config, weights, `exclusion_rules` merged at query time when `profileId` is set |

## Campaign persistence

| Table | Role |
|-------|------|
| `screening_campaigns` | Run metadata, `params_json` (filters, `layer0Limit`, `maxUniverseCandidates`, optional `scoreWeights`) |
| `screening_campaign_candidates` | Per org: `layer0_rank`, `profile_weighted_score`, `relevance_*`, `fit_*`, `combined_score`, `final_rank` |
| `screening_campaign_stages` | Stage status: `layer0`, `layer1`, `layer2`, `layer3` |

## References

- Filter taxonomy: `FILTER_TAXONOMY` in `backend/api/universe.py`
- Orchestrator stages: `docs/deep_research/SCREENING_ORCHESTRATOR_SPEC.md`

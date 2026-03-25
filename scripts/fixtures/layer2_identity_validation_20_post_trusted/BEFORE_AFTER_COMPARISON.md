# Identity validation batch — before / after `trusted_identity`

| | **Before (stricter only)** | **After (stricter + trusted_identity + entity mismatch)** |
|---|---------------------------|----------------------------------------------------------|
| **Artifacts** | `layer2_identity_validation_20_stricter/layer2_results_20260324T170027Z.jsonl` | `layer2_identity_validation_20_post_trusted/layer2_results_20260324T192124Z.jsonl` |
| **Run date** | 2026-03-24 (earlier) | 2026-03-24 |

## Headline metrics (n = 20)

| Metric | Before | After |
|--------|--------|-------|
| **Wrong first-party domain rate** (rank #1 `likely_first_party_domains` clearly not the target legal entity) | **1 / 20** (Cramo → `innofactor.com`) | **0 / 20** (Cramo → `cramo.se`; entity-mismatch drops e.g. crunchbase, sweden.se) |
| **`homepage_used` non-empty** | **9** | **19** |
| **`layer2_identity_confidence_low` true** | **11** | **1** |
| **`layer2_trusted_identity` true** | *field absent* (N/A) | **19** (all except SCA) |

## False negatives — `expected_class == good` (first 15 rows in `layer2_batch_40.csv`)

“False negative” = strong product story expected but **`is_fit_for_nivo` false** or clearly suppressed by identity (empty `homepage_used` + identity_low + low fit).

| Company | Before | After |
|---------|--------|-------|
| Quadpak | not fit, identity_low, no `homepage_used` | **fit**, identity ok, `homepage_used` quadpak.se |
| Elekta | not fit, identity_low, no `homepage_used` | **fit**, identity ok, `homepage_used` elekta.com |
| Sandvik | not fit, identity_low, no `homepage_used` | **fit**, identity ok, `homepage_used` home.sandvik |
| SCA | not fit, identity_low, no `homepage_used` | **still** not fit, identity_low, no `homepage_used` (`layer2_trusted_identity` **false**) |
| Others (good) | Mostly recovered already in stricter run | Stable or improved (e.g. Fladen / Nordiska / Mille Notti regain PAGE + higher fit_confidence) |

**Remaining large-cap gap:** **SCA Forest Products AB** — `sca.com` is correct in ranking, but **`domain_has_brand_keyword_match` does not treat “SCA” as a ≥4-char token**, so trusted identity does not apply the same way as for “Elekta”/“Sandvik”; still **identity_low** and no canonical homepage. This is **not** a new wrong-domain promotion; it is a **known lexical edge case** for very short brand tokens.

## New wrong-domain promotions (canonical / rank #1)

**None identified** in this run versus the stricter baseline:

- No recurrence of directory / vendor homepages as `homepage_used` (e.g. northdata, globaldata, gnosjoregion, tribotec, qimtek, mfn, mynewsdesk, fraktlogistik).
- **Cramo** fixed: top cluster **`cramo.se`** (was `innofactor.com`).

**Note:** `expected_class == maybe` rows (e.g. Loomis, Bring) show **classifier** changes (e.g. Loomis `is_fit` true in after vs false before); that reflects LLM + evidence text, not a new wrong **domain** pick.

## Tavily / retrieval

After run uses fewer secondary queries on many rows (trusted primary path); counts vary by row. See per-row `tavily_queries_run` in JSONL.

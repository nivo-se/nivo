# Layer 2 batch-40 summary

- Input: `scripts/fixtures/layer2_batch_40.csv`
- Results: `layer2_results_20260324T111611Z.jsonl`
- Review table: `layer2_batch_40_review_table.csv`

## Strict scorecard (expected **good** vs **bad** only)
- n_good=14, n_bad=14, n_maybe=12 (maybe excluded from accuracy)

### Model `is_fit_for_nivo`
- **Correct accepts**: 11
- **Correct rejects**: 14
- **False accepts** (bad + fit): 0
- **False rejects** (good + not fit): 3

### After hard semantic override (pre-blend)
Veto uplift if: hospitality OR generic_distributor OR (construction_install AND installer). Thin gate: `pages_fetched_count==0` → no uplift.
- **Correct accepts** (good + post_override_fit): 11
- **Correct rejects** (bad + not post_override_fit): 14
- **False accepts** (bad + post_override_fit): 0
- **False rejects** (good + not post_override_fit): 3

### False accepts after override (bad + would still uplift)
- (none)

## False accepts — model only (expected bad)
- (none)

## False rejects — model only (expected good)
- 5562146018 Fladen Fishing Aktiebolag
- 5565636353 AB Poly-Produkter
- 5560000841 Atlas Copco AB

## False rejects after override (expected good)
- 5562146018 Fladen Fishing Aktiebolag
- 5565636353 AB Poly-Produkter
- 5560000841 Atlas Copco AB

## Maybe bucket
- n_maybe=12; model **accept** on 2 (manual review: Dustin, Kryddhuset, etc.).

## Tavily
- `tavily_used=true`: **9** / 40 (dead/thin/failed home paths per logs).

## Recommendation
**Ready for ~200** with QA: 0 false accepts on labeled bad; 3 false rejects on labeled good (retrieval/thinness, not schema). Optional **prompt-only** pass for industrial OEM short homepages; fix **Poly** homepage in source data.
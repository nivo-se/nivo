# Runbook: First real screening profile across the full Universe

Use this runbook to run the first Layer 1 screening profile on the full ~13k company universe with the existing implementation. No new features or redesigns.

---

## Prerequisites

- Backend running with **Postgres** (`DATABASE_SOURCE=postgres`). Screening profiles and profile-weighted Universe query require Postgres.
- Toolkit: `profile_learning` package and CLI available (run from repo root).
- One of: (a) an existing `approved_comparison.json` you have already reviewed, or (b) the example file to use as-is for a test run.

---

## 1. Prepare the first approved comparison file

**Option A — Use the example as-is (test run)**  
Copy the example into a working location:

```bash
cp docs/deep_research/profile_learning/examples/approved_comparison.json /path/to/your/approved_comparison.json
```

**Option B — Start from example and edit**  
1. Copy `docs/deep_research/profile_learning/examples/approved_comparison.json` to your working path.  
2. Edit in place: set `batch_id`, `approved_by`, `approved_at`, and adjust `approved_variables`, `approved_weights`, `approved_archetypes`, `approved_exclusion_rules` as needed.  
3. Validate before generating config:

```bash
python3 -m profile_learning.cli validate-approved /path/to/your/approved_comparison.json
```

Expect: `OK: approved comparison valid`. Fix any reported errors.

**Exact file you need:** One JSON file with at least: `batch_id`, `approved_by`, `approved_at`, `approved_variables`, `approved_weights`, `approved_archetypes`, `approved_exclusion_rules`. Schema and allowed fields are in `docs/deep_research/profile_learning/MVP_FILE_SCHEMAS_AND_TEMPLATES.md`.

---

## 2. Generate config_json

From repo root:

```bash
python3 -m profile_learning.cli generate-config /path/to/your/approved_comparison.json --output-dir /path/to/output
```

**Output files (in `--output-dir`):**

- `config_json.json` — use this as the profile version config in step 4.
- `mapping_rejection_log.json` — if non-empty, fix the approved file and re-run; only use config when the log is empty or you have accepted the listed rejections.

**If you omit `--output-dir`:** Both files are written next to `approved_comparison.json`.

**Check:** Open `config_json.json`. It must have top-level keys: `variables`, `weights`, `archetypes`, `exclusion_rules`.

---

## 3. Create a screening profile

**API:** `POST /api/screening/profiles`

**Headers:** Same as rest of app (e.g. `Content-Type: application/json`; auth if `REQUIRE_AUTH` is on).

**Body:**

```json
{
  "name": "First screening profile",
  "description": "Layer 1 profile from profile-learning batch (runbook)",
  "scope": "private"
}
```

**Response:** JSON with profile `id` (UUID). Example: `{"id": "abc-...", "name": "First screening profile", ...}`.  
**Save the profile `id`** — you need it for the next step.

**cURL example (replace BASE_URL and optional auth):**

```bash
curl -s -X POST "${BASE_URL}/api/screening/profiles" \
  -H "Content-Type: application/json" \
  -d '{"name":"First screening profile","description":"Layer 1 profile from profile-learning batch","scope":"private"}'
```

---

## 4. Create a profile version (attach config)

**API:** `POST /api/screening/profiles/{profile_id}/versions`

**Body:** The generated `config_json.json` must be sent as the `config` field:

```json
{
  "config": <paste full contents of config_json.json>
}
```

**Response:** JSON with `id` (version UUID), `version` (integer, e.g. 1), `config`, `isActive`: false.  
**Save the version `id`** — you need it to activate and optionally to query by version.

**cURL example (replace PROFILE_ID and paste config):**

```bash
PROFILE_ID="<from step 3>"
CONFIG_JSON=$(cat /path/to/output/config_json.json)
curl -s -X POST "${BASE_URL}/api/screening/profiles/${PROFILE_ID}/versions" \
  -H "Content-Type: application/json" \
  -d "{\"config\": ${CONFIG_JSON}}"
```

---

## 5. Activate the version

**API:** `PUT /api/screening/profiles/{profile_id}/versions/{version_id}/activate`

No body. This sets the given version as the active one for the profile (and deactivates any other version).

**cURL example:**

```bash
PROFILE_ID="<from step 3>"
VERSION_ID="<from step 4>"
curl -s -X PUT "${BASE_URL}/api/screening/profiles/${PROFILE_ID}/versions/${VERSION_ID}/activate"
```

**Response:** JSON with the version and `isActive`: true.

---

## 6. Query Universe with the profile

**API:** `POST /api/universe/query`

**Body (minimal — full universe, ranked by profile score):**

```json
{
  "filters": [],
  "sort": { "by": "profile_weighted_score", "dir": "desc" },
  "limit": 100,
  "offset": 0,
  "profileId": "<profile_id from step 3>"
}
```

- **profileId** — required to apply this profile’s exclusion rules and profile-weighted score.  
- **profileVersionId** — optional; if omitted, the **active** version is used.  
- **sort.by** — use `profile_weighted_score` and `dir`: `desc` to get top-ranked companies first.  
- **limit** / **offset** — use to page (e.g. limit 100, offset 0 then 100, 200, …).

**Response:** `{ "rows": [...], "total": N }`. Each row can include `profile_weighted_score`, `archetype_code`, and the usual Universe fields (`orgnr`, `name`, `revenue_latest`, `ebitda_margin_latest`, `revenue_cagr_3y`, etc.). Companies excluded by the profile’s exclusion rules do not appear in `rows`.

**cURL example:**

```bash
PROFILE_ID="<from step 3>"
curl -s -X POST "${BASE_URL}/api/universe/query" \
  -H "Content-Type: application/json" \
  -d "{\"filters\":[],\"sort\":{\"by\":\"profile_weighted_score\",\"dir\":\"desc\"},\"limit\":100,\"offset\":0,\"profileId\":\"${PROFILE_ID}\"}"
```

**In the UI:** On the Universe page, select the screening profile (and optionally the version). Ensure sort is by profile-weighted score descending so the ranked list matches the runbook.

---

## 7. Review the ranked output

- **Total count:** Compare `total` with and without the profile (same filters). Fewer results means exclusions are applied.  
- **Top rows:** Check that the first rows have `profile_weighted_score` present and that high scores align with your expectations (e.g. growth, margin, scale).  
- **Archetypes:** If your config defines archetypes, check that `archetype_code` appears on rows where you expect it (e.g. `growth_platform`, `stable_cashflow`).  
- **Exclusions:** Spot-check a few companies that you know should be excluded (e.g. very low margin, negative growth); they should not appear when the profile is applied.  
- **Data quality:** For top-ranked companies, confirm that key fields (`revenue_latest`, `ebitda_margin_latest`, `revenue_cagr_3y`) are non-null where possible so the score is meaningful.

---

## 8. Five most likely failure points

1. **Postgres not used** — Screening profiles and profile-weighted Universe query only work when `DATABASE_SOURCE=postgres`. If the backend uses another DB, profile creation or Universe query with `profileId` can fail or be no-ops.  
2. **Wrong config shape** — The body of `POST .../versions` must be `{"config": <object>}` where `<object>` is exactly the generated `config_json` (variables, weights, archetypes, exclusion_rules). Extra keys at the top level (e.g. a mistaken paste of the approved file) can cause errors or unexpected behavior.  
3. **Using version id as profile id (or vice versa)** — Create profile → get **profile** `id`. Create version → get **version** `id`. Use **profile** `id` in `profileId` for the Universe query and in the activate URL; use **version** `id` only in the activate URL and in optional `profileVersionId`.  
4. **Not sorting by profile score** — If you sort by something else (e.g. `revenue_latest`), the list is not “ranked by the profile”. Use `sort.by`: `profile_weighted_score`, `dir`: `desc` to review the profile’s ranking.  
5. **Auth / CORS** — If the app requires auth, all screening and universe calls must use the same auth (cookie or header). Wrong or missing auth leads to 401 and empty or failed responses.

---

*Runbook version: 1.0. Uses existing Layer 1 screening API, Universe query API, and profile-learning toolkit only.*

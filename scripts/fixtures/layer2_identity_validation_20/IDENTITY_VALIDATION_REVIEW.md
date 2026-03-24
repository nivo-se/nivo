# Layer 2 multi-source identity validation (20 companies)

**Run:** `layer2_results_20260324T151850Z.jsonl`  
**Input:** `scripts/fixtures/layer2_batch_40.csv` (first 20 rows)  
**Mode:** `multi_source` (4 Tavily queries per company)

Artifacts: same directory — `layer2_manifest_20260324T151850Z.json`, CSV companion.

---

## Per-company snapshot

| orgnr | company | top cluster domain (rank #1) | `likely_first_party_domains` | `layer2_identity_confidence_low` | `homepage_used` | `pages_fetched` | `tavily_queries_run` | Classification (summary) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5564551900 | Texstar AB | texstar.se | texstar.se, teamworkwear.se | false | teamworkwear.se | 4 | 4 | fit, 0.75 — workwear / group |
| 5562146018 | Fladen Fishing | fladenfishing.se | fladenfishing.se | false | fladenfishing.se | 3 | 4 | fit, 0.85 — fishing products |
| 5591098214 | Nordiska Kök AB | nordiskakok.com | nordiskakok.com, nordiskakok.se | **true** | nordiskakok.se | 3 | 4 | fit, 0.45 — bespoke kitchens |
| 5564282738 | Mille Notti AB | millenotti.se | millenotti.se, mille-notti.com | **true** | mille-notti.com | 4 | 4 | fit, 0.4 — textiles / subsidiary note |
| 5565636353 | AB Poly-Produkter | polyprodukter.se | polyprodukter.se, poly.se | **true** | poly.se | 4 | 4 | fit, 0.45 — ropes / two brands |
| 5566816632 | Quadpak AB | quadpak.se | quadpak.se, **northdata.com** | false | **northdata.com** | 4 | 4 | fit, 0.75 — packaging |
| 5565281427 | Thule Sweden AB | thule.com | thule.com, **gnosjoregion.se** | false | **gnosjoregion.se** | 4 | 4 | fit, 0.85 — Thule products |
| 5560000841 | Atlas Copco AB | atlascopco.com | atlascopco.com, **imit.se** | false | **imit.se** | 3 | 4 | fit, 0.85 — industrial |
| 5560069463 | Alfa Laval Corporate AB | alfalaval.com | alfalaval.com, alfalaval.se | false | alfalaval.se | 4 | 4 | fit, 0.85 — heat transfer / fluids |
| 5560296968 | Getinge AB | getinge.com | getinge.com, carlbennetab.se | false | carlbennetab.se | 4 | 4 | fit, 0.85 — medtech |
| 5560168616 | Elekta AB | elekta.com | elekta.com, **globaldata.com** | false | **globaldata.com** | 4 | 4 | fit, 0.85 — oncology |
| 5567370431 | SCA Forest Products AB | sca.com | sca.com, **essity.se** | false | **essity.se** | 4 | 4 | fit, 0.85 — forest / pulp |
| 5560003468 | Volvo AB | volvogroup.com | volvogroup.com, volvoce.com | false | volvoce.com | 4 | 4 | fit, 0.85 — trucks / CE |
| 5560197460 | Sandvik AB | home.sandvik | home.sandvik, **tribotec.se** | false | **tribotec.se** | 4 | 4 | fit, 0.85 — engineering |
| 5564968039 | Formenta AB | formenta.se | formenta.se, **qimtek.se** | false | **qimtek.se** | 4 | 4 | fit, 0.75 — outdoor / flagpoles |
| 5564169786 | KRYDDHUSET I LJUNG | kryddhuset.se | kryddhuset.se, **mfn.se** | false | **mfn.se** path | 4 | 4 | not fit, 0.2 — spices / subsidiary |
| 5560337136 | Cramo AB | cramo.se | cramo.se, **mynewsdesk.com** | false | **mynewsdesk.com** | 4 | 4 | not fit, 0.2 — rental / service |
| 5561210560 | Loomis Sverige AB | loomis.se | loomis.se, loomis.com | false | loomis.com | 4 | 4 | not fit, 0.25 — cash handling |
| 5560444153 | Bring Sverige AB | bring.se | bring.se, **fraktlogistik.se** | false | **fraktlogistik.se** | 4 | 4 | not fit, 0.2 — logistics |
| 5560957432 | Telenor Sverige AB | telenor.se | telenor.se, telenor.com | false | telenor.com | 4 | 4 | not fit, 0.2 — telecom |

**Domain cluster ranking (scores):** see `domain_cluster_ranking` on each JSONL line (top 5 clusters: `score` + `hits`).

---

## Evaluation vs goals

### 1. Did the top clustered domain correspond to the real company site?

**Mostly yes for rank #1.** For this batch, the highest-scoring cluster is almost always the correct consumer-facing or corporate brand domain (e.g. `fladenfishing.se`, `nordiskakok.com`, `quadpak.se`, `thule.com`, `atlascopco.com`, `getinge.com`, `elekta.com`, `sca.com`, `volvogroup.com`, `home.sandvik`, `formenta.se`, `kryddhuset.se`, `cramo.se`, `bring.se`, `telenor.se`).

**Caveat — `homepage_used`:** Several runs picked a **secondary URL** as `homepage_used` even when rank #1 was correct (e.g. Thule → `gnosjoregion.se`, Atlas Copco → `imit.se`, Elekta → `globaldata.com`, SCA → `essity.se`, Sandvik → `tribotec.se`, Formenta → `qimtek.se`, Kryddhuset → `mfn.se`, Cramo → `mynewsdesk.com`, Bring → `fraktlogistik.se`, Quadpak → `northdata.com`). Those choices are **not** the same as “wrong top cluster”; they indicate a **post-cluster “primary page” selection** issue worth tightening (without changing Layer 1 or adding providers).

Texstar used `teamworkwear.se` as `homepage_used` while cluster #1 was `texstar.se` — plausible group relationship but worth human check.

---

### 2. Did `layer2_identity_confidence_low` trigger when identity was ambiguous?

**Partially.** It was **true** where `.com` / `.se` / alternate brand domains were close (Nordiska Kök, Mille Notti, AB Poly-Produkter) — good.

It remained **false** in cases where identity is arguably ambiguous or polluted at the **second** first-party slot or **`homepage_used`** (e.g. Quadpak + `northdata.com`, Thule + regional site, SCA + `essity.se`, mixed brand vs directory). So: **good for dual-homepage / TLD ambiguity**, **not** a full signal for “wrong secondary domain” or “directory as homepage”.

---

### 3. Did any junk / blocklist-style domain still become a `likely_first_party_domain`?

**Yes — several.** Non-operating or third-party domains appeared in `likely_first_party_domains` or drove `homepage_used`:

| Domain | Role | Rows |
| --- | --- | --- |
| northdata.com | Company database | Quadpak |
| gnosjoregion.se | Regional portal | Thule |
| imit.se | Third-party / investor-style | Atlas Copco |
| globaldata.com | Research vendor | Elekta |
| essity.se | **Different listed group** than SCA | SCA |
| tribotec.se | Appears distributor / industry | Sandvik |
| qimtek.se | Supplier / sourcing portal | Formenta |
| mfn.se | Financial media | Kryddhuset |
| mynewsdesk.com | PR platform | Cramo |
| fraktlogistik.se | Industry / logistics content | Bring |

**Rankings** also surfaced `rocketreach.co`, `ratsit.se`, `largestcompanies.se`, etc., usually below #1 — acceptable for diagnostics if they never get fetched as “first party”; the problem is when they **graduate** to `likely_first_party_domains` or **`homepage_used`**.

---

### 4. Did the classifier use the right company evidence?

**Mixed.** When `evidence_urls` included strong first-party pages (many rows), summaries and bullets tracked them well.

Where **`homepage_used` was wrong**, the model sometimes still cited good pages from `evidence_urls` (e.g. Thule still referenced `thule.com` content; Cramo referenced `cramo.se`). In other cases the narrative leaned on the **wrong** homepage (e.g. SCA + Essity, Elekta + GlobalData, Kryddhuset + MFN), which **hurts** traceability and fit reasoning.

**Notable:** KRYDDHUSET and Cramo got **low fit** for business-model reasons (subsidiary, rental/service); evidence quality issues on those rows are still a separate problem from fit.

---

## Bottom line

- **Multi-source clustering:** Rank #1 domain is **mostly aligned** with the real brand/site for this sample.
- **`layer2_identity_confidence_low`:** **Useful** for TLD / dual-brand ambiguity; **does not** flag directory / wrong-second-company picks.
- **Leaks:** **Yes** — several blocklist-style or wrong-company domains appear as **`likely_first_party_domains`** and/or **`homepage_used`**; this is the main follow-up for the identity engine (selection and filtering after clustering), without Layer 1 changes or new providers.
- **Classifier:** Generally **consistent with fetched URLs** when first-party URLs dominate the pack; **degrades** when `homepage_used` points at aggregators or the wrong corporate entity.

---

## Files

| File | Purpose |
| --- | --- |
| `layer2_results_20260324T151850Z.jsonl` | Full row payloads including `domain_cluster_ranking`, identity flags, retrieval counters |
| `layer2_results_20260324T151850Z.csv` | Tabular export |
| `layer2_manifest_20260324T151850Z.json` | Run metadata |

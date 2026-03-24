# Layer 2 identity validation — stricter policy (20 companies)

**Run:** `layer2_results_20260324T170027Z.jsonl`  
**Input:** `scripts/fixtures/layer2_batch_40.csv` (first 20 rows)  
**Mode:** `multi_source` (1–2 Tavily searches per company; stricter `homepage_used` + identity gates vs `layer2_identity_validation_20` run `20260324T151850Z`).

---

## Per-row snapshot

| orgnr | company | `likely_first_party_domains` | `layer2_identity_confidence_low` | `homepage_used` | `fit_confidence` | `is_fit_for_nivo` |
| --- | --- | --- | --- | --- | --- | --- |
| 5564551900 | Texstar AB | texstar.se | false | https://texstar.se | 0.8 | true |
| 5562146018 | Fladen Fishing | fladenfishing.se | true | (empty) | 0.4 | true |
| 5591098214 | Nordiska Kök AB | nordiskakok.com | true | (empty) | 0.4 | true |
| 5564282738 | Mille Notti AB | mille-notti.com | true | (empty) | 0.4 | true |
| 5565636353 | AB Poly-Produkter | polyprodukter.se, polyropes.eu | false | https://www.polyprodukter.se | 0.8 | true |
| 5566816632 | Quadpak AB | quadpak.se | true | (empty) | 0.4 | false |
| 5565281427 | Thule Sweden AB | thule.com, thulegroup.com | false | https://www.thule.com/sv-se | 0.8 | true |
| 5560000841 | Atlas Copco AB | atlascopco.com, atlascopcogroup.com | false | https://www.atlascopco.com | 0.9 | true |
| 5560069463 | Alfa Laval Corporate AB | alfalaval.com, alfalaval.us | false | https://www.alfalaval.com | 0.9 | true |
| 5560296968 | Getinge AB | getinge.com | false | https://www.getinge.com/se | 0.8 | true |
| 5560168616 | Elekta AB | elekta.com | true | (empty) | 0.4 | false |
| 5567370431 | SCA Forest Products AB | sca.com | true | (empty) | 0.4 | false |
| 5560003468 | Volvo AB | volvogroup.com, volvocars.com | false | https://www.volvogroup.com/en | 0.8 | true |
| 5560197460 | Sandvik AB | home.sandvik | true | (empty) | 0.4 | false |
| 5564968039 | Formenta AB | formenta.se, formenta.ca | true | (empty) | 0.4 | false |
| 5564169786 | KRYDDHUSET I LJUNG | kryddhuset.se, kryddhusetiljung.se | true | (empty) | 0.4 | false |
| 5560337136 | Cramo AB | **innofactor.com** | true | (empty) | 0.4 | false |
| 5561210560 | Loomis Sverige AB | loomis.com | false | https://www.loomis.com/en | 0.4 | false |
| 5560444153 | Bring Sverige AB | bring.se | true | (empty) | 0.4 | false |
| 5560957432 | Telenor Sverige AB | telenor.se, telenor.com | false | https://www.telenor.se | 0.25 | false |

---

## Summary metrics

1. **Wrong first-party domain rate (ranked #1 / first `likely_first_party_domains` vs known entity)**  
   - **1 / 20 (5%)**: **Cramo** — top cluster `innofactor.com` is incorrect; real operator site is `cramo.se` (Tavily/HTTP noise pushed a wrong domain to #1).  
   - All other rows: first listed domain is at least plausible for the legal entity or group brand.

2. **Rows with non-empty `homepage_used`**  
   - **9 / 20**: Texstar, Poly-Produkter, Thule, Atlas Copco, Alfa Laval, Getinge, Volvo, Loomis, Telenor.

3. **Rows with `layer2_identity_confidence_low == true`**  
   - **11 / 20**.

4. **Previously wrong `homepage_used` → now unresolved (empty) or clearly better** (vs `layer2_identity_validation_20/layer2_results_20260324T151850Z.csv`)  
   - **Unresolved (no canonical PAGE / empty `homepage_used`) where old run used a bad URL:** Quadpak (northdata), Elekta (globaldata), SCA (essity), Sandvik (tribotec), Formenta (qimtek), Kryddhuset (mfn path), Bring (fraktlogistik), plus several that were identity_low before but still had a PAGE on a weak path (Nordiska, Mille Notti, Fladen).  
   - **Fixed to a proper first-party URL (not empty):** Thule (was gnosjoregion.se → thule.com), Atlas Copco (was imit.se → atlascopco.com), Getinge (was carlbennetab.se → getinge.com), Texstar (was teamworkwear.se → texstar.se), AB Poly-Produkter (was poly.se → polyprodukter.se).  
   - **Telenor:** was telenor.com → now telenor.se (better match to “Sverige” entity).

5. **Good companies (`expected_class == good` in fixture) — classification still usable?**  
   - **Strong retention:** Texstar, Thule, Atlas Copco, Alfa Laval, Getinge, Volvo remain **fit** with **0.8–0.9** confidence and real PAGE evidence.  
   - **Tighter / snippet-only:** Fladen, Nordiska Kök, Mille Notti stay **fit** but **fit_confidence 0.4** with identity_low (no canonical PAGE).  
   - **Policy side effect:** Quadpak flipped to **not fit** (was fit); Elekta, SCA, Sandvik flipped to **not fit** with 0.4 — largely identity + prompt cap, not necessarily a worse *economic* read, but **screening signal is harsher** on those names without a verified homepage.

---

## Tavily usage note

`tavily_queries_run` is **1 or 2** per row in this run (not 4 — earlier fixture run used a different Tavily/caching configuration).

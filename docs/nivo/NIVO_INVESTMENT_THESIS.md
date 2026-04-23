# Nivo investment thesis (canonical)

**Last reviewed:** 2026-04-23  
**Owner:** Product / investment team (update when mandate changes)

This document is the **single human-readable source** for what Nivo looks for when screening Nordic companies and running research. Machine-facing config ([`backend/config/nivo_context.json`](../../backend/config/nivo_context.json)) and prompts should **align** with this file; bump `version` in `nivo_context.json` when you change material criteria.

---

## Who we are

Nivo is an **active owner** of small and mid-sized **Nordic** companies. We combine **institutional investment discipline** with **hands-on operational** work. The product in this repository supports **evidence-first** company research and sourcing — not marketing-style “intelligence platform” language (see [`AGENTS.md`](../../AGENTS.md)).

---

## What we typically look for (core band)

These ranges are **orientation**, not hard law; final judgment always combines **financials**, **business quality**, and **evidence** from research.

| Dimension | Typical range (illustrative) |
|-----------|------------------------------|
| Revenue (SEK) | ~50–250 M for “core” lower-mid themes; adjacent strategies may differ |
| Profitability | Sustainable EBITDA margin where the model supports reinvestment and improvement |
| Growth | Positive, defensible growth profile when the thesis requires it |
| Model | **Product-led**, **differentiated**, **B2B**-leaning businesses; **recurring or repeat** revenue is a plus when supported by facts |
| Geography | **Nordic** focus; international revenue is fine when clearly described |

Structured **strategy presets** (numeric bands and keywords) live in [`backend/config/investment_criteria.json`](../../backend/config/investment_criteria.json) — e.g. `core_thesis`, `tech_rollup`, `industrial_compounder`, `services_platform`.

---

## What we tend to deprioritise or challenge

Unless the evidence clearly supports an exception:

- Pure **project / installation** trades with no durable product or brand  
- **Generic distribution** with no moat  
- **Hotels, restaurants, property operators** as the core model (often outside scope)  
- **Shells, passive holdings, or fund-like** entities for **operational** buyouts  
- **Generic consulting** unless **productized** and scalable (e.g. clear software or IP)  

Screening classifiers in code express parts of this (see Layer 2 prompts under `backend/services/screening_layer2/`). SQL-level exclusions for the **universe / sourcing assistant** are documented in [`data/rag_context.md`](../../data/rag_context.md) (e.g. certain name/NACE patterns).

---

## How this ties to the product

- **Universe & filters:** Users refine **lists of companies** from internal data; filters must remain **explainable** (what was included/excluded and why).  
- **Deep research:** Outputs should stay **source-backed**; claims trace to evidence ([`AGENTS.md`](../../AGENTS.md)).  
- **External CRM (e.g. Attio):** Nivo may **push** curated company bundles **ad hoc**; Attio is the system of record for CRM objects — not this database read-back.

---

## Change control

1. Update **this** file with a short rationale in the same PR.  
2. Bump **`version`** and **`last_reviewed`** in `backend/config/nivo_context.json`.  
3. Align `investment_criteria.json` / RAG / prompts as needed, or document intentional drift.

---

## Related docs

- [`AGENTS.md`](../../AGENTS.md) — non-negotiables for implementation  
- [`docs/investor/nivo_team_investment_section.md`](../investor/nivo_team_investment_section.md) — team and execution narrative  
- [`data/rag_context.md`](../../data/rag_context.md) — sourcing assistant: allowed SQL fields and auto-exclusions

# Screening: granularity, head offices, and enrichment

## Problem

Layer 0 ranks on **financials + profile scores + SNI prefixes**. It does **not** know:

- Whether an org is a **group head office** vs an **operating subsidiary** (e.g. Epiroc vs Sandvik group entities, Ericsson HQ vs business units).
- Whether the listed **NACE** is the economically relevant activity for *your* mandate.

So you will still see large “obvious” names where the **legal entity** in Allabolag is not the investable unit.

## What we have in product now

- **SNI/NACE prefixes** to drop whole sections (transport, finance, …).
- **Click through** to `/company/:orgnr` to read the stored profile.
- **`excluded_from_analysis`** on campaign candidates — human flag for “skip in later stages” (stored in DB; downstream jobs should respect it).

## Next steps (recommended order)

### 1. **Corporate structure & role (highest leverage)**

- Ingest **Bolagsverket** (or equivalent) **group / subsidiary** links where available, or **manual parent_orgnr** on `companies`.
- Classify orgs as `role`: `operating` | `holding` | `head_office` | `unknown` (even a simple rules + review queue).
- Layer 0 or Layer 1: **prefer operating subsidiaries** or **down-rank** pure holdings / service companies unless the mandate says otherwise.

### 2. **Richer industry than a single SNI**

- Store **full SNI list** + **primary** + optional **mapped sector** (your taxonomy).
- Optional: **LLM-assisted** “economic activity one-liner” from annual report snippets (with citations), *after* deterministic filters.

### 3. **Tavily / web retrieval (use with discipline)**

- **Good for:** short factual checks (“Is this entity mainly a service company for the group?”), finding **official segment** names, recent restructuring.
- **Not a substitute for:** structured ownership, consolidated segment revenue, or investment judgement.
- **Pattern:** run Tavily (or existing `web_intel`) **only on the Layer 0 shortlist** or **only on rows flagged “uncertain”**, with **mandate + citations** per `AGENTS.md`.

### 4. **Screening pipeline contract**

- Layer 1+: read `excluded_from_analysis` and **drop** those orgnrs unless explicitly overridden.
- Optionally: second-pass **re-rank** using LLM “fit to mandate” with **deterministic gates** first (evidence-first).

## Summary

| Approach | Role |
|----------|------|
| SNI prefixes | Cheap, deterministic sector hygiene |
| Group / subsidiary data | Fixes “head office” noise at the source |
| Profile + exclusions in UI | Human loop before expensive stages |
| Tavily / LLM | Targeted enrichment + relevance, not primary sector truth |

See `SCREENING_ORCHESTRATOR_SPEC.md` for staged orchestration; align new fields with PostgreSQL as source of truth.

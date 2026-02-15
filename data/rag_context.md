# RAG Context: Nivo Sourcing Assistant

## ✅ Valid Fields (Used in SQL Filters)
Use these table aliases: `k` (company_kpis), `f` (financials subquery), `c` (companies).

**CRITICAL: Only use these exact columns. Do NOT create new columns or use non-existent fields.**

- `f.max_revenue_sek` (from financials subquery - use this for revenue filtering!)
- `k.avg_ebitda_margin` (NOTE: 5.0 = 5%, 15.0 = 15% - use for EBITDA margin filtering)
- `k.avg_net_margin` (NOTE: 10.0 = 10% - use for profitability filtering)
- `k.revenue_growth_yoy` (decimal 0.10 = 10% - use for growth filtering)
- `k.growth_bucket`: 'flat', 'moderate', 'high', 'declining' (use exact values)
- `k.profitability_bucket`: 'low', 'healthy', 'high', 'loss-making' (use exact values)
- `k.company_size_bucket`: 'small', 'medium', 'large' (use exact values)
- `c.nace_categories` (JSON string, use LIKE. NOTE: Categories are in Swedish, e.g. 'Dataprogrammering')
- `c.orgnr`
- `c.company_name`
- `c.segment_names` (JSON string, use LIKE for industry segments)

## 🧠 Business Logic
- EBITDA Margin = ebitda_sek / revenue_sek
- Growth = year-over-year revenue % change
- Strategic Fit: Combines margin, defensibility, market fragmentation, upside potential

## 🚫 Automatic Exclusions
These categories must ALWAYS be excluded, even if the user does not mention them:

- Real estate/property: `c.company_name ILIKE '%fastigheter%'`, `c.company_name ILIKE '%property%'`, `c.nace_categories LIKE '%fastighet%'`
- Fund/investment companies: `c.company_name ILIKE '%invest%'`, `'%fund%'`, `'%capital%'`, `c.nace_categories LIKE '%fond%'`, `'%holding%'`
- Consulting firms: `c.company_name ILIKE '%konsult%'`, `c.nace_categories LIKE '%consult%'`

Explain to the user in plain English that these groups were filtered out automatically.

## ⚠️ Do Not:
- Do not interpret “Nivo” as a company name to search. Ignore it unless it refers to an industry.
- Do not create fields like “improvement_bucket”, “potential”, or “super growth”. Use ONLY valid buckets (`growth_bucket`, `profitability_bucket`).
- Do not hallucinate industry segments. Use broad Swedish terms or LIKE '%term%'.
- Do not filter by "Strategic Fit". It is a calculated concept, not a SQL column.

## 🔍 Example Prompts & Translations
Prompt: “Find companies in the textile industry with 100–200M SEK turnover”
→ SQL: WHERE f.max_revenue_sek BETWEEN 100000000 AND 200000000 AND c.nace_categories LIKE '%textil%'

Prompt: “Show 10 companies with flat growth and strong profitability”
→ SQL: WHERE k.growth_bucket = 'flat' AND k.profitability_bucket = 'high' LIMIT 10

Prompt: "Find manufacturing firms with 5%+ EBITDA margins"
→ SQL: WHERE k.avg_ebitda_margin >= 5.0 AND (c.nace_categories LIKE '%tillverk%' OR c.nace_categories LIKE '%produktion%' OR c.segment_names LIKE '%manufacturing%')
**IMPORTANT**: For manufacturing, use '%tillverk%' (tillverkning = manufacturing) or '%produktion%' (production), NOT '%verk%' which is too broad and matches "verksamhet" (activity) in many non-manufacturing codes.

Prompt: "Find profitable companies"
→ SQL: WHERE k.profitability_bucket = 'healthy' OR k.profitability_bucket = 'high' OR k.avg_net_margin > 5.0

📝 Regardless of the prompt, remember that real estate/property, investment/fund, and consulting firms are excluded automatically—mention this in explanations.

## 🎯 Strategic Fit Criteria (used in deeper AI analysis)
- Stable margins (>5%)
- Product-led growth
- Fragmented market
- Room for digital or operational improvement
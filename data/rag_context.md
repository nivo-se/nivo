# RAG Context: Nivo Sourcing Assistant

## ✅ Valid Fields (Used in SQL Filters)
Use these table aliases: `m` (company_metrics), `k` (company_kpis), `f` (financials subquery), `c` (companies).

- `m.latest_revenue_sek` (from company_metrics)
- `f.max_revenue_sek` (from financials, use this for revenue filtering!)
- `m.avg_ebitda_margin` (NOTE: 5.0 = 5%, 15.0 = 15%)
- `k.avg_net_margin` (NOTE: 10.0 = 10%)
- `k.revenue_growth_yoy` (decimal 0.10 = 10%)
- `k.growth_bucket`: 'flat', 'moderate', 'high', 'declining'
- `k.profitability_bucket`: 'low', 'healthy', 'high', 'loss-making'
- `k.company_size_bucket`: 'small', 'medium', 'large'
- `c.nace_categories` (JSON string, use LIKE. NOTE: Categories are in Swedish, e.g. 'Dataprogrammering')
- `c.orgnr`
- `c.company_name`

## 🧠 Business Logic
- EBITDA Margin = ebitda_sek / revenue_sek
- Growth = year-over-year revenue % change
- Strategic Fit: Combines margin, defensibility, market fragmentation, upside potential

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

Prompt: “Find manufacturing firms with 5%+ EBITDA margins in Stockholm region”
→ SQL: WHERE m.avg_ebitda_margin >= 5.0 AND c.nace_categories LIKE '%verk%' AND c.city = 'Stockholm'

## 🎯 Strategic Fit Criteria (used in deeper AI analysis)
- Stable margins (>5%)
- Product-led growth
- Fragmented market
- Room for digital or operational improvement
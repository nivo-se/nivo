
# VALUATION_INTELLIGENCE_SPEC.md
Status: Valuation Intelligence Architecture
Purpose: Define how Nivo agents discover, validate, and apply valuation intelligence so that generated investment memos reach professional private‑equity standards.

---

# 1. Objective

Ensure the valuation section of every deep‑research report is:

• grounded in external market evidence  
• cross‑checked across multiple valuation methods  
• consistent with sector norms  
• explainable and auditable  

The system must **never rely on a single valuation method**.

Priority order:

1. Precedent transactions
2. Comparable public companies
3. Sector sanity ranges
4. DCF

---

# 2. Valuation Data Sources

Agents should search across four categories of valuation signals.

## 2.1 Precedent Transactions

Preferred valuation anchor.

Search examples:

"{industry} acquisition EV EBITDA"
"{industry} sold for multiple"
"{company} acquired"
"{industry} M&A valuation multiple"

Required fields:

target_company  
buyer  
year  
enterprise_value  
EBITDA  
EV_EBITDA_multiple  
source_url

Minimum target:

≥ 2 credible transactions

---

## 2.2 Comparable Companies

Used when transaction data is sparse.

Search examples:

"{industry} companies Europe revenue"
"{industry} listed companies"
"{company} competitors revenue"

Comparable metrics:

revenue  
EBITDA margin  
growth rate  
market positioning  

Output:

peer_set

Minimum target:

≥ 5 peers

---

## 2.3 Sector Multiple Library

Fallback valuation sanity layer.

Typical Nordic SME ranges:

| Sector | EV/EBITDA |
|------|------|
| Industrial | 5‑7x |
| Consumer | 5‑8x |
| Furniture/design | 5‑7x |
| SaaS | 8‑15x |
| Services | 4‑7x |

These ranges should be stored in a **sector_multiple_reference table**.

---

## 2.4 DCF Model

Used as a **supporting lens only**, not primary valuation.

Required inputs:

revenue growth  
EBITDA margin  
capex  
working capital  
WACC  
terminal growth

Outputs:

EV_low  
EV_base  
EV_high

---

# 3. Valuation Computation Pipeline

Step sequence:

1 Retrieve transactions  
2 Retrieve comparables  
3 Compute sector sanity band  
4 Run DCF  
5 Compare outputs  
6 Flag anomalies  

---

# 4. Enterprise Value Logic

Enterprise Value formula:

EV = Equity Value + Net Debt

Net Debt:

debt  
minus  
cash

Agents must verify:

• sign correctness  
• debt inclusion  
• minority interests if known  

---

# 5. Multiple Calculation

EV/EBITDA multiple:

multiple = EV / EBITDA

If EBITDA ≤ 0

DCF only allowed if justified.

---

# 6. SME Size Discount

Small companies typically trade at lower multiples due to:

• liquidity discount  
• customer concentration risk  
• management dependence  

Suggested adjustment:

| EBITDA | Discount |
|------|------|
| <5m | -25% |
| 5‑10m | -15% |
| 10‑20m | -10% |
| >20m | 0% |

---

# 7. Valuation Range Construction

Construct range using three anchors:

Transaction anchor  
Comparable anchor  
DCF anchor  

Example weighting:

transactions 50%  
comparables 30%  
DCF 20%

---

# 8. Valuation Sanity Checks

Validator must test:

Implied multiple within sector range

EV/EBITDA sanity

terminal value < 70% of EV

growth assumptions plausible

If failed:

re‑run transaction search or flag report.

---

# 9. Valuation Output Schema

Example:

{
"primary_method": "transactions",
"ev_low": 420,
"ev_base": 470,
"ev_high": 530,
"implied_multiple": 5.9,
"sector_range_low": 4.1,
"sector_range_high": 8.0,
"confidence_score": 0.74,
"warnings": []
}

---

# 10. Confidence Scoring

Confidence score is based on:

transaction_count  
peer_quality  
data_consistency  
source reliability  

Example:

confidence = weighted score (0‑1)

---

# 11. Valuation Agent Workflow

retrieve_transactions()

retrieve_comparables()

retrieve_sector_ranges()

run_dcf()

compute_multiples()

run_validator()

return valuation_packet

---

# 12. Evidence Requirements

Every valuation number must include:

source_url

timestamp

agent_name

---

# 13. Red Flags

Agent must flag:

negative EBITDA with high valuation

DCF > 2x transaction valuation

multiples outside sector band

missing sources

---

# 14. Future Enhancements

Potential upgrades:

private deal databases

industry multiple APIs

financial filings ingestion

AI‑estimated EBITDA adjustments

---

# 15. Summary

This valuation intelligence layer ensures Nivo reports produce valuations that:

• reflect real market behavior  
• remain consistent with SME deal multiples  
• are defensible in investment discussions  

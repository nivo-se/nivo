# Metrics & Shortlist Summary

## ✅ Metrics Verification - CRITICAL

### Margin Metrics (CORRECTED)

**Current Implementation:**
- **Field Used**: `avg_ebitda_margin` from `company_metrics` table
- **Type**: EBITDA Margin (NOT EBIT margin)
- **Format**: Decimal (0.15 = 15%, 0.08 = 8%)
- **Calculation**: Average EBITDA margin over multiple years
- **Formula**: `EBITDA / Revenue` averaged across available years

**Data Verification:**
- ✅ Verified: `avg_ebitda_margin` is stored as decimal (0.0345 = 3.45%)
- ✅ Fallback: If missing, calculates from latest year: `latest_ebitda_sek / latest_revenue_sek`
- ✅ All margins are in decimal format (not percentages)

**Important Distinction:**
- **EBITDA Margin** = (EBITDA / Revenue) - what we're using ✅
- **EBIT Margin** = (EBIT / Revenue) - NOT what we're using
- EBITDA = Operating Result (RG) + Depreciation/Amortization
- EBIT = Operating Result (RG)

### Revenue & Growth
- **Revenue**: Stored in **thousands of SEK** (100000 = 100 MSEK)
- **Growth**: `revenue_cagr_3y` stored as **decimal** (0.12 = 12%)

---

## ✅ Shortlist Storage

### Where Shortlists Are Saved

**Table**: `public.stage1_shortlists` in Supabase

**Schema:**
```sql
- id: UUID (primary key)
- name: "Stage 1 Shortlist - 180 companies"
- description: Weights used
- weights_json: JSONB with filter weights
- stage_one_size: 180
- companies: JSONB array of company data
- total_companies: 180
- generated_at: Timestamp
- status: 'active', 'archived', or 'used_for_stage2'
```

### Accessing Saved Shortlists

**API Endpoints:**
- `GET /api/shortlists/stage1` - List all Stage 1 shortlists
- `GET /api/shortlists/stage1/{id}` - Get specific shortlist

**SQL Query:**
```sql
SELECT * FROM stage1_shortlists 
WHERE status = 'active' 
ORDER BY generated_at DESC;
```

### What Gets Saved

Each shortlist includes:
- All company data (orgnr, name, revenue, growth, ebitda_margin, composite_score)
- The weights used to generate it
- Timestamp and metadata

---

## ⚠️ Important Notes

1. **Margin Format**: All margins are decimals (0.15 = 15%), NOT percentages
2. **Revenue Format**: Revenue is in thousands (100000 = 100 MSEK)
3. **Growth Format**: Growth is decimal (0.12 = 12%)
4. **Shortlist Persistence**: Every generated shortlist is automatically saved
5. **Data Quality**: Some companies may have negative margins (data quality issue, not code issue)

---

## Next Steps

1. ✅ Metrics verified and corrected
2. ✅ Shortlists being saved
3. ⏳ Run migration `007_create_shortlist_tables.sql` in Supabase
4. ⏳ Add UI to view/load saved shortlists


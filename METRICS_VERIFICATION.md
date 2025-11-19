# Metrics Verification - Critical for Analysis

## Current Implementation

### Margin Metrics Used
- **Field**: `avg_ebitda_margin` from `company_metrics` table
- **Format**: Decimal (0.15 = 15%, 0.08 = 8%)
- **Calculation**: Average EBITDA margin over multiple years
- **Formula**: `EBITDA / Revenue` averaged across available years

### Important Notes

1. **EBITDA vs EBIT Margin**:
   - We're using **EBITDA margin** (`avg_ebitda_margin`)
   - EBITDA = Operating Result (RG) + Depreciation/Amortization
   - This is stored in `company_metrics.avg_ebitda_margin` as a decimal

2. **Data Format**:
   - All margins are stored as **decimals** (0.15 = 15%)
   - Growth rates are stored as **decimals** (0.12 = 12%)
   - Revenue is stored in **thousands of SEK** (100000 = 100 MSEK)

3. **Verification**:
   - The `avg_ebitda_margin` field is pre-calculated and stored in `company_metrics`
   - It represents the average EBITDA margin across multiple years
   - If missing, we fall back to calculating from latest year: `latest_ebitda_sek / latest_revenue_sek`

## Shortlist Storage

### Where Shortlists Are Saved

Shortlists are now saved to the `stage1_shortlists` table in Supabase:

**Table**: `public.stage1_shortlists`
- `id`: UUID (primary key)
- `name`: Shortlist name
- `description`: Description with weights used
- `weights_json`: JSONB with filter weights
- `stage_one_size`: Number of companies requested
- `companies`: JSONB array of company data
- `total_companies`: Count of companies
- `generated_at`: Timestamp
- `status`: 'active', 'archived', or 'used_for_stage2'

### Accessing Saved Shortlists

To retrieve saved shortlists:
```sql
SELECT * FROM stage1_shortlists 
WHERE status = 'active' 
ORDER BY generated_at DESC;
```

Or via API (to be implemented):
```typescript
GET /api/shortlists/stage1
```

## Next Steps

1. ✅ Verify margin calculations are correct
2. ✅ Save shortlists to database
3. ⏳ Add endpoint to retrieve saved shortlists
4. ⏳ Add UI to view/load saved shortlists


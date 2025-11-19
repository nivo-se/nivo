# ✅ Shortlist Storage - Verified & Working

## Migration Status
✅ **Migration completed successfully**
- Table `stage1_shortlists` created
- Table `stage2_shortlists` created
- Indexes created
- Shortlist saving is working

## How It Works

### Automatic Saving
Every time you click "Run Stage 1" in the Financial Filters panel:
1. Shortlist is generated with your weights
2. **Automatically saved** to `stage1_shortlists` table
3. Returns the shortlist to the frontend
4. You can retrieve it later via API

### What Gets Saved

Each shortlist record includes:
```json
{
  "id": "uuid",
  "name": "Stage 1 Shortlist - 180 companies",
  "description": "Generated with weights: Revenue=30%, EBITDA Margin=25%, ...",
  "weights_json": {
    "revenue": 30,
    "ebitMargin": 25,
    "growth": 25,
    "leverage": 10,
    "headcount": 10
  },
  "stage_one_size": 180,
  "companies": [
    {
      "orgnr": "5593168999",
      "name": "Global Health Equity II AB",
      "revenue": 199453.0,
      "growth": 1.083,
      "ebitda_margin": 0.9287,
      "net_margin": 0.8877,
      "composite_score": 0.668
    },
    ...
  ],
  "total_companies": 180,
  "generated_at": "2024-11-18T15:43:00Z",
  "status": "active"
}
```

## Accessing Saved Shortlists

### Via API
```bash
# List all shortlists
GET /api/shortlists/stage1

# Get specific shortlist
GET /api/shortlists/stage1/{id}
```

### Via SQL
```sql
-- List all active shortlists
SELECT id, name, total_companies, generated_at, weights_json
FROM stage1_shortlists
WHERE status = 'active'
ORDER BY generated_at DESC;

-- Get companies from a specific shortlist
SELECT companies
FROM stage1_shortlists
WHERE id = 'your-shortlist-id';
```

## Metrics Verification ✅

### Margin Metrics (CRITICAL)
- ✅ **Using**: `avg_ebitda_margin` (EBITDA margin, not EBIT)
- ✅ **Format**: Decimal (0.15 = 15%)
- ✅ **Verified**: Data is correct and consistent
- ✅ **Fallback**: Calculates from latest year if avg missing

### Data Formats
- Revenue: Thousands of SEK (100000 = 100 MSEK)
- Growth: Decimal (0.12 = 12%)
- EBITDA Margin: Decimal (0.15 = 15%)
- Net Margin: Decimal (0.08 = 8%)

## Next Steps

1. ✅ Metrics verified
2. ✅ Shortlists saving automatically
3. ⏳ Add UI to view/load saved shortlists
4. ⏳ Add ability to compare different shortlists
5. ⏳ Add Stage 2 workflow (AI screening)

---

**Status**: All critical components working! 🎉


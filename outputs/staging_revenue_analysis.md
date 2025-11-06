# Staging Database Revenue Range Analysis

## Job Information
- **Job ID**: `de2cea99-ce04-4fce-bc15-695c672e4c22`
- **Status**: DONE (Stage 3 completed)
- **Job Parameters**: 
  - Revenue: 50 - 200 MSEK
  - Profit: No filter
  - Company Type: AB

## Revenue Unit Confirmation

✅ **Confirmed: Revenue values are stored in THOUSANDS of SEK**

### Evidence:
- Code conversion: `revenueFrom * 1000` (50 MSEK → 50,000 thousands)
- Database range: 50,004 - 199,997 (thousands of SEK)
- This equals: **50.004 - 199.997 MSEK** (matches our filter)

## Actual Data in Database

### Revenue Distribution
| Range (MSEK) | Count | Min (MSEK) | Max (MSEK) |
|--------------|-------|------------|------------|
| 50-100       | 6,384 | 50.004     | 99.999     |
| 100-500      | 3,616 | 100.000    | 199.997    |

### Distribution by 10 MSEK Buckets
| Range (MSEK) | Companies |
|--------------|-----------|
| 50-60        | 2,036     |
| 60-70        | 1,588     |
| 70-80        | 1,150     |
| 80-90        | 914       |
| 90-100       | 696       |
| 100-110      | 623       |
| 110-120      | 549       |
| 120-130      | 454       |
| 130-140      | 411       |
| 140-150      | 341       |
| 150-160      | 320       |
| 160-170      | 272       |
| 170-180      | 246       |
| 180-190      | 203       |
| 190-200      | 197       |

### Summary Statistics
- **Total Companies (stored)**: 10,000
- **Expected Companies (Allabolag UI)**: 13,610
- **Gap**: 3,610 companies (≈26.5%)
- **Min Revenue**: 50.004 MSEK
- **Max Revenue**: 199.997 MSEK
- **Average Revenue**: 94.71 MSEK
- **Companies with Financials**: 9,998 (2 companies not found)

## Potential Issues

### ⚠️ Issue 1: Exactly 10,000 Companies is Suspicious
- Round number suggests we may have hit a limit
- Job stopped at page 1,540
- Processed 19,584 pages but only got 10,000 companies total
- `total_companies` field shows exactly 10,000

### ⚠️ Issue 2: Job Stopped Due to Proxy Error
- Error: "Oxylabs proxy rate limit (429)"
- Job stopped at page 1,033
- Restarted from page 1,021
- May have missed pages during error recovery

### ⚠️ Issue 3: Missing Companies in Range
Given the range 50-200 MSEK, there should likely be more than 10,000 companies. The exact count should be verified against Allabolag.se to confirm.

## What We Have

### Data Completeness
- ✅ **Companies**: 10,000 (Stage 1 complete)
- ✅ **Company IDs**: 9,998 resolved (Stage 2 complete)
- ✅ **Financial Records**: 48,947 records (Stage 3 complete)
- ✅ **Raw JSON**: Complete API responses stored for all records

### Data Quality
- All companies have basic information (name, orgnr, revenue, profit)
- 9,998 companies have resolved company IDs
- 9,998 companies have financial data
- All financial records include complete raw JSON

## Next Steps

1. **Verify Expected Count**: Check Allabolag.se to confirm expected total companies in 50-200 MSEK range
2. **Identify Missing Companies**: Compare expected vs actual count
3. **Plan Second Batch**: Determine correct parameters to capture missing companies
4. **Check Pagination**: Verify if job stopped due to limit or completed naturally

## Revenue Range for Second Batch

Based on current analysis:
- **Current coverage**: 50.004 - 199.997 MSEK
- **Gap to investigate**: Need to verify if there are companies we missed
- **Possible issues**:
  - Companies below 50.004 MSEK (if filter was too strict)
  - Companies above 199.997 MSEK (if we hit a limit)
  - Companies in the middle range (if pagination skipped pages)

## Recommendations

1. **Verify with Allabolag.se**: Check online for expected total count in 50-200 MSEK range
2. **Check if pagination limit**: Verify if 10,000 is a hard limit or if we stopped early
3. **Analyze page distribution**: Check if companies are evenly distributed or if there are gaps
4. **Plan second batch**: Once we know the expected count, determine parameters for second batch


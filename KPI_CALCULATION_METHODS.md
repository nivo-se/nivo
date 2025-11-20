# KPI Calculation Methods

## Date: 2025-11-20

## Growth Metrics

### Year-over-Year Growth (revenue_growth_yoy)

**Formula**: `(SDI_current / SDI_previous - 1) * 100`

**Calculation**:
1. Get the most recent year's revenue (SDI) from `financials` table
2. Get the closest previous year's revenue (SDI)
3. Calculate: `(current_revenue / previous_revenue - 1) * 100`
4. Result is in **percentage** (e.g., 15.5 means 15.5% growth)

**Example**:
- 2024 Revenue (SDI): 1,000,000 SEK
- 2023 Revenue (SDI): 850,000 SEK
- Growth: (1,000,000 / 850,000 - 1) * 100 = **17.65%**

**Implementation**:
```python
def calculate_yoy_growth(values: List[float], years: List[int]) -> Optional[float]:
    # Sort by year (newest first)
    sorted_data = sorted(zip(years, values), key=lambda x: x[0], reverse=True)
    latest_value = sorted_data[0][1]
    latest_year = sorted_data[0][0]
    
    # Find closest previous year
    previous_value = None
    for year, value in sorted_data[1:]:
        if year < latest_year:
            previous_value = value
            break
    
    if previous_value is None or previous_value <= 0:
        return None
    
    # Formula: (current / previous - 1) * 100
    growth = (latest_value / previous_value - 1) * 100
    return growth
```

### Compound Annual Growth Rate (CAGR)

**3-Year CAGR** (`revenue_cagr_3y`):
- Formula: `(SDI_latest / SDI_3_years_ago)^(1/3) - 1`
- Result is a **decimal** (e.g., 0.15 = 15% growth)
- Measures average annual growth over 3 years

**5-Year CAGR** (`revenue_cagr_5y`):
- Formula: `(SDI_latest / SDI_5_years_ago)^(1/5) - 1`
- Result is a **decimal** (e.g., 0.12 = 12% growth)
- Measures average annual growth over 5 years

## Margin Metrics

### Average EBITDA Margin (avg_ebitda_margin)

**Formula**: `AVG(EBITDA / Revenue)` over all available years

**Calculation**:
1. For each year with both revenue and EBITDA:
   - Calculate: `ebitda / revenue`
2. Average all margin values
3. Result is a **decimal** (e.g., 0.15 = 15% margin)

**Example**:
- 2024: EBITDA = 150,000, Revenue = 1,000,000 → Margin = 0.15
- 2023: EBITDA = 120,000, Revenue = 850,000 → Margin = 0.141
- Average: (0.15 + 0.141) / 2 = **0.1455 (14.55%)**

### Average Net Margin (avg_net_margin)

**Formula**: `AVG(Profit / Revenue)` over all available years

**Calculation**: Same as EBITDA margin, but using profit (DR) instead of EBITDA

### Average EBIT Margin (avg_ebit_margin)

**Formula**: `AVG(EBIT / Revenue)` over all available years

**Calculation**: Same as EBITDA margin, but using EBIT (RG) instead of EBITDA

## Profitability Ratios

### Return on Equity (ROE)

**Formula**: `Profit / Equity`

**Calculation**: Uses latest year's profit and equity
- Result is a **decimal** (e.g., 0.20 = 20% ROE)

### Return on Assets (ROA)

**Formula**: `Profit / Assets`

**Calculation**: Uses latest year's profit and total assets
- Result is a **decimal** (e.g., 0.10 = 10% ROA)

### Equity Ratio

**Formula**: `Equity / (Equity + Debt)`

**Calculation**: Uses latest year's equity and debt
- Result is a **decimal** (e.g., 0.60 = 60% equity ratio)

### Debt-to-Equity Ratio

**Formula**: `Debt / Equity`

**Calculation**: Uses latest year's debt and equity
- Result is a **decimal** (e.g., 0.67 = 0.67x debt-to-equity)

## Efficiency Metrics

### Revenue per Employee

**Formula**: `Revenue / Employees`

**Calculation**: Uses latest year's revenue and employee count
- Result is in **SEK per employee**

### EBITDA per Employee

**Formula**: `EBITDA / Employees`

**Calculation**: Uses latest year's EBITDA and employee count
- Result is in **SEK per employee**

### Profit per Employee

**Formula**: `Profit / Employees`

**Calculation**: Uses latest year's profit and employee count
- Result is in **SEK per employee**

## Segmentation Buckets

### Company Size Bucket

Based on latest revenue:
- **small**: Revenue < 50,000,000 SEK
- **medium**: Revenue 50,000,000 - 150,000,000 SEK
- **large**: Revenue > 150,000,000 SEK

### Growth Bucket

Based on year-over-year growth (if available) or 3-year CAGR:
- **declining**: Growth < 0%
- **flat**: Growth 0% - 5%
- **moderate**: Growth 5% - 15%
- **high**: Growth > 15%

### Profitability Bucket

Based on average net margin:
- **loss-making**: Margin < 0%
- **low**: Margin 0% - 5%
- **healthy**: Margin 5% - 15%
- **high**: Margin > 15%

## Account Code Mappings

The financials table uses account codes as columns:
- `sdi_sek` = Revenue (SDI - Omsättning)
- `dr_sek` = Net Profit (DR - Årets resultat)
- `ebitda_sek` = EBITDA (EBITDA)
- `rg_sek` = EBIT (RG - Rörelseresultat)
- `ek_sek` = Equity (EK - Eget kapital)
- `fk_sek` = Debt (FK - Skulder)
- `sv_sek` = Total Assets (SV - Summa tillgångar)
- `ant_sek` = Employees (ANT - Antal anställda)

## Notes

- All growth calculations use the **most recent available year** and the **closest previous year**
- If consecutive years are not available, the calculation uses the closest available previous year
- Margins are calculated as **averages** over all available years (not just latest)
- All ratios use **latest year** data unless otherwise specified
- Percentages are stored as **decimals** for CAGR and margins (0.15 = 15%)
- Year-over-year growth is stored as **percentage** (15.5 = 15.5%)


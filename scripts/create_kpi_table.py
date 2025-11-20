#!/usr/bin/env python3
"""
Create and populate a company_kpis table from the optimized database.

This table will contain pre-calculated KPIs for all companies, making
segmentation and analysis queries much faster.
"""

import sqlite3
import argparse
from pathlib import Path
from typing import Dict, List, Optional
from collections import defaultdict

def calculate_cagr(values: List[float], years: List[int]) -> Optional[float]:
    """Calculate Compound Annual Growth Rate"""
    if len(values) < 2:
        return None
    
    # Sort by year (oldest first)
    sorted_data = sorted(zip(years, values), key=lambda x: x[0])
    years_sorted = [y for y, _ in sorted_data]
    values_sorted = [v for _, v in sorted_data]
    
    # Get first and last values
    first_value = values_sorted[0]
    last_value = values_sorted[-1]
    years_diff = years_sorted[-1] - years_sorted[0]
    
    if first_value <= 0 or years_diff <= 0:
        return None
    
    # CAGR = (End Value / Start Value)^(1/Years) - 1
    cagr = (last_value / first_value) ** (1 / years_diff) - 1
    return cagr

def calculate_3y_cagr(values: List[float], years: List[int]) -> Optional[float]:
    """Calculate 3-year CAGR"""
    if len(values) < 2:
        return None
    
    # Sort by year (newest first)
    sorted_data = sorted(zip(years, values), key=lambda x: x[0], reverse=True)
    years_sorted = [y for y, _ in sorted_data]
    values_sorted = [v for _, v in sorted_data]
    
    # Get latest and 3 years ago
    latest_value = values_sorted[0]
    latest_year = years_sorted[0]
    
    # Find value from 3 years ago (or closest)
    target_year = latest_year - 3
    three_years_ago_value = None
    three_years_ago_year = None
    
    for i, year in enumerate(years_sorted):
        if year <= target_year:
            three_years_ago_value = values_sorted[i]
            three_years_ago_year = year
            break
    
    if three_years_ago_value is None or three_years_ago_value <= 0:
        return None
    
    years_diff = latest_year - three_years_ago_year
    if years_diff <= 0:
        return None
    
    cagr = (latest_value / three_years_ago_value) ** (1 / years_diff) - 1
    return cagr

def calculate_5y_cagr(values: List[float], years: List[int]) -> Optional[float]:
    """Calculate 5-year CAGR"""
    if len(values) < 2:
        return None
    
    # Sort by year (newest first)
    sorted_data = sorted(zip(years, values), key=lambda x: x[0], reverse=True)
    years_sorted = [y for y, _ in sorted_data]
    values_sorted = [v for _, v in sorted_data]
    
    # Get latest and 5 years ago
    latest_value = values_sorted[0]
    latest_year = years_sorted[0]
    
    # Find value from 5 years ago (or closest)
    target_year = latest_year - 5
    five_years_ago_value = None
    five_years_ago_year = None
    
    for i, year in enumerate(years_sorted):
        if year <= target_year:
            five_years_ago_value = values_sorted[i]
            five_years_ago_year = year
            break
    
    if five_years_ago_value is None or five_years_ago_value <= 0:
        return None
    
    years_diff = latest_year - five_years_ago_year
    if years_diff <= 0:
        return None
    
    cagr = (latest_value / five_years_ago_value) ** (1 / years_diff) - 1
    return cagr

def calculate_yoy_growth(values: List[float], years: List[int]) -> Optional[float]:
    """Calculate year-over-year growth: (current / previous - 1) * 100
    
    Uses the most recent year and the closest previous year (not necessarily exactly 1 year before).
    
    Filters out unrealistic growth caused by data quality issues:
    - Previous year must be >= 10,000 SEK (to avoid division by tiny numbers)
    - Growth is capped at reasonable maximum (500%)
    """
    if len(values) < 2:
        return None
    
    # Sort by year (newest first)
    sorted_data = sorted(zip(years, values), key=lambda x: x[0], reverse=True)
    years_sorted = [y for y, _ in sorted_data]
    values_sorted = [v for _, v in sorted_data]
    
    # Get latest year and value
    latest_value = values_sorted[0]
    latest_year = years_sorted[0]
    
    # Find the most recent previous year (closest year before latest)
    previous_value = None
    previous_year = None
    
    for i in range(1, len(years_sorted)):
        if years_sorted[i] < latest_year:
            previous_value = values_sorted[i]
            previous_year = years_sorted[i]
            break
    
    if previous_value is None or previous_value <= 0:
        return None
    
    # Filter out unrealistic growth caused by data quality issues
    # If previous year is too small (< 10,000 SEK), it's likely a data error
    # Normal companies don't have revenue of 1-100 SEK
    MIN_PREVIOUS_REVENUE = 10000  # 10,000 SEK minimum
    
    if previous_value < MIN_PREVIOUS_REVENUE:
        # Previous year is suspiciously small - likely data error
        # Return None instead of calculating unrealistic growth
        return None
    
    # Growth = (current / previous - 1) * 100 (as percentage)
    # Formula: (SDI_current / SDI_previous - 1) * 100
    growth = (latest_value / previous_value - 1) * 100
    
    # Cap growth at reasonable maximum (500%) to handle remaining outliers
    # Growth above 500% is extremely rare and likely a data quality issue
    MAX_REASONABLE_GROWTH = 500.0
    if growth > MAX_REASONABLE_GROWTH:
        return None  # Return None for extreme outliers
    
    return growth

def calculate_avg_margin(revenues: List[float], profits: List[float]) -> Optional[float]:
    """Calculate average margin (profit/revenue)"""
    if not revenues or not profits or len(revenues) != len(profits):
        return None
    
    margins = []
    for rev, prof in zip(revenues, profits):
        if rev and rev > 0 and prof is not None:
            margins.append(prof / rev)
    
    if not margins:
        return None
    
    return sum(margins) / len(margins)

def create_kpi_table(conn: sqlite3.Connection):
    """Create the company_kpis table"""
    cur = conn.cursor()
    
    # Drop existing table if it exists (to update schema)
    cur.execute("DROP TABLE IF EXISTS company_kpis")
    
    cur.execute("""
        CREATE TABLE company_kpis (
            orgnr TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            
            -- Latest year data
            latest_year INTEGER,
            latest_revenue_sek REAL,
            latest_profit_sek REAL,
            latest_ebitda_sek REAL,
            latest_ebit_sek REAL,
            latest_equity_sek REAL,
            latest_debt_sek REAL,
            latest_employees INTEGER,
            
            -- Growth metrics
            revenue_growth_yoy REAL,  -- Year-over-year: (SDI_current / SDI_previous - 1) * 100
            revenue_cagr_3y REAL,  -- 3-year Compound Annual Growth Rate
            revenue_cagr_5y REAL,  -- 5-year Compound Annual Growth Rate
            profit_growth_yoy REAL,  -- Year-over-year profit growth
            profit_cagr_3y REAL,
            profit_cagr_5y REAL,
            
            -- Margin metrics (averages over available years)
            avg_ebitda_margin REAL,
            avg_ebit_margin REAL,
            avg_net_margin REAL,
            
            -- Profitability ratios
            roe REAL,  -- Return on Equity (profit/equity)
            roa REAL,  -- Return on Assets (profit/assets)
            equity_ratio REAL,  -- Equity / (Equity + Debt)
            debt_to_equity REAL,  -- Debt / Equity
            
            -- Efficiency metrics
            revenue_per_employee REAL,
            ebitda_per_employee REAL,
            profit_per_employee REAL,
            
            -- Size buckets
            company_size_bucket TEXT,  -- small, medium, large
            growth_bucket TEXT,  -- declining, flat, moderate, high
            profitability_bucket TEXT,  -- loss-making, low, healthy, high
            
            -- Metadata
            calculated_at TEXT DEFAULT (datetime('now')),
            years_of_data INTEGER,
            
            FOREIGN KEY (orgnr) REFERENCES companies(orgnr) ON DELETE CASCADE
        );
    """)
    
    # Create indexes for fast segmentation
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_kpis_size_bucket 
        ON company_kpis(company_size_bucket);
    """)
    
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_kpis_growth_bucket 
        ON company_kpis(growth_bucket);
    """)
    
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_kpis_profitability_bucket 
        ON company_kpis(profitability_bucket);
    """)
    
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_kpis_revenue_cagr_3y 
        ON company_kpis(revenue_cagr_3y);
    """)
    
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_kpis_avg_ebitda_margin 
        ON company_kpis(avg_ebitda_margin);
    """)
    
    conn.commit()
    print("✅ Created company_kpis table with indexes")

def populate_kpi_table(conn: sqlite3.Connection):
    """Populate the company_kpis table with calculated metrics"""
    cur = conn.cursor()
    
    print("\n📊 Calculating KPIs for all companies...")
    
    # Get all companies
    cur.execute("SELECT orgnr, company_id FROM companies")
    companies = cur.fetchall()
    print(f"  Found {len(companies)} companies")
    
    # Get all financial data (annual periods only)
    # EXCLUDE EUR records - only use SEK to avoid currency conversion issues
    # Companies reporting in EUR have incorrect values (EUR treated as SEK)
    cur.execute("""
        SELECT 
            orgnr,
            year,
            sdi_sek as revenue,
            dr_sek as profit,
            ebitda_sek as ebitda,
            rg_sek as ebit,
            ek_sek as equity,
            fk_sek as debt,
            sv_sek as assets,
            ant_sek as employees
        FROM financials
        WHERE (period = '12' OR period LIKE '%-12')
          AND year >= 2020
          AND currency = 'SEK'  -- Only use SEK records to avoid currency mismatch
        ORDER BY orgnr, year DESC
    """)
    
    financials = cur.fetchall()
    
    # Group by company
    company_financials: Dict[str, List[Dict]] = defaultdict(list)
    for row in financials:
        orgnr, year, revenue, profit, ebitda, ebit, equity, debt, assets, employees = row
        company_financials[orgnr].append({
            'year': year,
            'revenue': revenue,
            'profit': profit,
            'ebitda': ebitda,
            'ebit': ebit,
            'equity': equity,
            'debt': debt,
            'assets': assets,
            'employees': employees
        })
    
    print(f"  Found financial data for {len(company_financials)} companies")
    
    # Calculate KPIs for each company
    kpi_rows = []
    processed = 0
    
    for orgnr, company_id in companies:
        financials_list = company_financials.get(orgnr, [])
        
        if not financials_list:
            # No financial data, create minimal KPI row
            kpi_rows.append({
                'orgnr': orgnr,
                'company_id': company_id,
                'latest_year': None,
                'latest_revenue_sek': None,
                'latest_profit_sek': None,
                'latest_ebitda_sek': None,
                'latest_ebit_sek': None,
                'latest_equity_sek': None,
                'latest_debt_sek': None,
                'latest_employees': None,
                'revenue_growth_yoy': None,
                'revenue_cagr_3y': None,
                'revenue_cagr_5y': None,
                'profit_growth_yoy': None,
                'profit_cagr_3y': None,
                'profit_cagr_5y': None,
                'avg_ebitda_margin': None,
                'avg_ebit_margin': None,
                'avg_net_margin': None,
                'roe': None,
                'roa': None,
                'equity_ratio': None,
                'debt_to_equity': None,
                'revenue_per_employee': None,
                'ebitda_per_employee': None,
                'profit_per_employee': None,
                'company_size_bucket': None,
                'growth_bucket': None,
                'profitability_bucket': None,
                'years_of_data': 0
            })
            continue
        
        # Sort by year (newest first)
        financials_list.sort(key=lambda x: x['year'], reverse=True)
        latest = financials_list[0]
        
        # Extract time series
        revenues = [f['revenue'] for f in financials_list if f['revenue']]
        revenue_years = [f['year'] for f in financials_list if f['revenue']]
        
        profits = [f['profit'] for f in financials_list if f['profit'] is not None]
        profit_years = [f['year'] for f in financials_list if f['profit'] is not None]
        
        ebitdas = [f['ebitda'] for f in financials_list if f['ebitda']]
        ebits = [f['ebit'] for f in financials_list if f['ebit']]
        
        # Validate number helper (defined before use)
        def validate_number(value):
            if value is None:
                return None
            if isinstance(value, complex):
                return None
            if isinstance(value, (int, float)):
                import math
                if math.isnan(value) or math.isinf(value):
                    return None
                return float(value)
            return None
        
        # Calculate growth metrics
        # Year-over-year growth: (SDI_current / SDI_previous - 1) * 100
        revenue_growth_yoy = calculate_yoy_growth(revenues, revenue_years) if revenues else None
        profit_growth_yoy = calculate_yoy_growth(profits, profit_years) if profits else None
        
        # CAGR (Compound Annual Growth Rate) for longer-term trends
        revenue_cagr_3y = calculate_3y_cagr(revenues, revenue_years) if revenues else None
        revenue_cagr_5y = calculate_5y_cagr(revenues, revenue_years) if revenues else None
        profit_cagr_3y = calculate_3y_cagr(profits, profit_years) if profits else None
        profit_cagr_5y = calculate_5y_cagr(profits, profit_years) if profits else None
        
        # Validate all growth values
        revenue_growth_yoy = validate_number(revenue_growth_yoy)
        profit_growth_yoy = validate_number(profit_growth_yoy)
        revenue_cagr_3y = validate_number(revenue_cagr_3y)
        revenue_cagr_5y = validate_number(revenue_cagr_5y)
        profit_cagr_3y = validate_number(profit_cagr_3y)
        profit_cagr_5y = validate_number(profit_cagr_5y)
        
        # Calculate average margins
        avg_ebitda_margin = calculate_avg_margin(revenues, ebitdas) if revenues and ebitdas else None
        avg_ebit_margin = calculate_avg_margin(revenues, ebits) if revenues and ebits else None
        avg_net_margin = calculate_avg_margin(revenues, profits) if revenues and profits else None
        
        # Validate margin values
        avg_ebitda_margin = validate_number(avg_ebitda_margin)
        avg_ebit_margin = validate_number(avg_ebit_margin)
        avg_net_margin = validate_number(avg_net_margin)
        
        # Calculate profitability ratios
        roe = None
        if latest['profit'] and latest['equity'] and latest['equity'] > 0:
            roe = latest['profit'] / latest['equity']
            roe = validate_number(roe)
        
        roa = None
        if latest['profit'] and latest['assets'] and latest['assets'] > 0:
            roa = latest['profit'] / latest['assets']
            roa = validate_number(roa)
        
        equity_ratio = None
        if latest['equity'] is not None and latest['debt'] is not None:
            total = latest['equity'] + latest['debt']
            if total > 0:
                equity_ratio = latest['equity'] / total
                equity_ratio = validate_number(equity_ratio)
        
        debt_to_equity = None
        if latest['debt'] and latest['equity'] and latest['equity'] > 0:
            debt_to_equity = latest['debt'] / latest['equity']
            debt_to_equity = validate_number(debt_to_equity)
        
        # Calculate efficiency metrics
        revenue_per_employee = None
        ebitda_per_employee = None
        profit_per_employee = None
        if latest['employees'] and latest['employees'] > 0:
            if latest['revenue']:
                revenue_per_employee = latest['revenue'] / latest['employees']
                revenue_per_employee = validate_number(revenue_per_employee)
            if latest['ebitda']:
                ebitda_per_employee = latest['ebitda'] / latest['employees']
                ebitda_per_employee = validate_number(ebitda_per_employee)
            if latest['profit']:
                profit_per_employee = latest['profit'] / latest['employees']
                profit_per_employee = validate_number(profit_per_employee)
        
        # Calculate buckets
        # Size bucket
        company_size_bucket = None
        if latest['revenue']:
            if latest['revenue'] < 50_000_000:
                company_size_bucket = 'small'
            elif latest['revenue'] < 150_000_000:
                company_size_bucket = 'medium'
            else:
                company_size_bucket = 'large'
        
        # Growth bucket (use year-over-year growth if available, otherwise CAGR)
        growth_bucket = None
        growth_value = revenue_growth_yoy if revenue_growth_yoy is not None else (revenue_cagr_3y * 100 if revenue_cagr_3y is not None else None)
        if growth_value is not None:
            if growth_value < 0:
                growth_bucket = 'declining'
            elif growth_value < 5:  # 5% in percentage
                growth_bucket = 'flat'
            elif growth_value < 15:  # 15% in percentage
                growth_bucket = 'moderate'
            else:
                growth_bucket = 'high'
        
        # Profitability bucket
        profitability_bucket = None
        if avg_net_margin is not None:
            if avg_net_margin < 0:
                profitability_bucket = 'loss-making'
            elif avg_net_margin < 0.05:
                profitability_bucket = 'low'
            elif avg_net_margin < 0.15:
                profitability_bucket = 'healthy'
            else:
                profitability_bucket = 'high'
        
        kpi_rows.append({
            'orgnr': orgnr,
            'company_id': company_id,
            'latest_year': latest['year'],
            'latest_revenue_sek': latest['revenue'],
            'latest_profit_sek': latest['profit'],
            'latest_ebitda_sek': latest['ebitda'],
            'latest_ebit_sek': latest['ebit'],
            'latest_equity_sek': latest['equity'],
            'latest_debt_sek': latest['debt'],
            'latest_employees': latest['employees'],
            'revenue_growth_yoy': revenue_growth_yoy,
            'revenue_cagr_3y': revenue_cagr_3y,
            'revenue_cagr_5y': revenue_cagr_5y,
            'profit_growth_yoy': profit_growth_yoy,
            'profit_cagr_3y': profit_cagr_3y,
            'profit_cagr_5y': profit_cagr_5y,
            'avg_ebitda_margin': avg_ebitda_margin,
            'avg_ebit_margin': avg_ebit_margin,
            'avg_net_margin': avg_net_margin,
            'roe': roe,
            'roa': roa,
            'equity_ratio': equity_ratio,
            'debt_to_equity': debt_to_equity,
            'revenue_per_employee': revenue_per_employee,
            'ebitda_per_employee': ebitda_per_employee,
            'profit_per_employee': profit_per_employee,
            'company_size_bucket': company_size_bucket,
            'growth_bucket': growth_bucket,
            'profitability_bucket': profitability_bucket,
            'years_of_data': len(financials_list)
        })
        
        processed += 1
        if processed % 1000 == 0:
            print(f"  Processed {processed}/{len(companies)} companies...")
    
    # Insert KPIs
    print(f"\n💾 Inserting {len(kpi_rows)} KPI records...")
    
    insert_sql = """
        INSERT OR REPLACE INTO company_kpis (
            orgnr, company_id, latest_year, latest_revenue_sek, latest_profit_sek,
            latest_ebitda_sek, latest_ebit_sek, latest_equity_sek, latest_debt_sek,
            latest_employees, revenue_growth_yoy, revenue_cagr_3y, revenue_cagr_5y,
            profit_growth_yoy, profit_cagr_3y, profit_cagr_5y, avg_ebitda_margin,
            avg_ebit_margin, avg_net_margin, roe, roa, equity_ratio, debt_to_equity,
            revenue_per_employee, ebitda_per_employee, profit_per_employee,
            company_size_bucket, growth_bucket, profitability_bucket, years_of_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    
    for kpi in kpi_rows:
        cur.execute(insert_sql, (
            kpi['orgnr'], kpi['company_id'], kpi['latest_year'],
            kpi['latest_revenue_sek'], kpi['latest_profit_sek'],
            kpi['latest_ebitda_sek'], kpi['latest_ebit_sek'],
            kpi['latest_equity_sek'], kpi['latest_debt_sek'],
            kpi['latest_employees'], kpi['revenue_growth_yoy'],
            kpi['revenue_cagr_3y'], kpi['revenue_cagr_5y'],
            kpi['profit_growth_yoy'], kpi['profit_cagr_3y'],
            kpi['profit_cagr_5y'], kpi['avg_ebitda_margin'],
            kpi['avg_ebit_margin'], kpi['avg_net_margin'],
            kpi['roe'], kpi['roa'], kpi['equity_ratio'],
            kpi['debt_to_equity'], kpi['revenue_per_employee'],
            kpi['ebitda_per_employee'], kpi['profit_per_employee'],
            kpi['company_size_bucket'], kpi['growth_bucket'],
            kpi['profitability_bucket'], kpi['years_of_data']
        ))
    
    conn.commit()
    print(f"✅ Inserted {len(kpi_rows)} KPI records")

def main():
    parser = argparse.ArgumentParser(description="Create and populate company_kpis table")
    parser.add_argument("--db", required=True, help="Path to optimized database")
    args = parser.parse_args()
    
    db_path = Path(args.db)
    if not db_path.exists():
        print(f"❌ Database not found: {db_path}")
        return
    
    print("🚀 Creating Company KPIs Table")
    print("="*70)
    print(f"Database: {db_path}")
    
    conn = sqlite3.connect(str(db_path))
    
    # Create table
    create_kpi_table(conn)
    
    # Populate table
    populate_kpi_table(conn)
    
    # Get stats
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM company_kpis")
    count = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM company_kpis WHERE latest_revenue_sek IS NOT NULL")
    with_revenue = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM company_kpis WHERE revenue_cagr_3y IS NOT NULL")
    with_growth = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM company_kpis WHERE avg_net_margin IS NOT NULL")
    with_margin = cur.fetchone()[0]
    
    # Get database size
    size_mb = db_path.stat().st_size / (1024 * 1024)
    
    print("\n" + "="*70)
    print("✅ KPI TABLE CREATED")
    print(f"  Total companies: {count:,}")
    print(f"  With revenue data: {with_revenue:,}")
    print(f"  With growth metrics: {with_growth:,}")
    print(f"  With margin metrics: {with_margin:,}")
    print(f"  Database size: {size_mb:.1f} MB")
    
    conn.close()

if __name__ == "__main__":
    main()


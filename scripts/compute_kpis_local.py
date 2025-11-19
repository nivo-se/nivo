#!/usr/bin/env python3
"""Compute additional KPIs for local SQLite database.

This script calculates missing KPIs and persists them to the database
for efficient querying and analysis.
"""

from __future__ import annotations

import argparse
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional


def ensure_kpi_table(conn: sqlite3.Connection) -> None:
    """Create or update company_kpis_local table."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS company_kpis_local (
            orgnr TEXT NOT NULL,
            year INTEGER NOT NULL,
            period TEXT NOT NULL,
            
            -- Margins
            gross_margin_pct REAL,
            ebit_margin_pct REAL,
            ebitda_margin_pct REAL,
            net_margin_pct REAL,
            pbt_margin_pct REAL,
            
            -- Growth rates (YoY)
            revenue_growth_pct REAL,
            ebit_growth_pct REAL,
            profit_growth_pct REAL,
            ebitda_growth_pct REAL,
            
            -- Efficiency ratios
            asset_turnover REAL,
            revenue_per_employee REAL,
            ebitda_per_employee REAL,
            
            -- Liquidity ratios
            current_ratio REAL,
            
            -- Leverage ratios
            debt_to_equity REAL,
            equity_ratio_pct REAL,
            
            -- Performance ratios
            roe_pct REAL,
            roa_pct REAL,
            
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (orgnr, year, period)
        )
    """)
    
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_kpis_orgnr_year 
        ON company_kpis_local(orgnr, year DESC)
    """)


def compute_kpis_for_year(
    conn: sqlite3.Connection,
    orgnr: str,
    year: int,
    period: str,
    prev_year_data: Optional[Dict] = None
) -> Optional[Dict]:
    """Compute KPIs for a specific company/year from financial_accounts_pivot."""
    cur = conn.execute("""
        SELECT 
            revenue_sek, ebit_sek, profit_sek, ebitda_sek,
            equity_sek, debt_sek, total_assets_sek, employees,
            equity_ratio, roe_pct, roa_pct
        FROM financial_accounts_pivot
        WHERE orgnr = ? AND year = ? AND period = ?
    """, (orgnr, year, period))
    
    row = cur.fetchone()
    if not row:
        return None
    
    (revenue, ebit, profit, ebitda, equity, debt, assets, employees,
     equity_ratio, roe, roa) = row
    
    kpis: Dict = {
        'orgnr': orgnr,
        'year': year,
        'period': period,
    }
    
    # Margins
    if revenue and revenue > 0:
        if ebit is not None:
            kpis['ebit_margin_pct'] = (ebit / revenue) * 100
        if ebitda is not None:
            kpis['ebitda_margin_pct'] = (ebitda / revenue) * 100
        if profit is not None:
            kpis['net_margin_pct'] = (profit / revenue) * 100
        
        # Get gross profit (BE) and PBT from financial_accounts
        cur2 = conn.execute("""
            SELECT 
                MAX(CASE WHEN account_code = 'BE' THEN amount_sek END) as gross_profit,
                MAX(CASE WHEN account_code = 'resultat_e_finansnetto' THEN amount_sek END) as pbt
            FROM financial_accounts
            WHERE orgnr = ? AND year = ? AND period = ?
        """, (orgnr, year, period))
        
        gp_row = cur2.fetchone()
        if gp_row:
            gross_profit, pbt = gp_row
            if gross_profit is not None:
                kpis['gross_margin_pct'] = (gross_profit / revenue) * 100
            if pbt is not None:
                kpis['pbt_margin_pct'] = (pbt / revenue) * 100
    
    # Growth rates (YoY)
    if prev_year_data:
        prev_revenue = prev_year_data.get('revenue')
        prev_ebit = prev_year_data.get('ebit')
        prev_profit = prev_year_data.get('profit')
        prev_ebitda = prev_year_data.get('ebitda')
        
        if revenue and prev_revenue and prev_revenue > 0:
            kpis['revenue_growth_pct'] = ((revenue - prev_revenue) / prev_revenue) * 100
        
        if ebit is not None and prev_ebit is not None and prev_ebit != 0:
            kpis['ebit_growth_pct'] = ((ebit - prev_ebit) / abs(prev_ebit)) * 100
        
        if profit is not None and prev_profit is not None and prev_profit != 0:
            kpis['profit_growth_pct'] = ((profit - prev_profit) / abs(prev_profit)) * 100
        
        if ebitda is not None and prev_ebitda is not None and prev_ebitda != 0:
            kpis['ebitda_growth_pct'] = ((ebitda - prev_ebitda) / abs(prev_ebitda)) * 100
    
    # Efficiency ratios
    if assets and assets > 0 and revenue:
        kpis['asset_turnover'] = revenue / assets
    
    if employees and employees > 0:
        if revenue:
            kpis['revenue_per_employee'] = revenue / employees
        if ebitda is not None:
            kpis['ebitda_per_employee'] = ebitda / employees
    
    # Liquidity ratios
    cur3 = conn.execute("""
        SELECT 
            MAX(CASE WHEN account_code = 'SOM' THEN amount_sek END) as current_assets,
            MAX(CASE WHEN account_code = 'KB' THEN amount_sek END) as current_liabilities
        FROM financial_accounts
        WHERE orgnr = ? AND year = ? AND period = ?
    """, (orgnr, year, period))
    
    liq_row = cur3.fetchone()
    if liq_row:
        current_assets, current_liabilities = liq_row
        if current_assets and current_liabilities and current_liabilities > 0:
            kpis['current_ratio'] = current_assets / current_liabilities
    
    # Leverage ratios
    if equity is not None and debt is not None:
        if equity > 0:
            kpis['debt_to_equity'] = debt / equity
        elif debt > 0:
            kpis['debt_to_equity'] = None  # Negative equity
    
    if equity_ratio is not None:
        kpis['equity_ratio_pct'] = equity_ratio
    
    # Performance ratios
    if roe is not None:
        kpis['roe_pct'] = roe
    if roa is not None:
        kpis['roa_pct'] = roa
    
    return kpis


def compute_all_kpis(db_path: Path, dry_run: bool = False) -> None:
    """Compute KPIs for all companies/years in the database."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    ensure_kpi_table(conn)
    
    if not dry_run:
        conn.execute("DELETE FROM company_kpis_local")
    
    # Get all company/year combinations
    cur = conn.execute("""
        SELECT DISTINCT orgnr, year, period
        FROM financial_accounts_pivot
        ORDER BY orgnr, year, period
    """)
    
    rows = cur.fetchall()
    total = len(rows)
    computed = 0
    errors = 0
    
    prev_data: Dict[str, Dict] = {}  # orgnr -> {year: data}
    
    for i, row in enumerate(rows):
        orgnr = row['orgnr']
        year = row['year']
        period = row['period']
        
        # Get previous year data for growth calculations
        prev_year = year - 1
        prev_year_data = prev_data.get(orgnr, {}).get(prev_year)
        
        try:
            kpis = compute_kpis_for_year(conn, orgnr, year, period, prev_year_data)
            
            if kpis:
                # Store current year data for next iteration
                if orgnr not in prev_data:
                    prev_data[orgnr] = {}
                
                # Get current year financials for next year's growth calc
                cur_fin = conn.execute("""
                    SELECT revenue_sek, ebit_sek, profit_sek, ebitda_sek
                    FROM financial_accounts_pivot
                    WHERE orgnr = ? AND year = ? AND period = ?
                """, (orgnr, year, period)).fetchone()
                
                if cur_fin:
                    prev_data[orgnr][year] = {
                        'revenue': cur_fin[0],
                        'ebit': cur_fin[1],
                        'profit': cur_fin[2],
                        'ebitda': cur_fin[3],
                    }
                
                if not dry_run:
                    conn.execute("""
                        INSERT OR REPLACE INTO company_kpis_local (
                            orgnr, year, period,
                            gross_margin_pct, ebit_margin_pct, ebitda_margin_pct,
                            net_margin_pct, pbt_margin_pct,
                            revenue_growth_pct, ebit_growth_pct, profit_growth_pct, ebitda_growth_pct,
                            asset_turnover, revenue_per_employee, ebitda_per_employee,
                            current_ratio, debt_to_equity, equity_ratio_pct,
                            roe_pct, roa_pct
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        kpis['orgnr'], kpis['year'], kpis['period'],
                        kpis.get('gross_margin_pct'), kpis.get('ebit_margin_pct'),
                        kpis.get('ebitda_margin_pct'), kpis.get('net_margin_pct'),
                        kpis.get('pbt_margin_pct'),
                        kpis.get('revenue_growth_pct'), kpis.get('ebit_growth_pct'),
                        kpis.get('profit_growth_pct'), kpis.get('ebitda_growth_pct'),
                        kpis.get('asset_turnover'), kpis.get('revenue_per_employee'),
                        kpis.get('ebitda_per_employee'),
                        kpis.get('current_ratio'), kpis.get('debt_to_equity'),
                        kpis.get('equity_ratio_pct'),
                        kpis.get('roe_pct'), kpis.get('roa_pct')
                    ))
                
                computed += 1
                
                if (i + 1) % 1000 == 0:
                    print(f"Processed {i + 1}/{total} records...")
                    if not dry_run:
                        conn.commit()
        except Exception as e:
            errors += 1
            if errors <= 10:  # Print first 10 errors
                print(f"Error computing KPIs for {orgnr} {year}: {e}")
    
    if not dry_run:
        conn.commit()
    
    conn.close()
    
    mode = "DRY RUN" if dry_run else "COMPLETED"
    print(f"\n[{mode}]")
    print(f"  Total records: {total}")
    print(f"  Computed: {computed}")
    print(f"  Errors: {errors}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute KPIs for local SQLite database")
    parser.add_argument(
        "--db",
        default="data/new_schema_local.db",
        help="Path to local SQLite database",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only compute without persisting to database",
    )
    
    args = parser.parse_args()
    compute_all_kpis(Path(args.db), dry_run=args.dry_run)


if __name__ == "__main__":
    main()


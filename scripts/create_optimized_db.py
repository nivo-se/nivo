#!/usr/bin/env python3
"""
Create an optimized database structure from scraper staging data.

This script creates a minimal, efficient database with:
1. companies table: All company details (orgnr, company_id, name, address, employees, etc.)
2. financials table: All financial data (one row per company-year with all account codes as columns)

Target size: ~100-200 MB for 13k companies
"""

import sqlite3
import json
import argparse
from pathlib import Path
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Any, Set

# Account codes to extract (all known codes from Allabolag)
ALL_ACCOUNT_CODES = [
    'SDI', 'DR', 'ORS', 'RG', 'EK', 'FK', 'SV',  # Core metrics
    'ADI', 'ADK', 'ADR', 'AK', 'ANT',  # Additional
    'FI', 'GG', 'KBP', 'LG',  # More
    'SAP', 'SED', 'SI', 'SEK', 'SF', 'SFA', 'SGE', 'SIA', 'SIK',  # Even more
    'SKG', 'SKGKI', 'SKO', 'SLG', 'SOM', 'SUB',  # More
    'SVD', 'UTR', 'FSD', 'KB',  # More
    'AWA', 'IAC', 'MIN', 'BE', 'TR',  # More
    # Add any others discovered
]

def discover_account_codes_from_raw_data(conn: sqlite3.Connection) -> Set[str]:
    """Discover all unique account codes from raw_data JSON"""
    cur = conn.cursor()
    all_codes = set()
    
    cur.execute("""
        SELECT raw_data FROM staging_financials 
        WHERE raw_data IS NOT NULL 
        LIMIT 1000
    """)
    
    for row in cur.fetchall():
        try:
            raw_json = json.loads(row[0])
            # Navigate through the JSON structure to find account codes
            # The structure is: pageProps -> company -> companyAccounts -> accounts (array)
            if 'pageProps' in raw_json:
                page_props = raw_json['pageProps']
                if 'company' in page_props:
                    company = page_props['company']
                    # Check companyAccounts (the actual structure)
                    if 'companyAccounts' in company:
                        for report in company['companyAccounts']:
                            if 'accounts' in report and isinstance(report['accounts'], list):
                                for acc in report['accounts']:
                                    if isinstance(acc, dict) and 'code' in acc:
                                        all_codes.add(acc['code'])
        except Exception as e:
            continue
    
    return all_codes

def extract_account_codes_from_raw_data(raw_data: str, target_year: int = None, target_period: str = None) -> Dict[str, float]:
    """Extract account codes from raw_data JSON for a specific year/period
    
    IMPORTANT: Allabolag stores all financial values in thousands of SEK.
    So 72,000 in JSON = 72,000,000 SEK (72 million).
    We multiply by 1000 to convert to actual SEK.
    
    Exception: Employee count (ANT) is NOT in thousands, so we keep it as-is.
    
    Args:
        raw_data: JSON string from staging database
        target_year: Year to extract (if None, extracts from first/latest report)
        target_period: Period to extract (if None, uses '12' or latest)
    """
    account_codes = {}
    
    try:
        raw_json = json.loads(raw_data)
        
        # Navigate through JSON structure
        # Structure: pageProps -> company -> companyAccounts -> accounts (array)
        if 'pageProps' in raw_json:
            page_props = raw_json['pageProps']
            if 'company' in page_props:
                company = page_props['company']
                
                # Check companyAccounts (the actual structure)
                if 'companyAccounts' in company:
                    # If target_year is specified, find the matching report
                    if target_year is not None:
                        for report in company['companyAccounts']:
                            report_year = report.get('year')
                            report_period = report.get('period', '')
                            
                            # Match year and period
                            year_match = report_year == target_year
                            period_match = (target_period is None or 
                                          report_period == target_period or 
                                          report_period.endswith('-12') or
                                          report_period == '12')
                            
                            if year_match and period_match:
                                # Extract account codes from this specific report
                                if 'accounts' in report and isinstance(report['accounts'], list):
                                    for acc in report['accounts']:
                                        if isinstance(acc, dict):
                                            code = acc.get('code')
                                            amount = acc.get('amount')
                                            if code and amount is not None:
                                                try:
                                                    value = float(amount)
                                                    # Allabolag stores values in thousands of SEK
                                                    # Multiply by 1000 to get actual SEK
                                                    # EXCEPT for employee count (ANT) which is not in thousands
                                                    if code != 'ANT':
                                                        value = value * 1000
                                                    account_codes[code] = value
                                                except (ValueError, TypeError):
                                                    pass
                                break  # Found matching report, stop searching
                    else:
                        # No target year specified - extract from first report (usually latest)
                        if company['companyAccounts']:
                            report = company['companyAccounts'][0]
                            if 'accounts' in report and isinstance(report['accounts'], list):
                                for acc in report['accounts']:
                                    if isinstance(acc, dict):
                                        code = acc.get('code')
                                        amount = acc.get('amount')
                                        if code and amount is not None:
                                            try:
                                                value = float(amount)
                                                # Allabolag stores values in thousands of SEK
                                                # Multiply by 1000 to get actual SEK
                                                # EXCEPT for employee count (ANT) which is not in thousands
                                                if code != 'ANT':
                                                    value = value * 1000
                                                account_codes[code] = value
                                            except (ValueError, TypeError):
                                                pass
    except Exception as e:
        pass
    
    return account_codes

def create_optimized_schema(conn: sqlite3.Connection, all_account_codes: Set[str]):
    """Create optimized database schema"""
    cur = conn.cursor()
    
    # Companies table - all non-financial company data
    cur.execute("""
        CREATE TABLE IF NOT EXISTS companies (
            orgnr TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            company_name TEXT NOT NULL,
            homepage TEXT,
            foundation_year INTEGER,
            employees_latest INTEGER,
            nace_categories TEXT,  -- JSON array
            segment_names TEXT,    -- JSON array
            address TEXT,
            city TEXT,
            postal_code TEXT,
            country TEXT DEFAULT 'SE',
            phone TEXT,
            email TEXT,
            scraped_at TEXT,
            updated_at TEXT DEFAULT (datetime('now'))
        );
    """)
    
    # Financials table - one row per company-year with all account codes as columns
    # Build column definitions dynamically
    financial_columns = [
        "id TEXT PRIMARY KEY",
        "orgnr TEXT NOT NULL",
        "company_id TEXT NOT NULL",
        "year INTEGER NOT NULL",
        "period TEXT NOT NULL DEFAULT '12'",
        "period_start TEXT",
        "period_end TEXT",
        "currency TEXT DEFAULT 'SEK'",
        "employees INTEGER",
        "scraped_at TEXT",
    ]
    
    # Add all account codes as columns
    for code in sorted(all_account_codes):
        col_name = code.lower()
        financial_columns.append(f"{col_name}_sek REAL")
    
    # Add index columns
    financial_columns.append("created_at TEXT DEFAULT (datetime('now'))")
    
    create_financials_sql = f"""
        CREATE TABLE IF NOT EXISTS financials (
            {', '.join(financial_columns)},
            FOREIGN KEY (orgnr) REFERENCES companies(orgnr) ON DELETE CASCADE,
            UNIQUE(orgnr, year, period)
        );
    """
    
    cur.execute(create_financials_sql)
    
    # Create indexes
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_financials_orgnr_year 
        ON financials(orgnr, year DESC);
    """)
    
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_financials_company_id 
        ON financials(company_id);
    """)
    
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_financials_year 
        ON financials(year DESC);
    """)
    
    conn.commit()
    print(f"✅ Created optimized schema with {len(all_account_codes)} account code columns")

def migrate_companies(conn_source: sqlite3.Connection, conn_target: sqlite3.Connection):
    """Migrate company data"""
    cur_source = conn_source.cursor()
    cur_target = conn_target.cursor()
    
    print("\n📊 Migrating companies...")
    
    # Get all companies with their resolved company_ids
    cur_source.execute("""
        SELECT 
            sc.orgnr,
            COALESCE(sci.company_id, sc.company_id) as company_id,
            sc.company_name,
            sc.homepage,
            sc.foundation_year,
            sc.revenue_sek,
            sc.profit_sek,
            sc.nace_categories,
            sc.segment_name,
            sc.scraped_at
        FROM staging_companies sc
        LEFT JOIN staging_company_ids sci ON sc.orgnr = sci.orgnr
        ORDER BY sc.orgnr
    """)
    
    companies = cur_source.fetchall()
    print(f"  Found {len(companies)} companies")
    
    # Get latest employees from financials
    cur_source.execute("""
        SELECT orgnr, MAX(employees) as employees_latest
        FROM staging_financials
        WHERE employees IS NOT NULL
        GROUP BY orgnr
    """)
    employees_map = {row[0]: row[1] for row in cur_source.fetchall()}
    
    inserted = 0
    for row in companies:
        orgnr, company_id, company_name, homepage, foundation_year, revenue_sek, profit_sek, nace_categories, segment_name, scraped_at = row
        
        # Parse JSON fields
        nace = nace_categories if isinstance(nace_categories, str) else json.dumps(nace_categories) if nace_categories else '[]'
        segments = segment_name if isinstance(segment_name, str) else json.dumps(segment_name) if segment_name else '[]'
        
        cur_target.execute("""
            INSERT OR REPLACE INTO companies (
                orgnr, company_id, company_name, homepage, foundation_year,
                employees_latest, nace_categories, segment_names, scraped_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            orgnr,
            company_id or orgnr,  # Fallback to orgnr if no company_id
            company_name,
            homepage,
            foundation_year,
            employees_map.get(orgnr),
            nace,
            segments,
            scraped_at
        ))
        inserted += 1
    
    conn_target.commit()
    print(f"  ✅ Inserted {inserted} companies")

def migrate_financials(conn_source: sqlite3.Connection, conn_target: sqlite3.Connection, all_account_codes: Set[str]):
    """Migrate financial data"""
    cur_source = conn_source.cursor()
    cur_target = conn_target.cursor()
    
    print("\n📊 Migrating financials...")
    
    # Get all financial records
    cur_source.execute("""
        SELECT 
            sf.orgnr,
            sf.company_id,
            sf.year,
            sf.period,
            sf.period_start,
            sf.period_end,
            sf.currency,
            sf.employees,
            sf.revenue,
            sf.profit,
            sf.raw_data,
            sf.scraped_at
        FROM staging_financials sf
        WHERE sf.year >= 2020  -- Keep only last 5 years
        ORDER BY sf.orgnr, sf.year DESC, sf.period
    """)
    
    financials = cur_source.fetchall()
    print(f"  Found {len(financials)} financial records")
    
    # Build insert statement with all account code columns
    base_cols = ['id', 'orgnr', 'company_id', 'year', 'period', 'period_start', 'period_end', 'currency', 'employees', 'scraped_at']
    account_cols = [f"{code.lower()}_sek" for code in sorted(all_account_codes)]
    all_cols = base_cols + account_cols
    
    placeholders = ', '.join(['?' for _ in all_cols])
    insert_sql = f"""
        INSERT OR REPLACE INTO financials ({', '.join(all_cols)})
        VALUES ({placeholders})
    """
    
    inserted = 0
    skipped = 0
    
    for row in financials:
        orgnr, company_id, year, period, period_start, period_end, currency, employees, revenue, profit, raw_data, scraped_at = row
        
        # Extract account codes from raw_data for THIS SPECIFIC YEAR
        account_codes = {}
        if raw_data:
            # IMPORTANT: Extract account codes for the specific year we're processing
            account_codes = extract_account_codes_from_raw_data(raw_data, target_year=year, target_period=period)
        
        # Use explicit fields if account codes not found
        # IMPORTANT: staging_financials.revenue and profit are in thousands of SEK
        # Multiply by 1000 to convert to actual SEK
        if not account_codes:
            if revenue:
                account_codes['SDI'] = revenue * 1000
            if profit:
                account_codes['DR'] = profit * 1000
        
        # Build values list
        values = [
            f"{orgnr}_{year}_{period}",  # id
            orgnr,
            company_id or orgnr,
            year,
            period or '12',
            period_start,
            period_end,
            currency or 'SEK',
            employees,
            scraped_at,
        ]
        
        # Add account code values in sorted order
        for code in sorted(all_account_codes):
            col_name = f"{code.lower()}_sek"
            value = account_codes.get(code)
            values.append(value)
        
        try:
            cur_target.execute(insert_sql, values)
            inserted += 1
        except Exception as e:
            skipped += 1
            if skipped <= 5:  # Show first 5 errors
                print(f"    ⚠️  Skipped {orgnr} {year}: {e}")
    
    conn_target.commit()
    print(f"  ✅ Inserted {inserted} financial records")
    if skipped > 0:
        print(f"  ⚠️  Skipped {skipped} records")

def main():
    parser = argparse.ArgumentParser(description="Create optimized database from scraper staging data")
    parser.add_argument("--source", required=True, help="Source staging database path")
    parser.add_argument("--output", required=True, help="Output optimized database path")
    parser.add_argument("--discover-codes", action="store_true", help="Discover account codes from raw_data")
    args = parser.parse_args()
    
    source_path = Path(args.source)
    output_path = Path(args.output)
    
    if not source_path.exists():
        print(f"❌ Source database not found: {source_path}")
        return
    
    print("🚀 Creating Optimized Database")
    print("="*70)
    print(f"Source: {source_path}")
    print(f"Output: {output_path}")
    
    # Connect to databases
    conn_source = sqlite3.connect(str(source_path))
    conn_target = sqlite3.connect(str(output_path))
    
    # Discover account codes
    if args.discover_codes:
        print("\n🔍 Discovering account codes from raw_data...")
        all_account_codes = discover_account_codes_from_raw_data(conn_source)
        print(f"  Found {len(all_account_codes)} unique account codes")
    else:
        # Use predefined codes
        all_account_codes = set(ALL_ACCOUNT_CODES)
        print(f"\n📋 Using {len(all_account_codes)} predefined account codes")
    
    # Create schema
    create_optimized_schema(conn_target, all_account_codes)
    
    # Migrate data
    migrate_companies(conn_source, conn_target)
    migrate_financials(conn_source, conn_target, all_account_codes)
    
    # Get final stats
    cur_target = conn_target.cursor()
    cur_target.execute("SELECT COUNT(*) FROM companies")
    company_count = cur_target.fetchone()[0]
    
    cur_target.execute("SELECT COUNT(*) FROM financials")
    financial_count = cur_target.fetchone()[0]
    
    # Get database size
    size_mb = output_path.stat().st_size / (1024 * 1024)
    
    print("\n" + "="*70)
    print("✅ OPTIMIZATION COMPLETE")
    print(f"  Companies: {company_count:,}")
    print(f"  Financial records: {financial_count:,}")
    print(f"  Database size: {size_mb:.1f} MB")
    print(f"  Account codes: {len(all_account_codes)}")
    
    conn_source.close()
    conn_target.close()

if __name__ == "__main__":
    main()


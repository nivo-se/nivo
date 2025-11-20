#!/usr/bin/env python3
"""
Validate the optimized database for completeness and accuracy.

This script:
1. Checks data completeness (all companies, all financial records)
2. Validates data integrity (relationships, required fields)
3. Compares with staging database to ensure nothing was lost
4. Provides statistics and reports any issues
"""

import sqlite3
import json
import argparse
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Tuple, Set

def validate_companies(conn_opt: sqlite3.Connection, conn_staging: sqlite3.Connection) -> Dict:
    """Validate companies table"""
    print("\n📊 VALIDATING COMPANIES TABLE")
    print("="*70)
    
    cur_opt = conn_opt.cursor()
    cur_staging = conn_staging.cursor()
    
    # Count companies
    cur_opt.execute("SELECT COUNT(*) FROM companies")
    opt_count = cur_opt.fetchone()[0]
    
    cur_staging.execute("SELECT COUNT(*) FROM staging_companies")
    staging_count = cur_staging.fetchone()[0]
    
    print(f"  Optimized DB: {opt_count:,} companies")
    print(f"  Staging DB:   {staging_count:,} companies")
    
    if opt_count != staging_count:
        print(f"  ⚠️  COUNT MISMATCH: {abs(opt_count - staging_count)} companies difference")
    else:
        print(f"  ✅ Count matches")
    
    # Check for required fields
    cur_opt.execute("""
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN orgnr IS NULL OR orgnr = '' THEN 1 ELSE 0 END) as missing_orgnr,
            SUM(CASE WHEN company_id IS NULL OR company_id = '' THEN 1 ELSE 0 END) as missing_company_id,
            SUM(CASE WHEN company_name IS NULL OR company_name = '' THEN 1 ELSE 0 END) as missing_name
        FROM companies
    """)
    stats = cur_opt.fetchone()
    total, missing_orgnr, missing_company_id, missing_name = stats
    
    print(f"\n  Required Fields Check:")
    print(f"    Total companies: {total:,}")
    print(f"    Missing orgnr: {missing_orgnr}")
    print(f"    Missing company_id: {missing_company_id}")
    print(f"    Missing company_name: {missing_name}")
    
    if missing_orgnr == 0 and missing_company_id == 0 and missing_name == 0:
        print(f"    ✅ All required fields present")
    else:
        print(f"    ⚠️  Some required fields missing")
    
    # Check for duplicate orgnrs
    cur_opt.execute("""
        SELECT orgnr, COUNT(*) as cnt
        FROM companies
        GROUP BY orgnr
        HAVING cnt > 1
    """)
    duplicates = cur_opt.fetchall()
    
    if duplicates:
        print(f"    ⚠️  Found {len(duplicates)} duplicate orgnrs")
        for orgnr, cnt in duplicates[:5]:
            print(f"      {orgnr}: {cnt} times")
    else:
        print(f"    ✅ No duplicate orgnrs")
    
    # Compare orgnrs between databases
    cur_opt.execute("SELECT orgnr FROM companies ORDER BY orgnr")
    opt_orgnrs = set(row[0] for row in cur_opt.fetchall())
    
    cur_staging.execute("SELECT orgnr FROM staging_companies ORDER BY orgnr")
    staging_orgnrs = set(row[0] for row in cur_staging.fetchall())
    
    missing_in_opt = staging_orgnrs - opt_orgnrs
    extra_in_opt = opt_orgnrs - staging_orgnrs
    
    if missing_in_opt:
        print(f"\n  ⚠️  {len(missing_in_opt)} companies in staging but not in optimized:")
        for orgnr in list(missing_in_opt)[:5]:
            print(f"      {orgnr}")
        if len(missing_in_opt) > 5:
            print(f"      ... and {len(missing_in_opt) - 5} more")
    
    if extra_in_opt:
        print(f"\n  ⚠️  {len(extra_in_opt)} companies in optimized but not in staging:")
        for orgnr in list(extra_in_opt)[:5]:
            print(f"      {orgnr}")
        if len(extra_in_opt) > 5:
            print(f"      ... and {len(extra_in_opt) - 5} more")
    
    if not missing_in_opt and not extra_in_opt:
        print(f"\n  ✅ All companies match between databases")
    
    return {
        'count': opt_count,
        'staging_count': staging_count,
        'missing_orgnr': missing_orgnr,
        'missing_company_id': missing_company_id,
        'missing_name': missing_name,
        'duplicates': len(duplicates),
        'missing_in_opt': len(missing_in_opt),
        'extra_in_opt': len(extra_in_opt)
    }

def validate_financials(conn_opt: sqlite3.Connection, conn_staging: sqlite3.Connection) -> Dict:
    """Validate financials table"""
    print("\n📊 VALIDATING FINANCIALS TABLE")
    print("="*70)
    
    cur_opt = conn_opt.cursor()
    cur_staging = conn_staging.cursor()
    
    # Count financial records
    cur_opt.execute("SELECT COUNT(*) FROM financials")
    opt_count = cur_opt.fetchone()[0]
    
    cur_staging.execute("""
        SELECT COUNT(*) FROM staging_financials 
        WHERE year >= 2020
    """)
    staging_count = cur_staging.fetchone()[0]
    
    print(f"  Optimized DB: {opt_count:,} financial records (2020+)")
    print(f"  Staging DB:   {staging_count:,} financial records (2020+)")
    
    if abs(opt_count - staging_count) > 10:  # Allow small difference
        print(f"  ⚠️  COUNT MISMATCH: {abs(opt_count - staging_count)} records difference")
    else:
        print(f"  ✅ Count matches (within tolerance)")
    
    # Check year distribution
    cur_opt.execute("""
        SELECT year, COUNT(*) as cnt
        FROM financials
        GROUP BY year
        ORDER BY year DESC
    """)
    year_dist = cur_opt.fetchall()
    
    print(f"\n  Year Distribution:")
    for year, cnt in year_dist:
        print(f"    {year}: {cnt:,} records")
    
    # Check for companies with financials
    cur_opt.execute("SELECT COUNT(DISTINCT orgnr) FROM financials")
    companies_with_financials = cur_opt.fetchone()[0]
    
    cur_opt.execute("SELECT COUNT(*) FROM companies")
    total_companies = cur_opt.fetchone()[0]
    
    print(f"\n  Companies with Financials:")
    print(f"    Total companies: {total_companies:,}")
    print(f"    With financials: {companies_with_financials:,}")
    print(f"    Coverage: {companies_with_financials/total_companies*100:.1f}%")
    
    # Check for required fields
    cur_opt.execute("""
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN orgnr IS NULL OR orgnr = '' THEN 1 ELSE 0 END) as missing_orgnr,
            SUM(CASE WHEN company_id IS NULL OR company_id = '' THEN 1 ELSE 0 END) as missing_company_id,
            SUM(CASE WHEN year IS NULL THEN 1 ELSE 0 END) as missing_year,
            SUM(CASE WHEN period IS NULL OR period = '' THEN 1 ELSE 0 END) as missing_period
        FROM financials
    """)
    stats = cur_opt.fetchone()
    total, missing_orgnr, missing_company_id, missing_year, missing_period = stats
    
    print(f"\n  Required Fields Check:")
    print(f"    Total records: {total:,}")
    print(f"    Missing orgnr: {missing_orgnr}")
    print(f"    Missing company_id: {missing_company_id}")
    print(f"    Missing year: {missing_year}")
    print(f"    Missing period: {missing_period}")
    
    if missing_orgnr == 0 and missing_company_id == 0 and missing_year == 0 and missing_period == 0:
        print(f"    ✅ All required fields present")
    else:
        print(f"    ⚠️  Some required fields missing")
    
    # Check foreign key relationships
    cur_opt.execute("""
        SELECT COUNT(*) 
        FROM financials f
        LEFT JOIN companies c ON f.orgnr = c.orgnr
        WHERE c.orgnr IS NULL
    """)
    orphaned_financials = cur_opt.fetchone()[0]
    
    if orphaned_financials > 0:
        print(f"\n  ⚠️  {orphaned_financials} financial records with no matching company")
    else:
        print(f"\n  ✅ All financial records have matching companies")
    
    # Check account code coverage
    cur_opt.execute("PRAGMA table_info(financials)")
    columns = cur_opt.fetchall()
    account_code_cols = [c[1] for c in columns if c[1].endswith('_sek')]
    
    print(f"\n  Account Code Coverage:")
    print(f"    Total account code columns: {len(account_code_cols)}")
    
    # Check which account codes have data
    coverage_stats = {}
    for col in account_code_cols[:10]:  # Check first 10
        cur_opt.execute(f"SELECT COUNT(*) FROM financials WHERE {col} IS NOT NULL")
        count = cur_opt.fetchone()[0]
        coverage = count / total * 100 if total > 0 else 0
        code = col.replace('_sek', '').upper()
        coverage_stats[code] = coverage
        print(f"      {code:6s}: {count:>6,} records ({coverage:5.1f}%)")
    
    # Check core metrics
    print(f"\n  Core Metrics Coverage:")
    core_metrics = {
        'SDI': 'Revenue',
        'DR': 'Net Profit',
        'EK': 'Equity',
        'FK': 'Debt'
    }
    
    for code, name in core_metrics.items():
        col = f"{code.lower()}_sek"
        if col in account_code_cols:
            cur_opt.execute(f"SELECT COUNT(*) FROM financials WHERE {col} IS NOT NULL")
            count = cur_opt.fetchone()[0]
            coverage = count / total * 100 if total > 0 else 0
            print(f"      {name:15s} ({code:3s}): {count:>6,} records ({coverage:5.1f}%)")
    
    return {
        'count': opt_count,
        'staging_count': staging_count,
        'companies_with_financials': companies_with_financials,
        'total_companies': total_companies,
        'coverage_pct': companies_with_financials/total_companies*100 if total_companies > 0 else 0,
        'orphaned_financials': orphaned_financials,
        'account_code_columns': len(account_code_cols)
    }

def compare_sample_data(conn_opt: sqlite3.Connection, conn_staging: sqlite3.Connection, num_samples: int = 5):
    """Compare sample data between databases"""
    print("\n📊 COMPARING SAMPLE DATA")
    print("="*70)
    
    cur_opt = conn_opt.cursor()
    cur_staging = conn_staging.cursor()
    
    # Get random companies
    cur_opt.execute("""
        SELECT orgnr, company_id, company_name
        FROM companies
        ORDER BY RANDOM()
        LIMIT ?
    """, (num_samples,))
    
    sample_companies = cur_opt.fetchall()
    
    print(f"  Comparing {len(sample_companies)} random companies:\n")
    
    matches = 0
    mismatches = 0
    
    for orgnr, company_id, company_name in sample_companies:
        print(f"  Company: {company_name} ({orgnr})")
        
        # Get company data from optimized
        cur_opt.execute("""
            SELECT company_id, company_name, homepage, employees_latest, foundation_year
            FROM companies
            WHERE orgnr = ?
        """, (orgnr,))
        opt_company = cur_opt.fetchone()
        
        # Get company data from staging
        cur_staging.execute("""
            SELECT 
                COALESCE(sci.company_id, sc.company_id) as company_id,
                sc.company_name,
                sc.homepage,
                (SELECT MAX(employees) FROM staging_financials WHERE orgnr = sc.orgnr) as employees_latest,
                sc.foundation_year
            FROM staging_companies sc
            LEFT JOIN staging_company_ids sci ON sc.orgnr = sci.orgnr
            WHERE sc.orgnr = ?
        """, (orgnr,))
        staging_company = cur_staging.fetchone()
        
        if opt_company and staging_company:
            # Compare
            opt_id, opt_name, opt_homepage, opt_employees, opt_foundation = opt_company
            stg_id, stg_name, stg_homepage, stg_employees, stg_foundation = staging_company
            
            match = True
            if opt_id != stg_id:
                print(f"    ⚠️  company_id: opt={opt_id}, staging={stg_id}")
                match = False
            if opt_name != stg_name:
                print(f"    ⚠️  company_name: opt={opt_name}, staging={stg_name}")
                match = False
            if opt_employees != stg_employees:
                print(f"    ⚠️  employees: opt={opt_employees}, staging={stg_employees}")
                match = False
            
            if match:
                print(f"    ✅ Company data matches")
                matches += 1
            else:
                mismatches += 1
        
        # Get financial data
        cur_opt.execute("""
            SELECT year, sdi_sek, dr_sek, ek_sek
            FROM financials
            WHERE orgnr = ?
            ORDER BY year DESC
            LIMIT 1
        """, (orgnr,))
        opt_financial = cur_opt.fetchone()
        
        if opt_financial:
            year, revenue, profit, equity = opt_financial
            rev_str = f"{revenue:,.0f}" if revenue else "N/A"
            prof_str = f"{profit:,.0f}" if profit else "N/A"
            print(f"    Latest financial ({year}): Revenue={rev_str}, Profit={prof_str}")
        
        print()
    
    print(f"  Summary: {matches} matches, {mismatches} mismatches")

def validate_data_integrity(conn_opt: sqlite3.Connection) -> Dict:
    """Check data integrity and consistency"""
    print("\n📊 DATA INTEGRITY CHECKS")
    print("="*70)
    
    cur = conn_opt.cursor()
    
    issues = []
    
    # Check for negative values where they shouldn't be
    print("  Checking for data anomalies...")
    
    # Revenue should generally be positive
    cur.execute("SELECT COUNT(*) FROM financials WHERE sdi_sek < 0")
    negative_revenue = cur.fetchone()[0]
    if negative_revenue > 0:
        issues.append(f"Found {negative_revenue} records with negative revenue")
        print(f"    ⚠️  {negative_revenue} records with negative revenue (may be valid)")
    
    # Check for extremely large values (potential data errors)
    cur.execute("SELECT COUNT(*) FROM financials WHERE sdi_sek > 1000000000000")  # > 1 trillion
    huge_revenue = cur.fetchone()[0]
    if huge_revenue > 0:
        issues.append(f"Found {huge_revenue} records with revenue > 1 trillion")
        print(f"    ⚠️  {huge_revenue} records with extremely large revenue values")
    
    # Check year range
    cur.execute("SELECT MIN(year), MAX(year) FROM financials")
    min_year, max_year = cur.fetchone()
    print(f"    Year range: {min_year} - {max_year}")
    
    if max_year > 2025:
        issues.append(f"Found financial data for future year: {max_year}")
        print(f"    ⚠️  Future year detected: {max_year}")
    
    # Check for duplicate company-year-period combinations
    cur.execute("""
        SELECT orgnr, year, period, COUNT(*) as cnt
        FROM financials
        GROUP BY orgnr, year, period
        HAVING cnt > 1
    """)
    duplicates = cur.fetchall()
    
    if duplicates:
        issues.append(f"Found {len(duplicates)} duplicate company-year-period combinations")
        print(f"    ⚠️  {len(duplicates)} duplicate company-year-period combinations")
        for orgnr, year, period, cnt in duplicates[:3]:
            print(f"      {orgnr} {year}-{period}: {cnt} records")
    else:
        print(f"    ✅ No duplicate company-year-period combinations")
    
    if not issues:
        print(f"    ✅ No major data integrity issues found")
    
    return {
        'issues': issues,
        'negative_revenue': negative_revenue,
        'huge_revenue': huge_revenue,
        'duplicates': len(duplicates)
    }

def main():
    parser = argparse.ArgumentParser(description="Validate optimized database")
    parser.add_argument("--optimized", required=True, help="Path to optimized database")
    parser.add_argument("--staging", required=True, help="Path to staging database")
    parser.add_argument("--samples", type=int, default=5, help="Number of sample companies to compare")
    args = parser.parse_args()
    
    opt_path = Path(args.optimized)
    staging_path = Path(args.staging)
    
    if not opt_path.exists():
        print(f"❌ Optimized database not found: {opt_path}")
        return
    
    if not staging_path.exists():
        print(f"❌ Staging database not found: {staging_path}")
        return
    
    print("🔍 VALIDATING OPTIMIZED DATABASE")
    print("="*70)
    print(f"Optimized: {opt_path}")
    print(f"Staging:   {staging_path}")
    
    conn_opt = sqlite3.connect(str(opt_path))
    conn_staging = sqlite3.connect(str(staging_path))
    
    # Run validations
    company_stats = validate_companies(conn_opt, conn_staging)
    financial_stats = validate_financials(conn_opt, conn_staging)
    integrity_stats = validate_data_integrity(conn_opt)
    compare_sample_data(conn_opt, conn_staging, args.samples)
    
    # Summary
    print("\n" + "="*70)
    print("📊 VALIDATION SUMMARY")
    print("="*70)
    
    print(f"\nCompanies:")
    print(f"  ✅ Count: {company_stats['count']:,}")
    print(f"  {'⚠️' if company_stats['missing_in_opt'] > 0 else '✅'} Missing in optimized: {company_stats['missing_in_opt']}")
    print(f"  {'⚠️' if company_stats['duplicates'] > 0 else '✅'} Duplicates: {company_stats['duplicates']}")
    
    print(f"\nFinancials:")
    print(f"  ✅ Count: {financial_stats['count']:,}")
    print(f"  ✅ Coverage: {financial_stats['coverage_pct']:.1f}% of companies")
    print(f"  {'⚠️' if financial_stats['orphaned_financials'] > 0 else '✅'} Orphaned records: {financial_stats['orphaned_financials']}")
    print(f"  ✅ Account codes: {financial_stats['account_code_columns']}")
    
    print(f"\nData Integrity:")
    print(f"  {'⚠️' if integrity_stats['issues'] else '✅'} Issues: {len(integrity_stats['issues'])}")
    if integrity_stats['issues']:
        for issue in integrity_stats['issues']:
            print(f"    - {issue}")
    
    # Overall status
    all_good = (
        company_stats['missing_in_opt'] == 0 and
        company_stats['duplicates'] == 0 and
        financial_stats['orphaned_financials'] == 0 and
        len(integrity_stats['issues']) == 0
    )
    
    print(f"\n{'✅' if all_good else '⚠️'} Overall Status: {'PASS' if all_good else 'ISSUES FOUND'}")
    
    conn_opt.close()
    conn_staging.close()

if __name__ == "__main__":
    main()


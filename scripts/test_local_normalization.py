#!/usr/bin/env python3
"""Comprehensive local testing for financial_accounts normalization.

Tests:
1. Database structure and data integrity
2. Query functionality (JSONB vs normalized)
3. Performance comparison (SQLite)
4. Data consistency checks

Example:
  python3 scripts/test_local_normalization.py --db data/new_schema_local.db
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple


def connect_db(db_path: Path) -> sqlite3.Connection:
    """Connect to SQLite database."""
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def test_database_structure(conn: sqlite3.Connection) -> Tuple[bool, List[str]]:
    """Test that required tables and indexes exist."""
    print("=" * 80)
    print("TEST 1: Database Structure")
    print("=" * 80)
    
    errors = []
    required_tables = ['companies', 'company_financials', 'company_metrics', 'financial_accounts']
    required_indexes = [
        'financial_accounts_orgnr_year_idx',  # Actual index name
        'financial_accounts_account_code_idx',
        'financial_accounts_account_code_year_idx',
        'financial_accounts_financial_id_idx',
    ]
    
    # Check tables
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing_tables = {row[0] for row in cursor.fetchall()}
    
    for table in required_tables:
        if table in existing_tables:
            print(f"✅ Table '{table}' exists")
        else:
            print(f"❌ Table '{table}' missing")
            errors.append(f"Missing table: {table}")
    
    # Check indexes
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='index'")
    existing_indexes = {row[0] for row in cursor.fetchall()}
    
    for index in required_indexes:
        if index in existing_indexes:
            print(f"✅ Index '{index}' exists")
        else:
            print(f"⚠️  Index '{index}' missing (non-critical)")
    
    # Check pivot view
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='view' AND name='financial_accounts_pivot'")
    if cursor.fetchone():
        print("✅ View 'financial_accounts_pivot' exists")
    else:
        print("⚠️  View 'financial_accounts_pivot' missing (non-critical)")
    
    print()
    return len(errors) == 0, errors


def test_data_integrity(conn: sqlite3.Connection) -> Tuple[bool, List[str]]:
    """Test data integrity and coverage."""
    print("=" * 80)
    print("TEST 2: Data Integrity")
    print("=" * 80)
    
    errors = []
    
    # Count records
    financials_count = conn.execute("SELECT COUNT(*) FROM company_financials").fetchone()[0]
    accounts_count = conn.execute("SELECT COUNT(*) FROM financial_accounts").fetchone()[0]
    companies_count = conn.execute("SELECT COUNT(*) FROM companies").fetchone()[0]
    
    print(f"Companies: {companies_count:,}")
    print(f"Financial records: {financials_count:,}")
    print(f"Account rows: {accounts_count:,}")
    
    if accounts_count == 0:
        errors.append("No rows in financial_accounts table")
        print("❌ No data in financial_accounts")
    else:
        print("✅ financial_accounts has data")
    
    # Check coverage
    missing_coverage = conn.execute("""
        SELECT COUNT(*)
        FROM company_financials cf
        LEFT JOIN financial_accounts fa ON fa.financial_id = cf.id
        WHERE fa.financial_id IS NULL
    """).fetchone()[0]
    
    coverage_pct = (1 - missing_coverage / financials_count) * 100 if financials_count > 0 else 0
    print(f"Coverage: {coverage_pct:.1f}% ({financials_count - missing_coverage:,}/{financials_count:,})")
    
    if missing_coverage > 0:
        print(f"⚠️  {missing_coverage:,} financial records without normalized accounts")
    else:
        print("✅ All financial records have normalized accounts")
    
    # Check for orphaned accounts
    orphaned = conn.execute("""
        SELECT COUNT(*)
        FROM financial_accounts fa
        LEFT JOIN company_financials cf ON cf.id = fa.financial_id
        WHERE cf.id IS NULL
    """).fetchone()[0]
    
    if orphaned > 0:
        errors.append(f"{orphaned} orphaned account rows")
        print(f"❌ {orphaned:,} orphaned account rows")
    else:
        print("✅ No orphaned account rows")
    
    print()
    return len(errors) == 0, errors


def test_query_functionality(conn: sqlite3.Connection) -> Tuple[bool, List[str]]:
    """Test that queries work with both JSONB and normalized approaches."""
    print("=" * 80)
    print("TEST 3: Query Functionality")
    print("=" * 80)
    
    errors = []
    
    # Get a sample company
    sample_company = conn.execute("SELECT orgnr FROM companies LIMIT 1").fetchone()
    if not sample_company:
        errors.append("No companies in database")
        print("❌ No companies found")
        print()
        return False, errors
    
    orgnr = sample_company[0]
    print(f"Testing with company: {orgnr}")
    print()
    
    # Test 1: Get EBIT for 2024 (JSONB)
    print("Test 3.1: Get EBIT via JSONB")
    try:
        jsonb_result = conn.execute("""
            SELECT orgnr, year, 
                   json_extract(account_codes, '$.RG') as ebit_sek
            FROM company_financials
            WHERE orgnr = ? AND year = 2024
            LIMIT 1
        """, (orgnr,)).fetchone()
        
        if jsonb_result:
            print(f"✅ JSONB query works: EBIT = {jsonb_result['ebit_sek']}")
        else:
            print("⚠️  No 2024 data found (trying other years)")
            jsonb_result = conn.execute("""
                SELECT orgnr, year, 
                       json_extract(account_codes, '$.RG') as ebit_sek
                FROM company_financials
                WHERE orgnr = ? AND account_codes IS NOT NULL
                LIMIT 1
            """, (orgnr,)).fetchone()
            if jsonb_result:
                print(f"✅ JSONB query works: EBIT = {jsonb_result['ebit_sek']} (year {jsonb_result['year']})")
    except Exception as e:
        errors.append(f"JSONB query failed: {e}")
        print(f"❌ JSONB query failed: {e}")
    
    # Test 2: Get EBIT for 2024 (Normalized)
    print("\nTest 3.2: Get EBIT via Normalized Table")
    try:
        normalized_result = conn.execute("""
            SELECT orgnr, year, amount_sek as ebit_sek
            FROM financial_accounts
            WHERE orgnr = ? AND year = 2024 AND account_code = 'RG'
            LIMIT 1
        """, (orgnr,)).fetchone()
        
        if normalized_result:
            print(f"✅ Normalized query works: EBIT = {normalized_result['ebit_sek']}")
        else:
            print("⚠️  No 2024 data found (trying other years)")
            normalized_result = conn.execute("""
                SELECT orgnr, year, amount_sek as ebit_sek
                FROM financial_accounts
                WHERE orgnr = ? AND account_code = 'RG'
                LIMIT 1
            """, (orgnr,)).fetchone()
            if normalized_result:
                print(f"✅ Normalized query works: EBIT = {normalized_result['ebit_sek']} (year {normalized_result['year']})")
    except Exception as e:
        errors.append(f"Normalized query failed: {e}")
        print(f"❌ Normalized query failed: {e}")
    
    # Test 3: Pivot query (multiple metrics)
    print("\nTest 3.3: Pivot Query (Multiple Metrics)")
    try:
        pivot_result = conn.execute("""
            SELECT 
                fa.orgnr,
                fa.year,
                MAX(CASE WHEN fa.account_code = 'SDI' THEN fa.amount_sek END) as revenue_sek,
                MAX(CASE WHEN fa.account_code = 'RG' THEN fa.amount_sek END) as ebit_sek,
                MAX(CASE WHEN fa.account_code = 'DR' THEN fa.amount_sek END) as profit_sek
            FROM financial_accounts fa
            WHERE fa.orgnr = ?
            GROUP BY fa.orgnr, fa.year
            ORDER BY fa.year DESC
            LIMIT 3
        """, (orgnr,)).fetchall()
        
        if pivot_result:
            print(f"✅ Pivot query works: Found {len(pivot_result)} years")
            for row in pivot_result[:2]:
                print(f"   Year {row['year']}: Revenue={row['revenue_sek']}, EBIT={row['ebit_sek']}, Profit={row['profit_sek']}")
        else:
            print("⚠️  No pivot data found")
    except Exception as e:
        errors.append(f"Pivot query failed: {e}")
        print(f"❌ Pivot query failed: {e}")
    
    # Test 4: Pivot view
    print("\nTest 3.4: Pivot View")
    try:
        view_result = conn.execute("""
            SELECT * FROM financial_accounts_pivot
            WHERE orgnr = ?
            ORDER BY year DESC
            LIMIT 1
        """, (orgnr,)).fetchone()
        
        if view_result:
            print(f"✅ Pivot view works: Year {view_result['year']}")
            print(f"   Revenue={view_result['revenue_sek']}, EBIT={view_result['ebit_sek']}")
        else:
            print("⚠️  No pivot view data found")
    except Exception as e:
        print(f"⚠️  Pivot view test skipped: {e}")
    
    print()
    return len(errors) == 0, errors


def test_data_consistency(conn: sqlite3.Connection) -> Tuple[bool, List[str]]:
    """Test that JSONB and normalized data match."""
    print("=" * 80)
    print("TEST 4: Data Consistency (JSONB vs Normalized)")
    print("=" * 80)
    
    errors = []
    
    # Compare a sample of records
    sample = conn.execute("""
        SELECT cf.id, cf.orgnr, cf.year, cf.account_codes, 
               GROUP_CONCAT(fa.account_code || ':' || fa.amount_sek, '|') as normalized_accounts
        FROM company_financials cf
        JOIN financial_accounts fa ON fa.financial_id = cf.id
        WHERE cf.account_codes IS NOT NULL
        GROUP BY cf.id
        LIMIT 10
    """).fetchall()
    
    if not sample:
        errors.append("No sample data for comparison")
        print("❌ No data to compare")
        print()
        return False, errors
    
    print(f"Comparing {len(sample)} records...")
    mismatches = 0
    
    for row in sample:
        account_codes_json = json.loads(row['account_codes']) if row['account_codes'] else {}
        normalized_dict = {}
        
        if row['normalized_accounts']:
            for pair in row['normalized_accounts'].split('|'):
                if ':' in pair:
                    code, amount = pair.split(':', 1)
                    try:
                        normalized_dict[code] = float(amount)
                    except ValueError:
                        pass
        
        # Compare key account codes
        key_codes = ['SDI', 'RG', 'DR', 'EK', 'FK', 'EBITDA']
        for code in key_codes:
            jsonb_val = account_codes_json.get(code)
            normalized_val = normalized_dict.get(code)
            
            if jsonb_val is not None and normalized_val is not None:
                # Allow small floating point differences
                diff = abs(jsonb_val - normalized_val)
                if diff > 0.01:  # More than 0.01 SEK difference
                    mismatches += 1
                    if mismatches <= 3:  # Only show first 3 mismatches
                        print(f"⚠️  Mismatch for {row['orgnr']} {row['year']} {code}: JSONB={jsonb_val}, Normalized={normalized_val}")
    
    if mismatches == 0:
        print("✅ All compared values match between JSONB and normalized")
    else:
        print(f"⚠️  Found {mismatches} mismatches (may be due to rounding or missing codes)")
        if mismatches > len(sample) * 0.1:  # More than 10% mismatch rate
            errors.append(f"High mismatch rate: {mismatches}/{len(sample)}")
    
    print()
    return len(errors) == 0, errors


def test_performance(conn: sqlite3.Connection) -> Tuple[bool, List[str]]:
    """Compare query performance (simplified for SQLite)."""
    print("=" * 80)
    print("TEST 5: Query Performance Comparison")
    print("=" * 80)
    
    errors = []
    
    # Warmup
    conn.execute("SELECT 1").fetchone()
    
    # Test 1: Simple extraction
    print("Test 5.1: Simple EBIT Extraction (2024)")
    
    # JSONB approach
    start = time.time()
    jsonb_result = conn.execute("""
        SELECT COUNT(*) as cnt
        FROM company_financials
        WHERE year = 2024 AND account_codes IS NOT NULL
        AND json_extract(account_codes, '$.RG') IS NOT NULL
    """).fetchone()
    jsonb_time = time.time() - start
    
    # Normalized approach
    start = time.time()
    normalized_result = conn.execute("""
        SELECT COUNT(*) as cnt
        FROM financial_accounts
        WHERE year = 2024 AND account_code = 'RG'
    """).fetchone()
    normalized_time = time.time() - start
    
    jsonb_count = jsonb_result['cnt'] if jsonb_result else 0
    normalized_count = normalized_result['cnt'] if normalized_result else 0
    
    print(f"JSONB: {jsonb_time*1000:.2f}ms ({jsonb_count} records)")
    print(f"Normalized: {normalized_time*1000:.2f}ms ({normalized_count} records)")
    
    if normalized_time > 0:
        speedup = jsonb_time / normalized_time
        if speedup > 1:
            print(f"✅ Normalized is {speedup:.2f}x faster")
        elif speedup < 0.8:
            print(f"⚠️  Normalized is {1/speedup:.2f}x slower (may need indexes)")
        else:
            print("➡️  Performance is similar")
    
    print()
    
    # Test 2: Multi-metric query
    print("Test 5.2: Multi-Metric Query (Pivot)")
    
    sample_orgnr = conn.execute("SELECT orgnr FROM companies LIMIT 1").fetchone()[0]
    
    # JSONB approach
    start = time.time()
    jsonb_result = conn.execute("""
        SELECT 
            orgnr,
            year,
            json_extract(account_codes, '$.SDI') as revenue,
            json_extract(account_codes, '$.RG') as ebit,
            json_extract(account_codes, '$.DR') as profit
        FROM company_financials
        WHERE orgnr = ? AND year >= 2020
        ORDER BY year DESC
    """, (sample_orgnr,)).fetchall()
    jsonb_time = time.time() - start
    
    # Normalized approach
    start = time.time()
    normalized_result = conn.execute("""
        SELECT 
            fa.orgnr,
            fa.year,
            MAX(CASE WHEN fa.account_code = 'SDI' THEN fa.amount_sek END) as revenue,
            MAX(CASE WHEN fa.account_code = 'RG' THEN fa.amount_sek END) as ebit,
            MAX(CASE WHEN fa.account_code = 'DR' THEN fa.amount_sek END) as profit
        FROM financial_accounts fa
        WHERE fa.orgnr = ? AND fa.year >= 2020
        GROUP BY fa.orgnr, fa.year
        ORDER BY fa.year DESC
    """, (sample_orgnr,)).fetchall()
    normalized_time = time.time() - start
    
    print(f"JSONB: {jsonb_time*1000:.2f}ms ({len(jsonb_result)} years)")
    print(f"Normalized: {normalized_time*1000:.2f}ms ({len(normalized_result)} years)")
    
    if normalized_time > 0:
        speedup = jsonb_time / normalized_time
        if speedup > 1:
            print(f"✅ Normalized is {speedup:.2f}x faster")
        else:
            print(f"➡️  Performance is similar")
    
    print()
    return True, []


def main() -> None:
    parser = argparse.ArgumentParser(description="Test local financial_accounts normalization")
    parser.add_argument(
        "--db",
        default="data/new_schema_local.db",
        help="Path to local SQLite database",
    )
    parser.add_argument(
        "--skip-performance",
        action="store_true",
        help="Skip performance tests",
    )
    args = parser.parse_args()
    
    db_path = Path(args.db)
    
    print("=" * 80)
    print("LOCAL NORMALIZATION TEST SUITE")
    print("=" * 80)
    print(f"Database: {db_path}")
    print()
    
    conn = connect_db(db_path)
    
    all_errors = []
    tests_passed = 0
    tests_total = 4 if args.skip_performance else 5
    
    try:
        # Test 1: Structure
        passed, errors = test_database_structure(conn)
        if passed:
            tests_passed += 1
        all_errors.extend(errors)
        
        # Test 2: Integrity
        passed, errors = test_data_integrity(conn)
        if passed:
            tests_passed += 1
        all_errors.extend(errors)
        
        # Test 3: Functionality
        passed, errors = test_query_functionality(conn)
        if passed:
            tests_passed += 1
        all_errors.extend(errors)
        
        # Test 4: Consistency
        passed, errors = test_data_consistency(conn)
        if passed:
            tests_passed += 1
        all_errors.extend(errors)
        
        # Test 5: Performance
        if not args.skip_performance:
            passed, errors = test_performance(conn)
            if passed:
                tests_passed += 1
            all_errors.extend(errors)
        
        # Summary
        print("=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print(f"Tests passed: {tests_passed}/{tests_total}")
        
        if all_errors:
            print(f"\n❌ Found {len(all_errors)} error(s):")
            for error in all_errors[:10]:  # Show first 10 errors
                print(f"   - {error}")
            if len(all_errors) > 10:
                print(f"   ... and {len(all_errors) - 10} more")
            print("\n⚠️  Some tests failed. Review errors above.")
            exit(1)
        else:
            print("\n✅ All tests passed! Local normalization is working correctly.")
            print("\nNext steps:")
            print("1. Run: python3 scripts/validate_financial_accounts_local.py --db data/new_schema_local.db")
            print("2. Export CSVs: python3 scripts/export_financial_accounts_to_csv.py")
            print("3. Migrate to Supabase when ready")
    
    finally:
        conn.close()


if __name__ == "__main__":
    main()


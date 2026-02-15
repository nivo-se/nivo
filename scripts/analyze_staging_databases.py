#!/usr/bin/env python3
"""Analyze staging databases to identify missing data.

This script helps identify:
1. Which companies are in individual databases but not in the combined database
2. Which databases have the most unique companies
3. Recommendations for re-merging
"""

import sqlite3
from pathlib import Path
from collections import defaultdict
import sys


def get_companies_from_db(db_path: Path) -> set[str]:
    """Extract all ORGNRs from a staging database."""
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        cursor.execute("SELECT orgnr FROM staging_companies")
        orgnrs = set(row[0] for row in cursor.fetchall())
        conn.close()
        return orgnrs
    except Exception as e:
        print(f"  ⚠️  Error reading {db_path.name}: {e}", file=sys.stderr)
        return set()


def get_financials_count(db_path: Path) -> int:
    """Get count of financial records."""
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM staging_financials")
        count = cursor.fetchone()[0]
        conn.close()
        return count
    except:
        return 0


def main():
    staging_dir = Path("scraper/allabolag-scraper/staging")
    
    # Find all staging databases
    all_dbs = list(staging_dir.glob("staging_*.db"))
    excluded = {"staging_50_200_combined.db", "staging_current.db"}
    individual_dbs = [db for db in all_dbs if db.name not in excluded]
    
    # Load combined database
    combined_db = staging_dir / "staging_50_200_combined.db"
    if not combined_db.exists():
        print("❌ Combined database not found!")
        return
    
    print("=" * 80)
    print("STAGING DATABASE ANALYSIS")
    print("=" * 80)
    
    combined_orgnrs = get_companies_from_db(combined_db)
    print(f"\n📊 Combined database: {len(combined_orgnrs):,} companies")
    
    # Analyze each database
    db_analysis = []
    all_unique_orgnrs = set(combined_orgnrs)
    
    print(f"\n📁 Analyzing {len(individual_dbs)} individual databases...\n")
    
    for db_path in sorted(individual_dbs, key=lambda p: p.stat().st_size, reverse=True):
        orgnrs = get_companies_from_db(db_path)
        if not orgnrs:
            continue
        
        financials_count = get_financials_count(db_path)
        missing = orgnrs - combined_orgnrs
        new_unique = orgnrs - all_unique_orgnrs
        
        db_analysis.append({
            'name': db_path.name,
            'size_mb': db_path.stat().st_size / (1024*1024),
            'companies': len(orgnrs),
            'financials': financials_count,
            'missing': len(missing),
            'new_unique': len(new_unique),
            'orgnrs': orgnrs
        })
        
        all_unique_orgnrs.update(orgnrs)
    
    # Sort by missing/new unique companies
    db_analysis.sort(key=lambda x: (x['new_unique'], x['financials']), reverse=True)
    
    print("Databases with missing/new companies:\n")
    total_missing = 0
    total_new_unique = 0
    
    for db in db_analysis[:20]:  # Top 20
        if db['new_unique'] > 0 or db['missing'] > 0:
            print(f"  {db['name']}")
            print(f"    Companies: {db['companies']:,} | Financials: {db['financials']:,}")
            if db['missing'] > 0:
                print(f"    ⚠️  Missing from combined: {db['missing']:,}")
            if db['new_unique'] > 0:
                print(f"    ✨ New unique: {db['new_unique']:,}")
            print()
            total_missing += db['missing']
            total_new_unique += db['new_unique']
    
    print("=" * 80)
    print(f"SUMMARY")
    print("=" * 80)
    print(f"Combined database: {len(combined_orgnrs):,} companies")
    print(f"All unique companies (combined + individual): {len(all_unique_orgnrs):,}")
    print(f"Total missing from combined: {total_missing:,} companies")
    print(f"Total new unique companies: {total_new_unique:,} companies")
    print(f"Potential data loss: {len(all_unique_orgnrs) - len(combined_orgnrs):,} companies")
    
    # Identify databases with most missing data
    print("\n" + "=" * 80)
    print("RECOMMENDATIONS")
    print("=" * 80)
    
    # Find databases with financials that are missing
    dbs_with_financials = [db for db in db_analysis if db['financials'] > 0 and db['new_unique'] > 0]
    if dbs_with_financials:
        print("\n📋 Databases with financials that should be merged:")
        for db in dbs_with_financials[:5]:
            print(f"  - {db['name']}: {db['companies']:,} companies, {db['financials']:,} financials, {db['new_unique']:,} new unique")
    
    # Find databases with many companies but no financials
    dbs_no_financials = [db for db in db_analysis if db['financials'] == 0 and db['companies'] > 1000]
    if dbs_no_financials:
        print("\n⚠️  Databases with many companies but NO financials (incomplete scraping?):")
        for db in dbs_no_financials[:5]:
            print(f"  - {db['name']}: {db['companies']:,} companies, {db['new_unique']:,} new unique")
    
    print("\n💡 To re-merge all databases:")
    print("   python3 scripts/create_staging_snapshot.py \\")
    print("     --output scraper/allabolag-scraper/staging/staging_ALL_COMBINED.db \\")
    print("     scraper/allabolag-scraper/staging/staging_*.db")


if __name__ == "__main__":
    main()


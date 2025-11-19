#!/usr/bin/env python3
"""
Data Washing Script - Filter out unwanted companies before migration
Excludes restaurants, hotels, retail, and other non-target industries.
"""

import argparse
import json
import sqlite3
import sys
from pathlib import Path
from typing import Set, List, Dict, Any

# Load exclusion rules from filter_config.json
FILTER_CONFIG = Path(__file__).parent.parent / "database" / "filter_config.json"

def load_exclusion_rules() -> Set[str]:
    """Load excluded sectors from filter_config.json."""
    if FILTER_CONFIG.exists():
        with open(FILTER_CONFIG, 'r', encoding='utf-8') as f:
            config = json.load(f)
            excluded = set(config.get('excluded_sectors', []))
            print(f"  📋 Loaded {len(excluded)} excluded sectors from filter_config.json")
            return excluded
    else:
        # Default exclusions if config doesn't exist
        default_excluded = {
            "Restaurang", "Restaurant", "Hotell", "Hotel", 
            "Catering", "Detaljhandel", "Butikshandel",
            "Bokhandlare", "Livsmedel", "Spedition"
        }
        print(f"  ⚠️  filter_config.json not found, using default exclusions")
        return default_excluded

def is_excluded_company(company_row: Dict[str, Any], excluded_sectors: Set[str]) -> bool:
    """Check if company should be excluded based on segment_names."""
    segment_names = company_row.get('segment_names')
    
    if not segment_names:
        return False  # Keep companies without segment info
    
    # Parse segment_names (can be JSON string or already parsed)
    try:
        if isinstance(segment_names, str):
            segments = json.loads(segment_names)
        else:
            segments = segment_names
        
        if isinstance(segments, list):
            segment_list = segments
        elif isinstance(segments, dict):
            segment_list = segments.values() if isinstance(segments, dict) else []
        else:
            segment_list = [segments]
        
        # Check if any segment matches excluded sectors
        for segment in segment_list:
            if isinstance(segment, str):
                # Check for partial matches (case-insensitive)
                segment_lower = segment.lower()
                for excluded in excluded_sectors:
                    if excluded.lower() in segment_lower or segment_lower in excluded.lower():
                        return True
        
        return False
    except:
        # If parsing fails, keep the company (safer)
        return False

def wash_database(
    input_db: Path,
    output_db: Path,
    excluded_sectors: Set[str]
) -> Dict[str, int]:
    """Create a washed copy of the database with excluded companies removed."""
    print(f"🧹 Washing database...")
    print(f"  Input: {input_db}")
    print(f"  Output: {output_db}")
    print()
    
    input_conn = sqlite3.connect(str(input_db))
    input_conn.row_factory = sqlite3.Row
    
    # Create output database
    if output_db.exists():
        output_db.unlink()
    
    output_conn = sqlite3.connect(str(output_db))
    output_conn.row_factory = sqlite3.Row
    
    # Copy schema (create empty tables)
    print("  📋 Copying schema...")
    input_cur = input_conn.cursor()
    
    # Get schema from input DB
    input_cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('companies', 'company_financials', 'financial_accounts', 'company_metrics')")
    schemas = input_cur.fetchall()
    
    output_cur = output_conn.cursor()
    for (schema_sql,) in schemas:
        if schema_sql:
            output_cur.execute(schema_sql)
    
    output_conn.commit()
    
    stats = {
        'companies_before': 0,
        'companies_after': 0,
        'companies_excluded': 0,
        'financials_before': 0,
        'financials_after': 0,
        'accounts_before': 0,
        'accounts_after': 0,
        'metrics_before': 0,
        'metrics_after': 0,
    }
    
    # Get all companies
    print("  🔍 Analyzing companies...")
    input_cur = input_conn.cursor()
    input_cur.execute("SELECT * FROM companies")
    all_companies = input_cur.fetchall()
    stats['companies_before'] = len(all_companies)
    
    # Filter companies
    excluded_orgnrs = set()
    included_companies = []
    
    for row in all_companies:
        company_dict = dict(row)
        if is_excluded_company(company_dict, excluded_sectors):
            excluded_orgnrs.add(company_dict['orgnr'])
            stats['companies_excluded'] += 1
        else:
            included_companies.append(row)
    
    stats['companies_after'] = len(included_companies)
    
    print(f"  ✅ Companies: {stats['companies_before']:,} → {stats['companies_after']:,} ({stats['companies_excluded']:,} excluded)")
    print()
    
    # Copy included companies
    print("  📥 Copying included companies...")
    output_cur = output_conn.cursor()
    
    for row in included_companies:
        row_dict = dict(row)
        columns = list(row_dict.keys())
        # Handle NULL company_id (can have duplicates)
        if row_dict.get('company_id') is None:
            # Use INSERT OR IGNORE for NULL company_id
            placeholders = ', '.join(['?' for _ in columns])
            values = tuple(row_dict[col] for col in columns)
            output_cur.execute(f"INSERT OR IGNORE INTO companies ({', '.join(columns)}) VALUES ({placeholders})", values)
        else:
            # Regular insert for non-NULL company_id
            placeholders = ', '.join(['?' for _ in columns])
            values = tuple(row_dict[col] for col in columns)
            output_cur.execute(f"INSERT OR IGNORE INTO companies ({', '.join(columns)}) VALUES ({placeholders})", values)
    
    output_conn.commit()
    
    # Copy related data (only for included companies)
    included_orgnrs_list = [c['orgnr'] for c in included_companies]
    orgnr_placeholders = ','.join(['?' for _ in included_orgnrs_list])
    
    print("  📥 Copying company_financials...")
    input_cur.execute("SELECT COUNT(*) FROM company_financials")
    stats['financials_before'] = input_cur.fetchone()[0]
    
    input_cur.execute(f"SELECT * FROM company_financials WHERE orgnr IN ({orgnr_placeholders})", included_orgnrs_list)
    financials = input_cur.fetchall()
    
    for row in financials:
        row_dict = dict(row)
        columns = list(row_dict.keys())
        value_placeholders = ', '.join(['?' for _ in columns])
        values = tuple(row_dict[col] for col in columns)
        output_cur.execute(f"INSERT OR IGNORE INTO company_financials ({', '.join(columns)}) VALUES ({value_placeholders})", values)
    
    stats['financials_after'] = len(financials)
    output_conn.commit()
    
    # Copy financial_accounts (only for included companies)
    print("  📥 Copying financial_accounts...")
    input_cur.execute("SELECT COUNT(*) FROM financial_accounts")
    stats['accounts_before'] = input_cur.fetchone()[0]
    
    input_cur.execute(f"SELECT * FROM financial_accounts WHERE orgnr IN ({orgnr_placeholders})", included_orgnrs_list)
    accounts = input_cur.fetchall()
    
    for row in accounts:
        row_dict = dict(row)
        columns = list(row_dict.keys())
        value_placeholders = ', '.join(['?' for _ in columns])
        values = tuple(row_dict[col] for col in columns)
        output_cur.execute(f"INSERT OR IGNORE INTO financial_accounts ({', '.join(columns)}) VALUES ({value_placeholders})", values)
    
    stats['accounts_after'] = len(accounts)
    output_conn.commit()
    
    # Copy company_metrics
    print("  📥 Copying company_metrics...")
    input_cur.execute("SELECT COUNT(*) FROM company_metrics")
    stats['metrics_before'] = input_cur.fetchone()[0]
    
    input_cur.execute(f"SELECT * FROM company_metrics WHERE orgnr IN ({orgnr_placeholders})", included_orgnrs_list)
    metrics = input_cur.fetchall()
    
    for row in metrics:
        row_dict = dict(row)
        columns = list(row_dict.keys())
        value_placeholders = ', '.join(['?' for _ in columns])
        values = tuple(row_dict[col] for col in columns)
        output_cur.execute(f"INSERT OR IGNORE INTO company_metrics ({', '.join(columns)}) VALUES ({value_placeholders})", values)
    
    stats['metrics_after'] = len(metrics)
    output_conn.commit()
    
    input_conn.close()
    output_conn.close()
    
    return stats

def main():
    parser = argparse.ArgumentParser(
        description="Wash database - filter out unwanted companies before migration"
    )
    parser.add_argument(
        "--input-db",
        type=str,
        default="data/new_schema_local.db",
        help="Input database path"
    )
    parser.add_argument(
        "--output-db",
        type=str,
        default="data/new_schema_local_washed.db",
        help="Output washed database path"
    )
    
    args = parser.parse_args()
    
    input_db = Path(args.input_db)
    output_db = Path(args.output_db)
    
    if not input_db.exists():
        print(f"ERROR: Input database not found: {input_db}", file=sys.stderr)
        sys.exit(1)
    
    print("🧹 Data Washing Script")
    print("=" * 70)
    print()
    
    # Load exclusion rules
    excluded_sectors = load_exclusion_rules()
    print(f"  Excluded sectors: {len(excluded_sectors)}")
    print(f"  Examples: {', '.join(list(excluded_sectors)[:5])}...")
    print()
    
    # Wash database
    stats = wash_database(input_db, output_db, excluded_sectors)
    
    # Print summary
    print()
    print("📊 Washing Summary:")
    print("=" * 70)
    print(f"Companies:        {stats['companies_before']:>8,} → {stats['companies_after']:>8,} ({stats['companies_excluded']:>6,} excluded, {100*stats['companies_excluded']/stats['companies_before']:.1f}%)")
    print(f"Financials:       {stats['financials_before']:>8,} → {stats['financials_after']:>8,} ({100*stats['financials_after']/stats['financials_before']:.1f}% kept)")
    print(f"Financial Accts:   {stats['accounts_before']:>8,} → {stats['accounts_after']:>8,} ({100*stats['accounts_after']/stats['accounts_before']:.1f}% kept)")
    print(f"Metrics:          {stats['metrics_before']:>8,} → {stats['metrics_after']:>8,} ({100*stats['metrics_after']/stats['metrics_before']:.1f}% kept)")
    print()
    
    reduction_pct = 100 * (1 - stats['companies_after'] / stats['companies_before'])
    print(f"💡 Storage reduction: ~{reduction_pct:.0f}% fewer companies")
    print()
    print(f"✅ Washed database saved to: {output_db}")
    print()
    print("Next steps:")
    print("  1. Review the washed database")
    print("  2. Export to CSV: python3 scripts/export_local_db_to_csv_optimized.py --local-db data/new_schema_local_washed.db")
    print("  3. Run migration with washed data")

if __name__ == '__main__':
    main()


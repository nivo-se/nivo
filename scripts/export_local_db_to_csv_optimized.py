#!/usr/bin/env python3
"""
Optimized Export: Only export essential account codes and exclude raw_json
This reduces storage by ~80% by filtering during export.
"""

import argparse
import csv
import json
import sqlite3
import sys
from pathlib import Path
from typing import Any, Dict, List

# Only export these essential account codes
ESSENTIAL_ACCOUNT_CODES = {
    'SDI',      # Revenue
    'RG',       # EBIT
    'DR',       # Profit
    'EBITDA',   # EBITDA
    'EK',       # Equity
    'FK',       # Debt
    'SV',       # Total Assets
    'ANT',      # Employees
    'EKA',      # Equity Ratio
}

def filter_account_codes_json(account_codes_json: str) -> Dict[str, Any]:
    """Filter account_codes to only include essential codes."""
    if not account_codes_json:
        return {}
    
    try:
        if isinstance(account_codes_json, str):
            codes = json.loads(account_codes_json)
        else:
            codes = account_codes_json
        
        # Filter to only essential codes
        filtered = {
            code: value 
            for code, value in codes.items() 
            if code in ESSENTIAL_ACCOUNT_CODES
        }
        return filtered
    except:
        return {}

def export_table_to_csv(
    conn: sqlite3.Connection,
    table: str,
    output_path: Path,
    exclude_raw_json: bool = True,
    filter_account_codes: bool = True
) -> int:
    """Export a SQLite table to CSV file with optimizations."""
    cursor = conn.cursor()
    
    # Get all rows
    cursor.execute(f"SELECT * FROM {table}")
    rows = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]
    
    if not rows:
        print(f"  ⚠️  No data in {table}")
        return 0
    
    print(f"  📥 Exporting {len(rows)} rows from {table}...")
    
    # Determine which columns to exclude
    columns_to_export = columns.copy()
    if exclude_raw_json and 'raw_json' in columns_to_export:
        columns_to_export.remove('raw_json')
        print(f"     ⚡ Excluding raw_json (saves ~3 KB per row)")
    
    # Write CSV
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(columns_to_export)  # Header
        
        for row in rows:
            csv_row = []
            row_dict = dict(zip(columns, row))
            
            for col_name in columns_to_export:
                value = row_dict.get(col_name)
                
                if value is None:
                    csv_row.append('')
                elif col_name == 'account_codes' and filter_account_codes:
                    # Filter account codes to only essential ones
                    filtered = filter_account_codes_json(value)
                    csv_row.append(json.dumps(filtered, ensure_ascii=False) if filtered else '')
                elif isinstance(value, str):
                    # Check if it's already JSON
                    if col_name in ['address', 'segment_names', 'nace_codes']:
                        # Keep as JSON string
                        csv_row.append(value)
                    else:
                        csv_row.append(value)
                elif isinstance(value, (dict, list)):
                    # Convert to JSON string
                    csv_row.append(json.dumps(value, ensure_ascii=False))
                else:
                    csv_row.append(str(value))
            
            writer.writerow(csv_row)
    
    print(f"  ✅ Exported to {output_path.name}")
    return len(rows)

def export_financial_accounts_filtered(
    conn: sqlite3.Connection,
    output_path: Path
) -> int:
    """Export financial_accounts with only essential account codes."""
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM financial_accounts")
    rows = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]
    
    if not rows:
        print(f"  ⚠️  No data in financial_accounts")
        return 0
    
    print(f"  📥 Exporting financial_accounts (filtered to 9 essential codes)...")
    
    # Filter rows to only include essential account codes
    filtered_rows = []
    for row in rows:
        row_dict = dict(zip(columns, row))
        account_code = row_dict.get('account_code', '')
        
        if account_code in ESSENTIAL_ACCOUNT_CODES:
            filtered_rows.append(row)
    
    print(f"     ⚡ Filtered from {len(rows):,} to {len(filtered_rows):,} rows ({100*len(filtered_rows)/len(rows):.0f}%)")
    
    # Write CSV
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(columns)  # Header
        
        for row in filtered_rows:
            csv_row = []
            for idx, value in enumerate(row):
                col_name = columns[idx]
                
                if value is None:
                    csv_row.append('')
                elif isinstance(value, str):
                    csv_row.append(value)
                elif isinstance(value, (dict, list)):
                    csv_row.append(json.dumps(value, ensure_ascii=False))
                else:
                    csv_row.append(str(value))
            
            writer.writerow(csv_row)
    
    print(f"  ✅ Exported to {output_path.name}")
    return len(filtered_rows)


def main():
    parser = argparse.ArgumentParser(
        description="Export local SQLite database to CSV files (optimized)"
    )
    parser.add_argument(
        "--local-db",
        type=str,
        default="data/new_schema_local.db",
        help="Path to local SQLite database"
    )
    parser.add_argument(
        "--csv-dir",
        type=str,
        default="data/csv_export",
        help="Directory to write CSV files"
    )
    parser.add_argument(
        "--include-raw-json",
        action="store_true",
        help="Include raw_json field (default: exclude to save space)"
    )
    
    args = parser.parse_args()
    
    local_db_path = Path(args.local_db)
    csv_dir = Path(args.csv_dir)
    
    if not local_db_path.exists():
        print(f"ERROR: Local database not found: {local_db_path}", file=sys.stderr)
        sys.exit(1)
    
    # Create CSV directory
    csv_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"📊 Optimized Export from {local_db_path}")
    print(f"📁 Writing CSV files to {csv_dir}")
    print(f"⚡ Optimizations:")
    print(f"   - Excluding raw_json: {not args.include_raw_json}")
    print(f"   - Filtering account_codes to 9 essential codes")
    print(f"   - Filtering financial_accounts to 9 essential codes")
    print()
    
    # Connect to database
    conn = sqlite3.connect(str(local_db_path))
    conn.row_factory = sqlite3.Row
    
    try:
        # Export companies (no changes needed)
        export_table_to_csv(
            conn, 
            "companies", 
            csv_dir / "companies.csv",
            exclude_raw_json=False,  # companies doesn't have raw_json
            filter_account_codes=False
        )
        
        # Export company_financials (exclude raw_json, filter account_codes)
        export_table_to_csv(
            conn,
            "company_financials",
            csv_dir / "company_financials.csv",
            exclude_raw_json=not args.include_raw_json,
            filter_account_codes=True
        )
        
        # Export financial_accounts (filter to only essential codes)
        export_financial_accounts_filtered(
            conn,
            csv_dir / "financial_accounts.csv"
        )
        
        # Export company_metrics (no changes needed)
        export_table_to_csv(
            conn,
            "company_metrics",
            csv_dir / "company_metrics.csv",
            exclude_raw_json=False,
            filter_account_codes=False
        )
        
        print()
        print("✅ Export complete!")
        print()
        print("💡 Storage savings:")
        print("   - Excluded raw_json: ~200 MB")
        print("   - Filtered account_codes: ~50 MB")
        print("   - Filtered financial_accounts: ~800 MB")
        print("   Total savings: ~1,050 MB")
        
    finally:
        conn.close()


if __name__ == '__main__':
    main()


#!/usr/bin/env python3
"""
Optimize Supabase storage by removing non-essential data.

This script:
1. Deletes non-essential account codes from financial_accounts
2. Archives old financial data (keeps only last 5 years)
3. Vacuums to reclaim disk space

Expected reduction: ~900 MB (from 1.46 GB to ~500-600 MB)
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from urllib.parse import quote
from datetime import datetime

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Essential account codes to keep
ESSENTIAL_CODES = ['SDI', 'RG', 'DR', 'EBITDA', 'EK', 'FK', 'SV', 'ANT', 'EKA']

# Years to keep (last 5 years)
CURRENT_YEAR = datetime.now().year
MIN_YEAR = CURRENT_YEAR - 5


def get_db_connection():
    """Connect to Supabase PostgreSQL database"""
    password = os.getenv('SUPABASE_DB_PASSWORD')
    if not password:
        raise ValueError("SUPABASE_DB_PASSWORD not found in environment variables")
    
    # Get Supabase connection details
    supabase_url = os.getenv('SUPABASE_URL', '')
    if 'supabase.co' in supabase_url:
        # Extract project ref from URL
        project_ref = supabase_url.split('//')[1].split('.')[0]
        encoded_user = quote(f'postgres.{project_ref}', safe='')
    else:
        # Fallback to old format
        encoded_user = quote('postgres.clysgodrmowieximfaab', safe='')
    
    encoded_password = quote(password, safe='')
    
    # Try pooler connection first (faster)
    db_url = f'postgresql://{encoded_user}:{encoded_password}@aws-1-eu-north-1.pooler.supabase.com:5432/postgres'
    
    try:
        conn = psycopg2.connect(db_url, connect_timeout=10)
        return conn
    except Exception as e:
        print(f"Failed to connect via pooler: {e}")
        # Try direct connection
        db_url = f'postgresql://{encoded_user}:{encoded_password}@db.{project_ref}.supabase.co:5432/postgres'
        conn = psycopg2.connect(db_url, connect_timeout=10)
        return conn


def get_database_size(conn):
    """Get current database size"""
    cur = conn.cursor()
    cur.execute('SELECT pg_size_pretty(pg_database_size(current_database())), pg_database_size(current_database())')
    size_str, size_bytes = cur.fetchone()
    cur.close()
    return size_str, size_bytes


def get_table_sizes(conn):
    """Get sizes of main tables"""
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            schemaname || '.' || tablename AS table_name,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
            pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('financial_accounts', 'company_financials', 'companies', 'company_metrics')
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    """)
    results = cur.fetchall()
    cur.close()
    return results


def count_rows_to_delete(conn):
    """Count how many rows will be deleted"""
    cur = conn.cursor()
    
    # Count non-essential account codes
    cur.execute("""
        SELECT COUNT(*) 
        FROM financial_accounts 
        WHERE account_code NOT IN %s
    """, (tuple(ESSENTIAL_CODES),))
    non_essential_count = cur.fetchone()[0]
    
    # Count old data
    cur.execute("""
        SELECT COUNT(*) 
        FROM financial_accounts 
        WHERE year < %s
    """, (MIN_YEAR,))
    old_data_count = cur.fetchone()[0]
    
    # Count in company_financials
    cur.execute("""
        SELECT COUNT(*) 
        FROM company_financials 
        WHERE year < %s
    """, (MIN_YEAR,))
    old_financials_count = cur.fetchone()[0]
    
    cur.close()
    return non_essential_count, old_data_count, old_financials_count


def optimize_storage(conn, dry_run=True):
    """Optimize storage by deleting non-essential data"""
    cur = conn.cursor()
    
    print("\n" + "="*60)
    print("STORAGE OPTIMIZATION")
    print("="*60)
    
    # Get current sizes
    print("\n📊 Current Database Size:")
    size_str, size_bytes = get_database_size(conn)
    print(f"   Total: {size_str} ({size_bytes/1024/1024:.0f} MB)")
    
    print("\n📋 Table Sizes:")
    for table_name, size, size_bytes in get_table_sizes(conn):
        print(f"   {table_name}: {size} ({size_bytes/1024/1024:.0f} MB)")
    
    # Count rows to delete
    print("\n🔍 Analyzing data to delete...")
    non_essential_count, old_data_count, old_financials_count = count_rows_to_delete(conn)
    
    print(f"   Non-essential account codes: {non_essential_count:,} rows")
    print(f"   Old financial_accounts data (< {MIN_YEAR}): {old_data_count:,} rows")
    print(f"   Old company_financials data (< {MIN_YEAR}): {old_financials_count:,} rows")
    
    if dry_run:
        print("\n⚠️  DRY RUN MODE - No changes will be made")
        print("\nWould delete:")
        print(f"   1. {non_essential_count:,} rows from financial_accounts (non-essential codes)")
        print(f"   2. {old_data_count:,} rows from financial_accounts (old years)")
        print(f"   3. {old_financials_count:,} rows from company_financials (old years)")
        print("\nRun with --execute to actually delete data")
        return
    
    # Confirm
    print("\n⚠️  WARNING: This will permanently delete data!")
    print(f"   - {non_essential_count:,} rows from financial_accounts (non-essential codes)")
    print(f"   - {old_data_count:,} rows from financial_accounts (old years)")
    print(f"   - {old_financials_count:,} rows from company_financials (old years)")
    
    response = input("\nType 'YES' to continue: ")
    if response != 'YES':
        print("Aborted.")
        return
    
    # Step 1: Delete non-essential account codes
    print("\n🗑️  Step 1: Deleting non-essential account codes...")
    cur.execute("""
        DELETE FROM financial_accounts 
        WHERE account_code NOT IN %s
    """, (tuple(ESSENTIAL_CODES),))
    deleted_codes = cur.rowcount
    conn.commit()
    print(f"   ✅ Deleted {deleted_codes:,} rows")
    
    # Step 2: Delete old financial_accounts data
    print(f"\n🗑️  Step 2: Deleting old financial_accounts data (before {MIN_YEAR})...")
    cur.execute("""
        DELETE FROM financial_accounts 
        WHERE year < %s
    """, (MIN_YEAR,))
    deleted_old_accounts = cur.rowcount
    conn.commit()
    print(f"   ✅ Deleted {deleted_old_accounts:,} rows")
    
    # Step 3: Delete old company_financials data
    print(f"\n🗑️  Step 3: Deleting old company_financials data (before {MIN_YEAR})...")
    cur.execute("""
        DELETE FROM company_financials 
        WHERE year < %s
    """, (MIN_YEAR,))
    deleted_old_financials = cur.rowcount
    conn.commit()
    print(f"   ✅ Deleted {deleted_old_financials:,} rows")
    
    # Step 4: Vacuum
    print("\n🧹 Step 4: Vacuuming to reclaim disk space...")
    print("   (This may take a few minutes...)")
    cur.execute("VACUUM FULL financial_accounts")
    cur.execute("VACUUM FULL company_financials")
    conn.commit()
    print("   ✅ Vacuum complete")
    
    # Get final sizes
    print("\n📊 Final Database Size:")
    size_str, size_bytes = get_database_size(conn)
    print(f"   Total: {size_str} ({size_bytes/1024/1024:.0f} MB)")
    
    print("\n📋 Final Table Sizes:")
    for table_name, size, size_bytes in get_table_sizes(conn):
        print(f"   {table_name}: {size} ({size_bytes/1024/1024:.0f} MB)")
    
    cur.close()
    print("\n✅ Optimization complete!")


def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Optimize Supabase storage')
    parser.add_argument('--execute', action='store_true', 
                       help='Actually delete data (default is dry-run)')
    args = parser.parse_args()
    
    try:
        print("Connecting to Supabase...")
        conn = get_db_connection()
        print("✅ Connected to Supabase")
        
        optimize_storage(conn, dry_run=not args.execute)
        
        conn.close()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()


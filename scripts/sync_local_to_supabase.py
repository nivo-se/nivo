#!/usr/bin/env python3
"""
Sync schema and/or data from local SQLite database to Supabase PostgreSQL.

This script helps keep your local development database and Supabase in sync.

Usage:
    # Sync specific tables' data
    python3 scripts/sync_local_to_supabase.py --tables companies,company_metrics
    
    # Sync schema only (no data)
    python3 scripts/sync_local_to_supabase.py --schema-only
    
    # Sync everything
    python3 scripts/sync_local_to_supabase.py --all
    
    # Dry run (show what would be synced)
    python3 scripts/sync_local_to_supabase.py --dry-run --tables companies
"""

import argparse
import json
import os
import sqlite3
import sys
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

try:
    from supabase import create_client, Client
    from dotenv import load_dotenv
except ImportError:
    print("ERROR: Missing dependencies. Install with:")
    print("  pip install supabase python-dotenv")
    sys.exit(1)

# Load environment variables
load_dotenv()

# Default paths
LOCAL_DB_PATH = Path(__file__).parent.parent / "data" / "new_schema_local.db"

# Tables that should be synced (in order, respecting foreign keys)
SYNC_ORDER = [
    "companies",
    "company_financials", 
    "financial_accounts",
    "company_metrics"
]


def get_local_db() -> sqlite3.Connection:
    """Get connection to local SQLite database."""
    if not LOCAL_DB_PATH.exists():
        raise FileNotFoundError(f"Local database not found: {LOCAL_DB_PATH}")
    
    conn = sqlite3.connect(str(LOCAL_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def get_supabase_client() -> Client:
    """Get Supabase client."""
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url or not supabase_key:
        raise ValueError(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
        )
    
    return create_client(supabase_url, supabase_key)


def get_table_names(conn: sqlite3.Connection) -> List[str]:
    """Get list of all tables in local database."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    """)
    return [row[0] for row in cursor.fetchall()]


def get_row_count(conn: sqlite3.Connection, table: str) -> int:
    """Get row count for a table."""
    cursor = conn.cursor()
    cursor.execute(f"SELECT COUNT(*) FROM {table}")
    return cursor.fetchone()[0]


def transform_record(record: Dict[str, Any], table: str) -> Dict[str, Any]:
    """
    Transform a SQLite record to PostgreSQL format.
    Handles JSONB, UUID, boolean, and datetime conversions.
    """
    transformed = {}
    
    for key, value in record.items():
        if value is None:
            transformed[key] = None
            continue
        
        # Handle JSONB fields - parse JSON strings
        jsonb_fields = {
            'companies': ['address', 'segment_names', 'nace_codes'],
            'company_financials': ['account_codes', 'raw_json'],
        }
        if table in jsonb_fields and key in jsonb_fields[table]:
            if isinstance(value, str):
                try:
                    transformed[key] = json.loads(value)
                except (json.JSONDecodeError, TypeError):
                    # If it's not valid JSON, try to parse as string
                    transformed[key] = value
            elif isinstance(value, (dict, list)):
                transformed[key] = value
            else:
                transformed[key] = None
            continue
        
        # Handle UUID fields - validate/convert UUID format
        uuid_fields = {
            'company_financials': ['id'],
            'financial_accounts': ['id', 'financial_id'],
        }
        if table in uuid_fields and key in uuid_fields[table]:
            if isinstance(value, str):
                # Try to validate UUID format
                try:
                    uuid.UUID(value)  # Validate format
                    transformed[key] = value
                except (ValueError, AttributeError):
                    # If invalid, generate new UUID (shouldn't happen with proper data)
                    print(f"  ⚠️  Warning: Invalid UUID format for {key}: {value}, generating new UUID")
                    transformed[key] = str(uuid.uuid4())
            else:
                transformed[key] = str(uuid.uuid4()) if value else None
            continue
        
        # Handle boolean fields - convert INTEGER (0/1) to boolean
        boolean_fields = {
            'company_metrics': ['digital_presence'],
        }
        if table in boolean_fields and key in boolean_fields[table]:
            if isinstance(value, bool):
                transformed[key] = value
            elif isinstance(value, int):
                transformed[key] = bool(value)
            elif isinstance(value, str):
                transformed[key] = value.lower() in ('true', '1', 'yes')
            else:
                transformed[key] = False
            continue
        
        # Handle datetime strings - convert to ISO format
        if isinstance(value, str):
            # SQLite datetime format: YYYY-MM-DD HH:MM:SS or YYYY-MM-DDTHH:MM:SS
            if len(value) == 19 and 'T' not in value:
                # SQLite datetime format: YYYY-MM-DD HH:MM:SS
                transformed[key] = value.replace(' ', 'T') + 'Z'
            elif len(value) >= 19 and 'T' in value and not value.endswith('Z'):
                # ISO format without Z
                transformed[key] = value + 'Z' if not value.endswith(('Z', '+', '-')) else value
            else:
                transformed[key] = value
        else:
            transformed[key] = value
    
    return transformed


def sync_table_data(
    local_conn: sqlite3.Connection,
    supabase: Client,
    table: str,
    dry_run: bool = False
) -> int:
    """
    Sync data from local SQLite table to Supabase.
    Returns number of rows synced.
    """
    print(f"\n📊 Syncing table: {table}")
    
    # Get row count first
    row_count = get_row_count(local_conn, table)
    print(f"  📥 Found {row_count} rows in local database")
    
    if row_count == 0:
        print(f"  ⚠️  No data in local table")
        return 0
    
    if dry_run:
        print(f"  🔍 [DRY RUN] Would sync {row_count} rows to Supabase")
        # Show sample row
        cursor = local_conn.cursor()
        cursor.execute(f"SELECT * FROM {table} LIMIT 1")
        sample_row = cursor.fetchone()
        if sample_row:
            columns = [desc[0] for desc in cursor.description]
            sample = dict(zip(columns, sample_row))
            print(f"  📋 Sample columns: {list(sample.keys())[:5]}...")
        return row_count
    
    # Batch processing for large tables
    batch_size = 1000
    total_inserted = 0
    
    try:
        # Clear existing data first
        print(f"  🗑️  Clearing existing data in Supabase...")
        try:
            # Try to delete all rows (works for tables with any column)
            supabase.table(table).delete().neq('orgnr', '___NONEXISTENT___').execute()
        except Exception as e:
            # Fallback: try deleting by id if table has id column
            try:
                supabase.table(table).delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
            except:
                print(f"  ⚠️  Could not clear existing data (table may be empty): {e}")
        
        # Process in batches to avoid memory issues
        cursor = local_conn.cursor()
        offset = 0
        
        while offset < row_count:
            cursor.execute(f"SELECT * FROM {table} LIMIT {batch_size} OFFSET {offset}")
            rows = cursor.fetchall()
            
            if not rows:
                break
            
            # Convert rows to dictionaries
            columns = [desc[0] for desc in cursor.description]
            records = [dict(zip(columns, row)) for row in rows]
            
            # Transform records for PostgreSQL
            transformed_records = [transform_record(record, table) for record in records]
            
            # Insert batch
            try:
                result = supabase.table(table).insert(transformed_records).execute()
                total_inserted += len(transformed_records)
                print(f"  ✅ Inserted batch {offset//batch_size + 1} ({total_inserted}/{row_count} rows)")
            except Exception as e:
                print(f"  ❌ Error inserting batch {offset//batch_size + 1}: {e}")
                # Try to insert records one by one to identify problematic records
                print(f"  🔍 Attempting individual record insertion to identify issues...")
                for idx, record in enumerate(transformed_records):
                    try:
                        supabase.table(table).insert(record).execute()
                        total_inserted += 1
                    except Exception as record_error:
                        print(f"  ❌ Failed to insert record {offset + idx}: {record_error}")
                        print(f"     Record keys: {list(record.keys())[:10]}...")
                        # Skip this record and continue
                        continue
                print(f"  ⚠️  Some records may have been skipped due to errors")
            
            offset += batch_size
            
            # Progress update for very large tables
            if row_count > 10000 and offset % 10000 == 0:
                print(f"  📊 Progress: {total_inserted}/{row_count} rows ({100*total_inserted/row_count:.1f}%)")
        
        print(f"  ✅ Successfully synced {total_inserted} rows")
        return total_inserted
        
    except Exception as e:
        print(f"  ❌ Error syncing {table}: {e}")
        import traceback
        traceback.print_exc()
        raise


def sync_schema_only(
    local_conn: sqlite3.Connection,
    supabase: Client,
    dry_run: bool = False
):
    """Extract and display schema differences (doesn't apply changes)."""
    print("\n📐 Schema Comparison")
    print("=" * 60)
    
    tables = get_table_names(local_conn)
    
    for table in tables:
        print(f"\n📋 Table: {table}")
        
        # Get local schema
        cursor = local_conn.cursor()
        cursor.execute(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table}'")
        local_schema = cursor.fetchone()
        
        if local_schema:
            print(f"  Local schema exists")
            if dry_run:
                print(f"  [DRY RUN] Would compare with Supabase schema")
            else:
                # Try to get Supabase schema info
                try:
                    # Get sample row to see columns
                    sample = supabase.table(table).select("*").limit(1).execute()
                    if sample.data:
                        supabase_columns = list(sample.data[0].keys())
                        print(f"  Supabase columns: {len(supabase_columns)}")
                        print(f"  ⚠️  Manual schema comparison recommended")
                    else:
                        print(f"  ⚠️  Table exists in Supabase but is empty")
                except Exception as e:
                    print(f"  ⚠️  Could not check Supabase: {e}")
                    print(f"  💡 Table may not exist in Supabase yet")


def main():
    parser = argparse.ArgumentParser(
        description="Sync local SQLite database to Supabase"
    )
    parser.add_argument(
        "--tables",
        type=str,
        help="Comma-separated list of tables to sync (e.g., companies,company_metrics)"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Sync all tables"
    )
    parser.add_argument(
        "--schema-only",
        action="store_true",
        help="Only compare schemas, don't sync data"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be synced without actually syncing"
    )
    parser.add_argument(
        "--local-db",
        type=str,
        default=str(LOCAL_DB_PATH),
        help=f"Path to local SQLite database (default: {LOCAL_DB_PATH})"
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if not args.tables and not args.all and not args.schema_only:
        parser.error("Must specify --tables, --all, or --schema-only")
    
    if args.dry_run:
        print("🔍 DRY RUN MODE - No changes will be made\n")
    
    try:
        # Connect to databases
        print("🔌 Connecting to databases...")
        local_conn = sqlite3.connect(args.local_db)
        local_conn.row_factory = sqlite3.Row
        
        if not args.schema_only:
            supabase = get_supabase_client()
            print("✅ Connected to Supabase")
        else:
            supabase = None
        
        print(f"✅ Connected to local database: {args.local_db}\n")
        
        # Determine which tables to sync
        if args.schema_only:
            sync_schema_only(local_conn, supabase, args.dry_run)
        elif args.all:
            tables_to_sync = [t for t in SYNC_ORDER if t in get_table_names(local_conn)]
            print(f"📋 Syncing all tables: {', '.join(tables_to_sync)}\n")
            
            for table in tables_to_sync:
                sync_table_data(local_conn, supabase, table, args.dry_run)
        else:
            tables_to_sync = [t.strip() for t in args.tables.split(',')]
            print(f"📋 Syncing tables: {', '.join(tables_to_sync)}\n")
            
            # Respect sync order
            ordered_tables = [t for t in SYNC_ORDER if t in tables_to_sync]
            unordered_tables = [t for t in tables_to_sync if t not in SYNC_ORDER]
            
            for table in ordered_tables + unordered_tables:
                sync_table_data(local_conn, supabase, table, args.dry_run)
        
        local_conn.close()
        print("\n✅ Sync complete!")
        
    except FileNotFoundError as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)
    except ValueError as e:
        print(f"❌ Configuration error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()


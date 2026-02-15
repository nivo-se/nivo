#!/usr/bin/env python3
"""
Cleanup Supabase tables - Remove irrelevant tables to reduce storage.

This script identifies and deletes tables that are:
1. Not used by the current dashboard
2. Taking up significant storage
3. Will be replaced in the upcoming dashboard overhaul

KEEP:
- Auth tables (managed by Supabase)
- Essential tables: companies, company_metrics (if still needed)
- Shortlists: stage1_shortlists, stage2_shortlists (if used)

DELETE:
- company_financials (large, will be replaced)
- Old analytics tables
- Intelligence tables (if not actively used)
- Other deprecated tables
"""

import os
import sys
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

def get_supabase_client() -> Client:
    """Get Supabase client"""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    
    return create_client(url, key)

def get_table_sizes(supabase: Client):
    """Get size of each table in Supabase"""
    # Query to get table sizes
    query = """
    SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
    FROM pg_tables
    WHERE schemaname IN ('public', 'ai_ops')
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    """
    
    # Execute via RPC or direct SQL
    # Note: This requires direct SQL access, so we'll use a different approach
    # For now, we'll list tables and estimate sizes
    print("📊 Table Size Analysis")
    print("=" * 70)
    print("Note: Direct size queries require SQL access.")
    print("Please run this query in Supabase SQL Editor to see sizes:\n")
    print(query)
    print("\n")

def list_all_tables(supabase: Client):
    """List all tables in public and ai_ops schemas"""
    print("📋 Listing all tables...")
    print("=" * 70)
    
    # Tables we know about from migrations
    known_tables = {
        'public': [
            'companies',
            'company_financials',
            'company_metrics',
            'stage1_shortlists',
            'stage2_shortlists',
            'saved_company_lists',
            'master_analytics',  # Old, likely deprecated
            'company_accounts_by_id',  # Old, likely deprecated
        ],
        'ai_ops': [
            'company_intel',
            'intel_artifacts',
            'company_embeddings',
            'ai_reports',
            'company_rankings',
        ]
    }
    
    print("\nTables in 'public' schema:")
    for table in known_tables['public']:
        print(f"  - {table}")
    
    print("\nTables in 'ai_ops' schema:")
    for table in known_tables['ai_ops']:
        print(f"  - {table}")
    
    return known_tables

def get_tables_to_delete():
    """Define which tables to delete"""
    
    # Tables to DELETE (large, not essential, will be replaced)
    tables_to_delete = {
        'public': [
            'company_financials',  # Large, will be replaced with optimized structure
            'master_analytics',  # Old deprecated table
            'company_accounts_by_id',  # Old deprecated table
        ],
        'ai_ops': [
            'company_intel',  # If not actively used
            'intel_artifacts',  # If not actively used
            'company_embeddings',  # If not actively used
            'ai_reports',  # If not actively used
            'company_rankings',  # If not actively used
        ]
    }
    
    # Tables to KEEP (essential)
    tables_to_keep = {
        'public': [
            'companies',  # Core company data
            'company_metrics',  # KPI data (if still used)
            'stage1_shortlists',  # Shortlists (if used)
            'stage2_shortlists',  # Shortlists (if used)
            'saved_company_lists',  # User lists (if used)
        ],
        'ai_ops': []  # Keep none from ai_ops if not used
    }
    
    return tables_to_delete, tables_to_keep

def delete_tables(supabase: Client, tables_to_delete: dict, dry_run: bool = True):
    """Delete specified tables"""
    
    print("\n🗑️  TABLE DELETION PLAN")
    print("=" * 70)
    
    if dry_run:
        print("⚠️  DRY RUN MODE - No tables will be deleted\n")
    else:
        print("⚠️  LIVE MODE - Tables will be permanently deleted!\n")
    
    total_tables = 0
    for schema, tables in tables_to_delete.items():
        if tables:
            print(f"\nSchema: {schema}")
            for table in tables:
                full_table_name = f"{schema}.{table}"
                print(f"  ❌ DELETE: {full_table_name}")
                total_tables += 1
                
                if not dry_run:
                    try:
                        # Drop table (CASCADE to handle dependencies)
                        # Note: This requires SQL execution, not available via Python client
                        # We'll generate SQL script instead
                        print(f"      ⚠️  Cannot delete via Python client - use SQL script")
                    except Exception as e:
                        print(f"      ❌ Error: {e}")
    
    print(f"\n📊 Total tables to delete: {total_tables}")
    
    if dry_run:
        print("\n✅ Dry run complete. Review the plan above.")
        print("   Run with --execute to actually delete tables.")
    else:
        print("\n⚠️  Tables marked for deletion.")
        print("   Execute the generated SQL script in Supabase SQL Editor.")

def generate_delete_sql(tables_to_delete: dict, output_file: str = "supabase_cleanup.sql"):
    """Generate SQL script to delete tables"""
    
    sql_lines = [
        "-- Supabase Table Cleanup Script",
        "-- Generated to reduce database storage",
        "-- Review carefully before executing!",
        "",
        "-- ============================================",
        "-- TABLES TO DELETE",
        "-- ============================================",
        ""
    ]
    
    for schema, tables in tables_to_delete.items():
        if tables:
            sql_lines.append(f"-- Schema: {schema}")
            for table in tables:
                full_table_name = f"{schema}.{table}"
                sql_lines.append(f"DROP TABLE IF EXISTS {full_table_name} CASCADE;")
            sql_lines.append("")
    
    sql_lines.extend([
        "-- ============================================",
        "-- VERIFICATION",
        "-- ============================================",
        "-- Check remaining tables:",
        "SELECT schemaname, tablename",
        "FROM pg_tables",
        "WHERE schemaname IN ('public', 'ai_ops')",
        "ORDER BY schemaname, tablename;",
        "",
        "-- Check database size:",
        "SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size;",
    ])
    
    sql_content = "\n".join(sql_lines)
    
    output_path = Path(__file__).parent.parent / output_file
    output_path.write_text(sql_content)
    
    print(f"\n✅ SQL script generated: {output_path}")
    print(f"   Review and execute in Supabase SQL Editor")

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Cleanup Supabase tables to reduce storage")
    parser.add_argument("--execute", action="store_true", help="Generate SQL script (dry run by default)")
    parser.add_argument("--generate-sql", action="store_true", help="Generate SQL script file")
    args = parser.parse_args()
    
    try:
        supabase = get_supabase_client()
        
        print("🔍 SUPABASE TABLE CLEANUP")
        print("=" * 70)
        print()
        
        # List tables
        known_tables = list_all_tables(supabase)
        
        # Get deletion plan
        tables_to_delete, tables_to_keep = get_tables_to_delete()
        
        print("\n✅ TABLES TO KEEP")
        print("=" * 70)
        for schema, tables in tables_to_keep.items():
            if tables:
                print(f"\nSchema: {schema}")
                for table in tables:
                    print(f"  ✅ KEEP: {schema}.{table}")
        
        # Show deletion plan
        delete_tables(supabase, tables_to_delete, dry_run=not args.execute)
        
        # Generate SQL script
        if args.generate_sql or args.execute:
            generate_delete_sql(tables_to_delete)
        
        print("\n" + "=" * 70)
        print("✅ Cleanup analysis complete!")
        print("\nNext steps:")
        print("1. Review the tables to delete above")
        print("2. Check table sizes in Supabase dashboard")
        print("3. Execute the generated SQL script in Supabase SQL Editor")
        print("4. Verify remaining tables and database size")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()


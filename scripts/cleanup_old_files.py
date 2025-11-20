#!/usr/bin/env python3
"""
Clean up old and unused files while keeping essential migration guides and active scripts.
"""

import os
from pathlib import Path
from typing import List, Set

# Files to KEEP (essential/current)
KEEP_FILES: Set[str] = {
    # Root documentation
    "README.md",
    "QUICK_START.md",
    "OPTIMIZED_DATABASE_GUIDE.md",
    "VALIDATION_REPORT.md",
    "VERCEL_RAILWAY_SETUP.md",
    "TESTING_GUIDE.md",
    
    # Current database
    "database/migrations/001_create_segmentation_system.sql",
    "database/migrations/002_deprecate_wrong_columns.sql",
    "database/migrations/003_update_company_metrics_from_account_codes.sql",
    "database/migrations/004_fix_tier_assignment.sql",
    "database/migrations/005_add_intelligence_tables.sql",
    "database/migrations/006_add_vector_search_function.sql",
    "database/migrations/007_create_shortlist_tables.sql",
    "database/new_schema.sql",
    "database/README.md",
    
    # Migration guides
    "docs/migration/runbook.md",
    "docs/migration/local_dataset.md",
    "docs/migration/load_data_via_dashboard.sql",
    
    # Current scripts
    "scripts/create_optimized_db.py",
    "scripts/validate_optimized_db.py",
    "scripts/verify_online_source.py",
    "scripts/migrate_staging_to_new_schema.py",
    "scripts/create_staging_snapshot.py",
    "scripts/optimize_supabase_storage.py",
    "scripts/start-backend.sh",
    "scripts/start-redis.sh",
    "scripts/start-worker.sh",
    "scripts/start-all.sh",
    "scripts/test_connections.sh",
    "scripts/check-env.sh",
    "scripts/add-missing-env.sh",
    
    # Backend guides
    "backend/DATA_OPERATIONS_GUIDE.md",
    "backend/ESSENTIAL_SCRIPTS.md",
    
    # Scraper
    "scraper/allabolag-scraper/create-staging-tables.sql",
    "scraper/database/migrations/001_create_staging_tables.sql",
}

# Patterns to DELETE (old/unused)
DELETE_PATTERNS = [
    # Old analysis/planning docs
    "**/CLEANUP_*.md",
    "**/STORAGE_*.md",
    "**/WHY_*.md",
    "**/FLATTENING_*.md",
    "**/FLAT_*.md",
    "**/DATABASE_CLEANUP_*.md",
    "**/DATABASE_SIZE_*.md",
    "**/SOLUTION_COMPARISON.md",
    "**/IMPLEMENTATION_STATUS.md",
    "**/DEPLOYMENT_STATUS.md",
    "**/RAILWAY_FIX.md",
    "**/RAILWAY_QUICK_START.md",
    "**/RAILWAY_STORAGE_*.md",
    "**/SUPABASE_STORAGE_FIX.md",
    "**/SUPABASE_STORAGE_OPTIMIZATION_*.md",
    "**/SHORTLIST_STORAGE_*.md",
    "**/METRICS_VERIFICATION.md",
    "**/METRICS_AND_SHORTLIST_*.md",
    "**/API_ENDPOINT_SUMMARY.md",
    "**/DASHBOARD_API_AUDIT.md",
    "**/BACKEND_DEPLOYMENT.md",
    "**/START_*.md",
    "**/QUICK_START_SERVERS.md",
    "**/VERCEL_PYTHON_SETUP.md",
    "**/AI_REPORTS_IMPLEMENTATION.md",
    
    # Old database docs
    "database/DATA_FORMAT_FIX_*.md",
    "database/DATA_MAPPING_*.md",
    "database/DATABASE_SCHEMA_DIAGRAM.md",
    "database/DATABASE_STRUCTURE_*.md",
    "database/DATABASE_SUMMARY.txt",
    "database/FINANCIAL_ACCOUNTS_*.md",
    "database/UI_CURRENCY_*.md",
    "database/performance_warnings_*.md",
    "database/ALLOBOLAG_CODE_MAPPING.md",
    "database/COMPLETE_ALLABOLAG_*.md",
    
    # Old SQL schemas (replaced by new_schema.sql)
    "database/financial_accounts_schema*.sql",
    "database/financial_accounts_query_examples*.sql",
    "database/valuation_schema*.sql",
    "database/create_user_roles_table_simple.sql",
    "database/saved_lists_schema.sql",
    "database/ai_ops_schema.sql",
    
    # Old docs
    "docs/CITY_DATA_*.md",
    "docs/CLEANUP_*.md",
    "docs/DATA_WASHING_*.md",
    "docs/DATABASE_WORKFLOW_*.md",
    "docs/DEPRECATED_*.md",
    "docs/FINAL_SEGMENTATION_*.md",
    "docs/PITCH_DECK_*.md",
    "docs/SEGMENTATION_*.md",
    "docs/STORAGE_*.md",
    "docs/TABLES_STATUS_*.md",
    "docs/THRESHOLD_*.md",
    "docs/VERIFY_LOCAL_*.md",
    "docs/VIEWS_*.md",
    "docs/WHY_*.md",
    "docs/QA_REPORT.md",
    "docs/DASHBOARD_VERIFICATION_*.md",
    "docs/DASHBOARD_API_TEST_*.md",
    
    # Old scripts
    "scripts/restructure_to_flat_financials.py",  # Replaced by create_optimized_db.py
    "scripts/export_financial_accounts_to_csv.py",
    "scripts/export_local_db_to_csv_optimized.py",
    "scripts/compute_kpis_local.py",
    "scripts/test_local_normalization.py",
    "scripts/validate_financial_accounts_local.py",
    "scripts/wash_data_before_migration.py",
    "scripts/create_test_local_db.py",
    "scripts/sync_local_to_supabase.py",
    "scripts/load_data_to_supabase_python.py",
    "scripts/LOCAL_TESTING_*.md",
    "scripts/MANUAL_MIGRATION_*.md",
    "scripts/PERFORMANCE_MONITORING.md",
    "scripts/README_SQL_SCRIPTS.md",
    "scripts/README_TIMEOUT_FIX.md",
    "scripts/check_revenue_coverage.js",
    "scripts/test_homepage_fetch.ts",
    "scripts/dashboard_api_test_*.json",
]

def should_keep(file_path: str) -> bool:
    """Check if file should be kept"""
    # Normalize path
    path = Path(file_path)
    rel_path = str(path.relative_to(Path.cwd())) if path.is_absolute() else file_path
    
    # Check exact matches
    if rel_path in KEEP_FILES:
        return True
    
    # Check if in keep directories
    if rel_path.startswith("docs/migration/"):
        # Only keep specific migration files
        return rel_path in KEEP_FILES
    
    # Check if in node_modules or venv (skip)
    if "node_modules" in rel_path or "venv" in rel_path or ".git" in rel_path:
        return True
    
    return False

def matches_delete_pattern(file_path: str) -> bool:
    """Check if file matches delete patterns"""
    from fnmatch import fnmatch
    
    path = Path(file_path)
    rel_path = str(path.relative_to(Path.cwd())) if path.is_absolute() else file_path
    
    for pattern in DELETE_PATTERNS:
        if fnmatch(rel_path, pattern):
            return True
    
    return False

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Clean up old and unused files")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted without deleting")
    parser.add_argument("--execute", action="store_true", help="Actually delete files")
    args = parser.parse_args()
    
    if not args.dry_run and not args.execute:
        print("❌ Please specify --dry-run or --execute")
        return
    
    print("🧹 CLEANING UP OLD FILES")
    print("="*70)
    
    files_to_delete = []
    
    # Find all .md and .sql files
    root = Path.cwd()
    for ext in ["*.md", "*.sql", "*.txt", "*.json"]:
        for file_path in root.rglob(ext):
            # Skip node_modules, venv, .git
            if "node_modules" in str(file_path) or "venv" in str(file_path) or ".git" in str(file_path):
                continue
            
            try:
                rel_path = str(file_path.relative_to(root))
            except ValueError:
                # File is not under root, skip
                continue
            
            # Skip if should keep
            if should_keep(rel_path):
                continue
            
            # Check if matches delete pattern
            if matches_delete_pattern(rel_path):
                files_to_delete.append(file_path)
    
    if not files_to_delete:
        print("✅ No files to delete")
        return
    
    print(f"\n📋 Found {len(files_to_delete)} files to delete:\n")
    
    # Group by directory
    by_dir = {}
    for f in files_to_delete:
        dir_name = str(f.parent)
        if dir_name not in by_dir:
            by_dir[dir_name] = []
        by_dir[dir_name].append(f)
    
    for dir_name in sorted(by_dir.keys()):
        print(f"  {dir_name}/")
        for f in sorted(by_dir[dir_name]):
            size = f.stat().st_size if f.exists() else 0
            size_str = f"{size/1024:.1f} KB" if size < 1024*1024 else f"{size/(1024*1024):.1f} MB"
            print(f"    - {f.name} ({size_str})")
        print()
    
    total_size = sum(f.stat().st_size for f in files_to_delete if f.exists())
    print(f"Total size: {total_size/(1024*1024):.1f} MB\n")
    
    if args.dry_run:
        print("🔍 DRY RUN - No files deleted")
        print("Run with --execute to actually delete these files")
    elif args.execute:
        print("🗑️  DELETING FILES...")
        deleted = 0
        errors = 0
        
        for f in files_to_delete:
            try:
                if f.exists():
                    f.unlink()
                    deleted += 1
            except Exception as e:
                print(f"  ⚠️  Error deleting {f}: {e}")
                errors += 1
        
        print(f"\n✅ Deleted {deleted} files")
        if errors > 0:
            print(f"⚠️  {errors} errors")

if __name__ == "__main__":
    main()


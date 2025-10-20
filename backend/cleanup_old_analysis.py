#!/usr/bin/env python3
"""
Script to delete all old analysis data except for those done today.
This script connects to Supabase and removes analysis runs older than today.
"""

import os
import sys
from datetime import datetime, date
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_supabase_client() -> Client:
    """Create and return a Supabase client."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    
    if not url or not key:
        print("Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables")
        sys.exit(1)
    
    return create_client(url, key)

def cleanup_old_analysis():
    """Delete all analysis data older than today."""
    supabase = get_supabase_client()
    
    # Get today's date
    today = date.today().strftime('%Y-%m-%d')
    print(f"Today is: {today}")
    
    try:
        # First, let's see what we have
        print("\nChecking existing analysis data...")
        
        # Count total analysis runs
        result = supabase.table('ai_analysis_runs').select('id', count='exact').execute()
        total_runs = result.count
        print(f"Total analysis runs: {total_runs}")
        
        # Count runs from today
        result = supabase.table('ai_analysis_runs').select('id', count='exact').gte('started_at', f'{today}T00:00:00').execute()
        today_runs = result.count
        print(f"Analysis runs from today: {today_runs}")
        
        old_runs = total_runs - today_runs
        print(f"Old analysis runs to delete: {old_runs}")
        
        if old_runs == 0:
            print("No old analysis data to clean up!")
            return
        
        # Show some sample old data
        print("\nSample old analysis runs:")
        result = supabase.table('ai_analysis_runs').select('id, started_at, analysis_mode, status').lt('started_at', f'{today}T00:00:00').order('started_at', desc=True).limit(5).execute()
        
        for row in result.data:
            print(f"  {row['id'][:8]}... | {row['started_at']} | {row['analysis_mode']} | {row['status']}")
        
        # Auto-confirm deletion (for automated cleanup)
        print(f"\nAuto-confirming deletion of {old_runs} old analysis runs...")
        
        print("\nStarting cleanup...")
        
        # Get all old run IDs first
        result = supabase.table('ai_analysis_runs').select('id').lt('started_at', f'{today}T00:00:00').execute()
        old_run_ids = [row['id'] for row in result.data]
        
        print(f"Found {len(old_run_ids)} old analysis runs to delete")
        
        # Delete related data in the correct order (due to foreign key constraints)
        
        # 1. Delete from ai_analysis_audit
        print("Deleting audit records...")
        for run_id in old_run_ids:
            supabase.table('ai_analysis_audit').delete().eq('run_id', run_id).execute()
        
        # 2. Delete from ai_analysis_metrics
        print("Deleting metrics...")
        for run_id in old_run_ids:
            supabase.table('ai_analysis_metrics').delete().eq('run_id', run_id).execute()
        
        # 3. Delete from ai_analysis_sections
        print("Deleting sections...")
        for run_id in old_run_ids:
            supabase.table('ai_analysis_sections').delete().eq('run_id', run_id).execute()
        
        # 4. Delete from ai_company_analysis
        print("Deleting company analysis...")
        for run_id in old_run_ids:
            supabase.table('ai_company_analysis').delete().eq('run_id', run_id).execute()
        
        # 5. Delete from ai_screening_results
        print("Deleting screening results...")
        for run_id in old_run_ids:
            supabase.table('ai_screening_results').delete().eq('run_id', run_id).execute()
        
        # 6. Finally, delete the main run records
        print("Deleting main run records...")
        for run_id in old_run_ids:
            supabase.table('ai_analysis_runs').delete().eq('id', run_id).execute()
        
        print(f"\n✅ Successfully deleted {old_runs} old analysis runs and all related data!")
        
        # Verify cleanup
        result = supabase.table('ai_analysis_runs').select('id', count='exact').execute()
        remaining_runs = result.count
        print(f"Remaining analysis runs: {remaining_runs}")
        
    except Exception as e:
        print(f"Error during cleanup: {e}")
        sys.exit(1)

if __name__ == "__main__":
    cleanup_old_analysis()

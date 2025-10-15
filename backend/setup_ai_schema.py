#!/usr/bin/env python3
"""
Setup AI Operations Schema in Supabase
Runs the AI operations database schema migration
"""

import os
import sys
from pathlib import Path
from supabase import create_client, Client

def load_env_vars():
    """Load environment variables from .env file or environment"""
    env_vars = {}
    
    # Try to load from .env file
    env_file = Path(".env")
    if env_file.exists():
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key] = value
    
    # Override with actual environment variables
    for key in ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']:
        if key in os.environ:
            env_vars[key] = os.environ[key]
    
    return env_vars

def setup_ai_schema():
    """Set up the AI operations schema in Supabase"""
    print("🚀 Setting up AI Operations Schema in Supabase...")
    
    # Load environment variables
    env_vars = load_env_vars()
    
    supabase_url = env_vars.get('SUPABASE_URL')
    supabase_key = env_vars.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url or not supabase_key:
        print("❌ Missing Supabase credentials!")
        print("Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables")
        print("Or create a .env file with these values")
        return False
    
    try:
        # Create Supabase client
        supabase: Client = create_client(supabase_url, supabase_key)
        print("✅ Connected to Supabase")
        
        # Read the AI schema SQL file
        schema_file = Path(__file__).parent.parent / "database" / "ai_ops_schema.sql"
        if not schema_file.exists():
            print(f"❌ Schema file not found: {schema_file}")
            return False
        
        with open(schema_file, 'r') as f:
            schema_sql = f.read()
        
        print("📄 Loaded AI operations schema")
        
        # Execute the schema
        print("🔧 Executing schema migration...")
        result = supabase.rpc('exec_sql', {'sql': schema_sql}).execute()
        
        if result.data:
            print("✅ AI operations schema created successfully!")
            print("📊 Schema includes:")
            print("   - ai_analysis_runs (run metadata)")
            print("   - ai_company_analysis (company results)")
            print("   - ai_analysis_sections (narrative sections)")
            print("   - ai_analysis_metrics (structured metrics)")
            print("   - ai_analysis_audit (prompt/response audit)")
            print("   - ai_analysis_feedback (human feedback)")
            print("   - Convenience views for dashboard")
            return True
        else:
            print("❌ Schema creation failed")
            return False
            
    except Exception as e:
        print(f"❌ Error setting up schema: {e}")
        return False

def main():
    """Main function"""
    print("🤖 AI Operations Schema Setup")
    print("=" * 40)
    
    success = setup_ai_schema()
    
    if success:
        print("\n🎉 AI operations schema is ready!")
        print("You can now run AI analysis workflows.")
    else:
        print("\n💥 Setup failed. Please check the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    main()

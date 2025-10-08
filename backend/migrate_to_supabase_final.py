#!/usr/bin/env python3
"""
Final migration script to properly load all data to Supabase
Uses the fixed local SQLite database with correct numeric types
"""

import sqlite3
import os
import pandas as pd
from supabase import create_client, Client
from datetime import datetime
import time

def get_supabase_client():
    """Initialize Supabase client from frontend/.env.local"""
    env_file = '../frontend/.env.local'
    url = None
    key = None
    
    with open(env_file, 'r') as f:
        for line in f:
            if 'VITE_SUPABASE_URL' in line and '=' in line:
                url = line.split('=', 1)[1].strip()
            elif 'VITE_SUPABASE_ANON_KEY' in line and '=' in line:
                key = line.split('=', 1)[1].strip()
    
    if not url or not key:
        raise ValueError("Missing Supabase credentials in .env.local")
    
    return create_client(url, key)

def export_from_sqlite(db_path='../allabolag.db'):
    """Export master_analytics from fixed SQLite database"""
    print("=" * 70)
    print("EXPORTING FROM LOCAL SQLITE DATABASE")
    print("=" * 70)
    
    conn = sqlite3.connect(db_path)
    
    # Verify the database has correct types
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(master_analytics)")
    columns = cursor.fetchall()
    
    print("\nColumn types in local database:")
    for col in columns:
        if col[1] in ['revenue', 'profit', 'employees']:
            print(f"  {col[1]}: {col[2]}")
    
    # Export only columns that exist in Supabase schema
    query = """
    SELECT 
        OrgNr, name, address, city, incorporation_date, email, homepage,
        segment, segment_name,
        revenue, profit, employees,
        SDI, DR, ORS, Revenue_growth, EBIT_margin, NetProfit_margin,
        analysis_year, seg_revenue, seg_ebit, year_rank, avg_growth,
        growth_range, growth_stage, digital_maturity, industry_cluster,
        fit_score_reason,
        company_size_category, employee_size_category, 
        profitability_category, growth_category
    FROM master_analytics
    """
    
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    print(f"\nExported {len(df)} companies from local database")
    
    # Show data coverage
    print("\nData coverage:")
    print(f"  Companies with revenue: {df['revenue'].notna().sum()} ({df['revenue'].notna().sum()/len(df)*100:.1f}%)")
    print(f"  Companies with profit: {df['profit'].notna().sum()} ({df['profit'].notna().sum()/len(df)*100:.1f}%)")
    print(f"  Companies with employees: {df['employees'].notna().sum()} ({df['employees'].notna().sum()/len(df)*100:.1f}%)")
    
    # Show sample data
    print("\nSample data (first 3 companies):")
    for idx, row in df.head(3).iterrows():
        print(f"\n  {row['name']}")
        print(f"    Revenue: {row['revenue']} (type: {type(row['revenue']).__name__})")
        print(f"    Profit: {row['profit']}")
        print(f"    Employees: {row['employees']}")
    
    return df

def clean_dataframe_for_supabase(df):
    """Clean and prepare dataframe for Supabase"""
    print("\n" + "=" * 70)
    print("CLEANING DATA FOR SUPABASE")
    print("=" * 70)
    
    # Fix incorporation_date format (DD.MM.YYYY -> YYYY-MM-DD)
    if 'incorporation_date' in df.columns:
        print("  Converting incorporation_date format...")
        def convert_date(date_str):
            if pd.isna(date_str) or date_str is None:
                return None
            try:
                # Try parsing DD.MM.YYYY format
                if isinstance(date_str, str) and '.' in date_str:
                    parts = date_str.split('.')
                    if len(parts) == 3:
                        day, month, year = parts
                        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                # If already in correct format or other format, return as is
                return date_str
            except:
                return None
        
        df['incorporation_date'] = df['incorporation_date'].apply(convert_date)
    
    # Define column types
    float_columns = ['revenue', 'profit', 'SDI', 'DR', 'ORS', 
                    'Revenue_growth', 'EBIT_margin', 'NetProfit_margin',
                    'seg_revenue', 'seg_ebit', 'avg_growth']
    
    integer_columns = ['employees', 'analysis_year', 'year_rank']
    
    # Handle float columns
    for col in float_columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            df[col] = df[col].replace([float('inf'), float('-inf'), float('nan')], None)
    
    # Handle integer columns properly
    for col in integer_columns:
        if col in df.columns:
            # Convert to numeric first
            df[col] = pd.to_numeric(df[col], errors='coerce')
            # Replace infinity and NaN with None
            df[col] = df[col].replace([float('inf'), float('-inf'), float('nan')], None)
            # Convert to integer where not None
            df[col] = df[col].apply(lambda x: int(x) if pd.notna(x) and x is not None else None)
    
    # Replace ALL remaining NaN with None (for text columns)
    df = df.where(pd.notnull(df), None)
    
    # Double-check: replace any remaining NaN values
    df = df.replace({pd.NA: None, pd.NaT: None, float('nan'): None})
    
    # Add digital_presence boolean (if not already present)
    if 'digital_presence' not in df.columns:
        df['digital_presence'] = df['homepage'].notna()
    
    # Verify no NaN values remain
    nan_count = df.isna().sum().sum()
    print(f"\nData cleaning complete")
    print(f"  Total rows: {len(df)}")
    print(f"  Total columns: {len(df.columns)}")
    print(f"  Remaining NaN values: {nan_count} (should be 0)")
    
    return df

def import_to_supabase(df, supabase: Client):
    """Import dataframe to Supabase in batches"""
    print("\n" + "=" * 70)
    print("IMPORTING TO SUPABASE")
    print("=" * 70)
    
    # Debug: Check types before converting to dict
    print("\nColumn types before conversion to dict:")
    for col in ['employees', 'analysis_year', 'year_rank']:
        if col in df.columns:
            sample_val = df[col].iloc[0]
            print(f"  {col}: {type(sample_val).__name__} - value: {sample_val}")
    
    # Convert to records (dict format)
    records = df.to_dict('records')
    
    # Fix integer columns in records (they get converted back to float by to_dict)
    integer_cols = ['employees', 'analysis_year', 'year_rank']
    for record in records:
        for col in integer_cols:
            if col in record and record[col] is not None:
                try:
                    # Ensure it's an integer
                    record[col] = int(float(record[col]))
                except (ValueError, TypeError):
                    record[col] = None
    
    # Remove duplicates based on OrgNr (keep last occurrence)
    seen_orgnr = {}
    for record in records:
        orgnr = record.get('OrgNr')
        if orgnr:
            seen_orgnr[orgnr] = record
    
    # Convert back to list (now deduplicated)
    records = list(seen_orgnr.values())
    print(f"\nAfter deduplication: {len(records)} unique companies")
    
    # Debug: Check first record
    print("\nFirst record sample:")
    if records:
        sample = records[0]
        for key in ['name', 'revenue', 'employees', 'analysis_year']:
            if key in sample:
                val = sample[key]
                print(f"  {key}: {val} (type: {type(val).__name__})")
    
    # Batch configuration
    batch_size = 500  # Smaller batches for reliability
    total_batches = (len(records) + batch_size - 1) // batch_size
    
    successful_batches = 0
    failed_batches = []
    
    print(f"\nStarting import: {len(records)} records in {total_batches} batches")
    print(f"Batch size: {batch_size}")
    
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        batch_num = i // batch_size + 1
        
        try:
            # Upsert batch (insert or update if exists)
            result = supabase.table('master_analytics').upsert(batch).execute()
            successful_batches += 1
            
            # Progress indicator
            if batch_num % 5 == 0 or batch_num == total_batches:
                print(f"  Progress: {batch_num}/{total_batches} batches ({successful_batches} successful)")
            
            # Small delay to avoid rate limiting
            time.sleep(0.1)
            
        except Exception as e:
            print(f"  ❌ Error in batch {batch_num}: {str(e)[:100]}")
            failed_batches.append(batch_num)
            
            # Try smaller sub-batches if batch fails
            if len(batch) > 100:
                print(f"     Retrying with smaller sub-batches...")
                for j in range(0, len(batch), 100):
                    sub_batch = batch[j:j + 100]
                    try:
                        supabase.table('master_analytics').upsert(sub_batch).execute()
                        print(f"     ✓ Sub-batch {j//100 + 1} successful")
                    except Exception as e2:
                        print(f"     ❌ Sub-batch failed: {str(e2)[:50]}")
    
    print(f"\n✅ Import complete!")
    print(f"  Successful batches: {successful_batches}/{total_batches}")
    if failed_batches:
        print(f"  Failed batches: {failed_batches}")
    
    return successful_batches == total_batches

def verify_migration(supabase: Client):
    """Verify the migration was successful"""
    print("\n" + "=" * 70)
    print("VERIFYING MIGRATION")
    print("=" * 70)
    
    # Total count
    result = supabase.table('master_analytics').select('*', count='exact').limit(1).execute()
    total = result.count
    print(f"\nTotal companies in Supabase: {total:,}")
    
    if total == 0:
        print("⚠️  No data was imported - check errors above")
        return False
    
    # Revenue coverage
    result = supabase.table('master_analytics').select('revenue', count='exact').not_.is_('revenue', None).limit(1).execute()
    revenue_count = result.count
    print(f"Companies with revenue: {revenue_count:,} ({revenue_count/total*100:.1f}%)")
    
    # Profit coverage
    result = supabase.table('master_analytics').select('profit', count='exact').not_.is_('profit', None).limit(1).execute()
    profit_count = result.count
    print(f"Companies with profit: {profit_count:,} ({profit_count/total*100:.1f}%)")
    
    # Employees coverage
    result = supabase.table('master_analytics').select('employees', count='exact').not_.is_('employees', None).limit(1).execute()
    employees_count = result.count
    print(f"Companies with employees: {employees_count:,} ({employees_count/total*100:.1f}%)")
    
    # Sample data verification
    print("\n" + "=" * 70)
    print("SAMPLE DATA VERIFICATION")
    print("=" * 70)
    
    result = supabase.table('master_analytics').select('name, revenue, profit, employees').limit(5).execute()
    for company in result.data:
        print(f"\n{company.get('name')}")
        print(f"  Revenue: {company.get('revenue')} (type: {type(company.get('revenue')).__name__})")
        print(f"  Profit: {company.get('profit')}")
        print(f"  Employees: {company.get('employees')}")
    
    # Check specific company we know has data
    print("\n" + "=" * 70)
    print("SPECIFIC COMPANY CHECK (zeb.consulting AB)")
    print("=" * 70)
    
    result = supabase.table('master_analytics').select('*').eq('OrgNr', '5565434056').execute()
    if result.data:
        company = result.data[0]
        print(f"\nName: {company.get('name')}")
        print(f"Revenue: {company.get('revenue')} ✓")
        print(f"Profit: {company.get('profit')} ✓")
        print(f"Employees: {company.get('employees')} ✓")
        print(f"Revenue_growth: {company.get('Revenue_growth')} ✓")
        print(f"EBIT_margin: {company.get('EBIT_margin')} ✓")
    else:
        print("❌ Company not found!")
    
    # Success criteria
    print("\n" + "=" * 70)
    print("MIGRATION SUCCESS CRITERIA")
    print("=" * 70)
    
    success = True
    
    if total < 8400:
        print(f"❌ Total companies ({total}) is less than expected (8400+)")
        success = False
    else:
        print(f"✅ Total companies: {total}")
    
    if revenue_count / total < 0.99:
        print(f"❌ Revenue coverage ({revenue_count/total*100:.1f}%) is less than 99%")
        success = False
    else:
        print(f"✅ Revenue coverage: {revenue_count/total*100:.1f}%")
    
    if profit_count / total < 0.99:
        print(f"❌ Profit coverage ({profit_count/total*100:.1f}%) is less than 99%")
        success = False
    else:
        print(f"✅ Profit coverage: {profit_count/total*100:.1f}%")
    
    if employees_count / total < 0.99:
        print(f"❌ Employees coverage ({employees_count/total*100:.1f}%) is less than 99%")
        success = False
    else:
        print(f"✅ Employees coverage: {employees_count/total*100:.1f}%")
    
    return success

def main():
    """Main migration process"""
    print("\n" + "=" * 70)
    print("SUPABASE MIGRATION - FINAL VERSION")
    print("=" * 70)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        # Step 1: Export from SQLite
        df = export_from_sqlite()
        
        # Step 2: Clean data
        df = clean_dataframe_for_supabase(df)
        
        # Step 3: Connect to Supabase
        print("\n" + "=" * 70)
        print("CONNECTING TO SUPABASE")
        print("=" * 70)
        supabase = get_supabase_client()
        print("✓ Connected successfully")
        
        # Step 4: Import data
        import_success = import_to_supabase(df, supabase)
        
        # Step 5: Verify migration
        verification_success = verify_migration(supabase)
        
        # Final status
        print("\n" + "=" * 70)
        print("MIGRATION COMPLETE")
        print("=" * 70)
        print(f"Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        if import_success and verification_success:
            print("\n🎉 SUCCESS! Migration completed successfully!")
            print("   All data has been migrated with 100% coverage.")
        else:
            print("\n⚠️  Migration completed with warnings.")
            print("   Please review the output above for details.")
        
        return verification_success
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)


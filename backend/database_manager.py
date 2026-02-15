#!/usr/bin/env python3
"""
Supabase Database Manager
Direct database connection for data cleaning, analysis, and management
"""

import os
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv
import json
from datetime import datetime
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self):
        load_dotenv()
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if not all([self.supabase_url, self.supabase_key]):
            raise ValueError("Missing required environment variables")
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        logger.info("✅ Connected to Supabase database")
    
    def list_tables(self):
        """List all tables in the database"""
        try:
            # Get table information
            result = self.supabase.rpc('get_table_names').execute()
            logger.info("📋 Available tables:")
            for table in result.data:
                print(f"  - {table}")
        except Exception as e:
            logger.error(f"Error listing tables: {e}")
    
    def get_table_info(self, table_name):
        """Get basic information about a table"""
        try:
            # Get row count
            count_result = self.supabase.table(table_name).select("*", count="exact").execute()
            row_count = count_result.count
            
            # Get sample data
            sample_result = self.supabase.table(table_name).select("*").limit(5).execute()
            
            logger.info(f"📊 Table: {table_name}")
            logger.info(f"   Rows: {row_count}")
            logger.info(f"   Columns: {list(sample_result.data[0].keys()) if sample_result.data else 'No data'}")
            
            return {
                'row_count': row_count,
                'columns': list(sample_result.data[0].keys()) if sample_result.data else [],
                'sample_data': sample_result.data[:3] if sample_result.data else []
            }
        except Exception as e:
            logger.error(f"Error getting table info for {table_name}: {e}")
            return None
    
    def query_table(self, table_name, limit=100, where_clause=None):
        """Query a table with optional filters"""
        try:
            query = self.supabase.table(table_name).select("*")
            
            if where_clause:
                query = query.filter(where_clause)
            
            result = query.limit(limit).execute()
            
            logger.info(f"📋 Querying {table_name} (limit: {limit})")
            logger.info(f"   Found {len(result.data)} rows")
            
            return result.data
        except Exception as e:
            logger.error(f"Error querying {table_name}: {e}")
            return []
    
    def find_data_issues(self, table_name):
        """Find common data issues in a table"""
        try:
            logger.info(f"🔍 Analyzing data issues in {table_name}...")
            
            # Get all data
            result = self.supabase.table(table_name).select("*").execute()
            df = pd.DataFrame(result.data)
            
            issues = []
            
            # Check for date format issues
            for col in df.columns:
                if 'date' in col.lower() or 'time' in col.lower():
                    date_values = df[col].dropna()
                    if len(date_values) > 0:
                        # Check for "1970-01-01" dates (Unix epoch)
                        epoch_dates = date_values[date_values.astype(str).str.contains('1970-01-01')]
                        if len(epoch_dates) > 0:
                            issues.append(f"Column '{col}' has {len(epoch_dates)} '1970-01-01' dates (Unix epoch)")
            
            # Check for numeric columns with text
            for col in df.columns:
                if df[col].dtype == 'object':
                    # Try to convert to numeric
                    numeric_errors = pd.to_numeric(df[col], errors='coerce').isna().sum()
                    if numeric_errors > 0:
                        issues.append(f"Column '{col}' has {numeric_errors} non-numeric values in what should be numeric column")
            
            # Check for empty/null values
            null_counts = df.isnull().sum()
            for col, count in null_counts.items():
                if count > 0:
                    issues.append(f"Column '{col}' has {count} null/empty values")
            
            if issues:
                logger.warning(f"⚠️  Found {len(issues)} data issues:")
                for issue in issues:
                    logger.warning(f"   - {issue}")
            else:
                logger.info("✅ No major data issues found")
            
            return issues
            
        except Exception as e:
            logger.error(f"Error analyzing {table_name}: {e}")
            return []
    
    def clean_table_data(self, table_name, column_mappings=None):
        """Clean data in a specific table"""
        try:
            logger.info(f"🧹 Cleaning data in {table_name}...")
            
            # Get all data
            result = self.supabase.table(table_name).select("*").execute()
            df = pd.DataFrame(result.data)
            
            original_count = len(df)
            logger.info(f"   Original rows: {original_count}")
            
            # Clean date columns
            for col in df.columns:
                if 'date' in col.lower() or 'time' in col.lower():
                    # Convert to proper datetime
                    df[col] = pd.to_datetime(df[col], errors='coerce')
                    # Replace invalid dates with None
                    df[col] = df[col].where(df[col].dt.year > 1900, None)
            
            # Clean numeric columns
            for col in df.columns:
                if df[col].dtype == 'object':
                    # Try to convert to numeric
                    numeric_series = pd.to_numeric(df[col], errors='coerce')
                    if not numeric_series.isna().all():
                        df[col] = numeric_series
            
            # Replace NaN with None for JSON compatibility
            df = df.where(pd.notnull(df), None)
            
            # Remove rows that are all None
            df = df.dropna(how='all')
            
            cleaned_count = len(df)
            logger.info(f"   Cleaned rows: {cleaned_count}")
            logger.info(f"   Removed: {original_count - cleaned_count} rows")
            
            if cleaned_count > 0:
                # Convert to records for insertion
                records = df.to_dict('records')
                
                # Clear existing data
                self.supabase.table(table_name).delete().neq('id', 0).execute()
                
                # Insert cleaned data in batches
                batch_size = 1000
                for i in range(0, len(records), batch_size):
                    batch = records[i:i + batch_size]
                    self.supabase.table(table_name).insert(batch).execute()
                    logger.info(f"   Inserted batch {i//batch_size + 1}")
                
                logger.info(f"✅ Successfully cleaned and updated {table_name}")
            else:
                logger.warning(f"⚠️  No valid data remaining in {table_name}")
            
        except Exception as e:
            logger.error(f"Error cleaning {table_name}: {e}")
    
    def get_migration_status(self):
        """Get current migration status"""
        try:
            logger.info("📊 Migration Status Report")
            logger.info("=" * 50)
            
            # List of all tables that should exist
            expected_tables = [
                'companies', 'company_accounts_by_id', 'company_kpis_by_id',
                'segmentation_companies_raw', 'website_fit_scores',
                'all_companies_raw', 'top_50_ai_analysis', 'ai_company_analysis'
            ]
            
            for table in expected_tables:
                try:
                    info = self.get_table_info(table)
                    if info:
                        status = "✅" if info['row_count'] > 0 else "⚠️"
                        print(f"{status} {table}: {info['row_count']} rows")
                    else:
                        print(f"❌ {table}: Error accessing table")
                except:
                    print(f"❌ {table}: Table not found")
            
        except Exception as e:
            logger.error(f"Error getting migration status: {e}")
    
    def run_custom_query(self, query):
        """Run a custom SQL query"""
        try:
            result = self.supabase.rpc('execute_sql', {'query': query}).execute()
            return result.data
        except Exception as e:
            logger.error(f"Error running custom query: {e}")
            return None

def main():
    """Interactive database manager"""
    try:
        db = DatabaseManager()
        
        print("\n🚀 Supabase Database Manager")
        print("=" * 40)
        print("Available commands:")
        print("1. list_tables() - List all tables")
        print("2. get_table_info('table_name') - Get table information")
        print("3. query_table('table_name') - Query table data")
        print("4. find_data_issues('table_name') - Find data problems")
        print("5. clean_table_data('table_name') - Clean table data")
        print("6. get_migration_status() - Check migration status")
        print("7. run_custom_query('SQL') - Run custom SQL")
        
        # Example usage
        db.get_migration_status()
        
        return db
        
    except Exception as e:
        logger.error(f"Failed to initialize database manager: {e}")
        return None

if __name__ == "__main__":
    db = main()

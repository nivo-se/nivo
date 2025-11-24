import sys
import os
from backend.services.db_factory import get_database_service

# Add current directory to path so imports work
sys.path.append(os.getcwd())

def check_data():
    try:
        print("Connecting to database...")
        db = get_database_service()
        print(f"Connected to {db.db_path}")

        tables = ["companies", "financials", "company_metrics"]
        
        for table in tables:
            try:
                result = db.run_raw_query(f"SELECT count(*) as count FROM {table}")
                count = result[0]['count'] if result else 0
                print(f"Table '{table}': {count} rows")
            except Exception as e:
                print(f"Table '{table}': Error - {e}")

    except Exception as e:
        print(f"Database connection failed: {e}")

if __name__ == "__main__":
    check_data()

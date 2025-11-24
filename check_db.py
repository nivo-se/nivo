import sys
import os
from backend.services.db_factory import get_database_service

# Add current directory to path so imports work
sys.path.append(os.getcwd())

def check_db():
    try:
        print("Connecting to database...")
        db = get_database_service()
        print("Connected.")

        print("Checking tables...")
        # Try to query the tables
        try:
            db.run_raw_query("SELECT count(*) FROM companies LIMIT 1")
            print("Table 'companies' exists.")
        except Exception as e:
            print(f"Error checking 'companies': {e}")

        try:
            db.run_raw_query("SELECT count(*) FROM company_metrics LIMIT 1")
            print("Table 'company_metrics' exists.")
        except Exception as e:
            print(f"Error checking 'company_metrics': {e}")

    except Exception as e:
        print(f"Database connection failed: {e}")

if __name__ == "__main__":
    check_db()

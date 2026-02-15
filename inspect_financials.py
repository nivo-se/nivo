import sys
import os
from backend.services.db_factory import get_database_service

sys.path.append(os.getcwd())

def inspect_financials():
    db = get_database_service()
    rows = db.run_raw_query("SELECT * FROM financials LIMIT 1")
    if rows:
        print("Columns in 'financials':")
        for key in rows[0].keys():
            print(f"- {key}: {rows[0][key]}")
    else:
        print("No data in financials")

if __name__ == "__main__":
    inspect_financials()

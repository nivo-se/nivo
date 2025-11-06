#!/usr/bin/env python3
"""Load CSV data into Supabase using Python (alternative to psql).

This script uses pandas and psycopg2 to load data, which may work better
than direct psql connections if there are firewall issues.
"""

import os
import sys
import csv
import psycopg2
from psycopg2.extras import execute_values
from pathlib import Path
import json

def load_csv_to_table(conn, table_name: str, csv_path: Path, batch_size: int = 1000):
    """Load CSV file into PostgreSQL table using COPY."""
    print(f"Loading {csv_path.name} into {table_name}...")
    
    with conn.cursor() as cur:
        # Use COPY for efficient bulk loading
        with open(csv_path, 'r', encoding='utf-8') as f:
            # Skip header
            next(f)
            cur.copy_expert(
                f"COPY {table_name} FROM STDIN WITH (FORMAT csv, HEADER false)",
                f
            )
        conn.commit()
        print(f"  ✓ {table_name} loaded")

def main():
    # Get connection string
    db_url = os.getenv('SUPABASE_DB_URL')
    db_password = os.getenv('SUPABASE_DB_PASSWORD')
    
    if not db_url and db_password:
        db_url = f"postgresql://postgres:{db_password}@db.clysgodrmowieximfaab.supabase.co:5432/postgres?sslmode=require"
    
    if not db_url:
        print("ERROR: SUPABASE_DB_URL or SUPABASE_DB_PASSWORD must be set", file=sys.stderr)
        sys.exit(1)
    
    csv_dir = Path("data/csv_export")
    if not csv_dir.exists():
        print(f"ERROR: CSV directory not found: {csv_dir}", file=sys.stderr)
        sys.exit(1)
    
    try:
        # Connect to database
        print("Connecting to Supabase...")
        conn = psycopg2.connect(db_url)
        print("  ✓ Connected")
        
        # Load tables in order (respecting foreign keys)
        load_csv_to_table(conn, "companies", csv_dir / "companies.csv")
        load_csv_to_table(conn, "company_financials", csv_dir / "company_financials.csv")
        load_csv_to_table(conn, "company_metrics", csv_dir / "company_metrics.csv")
        
        conn.close()
        print("\n✅ All data loaded successfully!")
        
    except psycopg2.OperationalError as e:
        print(f"\nERROR: Database connection failed: {e}", file=sys.stderr)
        print("\nThis might be a network/firewall issue.", file=sys.stderr)
        print("Try:", file=sys.stderr)
        print("  1. Check your IP is whitelisted in Supabase Dashboard", file=sys.stderr)
        print("  2. Use the connection pooling URL instead", file=sys.stderr)
        print("  3. Or use Supabase Dashboard SQL Editor to import manually", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\nERROR: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()


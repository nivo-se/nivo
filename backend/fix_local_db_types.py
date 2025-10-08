#!/usr/bin/env python3
"""
Fix local SQLite database column types
Convert revenue, profit, employees from TEXT to proper numeric types
"""

import sqlite3
import sys

def fix_column_types(db_path):
    """Convert TEXT columns to numeric types in master_analytics table"""
    
    print(f"Opening database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Step 1: Check current state
        print("\n=== BEFORE CONVERSION ===")
        cursor.execute("PRAGMA table_info(master_analytics)")
        columns = cursor.fetchall()
        for col in columns:
            if col[1] in ['revenue', 'profit', 'employees']:
                print(f"Column: {col[1]}, Type: {col[2]}")
        
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN revenue IS NOT NULL AND revenue != '' THEN 1 END) as has_revenue,
                COUNT(CASE WHEN profit IS NOT NULL AND profit != '' THEN 1 END) as has_profit,
                COUNT(CASE WHEN employees IS NOT NULL AND employees != '' THEN 1 END) as has_employees
            FROM master_analytics
        """)
        stats = cursor.fetchone()
        print(f"\nData coverage:")
        print(f"  Total companies: {stats[0]}")
        print(f"  With revenue: {stats[1]} ({stats[1]/stats[0]*100:.1f}%)")
        print(f"  With profit: {stats[2]} ({stats[2]/stats[0]*100:.1f}%)")
        print(f"  With employees: {stats[3]} ({stats[3]/stats[0]*100:.1f}%)")
        
        # Step 2: Add new columns with proper types
        print("\n=== ADDING NEW COLUMNS ===")
        cursor.execute("ALTER TABLE master_analytics ADD COLUMN revenue_numeric REAL")
        print("✓ Added revenue_numeric (REAL)")
        
        cursor.execute("ALTER TABLE master_analytics ADD COLUMN profit_numeric REAL")
        print("✓ Added profit_numeric (REAL)")
        
        cursor.execute("ALTER TABLE master_analytics ADD COLUMN employees_numeric INTEGER")
        print("✓ Added employees_numeric (INTEGER)")
        
        conn.commit()
        
        # Step 3: Copy and convert data
        print("\n=== CONVERTING DATA ===")
        
        # Convert revenue (TEXT -> REAL)
        cursor.execute("""
            UPDATE master_analytics 
            SET revenue_numeric = CAST(revenue AS REAL)
            WHERE revenue IS NOT NULL AND revenue != ''
        """)
        print(f"✓ Converted {cursor.rowcount} revenue values to REAL")
        
        # Convert profit (TEXT -> REAL)
        cursor.execute("""
            UPDATE master_analytics 
            SET profit_numeric = CAST(profit AS REAL)
            WHERE profit IS NOT NULL AND profit != ''
        """)
        print(f"✓ Converted {cursor.rowcount} profit values to REAL")
        
        # Convert employees (TEXT -> INTEGER)
        cursor.execute("""
            UPDATE master_analytics 
            SET employees_numeric = CAST(employees AS INTEGER)
            WHERE employees IS NOT NULL AND employees != ''
        """)
        print(f"✓ Converted {cursor.rowcount} employee values to INTEGER")
        
        conn.commit()
        
        # Step 4: Verify conversion
        print("\n=== VERIFYING CONVERSION ===")
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(revenue_numeric) as has_revenue,
                COUNT(profit_numeric) as has_profit,
                COUNT(employees_numeric) as has_employees,
                AVG(revenue_numeric) as avg_revenue,
                AVG(profit_numeric) as avg_profit,
                AVG(employees_numeric) as avg_employees
            FROM master_analytics
        """)
        stats = cursor.fetchone()
        print(f"New columns data coverage:")
        print(f"  Total companies: {stats[0]}")
        print(f"  With revenue_numeric: {stats[1]} ({stats[1]/stats[0]*100:.1f}%)")
        print(f"  With profit_numeric: {stats[2]} ({stats[2]/stats[0]*100:.1f}%)")
        print(f"  With employees_numeric: {stats[3]} ({stats[3]/stats[0]*100:.1f}%)")
        print(f"\nAverages:")
        print(f"  Avg revenue: {stats[4]:,.0f} SEK")
        print(f"  Avg profit: {stats[5]:,.0f} SEK")
        print(f"  Avg employees: {stats[6]:.1f}")
        
        # Step 5: Sample comparison
        print("\n=== SAMPLE COMPARISON (First 3 companies) ===")
        cursor.execute("""
            SELECT name, 
                   revenue, revenue_numeric,
                   profit, profit_numeric,
                   employees, employees_numeric
            FROM master_analytics 
            LIMIT 3
        """)
        for row in cursor.fetchall():
            print(f"\nCompany: {row[0]}")
            print(f"  Revenue:   '{row[1]}' (TEXT) -> {row[2]} (REAL)")
            print(f"  Profit:    '{row[3]}' (TEXT) -> {row[4]} (REAL)")
            print(f"  Employees: '{row[5]}' (TEXT) -> {row[6]} (INTEGER)")
        
        # Step 6: Create new table with correct schema
        print("\n=== CREATING NEW TABLE WITH CORRECT SCHEMA ===")
        
        # Get the old table schema
        cursor.execute("PRAGMA table_info(master_analytics)")
        old_columns = cursor.fetchall()
        
        # Build column list excluding old TEXT columns and including new numeric ones
        new_columns = []
        for col in old_columns:
            col_name = col[1]
            col_type = col[2]
            
            if col_name == 'revenue':
                continue  # Skip old TEXT column
            elif col_name == 'profit':
                continue  # Skip old TEXT column
            elif col_name == 'employees':
                continue  # Skip old TEXT column
            elif col_name == 'revenue_numeric':
                new_columns.append('revenue REAL')  # Rename back to revenue
            elif col_name == 'profit_numeric':
                new_columns.append('profit REAL')  # Rename back to profit
            elif col_name == 'employees_numeric':
                new_columns.append('employees INTEGER')  # Rename back to employees
            else:
                new_columns.append(f'{col_name} {col_type}')
        
        # Create new table
        create_sql = f"CREATE TABLE master_analytics_new ({', '.join(new_columns)})"
        cursor.execute(create_sql)
        print("✓ Created master_analytics_new table")
        
        # Copy data (mapping new numeric columns to original names)
        old_column_names = [col[1] for col in old_columns if col[1] not in ['revenue', 'profit', 'employees']]
        
        # Build INSERT statement
        select_columns = []
        for col in old_columns:
            if col[1] == 'revenue':
                continue
            elif col[1] == 'profit':
                continue
            elif col[1] == 'employees':
                continue
            elif col[1] == 'revenue_numeric':
                select_columns.append('revenue_numeric as revenue')
            elif col[1] == 'profit_numeric':
                select_columns.append('profit_numeric as profit')
            elif col[1] == 'employees_numeric':
                select_columns.append('employees_numeric as employees')
            else:
                select_columns.append(col[1])
        
        insert_sql = f"""
            INSERT INTO master_analytics_new 
            SELECT {', '.join(select_columns)}
            FROM master_analytics
        """
        cursor.execute(insert_sql)
        print(f"✓ Copied {cursor.rowcount} rows to new table")
        
        conn.commit()
        
        # Step 7: Swap tables
        print("\n=== SWAPPING TABLES ===")
        cursor.execute("DROP TABLE master_analytics")
        print("✓ Dropped old master_analytics table")
        
        cursor.execute("ALTER TABLE master_analytics_new RENAME TO master_analytics")
        print("✓ Renamed master_analytics_new to master_analytics")
        
        conn.commit()
        
        # Step 8: Final verification
        print("\n=== FINAL VERIFICATION ===")
        cursor.execute("PRAGMA table_info(master_analytics)")
        columns = cursor.fetchall()
        for col in columns:
            if col[1] in ['revenue', 'profit', 'employees']:
                print(f"Column: {col[1]}, Type: {col[2]}")
        
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(revenue) as has_revenue,
                COUNT(profit) as has_profit,
                COUNT(employees) as has_employees,
                AVG(revenue) as avg_revenue,
                AVG(profit) as avg_profit,
                AVG(employees) as avg_employees
            FROM master_analytics
        """)
        stats = cursor.fetchone()
        print(f"\nFinal data coverage:")
        print(f"  Total companies: {stats[0]}")
        print(f"  With revenue: {stats[1]} ({stats[1]/stats[0]*100:.1f}%)")
        print(f"  With profit: {stats[2]} ({stats[2]/stats[0]*100:.1f}%)")
        print(f"  With employees: {stats[3]} ({stats[3]/stats[0]*100:.1f}%)")
        print(f"\nAverages:")
        print(f"  Avg revenue: {stats[4]:,.0f} SEK")
        print(f"  Avg profit: {stats[5]:,.0f} SEK")
        print(f"  Avg employees: {stats[6]:.1f}")
        
        print("\n✅ SUCCESS! Database column types have been fixed.")
        print("   Revenue: TEXT -> REAL")
        print("   Profit: TEXT -> REAL")
        print("   Employees: TEXT -> INTEGER")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        conn.rollback()
        raise
    
    finally:
        conn.close()

if __name__ == '__main__':
    db_path = '../allabolag.db'
    if len(sys.argv) > 1:
        db_path = sys.argv[1]
    
    print("=" * 70)
    print("FIXING LOCAL DATABASE COLUMN TYPES")
    print("=" * 70)
    
    fix_column_types(db_path)


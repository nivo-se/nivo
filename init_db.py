import sys
import os
from backend.services.db_factory import get_database_service

# Add current directory to path so imports work
sys.path.append(os.getcwd())

def init_db():
    try:
        # Revert to local (default)
        if "DATABASE_SOURCE" in os.environ:
            del os.environ["DATABASE_SOURCE"]
        from backend.services.db_factory import reset_database_service_cache
        reset_database_service_cache()

        print("Connecting to Local DB (SQLite)...")
        db = get_database_service()
        print("Connected.")

        # List of schema files to execute
        schema_files = [
            "database/sqlite_schema.sql"
        ]

        for schema_file in schema_files:
            print(f"Executing {schema_file}...")
            try:
                with open(schema_file, "r") as f:
                    sql = f.read()
                    # Split by statement if needed, but run_raw_query might handle it or we might need to split by ';'
                    # For simplicity, let's try running the whole block or split if it fails.
                    # Supabase/Postgres usually handles multiple statements in one go if the driver supports it.
                    # If not, we might need to split.
                    
                    # Simple split by semicolon for safety, though it might break if semicolons are in strings.
                    # But these schema files look simple enough.
                    statements = [s.strip() for s in sql.split(';') if s.strip()]
                    
                    for stmt in statements:
                        try:
                            db.run_raw_query(stmt)
                        except Exception as e:
                            # Ignore "already exists" errors
                            if "already exists" in str(e):
                                print(f"  Note: {e}")
                            else:
                                print(f"  Error executing statement: {e}")
                                # print(f"  Statement: {stmt[:100]}...")

                print(f"Finished {schema_file}.")
            except FileNotFoundError:
                print(f"File not found: {schema_file}")
            except Exception as e:
                print(f"Error reading/executing {schema_file}: {e}")

    except Exception as e:
        print(f"Database connection failed: {e}")

if __name__ == "__main__":
    init_db()

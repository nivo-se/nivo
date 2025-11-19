#!/usr/bin/env python3
"""
Dashboard Functions Verification Script

This script verifies that all dashboard functions are working correctly
by testing database queries, API endpoints, and data transformations.

Tests both local SQLite and Supabase databases.
"""

import sqlite3
import json
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime

# Try to import requests, make API tests optional if not available
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    print("⚠️  'requests' library not available. API endpoint tests will be skipped.")
    print("   Install with: pip install requests")

# Database paths
LOCAL_DB_PATH = Path(__file__).parent.parent / "data" / "new_schema_local.db"
BASE_URL = "http://localhost:3001"  # Default enhanced-server port


@dataclass
class TestResult:
    """Test result container"""
    test_name: str
    passed: bool
    message: str
    details: Optional[Dict[str, Any]] = None


class DashboardVerifier:
    """Main verification class"""
    
    def __init__(self):
        self.results: List[TestResult] = []
        self.local_db: Optional[sqlite3.Connection] = None
        self.supabase_available = False
        
    def log_result(self, test_name: str, passed: bool, message: str, details: Optional[Dict] = None):
        """Log a test result"""
        self.results.append(TestResult(test_name, passed, message, details))
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not passed:
            print(f"   Details: {details}")
    
    def connect_local_db(self) -> bool:
        """Connect to local SQLite database"""
        try:
            if not LOCAL_DB_PATH.exists():
                self.log_result("Local DB Connection", False, f"Database not found: {LOCAL_DB_PATH}")
                return False
            
            self.local_db = sqlite3.connect(str(LOCAL_DB_PATH))
            self.local_db.row_factory = sqlite3.Row
            self.log_result("Local DB Connection", True, f"Connected to {LOCAL_DB_PATH}")
            return True
        except Exception as e:
            self.log_result("Local DB Connection", False, f"Error: {e}")
            return False
    
    def check_supabase_connection(self) -> bool:
        """Check if Supabase is configured (via environment or config)"""
        # Check environment variables for Supabase configuration
        import os
        supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")
        
        if supabase_url and supabase_key:
            self.supabase_available = True
            self.log_result("Supabase Connection", True, "Supabase credentials found in environment")
            return True
        else:
            self.supabase_available = False
            self.log_result("Supabase Connection", False, "Supabase credentials not found (check .env.local)")
            return False
    
    def verify_table_existence(self) -> None:
        """Verify all expected tables exist"""
        if not self.local_db:
            return
        
        expected_tables = [
            "companies",
            "company_financials",
            "company_metrics",
            "financial_accounts",
            # "financial_accounts_pivot" - Optional table, may not exist
        ]
        
        cursor = self.local_db.execute("SELECT name FROM sqlite_master WHERE type='table'")
        existing_tables = {row[0] for row in cursor.fetchall()}
        
        for table in expected_tables:
            if table in existing_tables:
                self.log_result(f"Table Exists: {table}", True, f"Table {table} exists")
            else:
                self.log_result(f"Table Exists: {table}", False, f"Table {table} missing")
    
    def verify_table_row_counts(self) -> None:
        """Verify table row counts match expectations"""
        if not self.local_db:
            return
        
        expected_counts = {
            "companies": (10000, 20000),  # Range: should be ~13,609
            "company_financials": (50000, 100000),  # Range: should be ~66,614
            "company_metrics": (10000, 20000),  # Range: should be ~13,609
            "financial_accounts": (1000000, 5000000),  # Range: should be ~3.3M
        }
        
        for table, (min_count, max_count) in expected_counts.items():
            try:
                cursor = self.local_db.execute(f"SELECT COUNT(*) as count FROM {table}")
                count = cursor.fetchone()["count"]
                
                if min_count <= count <= max_count:
                    self.log_result(
                        f"Row Count: {table}",
                        True,
                        f"Count: {count:,} (expected {min_count:,}-{max_count:,})"
                    )
                else:
                    self.log_result(
                        f"Row Count: {table}",
                        False,
                        f"Count: {count:,} (expected {min_count:,}-{max_count:,})",
                        {"actual": count, "expected_min": min_count, "expected_max": max_count}
                    )
            except Exception as e:
                self.log_result(f"Row Count: {table}", False, f"Error: {e}")
    
    def verify_table_schemas(self) -> None:
        """Verify table schemas match expected structure"""
        if not self.local_db:
            return
        
        # Check companies table
        try:
            cursor = self.local_db.execute("PRAGMA table_info(companies)")
            columns = {row[1]: row[2] for row in cursor.fetchall()}
            
            required_columns = ["orgnr", "company_name", "homepage", "address", "segment_names"]
            for col in required_columns:
                if col in columns:
                    self.log_result(f"Schema: companies.{col}", True, f"Column {col} exists")
                else:
                    self.log_result(f"Schema: companies.{col}", False, f"Column {col} missing")
        except Exception as e:
            self.log_result("Schema: companies", False, f"Error checking schema: {e}")
        
        # Check company_metrics table
        try:
            cursor = self.local_db.execute("PRAGMA table_info(company_metrics)")
            columns = {row[1]: row[2] for row in cursor.fetchall()}
            
            required_columns = ["orgnr", "latest_revenue_sek", "revenue_cagr_3y", "avg_ebitda_margin"]
            for col in required_columns:
                if col in columns:
                    self.log_result(f"Schema: company_metrics.{col}", True, f"Column {col} exists")
                else:
                    self.log_result(f"Schema: company_metrics.{col}", False, f"Column {col} missing")
        except Exception as e:
            self.log_result("Schema: company_metrics", False, f"Error checking schema: {e}")
    
    def verify_data_format(self) -> None:
        """Verify data format (thousands vs SEK)"""
        if not self.local_db:
            return
        
        # Check if revenue values are in reasonable range (thousands)
        # If stored in thousands, values should be like 100000 (100 mSEK)
        # If stored in SEK, values would be like 100000000 (100 mSEK)
        try:
            cursor = self.local_db.execute("""
                SELECT 
                    latest_revenue_sek,
                    COUNT(*) as count
                FROM company_metrics
                WHERE latest_revenue_sek IS NOT NULL
                GROUP BY 
                    CASE 
                        WHEN latest_revenue_sek < 1000000 THEN 'thousands'
                        WHEN latest_revenue_sek < 1000000000 THEN 'sek'
                        ELSE 'very_large'
                    END
                ORDER BY count DESC
                LIMIT 5
            """)
            
            results = cursor.fetchall()
            if results:
                # Most values should be in thousands range (< 1M)
                top_result = results[0]
                if top_result[0] == "thousands" or (isinstance(top_result[0], (int, float)) and top_result[0] < 1000000):
                    self.log_result(
                        "Data Format: Revenue",
                        True,
                        "Revenue values appear to be stored in thousands (as expected)"
                    )
                else:
                    self.log_result(
                        "Data Format: Revenue",
                        False,
                        f"Revenue values may be in wrong format. Top range: {top_result}",
                        {"results": [dict(r) for r in results]}
                    )
        except Exception as e:
            self.log_result("Data Format: Revenue", False, f"Error checking format: {e}")
    
    def verify_jsonb_parsing(self) -> None:
        """Verify JSONB/JSON field parsing works"""
        if not self.local_db:
            return
        
        # Test address JSON parsing
        try:
            cursor = self.local_db.execute("""
                SELECT 
                    orgnr,
                    address,
                    segment_names
                FROM companies
                WHERE address IS NOT NULL AND address != ''
                LIMIT 5
            """)
            
            parsed_count = 0
            for row in cursor.fetchall():
                try:
                    # Try to parse address as JSON
                    if isinstance(row["address"], str):
                        addr_data = json.loads(row["address"])
                        if isinstance(addr_data, dict) and ("city" in addr_data or "postPlace" in addr_data):
                            parsed_count += 1
                    
                    # Try to parse segment_names as JSON
                    if row["segment_names"]:
                        if isinstance(row["segment_names"], str):
                            segments = json.loads(row["segment_names"])
                            if isinstance(segments, list):
                                parsed_count += 1
                except:
                    pass
            
            if parsed_count > 0:
                self.log_result(
                    "JSON Parsing: Address/Segments",
                    True,
                    f"Successfully parsed JSON fields for {parsed_count} companies"
                )
            else:
                self.log_result(
                    "JSON Parsing: Address/Segments",
                    False,
                    "Could not parse JSON fields"
                )
        except Exception as e:
            self.log_result("JSON Parsing: Address/Segments", False, f"Error: {e}")
    
    def verify_api_endpoints(self) -> None:
        """Verify API endpoints are accessible and return expected data"""
        if not REQUESTS_AVAILABLE:
            self.log_result(
                "API Endpoints",
                False,
                "Skipped - 'requests' library not available"
            )
            return
        
        endpoints = [
            ("GET", "/api/companies", {"limit": 10}),
            ("GET", "/api/analytics-local", {}),
        ]
        
        for method, path, params in endpoints:
            try:
                url = f"{BASE_URL}{path}"
                if method == "GET":
                    response = requests.get(url, params=params, timeout=5)
                else:
                    response = requests.post(url, json=params, timeout=5)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success") or "companies" in data or "totalCompanies" in data:
                        self.log_result(
                            f"API: {method} {path}",
                            True,
                            f"Endpoint accessible and returns data"
                        )
                    else:
                        self.log_result(
                            f"API: {method} {path}",
                            False,
                            f"Endpoint accessible but unexpected response format",
                            {"response": data}
                        )
                else:
                    self.log_result(
                        f"API: {method} {path}",
                        False,
                        f"HTTP {response.status_code}: {response.text[:100]}"
                    )
            except requests.exceptions.ConnectionError:
                self.log_result(
                    f"API: {method} {path}",
                    False,
                    "Server not running or not accessible"
                )
            except Exception as e:
                self.log_result(
                    f"API: {method} {path}",
                    False,
                    f"Error: {e}"
                )
    
    def verify_analytics_calculations(self) -> None:
        """Verify analytics calculations are correct"""
        if not self.local_db:
            return
        
        # Test total companies count
        try:
            cursor = self.local_db.execute("SELECT COUNT(*) as count FROM companies")
            total_companies = cursor.fetchone()["count"]
            
            cursor = self.local_db.execute("""
                SELECT COUNT(*) as count 
                FROM company_metrics 
                WHERE latest_revenue_sek IS NOT NULL AND latest_revenue_sek > 0
            """)
            with_financials = cursor.fetchone()["count"]
            
            cursor = self.local_db.execute("""
                SELECT COUNT(*) as count 
                FROM companies 
                WHERE homepage IS NOT NULL AND homepage != ''
            """)
            with_homepage = cursor.fetchone()["count"]
            
            self.log_result(
                "Analytics: Total Companies",
                True,
                f"Total: {total_companies:,}, With Financials: {with_financials:,}, With Homepage: {with_homepage:,}"
            )
        except Exception as e:
            self.log_result("Analytics: Total Companies", False, f"Error: {e}")
        
        # Test average revenue calculation
        try:
            cursor = self.local_db.execute("""
                SELECT 
                    AVG(latest_revenue_sek) as avg_revenue,
                    COUNT(*) as count
                FROM company_metrics
                WHERE latest_revenue_sek IS NOT NULL AND latest_revenue_sek > 0
            """)
            result = cursor.fetchone()
            avg_revenue = result["avg_revenue"]
            count = result["count"]
            
            if avg_revenue and avg_revenue > 0:
                self.log_result(
                    "Analytics: Average Revenue",
                    True,
                    f"Average: {avg_revenue:,.0f} (from {count:,} companies)"
                )
            else:
                self.log_result(
                    "Analytics: Average Revenue",
                    False,
                    "Could not calculate average revenue"
                )
        except Exception as e:
            self.log_result("Analytics: Average Revenue", False, f"Error: {e}")
    
    def verify_historical_data(self) -> None:
        """Verify historical financial data queries work"""
        if not self.local_db:
            return
        
        try:
            # Get a sample company
            cursor = self.local_db.execute("SELECT orgnr FROM companies LIMIT 1")
            sample = cursor.fetchone()
            if not sample:
                self.log_result("Historical Data", False, "No companies found")
                return
            
            orgnr = sample["orgnr"]
            
            # Query historical data
            cursor = self.local_db.execute("""
                SELECT 
                    year,
                    account_code,
                    amount_sek
                FROM financial_accounts
                WHERE orgnr = ? AND account_code IN ('SDI', 'RG', 'DR')
                ORDER BY year DESC
                LIMIT 10
            """, (orgnr,))
            
            rows = cursor.fetchall()
            if rows:
                self.log_result(
                    "Historical Data Query",
                    True,
                    f"Found {len(rows)} historical records for sample company"
                )
            else:
                self.log_result(
                    "Historical Data Query",
                    False,
                    "No historical data found for sample company"
                )
        except Exception as e:
            self.log_result("Historical Data Query", False, f"Error: {e}")
    
    def generate_report(self) -> str:
        """Generate verification report"""
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r.passed)
        failed_tests = total_tests - passed_tests
        
        report = f"""
{'='*80}
DASHBOARD VERIFICATION REPORT
{'='*80}
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Summary:
  Total Tests: {total_tests}
  Passed: {passed_tests} ({passed_tests/total_tests*100:.1f}%)
  Failed: {failed_tests} ({failed_tests/total_tests*100:.1f}%)

{'='*80}
DETAILED RESULTS
{'='*80}
"""
        
        for result in self.results:
            status = "✅ PASS" if result.passed else "❌ FAIL"
            report += f"\n{status}: {result.test_name}\n"
            report += f"   {result.message}\n"
            if result.details:
                report += f"   Details: {json.dumps(result.details, indent=2)}\n"
        
        report += f"\n{'='*80}\n"
        
        if failed_tests > 0:
            report += "\nFAILED TESTS:\n"
            for result in self.results:
                if not result.passed:
                    report += f"  - {result.test_name}: {result.message}\n"
        
        return report
    
    def run_all_tests(self) -> None:
        """Run all verification tests"""
        print("Starting Dashboard Verification...\n")
        
        # Phase 1: Database connectivity
        self.connect_local_db()
        self.check_supabase_connection()
        
        if not self.local_db:
            print("⚠️  Cannot proceed without local database connection")
            return
        
        # Phase 2: Table verification
        print("\n--- Table Verification ---")
        self.verify_table_existence()
        self.verify_table_row_counts()
        self.verify_table_schemas()
        
        # Phase 3: Data verification
        print("\n--- Data Verification ---")
        self.verify_data_format()
        self.verify_jsonb_parsing()
        self.verify_analytics_calculations()
        self.verify_historical_data()
        
        # Phase 4: API verification
        print("\n--- API Verification ---")
        self.verify_api_endpoints()
        
        # Generate report
        print("\n" + self.generate_report())


def main():
    """Main entry point"""
    verifier = DashboardVerifier()
    verifier.run_all_tests()
    
    # Exit with error code if any tests failed
    failed_count = sum(1 for r in verifier.results if not r.passed)
    if failed_count > 0:
        print(f"\n⚠️  {failed_count} test(s) failed. Please review the report above.")
        sys.exit(1)
    else:
        print("\n✅ All tests passed!")
        sys.exit(0)


if __name__ == "__main__":
    main()


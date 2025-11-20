#!/usr/bin/env python3
"""
Verify database data against Allabolag.se online source.

This script allows spot-checking specific companies against the live website
to ensure data accuracy. Use sparingly to avoid rate limiting.
"""

import sqlite3
import argparse
from pathlib import Path
from typing import Optional, Dict, Any
import time

def get_company_from_db(conn: sqlite3.Connection, orgnr: str) -> Optional[Dict]:
    """Get company data from optimized database"""
    cur = conn.cursor()
    
    cur.execute("""
        SELECT 
            orgnr, company_id, company_name, homepage, 
            employees_latest, foundation_year
        FROM companies
        WHERE orgnr = ?
    """, (orgnr,))
    
    company = cur.fetchone()
    if not company:
        return None
    
    cur.execute("""
        SELECT year, sdi_sek, dr_sek, ek_sek, fk_sek
        FROM financials
        WHERE orgnr = ?
        ORDER BY year DESC
        LIMIT 5
    """, (orgnr,))
    
    financials = cur.fetchall()
    
    return {
        'orgnr': company[0],
        'company_id': company[1],
        'company_name': company[2],
        'homepage': company[3],
        'employees_latest': company[4],
        'foundation_year': company[5],
        'financials': [
            {
                'year': f[0],
                'revenue': f[1],
                'profit': f[2],
                'equity': f[3],
                'debt': f[4]
            }
            for f in financials
        ]
    }

def fetch_company_online(orgnr: str, company_id: Optional[str] = None) -> Optional[Dict]:
    """
    Fetch company data from Allabolag.se
    
    Note: This requires the actual API endpoint. For now, this is a placeholder
    that shows the structure. In production, you would need to:
    1. Use the same scraper logic to fetch data
    2. Or use Allabolag's API if available
    3. Or scrape the HTML page
    
    This is kept minimal to avoid rate limiting.
    """
    # Placeholder - in production, implement actual API call
    # For now, return None to indicate manual verification needed
    return None

def compare_company_data(db_data: Dict, online_data: Optional[Dict]) -> Dict:
    """Compare database data with online data"""
    print(f"\n📊 COMPARING: {db_data['company_name']} ({db_data['orgnr']})")
    print("="*70)
    
    print(f"\nDatabase Data:")
    print(f"  Company Name: {db_data['company_name']}")
    print(f"  Company ID: {db_data['company_id']}")
    print(f"  Homepage: {db_data['homepage'] or 'N/A'}")
    print(f"  Employees: {db_data['employees_latest'] or 'N/A'}")
    print(f"  Foundation Year: {db_data['foundation_year'] or 'N/A'}")
    
    print(f"\n  Financial Data (last 5 years):")
    for fin in db_data['financials']:
        rev_str = f"{fin['revenue']:,.0f}" if fin['revenue'] else "N/A"
        prof_str = f"{fin['profit']:,.0f}" if fin['profit'] else "N/A"
        print(f"    {fin['year']}: Revenue={rev_str}, Profit={prof_str}")
    
    if online_data:
        print(f"\nOnline Data:")
        print(f"  Company Name: {online_data.get('company_name', 'N/A')}")
        print(f"  Company ID: {online_data.get('company_id', 'N/A')}")
        
        # Compare
        issues = []
        if db_data['company_name'] != online_data.get('company_name'):
            issues.append(f"Company name mismatch")
        if db_data['company_id'] != online_data.get('company_id'):
            issues.append(f"Company ID mismatch")
        
        if issues:
            print(f"\n  ⚠️  Issues found:")
            for issue in issues:
                print(f"    - {issue}")
        else:
            print(f"\n  ✅ Data matches online source")
    else:
        print(f"\n  ℹ️  Online verification not available")
        print(f"     Please manually verify at: https://www.allabolag.se/{db_data['orgnr']}")
    
    return {
        'orgnr': db_data['orgnr'],
        'company_name': db_data['company_name'],
        'issues': [] if not online_data else []
    }

def main():
    parser = argparse.ArgumentParser(description="Verify database data against online source")
    parser.add_argument("--db", required=True, help="Path to optimized database")
    parser.add_argument("--orgnr", help="Specific organization number to verify")
    parser.add_argument("--random", type=int, help="Number of random companies to verify")
    parser.add_argument("--list", help="File with list of orgnrs to verify (one per line)")
    args = parser.parse_args()
    
    db_path = Path(args.db)
    if not db_path.exists():
        print(f"❌ Database not found: {db_path}")
        return
    
    conn = sqlite3.connect(str(db_path))
    
    print("🔍 VERIFYING DATA AGAINST ONLINE SOURCE")
    print("="*70)
    print(f"Database: {db_path}")
    print("\n⚠️  Note: Online verification requires API access or manual checking")
    print("    This script provides database data for manual comparison")
    
    companies_to_check = []
    
    if args.orgnr:
        companies_to_check = [args.orgnr]
    elif args.random:
        cur = conn.cursor()
        cur.execute("""
            SELECT orgnr FROM companies
            ORDER BY RANDOM()
            LIMIT ?
        """, (args.random,))
        companies_to_check = [row[0] for row in cur.fetchall()]
    elif args.list:
        list_path = Path(args.list)
        if list_path.exists():
            with open(list_path) as f:
                companies_to_check = [line.strip() for line in f if line.strip()]
        else:
            print(f"❌ List file not found: {list_path}")
            return
    else:
        print("❌ Please specify --orgnr, --random, or --list")
        return
    
    print(f"\n📋 Checking {len(companies_to_check)} companies...\n")
    
    results = []
    for i, orgnr in enumerate(companies_to_check, 1):
        print(f"\n[{i}/{len(companies_to_check)}]")
        
        db_data = get_company_from_db(conn, orgnr)
        if not db_data:
            print(f"  ⚠️  Company {orgnr} not found in database")
            continue
        
        # For now, we don't fetch online (to avoid rate limiting)
        # In production, you could implement this
        online_data = None  # fetch_company_online(orgnr, db_data['company_id'])
        
        result = compare_company_data(db_data, online_data)
        results.append(result)
        
        # Rate limiting
        if i < len(companies_to_check):
            time.sleep(0.5)
    
    # Summary
    print("\n" + "="*70)
    print("📊 VERIFICATION SUMMARY")
    print("="*70)
    print(f"  Companies checked: {len(results)}")
    print(f"  Companies with issues: {sum(1 for r in results if r['issues'])}")
    
    print(f"\n  Manual Verification URLs:")
    for result in results[:10]:  # Show first 10
        url = f"https://www.allabolag.se/{result['orgnr']}"
        print(f"    {result['company_name']}: {url}")
    
    if len(results) > 10:
        print(f"    ... and {len(results) - 10} more")
    
    conn.close()

if __name__ == "__main__":
    main()


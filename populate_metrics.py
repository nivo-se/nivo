import sys
import os
import sqlite3
from collections import defaultdict
from backend.services.db_factory import get_database_service

sys.path.append(os.getcwd())

def populate_metrics():
    print("Connecting to database...")
    db = get_database_service()
    conn = db._conn
    
    print("Fetching financials...")
    cursor = conn.execute("SELECT orgnr, year, sdi_sek, ors_sek, employees FROM financials ORDER BY orgnr, year DESC")
    rows = cursor.fetchall()
    
    print(f"Processing {len(rows)} financial records...")
    
    company_data = defaultdict(list)
    for row in rows:
        company_data[row['orgnr']].append(dict(row))
        
    metrics_data = []
    
    for orgnr, financials in company_data.items():
        # Financials are already sorted by year DESC
        if not financials:
            continue
            
        latest = financials[0]
        latest_year = latest['year']
        latest_revenue = latest['sdi_sek'] or 0
        latest_ebit = latest['ors_sek'] or 0
        employees = latest['employees'] or 0
        
        # Calculate Margin (EBIT margin as proxy for EBITDA if EBITDA is missing)
        margin = 0
        if latest_revenue > 0:
            margin = latest_ebit / latest_revenue
            
        # Calculate CAGR 3y
        cagr = 0
        if len(financials) >= 3:
            three_years_ago = financials[2] # 0=latest, 1=-1y, 2=-2y (wait, CAGR 3y usually means Year T vs Year T-3)
            # Let's look for Year T-3
            target_year = latest_year - 3
            start_rev = 0
            for f in financials:
                if f['year'] == target_year:
                    start_rev = f['sdi_sek'] or 0
                    break
            
            if start_rev > 0 and latest_revenue > 0:
                try:
                    cagr = (latest_revenue / start_rev) ** (1/3) - 1
                except:
                    cagr = 0
        
        # Growth YoY (fallback if no 3y data)
        if cagr == 0 and len(financials) >= 2:
             prev = financials[1]
             prev_rev = prev['sdi_sek'] or 0
             if prev_rev > 0:
                 cagr = (latest_revenue - prev_rev) / prev_rev

        metrics_data.append((
            orgnr,
            latest_year,
            latest_revenue,
            latest_ebit, # Profit
            latest_ebit, # EBITDA (proxy)
            cagr, # CAGR 3y
            margin, # Avg EBITDA margin
        ))

    print(f"Inserting {len(metrics_data)} metrics records...")
    
    # SQLite upsert
    sql = """
    INSERT INTO company_metrics (
        orgnr, latest_year, latest_revenue_sek, latest_profit_sek, latest_ebitda_sek, 
        revenue_cagr_3y, avg_ebitda_margin
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(orgnr) DO UPDATE SET
        latest_year=excluded.latest_year,
        latest_revenue_sek=excluded.latest_revenue_sek,
        latest_profit_sek=excluded.latest_profit_sek,
        latest_ebitda_sek=excluded.latest_ebitda_sek,
        revenue_cagr_3y=excluded.revenue_cagr_3y,
        avg_ebitda_margin=excluded.avg_ebitda_margin
    """
    
    conn.executemany(sql, metrics_data)
    conn.commit()
    print("Done.")

if __name__ == "__main__":
    populate_metrics()

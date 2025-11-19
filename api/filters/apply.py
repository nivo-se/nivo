"""
Vercel serverless function for applying filters
POST /api/filters/apply
"""
import json
import os
import pandas as pd
from supabase import create_client

def get_supabase_client():
    """Get Supabase client"""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    
    return create_client(url, key)

def cors_headers():
    """Return CORS headers"""
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }

def handler(req):
    """Handle POST request for applying filters"""
    try:
        # Handle CORS preflight
        if req.get("httpMethod") == "OPTIONS" or req.get("method") == "OPTIONS":
            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": "",
            }
        
        # Parse request body
        body = json.loads(req.get("body", "{}"))
        weights = body.get("weights", {
            "revenue": 30.0,
            "ebitMargin": 25.0,
            "growth": 25.0,
            "leverage": 10.0,
            "headcount": 10.0,
        })
        stage_one_size = body.get("stage_one_size", 180)
        
        supabase = get_supabase_client()
        
        # Fetch company metrics
        response = supabase.table("company_metrics").select(
            "orgnr, latest_revenue_sek, revenue_cagr_3y, avg_ebitda_margin, avg_net_margin, "
            "latest_ebitda_sek, latest_revenue_sek, "
            "companies!inner(company_name, employees_latest)"
        ).limit(5000).execute()
        
        if not response.data:
            return {
                "statusCode": 404,
                "headers": {**cors_headers(), "Content-Type": "application/json"},
                "body": json.dumps({"error": "No company data found"}),
            }
        
        # Convert to DataFrame
        companies_data = []
        for row in response.data:
            company = row.get("companies", {})
            revenue = row.get("latest_revenue_sek") or 0
            ebitda = row.get("latest_ebitda_sek") or 0
            
            avg_ebitda_margin = row.get("avg_ebitda_margin")
            if avg_ebitda_margin is None and revenue > 0:
                avg_ebitda_margin = ebitda / revenue if revenue > 0 else 0
            elif avg_ebitda_margin is None:
                avg_ebitda_margin = 0
            
            companies_data.append({
                "orgnr": row.get("orgnr"),
                "name": company.get("company_name", "Unknown"),
                "revenue": revenue,
                "revenue_growth": row.get("revenue_cagr_3y") or 0,
                "ebitda_margin": avg_ebitda_margin,
                "net_margin": row.get("avg_net_margin") or 0,
                "employees": company.get("employees_latest") or 0,
            })
        
        df = pd.DataFrame(companies_data)
        
        if df.empty:
            return {
                "statusCode": 404,
                "headers": {**cors_headers(), "Content-Type": "application/json"},
                "body": json.dumps({"error": "No companies found"}),
            }
        
        # Normalize function
        def normalize(series):
            if series.std() == 0:
                return pd.Series(0.0, index=series.index)
            return (series - series.min()) / (series.max() - series.min() + 1e-9)
        
        # Normalize metrics
        df["revenue_norm"] = normalize(df["revenue"].fillna(0))
        df["growth_norm"] = normalize(df["revenue_growth"].fillna(0))
        df["ebitda_margin_norm"] = normalize(df["ebitda_margin"].fillna(0))
        df["efficiency"] = (df["revenue"] / (df["employees"] + 1)).fillna(0)
        df["efficiency_norm"] = normalize(df["efficiency"])
        
        # Calculate composite score
        total_weight = weights["revenue"] + weights["ebitMargin"] + weights["growth"] + weights["leverage"] + weights["headcount"]
        if total_weight == 0:
            total_weight = 1.0
        
        df["composite_score"] = (
            (weights["revenue"] / total_weight) * df["revenue_norm"] +
            (weights["ebitMargin"] / total_weight) * df["ebitda_margin_norm"] +
            (weights["growth"] / total_weight) * df["growth_norm"] +
            (weights["leverage"] / total_weight) * df["efficiency_norm"] +
            (weights["headcount"] / total_weight) * normalize(df["employees"].fillna(0))
        )
        
        # Sort and take top N
        df_sorted = df.sort_values("composite_score", ascending=False).head(stage_one_size)
        
        # Convert to response format
        companies = []
        for _, row in df_sorted.iterrows():
            companies.append({
                "orgnr": str(row["orgnr"]),
                "name": str(row["name"]),
                "revenue": float(row["revenue"]),
                "growth": float(row["revenue_growth"]),
                "ebitda_margin": float(row["ebitda_margin"]),
                "net_margin": float(row["net_margin"]),
                "composite_score": float(row["composite_score"]),
            })
        
        # Save shortlist to database
        try:
            shortlist_name = f"Stage 1 Shortlist - {stage_one_size} companies"
            shortlist_description = f"Generated with weights: Revenue={weights['revenue']}%, EBITDA Margin={weights['ebitMargin']}%, Growth={weights['growth']}%, Leverage={weights['leverage']}%, Headcount={weights['headcount']}%"
            
            supabase.table("stage1_shortlists").insert({
                "name": shortlist_name,
                "description": shortlist_description,
                "weights_json": weights,
                "stage_one_size": stage_one_size,
                "companies": companies,
                "total_companies": len(companies),
                "status": "active"
            }).execute()
        except Exception as save_error:
            # Log but don't fail
            print(f"Failed to save shortlist: {save_error}")
        
        return {
            "statusCode": 200,
            "headers": {**cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({
                "success": True,
                "companies": companies,
                "total": len(companies),
                "weights_applied": weights,
                "saved": True,
            }),
        }
        
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {**cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({"error": str(e)}),
        }


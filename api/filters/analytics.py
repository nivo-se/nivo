"""
Vercel serverless function for filter analytics
GET /api/filters/analytics
"""
import json
import sys
import os
from pathlib import Path
import numpy as np
import pandas as pd

# Import supabase directly
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
    """Handle GET request for filter analytics"""
    try:
        # Handle CORS preflight
        if req.get("httpMethod") == "OPTIONS" or req.get("method") == "OPTIONS":
            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": "",
            }
        
        # Parse query parameters (Vercel format)
        query = req.get("queryStringParameters") or {}
        weights_str = query.get("weights")
        use_percentiles = query.get("use_percentiles", "false").lower() == "true"
        
        # Parse weights or use defaults
        if weights_str:
            weight_dict = json.loads(weights_str)
        else:
            weight_dict = {
                "revenue": 30.0,
                "ebitMargin": 25.0,
                "growth": 25.0,
                "leverage": 10.0,
                "headcount": 10.0,
            }
        
        # Get Supabase client
        supabase = get_supabase_client()
        
        # Fetch company metrics for analytics
        response = supabase.table("company_metrics").select(
            "orgnr, latest_revenue_sek, revenue_cagr_3y, avg_ebitda_margin, avg_net_margin, "
            "companies!inner(company_name, employees_latest)"
        ).limit(1000).execute()
        
        if not response.data:
            return {
                "statusCode": 200,
                "headers": {**cors_headers(), "Content-Type": "application/json"},
                "body": json.dumps({
                    "percentiles": {},
                    "clusters": [],
                    "scatter_data": [],
                    "density_data": [],
                }),
            }
        
        # Convert to DataFrame
        companies = []
        for row in response.data:
            company = row.get("companies", {})
            companies.append({
                "orgnr": row.get("orgnr"),
                "name": company.get("company_name", "Unknown"),
                "revenue": row.get("latest_revenue_sek") or 0,
                "growth": row.get("revenue_cagr_3y") or 0,
                "ebitda_margin": row.get("avg_ebitda_margin") or 0,
                "net_margin": row.get("avg_net_margin") or 0,
                "employees": company.get("employees_latest") or 0,
            })
        
        df = pd.DataFrame(companies)
        
        # Calculate percentiles
        percentiles = {
            "revenue": {
                "p25": float(df["revenue"].quantile(0.25)),
                "p50": float(df["revenue"].quantile(0.50)),
                "p75": float(df["revenue"].quantile(0.75)),
                "p90": float(df["revenue"].quantile(0.90)),
            },
            "growth": {
                "p25": float(df["growth"].quantile(0.25)),
                "p50": float(df["growth"].quantile(0.50)),
                "p75": float(df["growth"].quantile(0.75)),
                "p90": float(df["growth"].quantile(0.90)),
            },
            "ebitda_margin": {
                "p25": float(df["ebitda_margin"].quantile(0.25)),
                "p50": float(df["ebitda_margin"].quantile(0.50)),
                "p75": float(df["ebitda_margin"].quantile(0.75)),
                "p90": float(df["ebitda_margin"].quantile(0.90)),
            },
        }
        
        # Generate scatter plot data
        scatter_data = []
        for _, row in df.iterrows():
            if pd.notna(row["growth"]) and pd.notna(row["ebitda_margin"]):
                scatter_data.append({
                    "x": float(row["growth"]),
                    "y": float(row["ebitda_margin"]),
                    "orgnr": row["orgnr"],
                    "name": row["name"],
                    "revenue": float(row["revenue"]),
                })
        
        # Clustering
        clusters = [
            {"id": "high_growth_high_margin", "name": "High Growth + High Margin", "count": 0},
            {"id": "high_growth_low_margin", "name": "High Growth + Low Margin", "count": 0},
            {"id": "low_growth_high_margin", "name": "Low Growth + High Margin", "count": 0},
            {"id": "low_growth_low_margin", "name": "Low Growth + Low Margin", "count": 0},
        ]
        
        growth_median = df["growth"].median()
        margin_median = df["ebitda_margin"].median()
        
        for _, row in df.iterrows():
            if pd.notna(row["growth"]) and pd.notna(row["ebitda_margin"]):
                if row["growth"] >= growth_median and row["ebitda_margin"] >= margin_median:
                    clusters[0]["count"] += 1
                elif row["growth"] >= growth_median:
                    clusters[1]["count"] += 1
                elif row["ebitda_margin"] >= margin_median:
                    clusters[2]["count"] += 1
                else:
                    clusters[3]["count"] += 1
        
        # Density data
        density_data = []
        growth_bins = np.linspace(df["growth"].min(), df["growth"].max(), 10)
        margin_bins = np.linspace(df["ebitda_margin"].min(), df["ebitda_margin"].max(), 10)
        
        for i in range(len(growth_bins) - 1):
            for j in range(len(margin_bins) - 1):
                count = len(df[
                    (df["growth"] >= growth_bins[i]) & (df["growth"] < growth_bins[i + 1]) &
                    (df["ebitda_margin"] >= margin_bins[j]) & (df["ebitda_margin"] < margin_bins[j + 1])
                ])
                if count > 0:
                    density_data.append({
                        "x": float((growth_bins[i] + growth_bins[i + 1]) / 2),
                        "y": float((margin_bins[j] + margin_bins[j + 1]) / 2),
                        "value": int(count),
                    })
        
        return {
            "statusCode": 200,
            "headers": {**cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({
                "percentiles": percentiles,
                "clusters": clusters,
                "scatter_data": scatter_data[:500],
                "density_data": density_data,
            }),
        }
        
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {**cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({"error": str(e)}),
        }


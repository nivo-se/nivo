"""
Vercel serverless function for Stage 1 shortlists
GET /api/shortlists/stage1
"""
import json
import os
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
    """Handle GET request for Stage 1 shortlists"""
    try:
        # Handle CORS preflight
        if req.get("httpMethod") == "OPTIONS" or req.get("method") == "OPTIONS":
            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": "",
            }
        
        # Parse query parameters
        query = req.get("queryStringParameters") or {}
        limit = int(query.get("limit", 10))
        status = query.get("status")
        
        supabase = get_supabase_client()
        
        query_builder = supabase.table("stage1_shortlists").select("*")
        
        if status:
            query_builder = query_builder.eq("status", status)
        
        response = query_builder.order("generated_at", desc=True).limit(limit).execute()
        
        return {
            "statusCode": 200,
            "headers": {**cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({
                "shortlists": response.data or [],
                "total": len(response.data) if response.data else 0,
            }),
        }
        
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {**cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({"error": str(e)}),
        }


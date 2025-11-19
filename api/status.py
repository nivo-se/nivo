"""
Vercel serverless function for API status
GET /api/status
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
    """Handle GET request for API status"""
    try:
        # Handle CORS preflight
        if req.get("httpMethod") == "OPTIONS" or req.get("method") == "OPTIONS":
            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": "",
            }
        
        services = {
            "api": "healthy",
            "supabase": "unknown",
            "redis": "not_configured",
        }
        
        # Check Supabase
        try:
            supabase = get_supabase_client()
            # Test query
            supabase.table("companies").select("orgnr").limit(1).execute()
            services["supabase"] = "healthy"
        except Exception as e:
            services["supabase"] = f"error: {str(e)}"
        
        # Redis is optional and not available in serverless
        services["redis"] = "not_available_in_serverless"
        
        status = "healthy" if services["supabase"] == "healthy" else "degraded"
        
        return {
            "statusCode": 200,
            "headers": {**cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({
                "status": status,
                "services": services,
            }),
        }
        
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {**cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({"error": str(e)}),
        }


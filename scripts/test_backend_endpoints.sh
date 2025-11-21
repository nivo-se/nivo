#!/bin/bash
# Test backend endpoints to verify they're working

set -e

BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"

echo "🧪 Testing Backend Endpoints"
echo "============================"
echo "Backend URL: $BACKEND_URL"
echo ""

# Check if backend is running
echo "1. Health Check..."
if curl -s -f "$BACKEND_URL/health" > /dev/null; then
    echo "   ✅ Backend is running"
    curl -s "$BACKEND_URL/health" | python3 -m json.tool
else
    echo "   ❌ Backend is not running or not accessible"
    echo "   Start it with: cd backend && ./scripts/start-backend.sh"
    exit 1
fi

echo ""
echo "2. API Status..."
curl -s "$BACKEND_URL/api/status" | python3 -m json.tool || echo "   ⚠️  Status endpoint returned an error (may be expected if Supabase/Redis not configured)"

echo ""
echo "3. New AI Filter Endpoint (POST /api/ai-filter)..."
echo "   Testing with sample prompt..."
RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/ai-filter" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Find companies with revenue over 10 million SEK", "limit": 10, "offset": 0}' \
  2>&1)

if echo "$RESPONSE" | grep -q "org_numbers\|error"; then
    echo "   ✅ Endpoint is accessible"
    echo "$RESPONSE" | python3 -m json.tool | head -20
else
    echo "   ⚠️  Unexpected response:"
    echo "$RESPONSE" | head -5
fi

echo ""
echo "4. Enrichment Endpoint (POST /api/enrichment)..."
RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/enrichment" \
  -H "Content-Type: application/json" \
  -d '{"org_numbers": ["5569771651"]}' \
  2>&1)

if echo "$RESPONSE" | grep -q "job_id\|error"; then
    echo "   ✅ Endpoint is accessible"
    echo "$RESPONSE" | python3 -m json.tool | head -10
else
    echo "   ⚠️  Unexpected response:"
    echo "$RESPONSE" | head -5
fi

echo ""
echo "5. Export Endpoint (POST /api/export)..."
RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/export" \
  -H "Content-Type: application/json" \
  -d '{"org_numbers": ["5569771651"], "format": "copper"}' \
  2>&1)

if echo "$RESPONSE" | grep -q "message\|error"; then
    echo "   ✅ Endpoint is accessible"
    echo "$RESPONSE" | python3 -m json.tool | head -10
else
    echo "   ⚠️  Unexpected response:"
    echo "$RESPONSE" | head -5
fi

echo ""
echo "✅ Endpoint testing complete!"
echo ""
echo "📚 Full API documentation: $BACKEND_URL/docs"


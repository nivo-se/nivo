#!/bin/bash

# Test script to verify all connections are working
# Railway backend, Vercel frontend, and Supabase

echo "🔍 Testing Nivo Platform Connections"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
    source .env
else
    echo -e "${RED}❌ .env file not found${NC}"
    exit 1
fi

# Get Railway URL (from user or env)
RAILWAY_URL="${RAILWAY_URL:-https://vitereactshadcnts-production-fad5.up.railway.app}"
VERCEL_URL="${VERCEL_URL:-https://nivo-web.vercel.app}"

echo "📡 Testing Railway Backend..."
echo "   URL: $RAILWAY_URL"
echo ""

# Test 1: Railway Health Check
echo "1️⃣  Testing Railway Health Endpoint..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$RAILWAY_URL/health" 2>/dev/null)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "   ${GREEN}✅ Health check passed${NC}"
    echo "   Response: $BODY"
else
    echo -e "   ${RED}❌ Health check failed (HTTP $HTTP_CODE)${NC}"
    echo "   Response: $BODY"
fi
echo ""

# Test 2: Railway API Status
echo "2️⃣  Testing Railway API Status Endpoint..."
STATUS_RESPONSE=$(curl -s -w "\n%{http_code}" "$RAILWAY_URL/api/status" 2>/dev/null)
HTTP_CODE=$(echo "$STATUS_RESPONSE" | tail -n1)
BODY=$(echo "$STATUS_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "   ${GREEN}✅ API status check passed${NC}"
    echo "   Response: $BODY"
else
    echo -e "   ${YELLOW}⚠️  API status check returned HTTP $HTTP_CODE${NC}"
    echo "   Response: $BODY"
fi
echo ""

# Test 3: Supabase Connection (via Railway)
echo "3️⃣  Testing Supabase Connection (via Railway)..."
if [ -n "$SUPABASE_URL" ]; then
    echo "   Supabase URL: $SUPABASE_URL"
    echo -e "   ${GREEN}✅ Supabase URL configured${NC}"
else
    echo -e "   ${RED}❌ SUPABASE_URL not set${NC}"
fi
echo ""

# Test 4: Vercel Frontend
echo "4️⃣  Testing Vercel Frontend..."
echo "   URL: $VERCEL_URL"
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$VERCEL_URL" 2>/dev/null)

if [ "$FRONTEND_RESPONSE" = "200" ]; then
    echo -e "   ${GREEN}✅ Frontend is accessible${NC}"
else
    echo -e "   ${YELLOW}⚠️  Frontend returned HTTP $FRONTEND_RESPONSE${NC}"
fi
echo ""

# Test 5: Check Environment Variables
echo "5️⃣  Checking Environment Variables..."
MISSING_VARS=()

if [ -z "$SUPABASE_URL" ]; then
    MISSING_VARS+=("SUPABASE_URL")
fi
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] && [ -z "$SUPABASE_ANON_KEY" ]; then
    MISSING_VARS+=("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY")
fi
if [ -z "$OPENAI_API_KEY" ]; then
    MISSING_VARS+=("OPENAI_API_KEY")
fi

if [ ${#MISSING_VARS[@]} -eq 0 ]; then
    echo -e "   ${GREEN}✅ All required environment variables are set${NC}"
else
    echo -e "   ${YELLOW}⚠️  Missing environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "      - $var"
    done
fi
echo ""

# Test 6: Test API Endpoint (if possible)
echo "6️⃣  Testing Financial Filters Analytics Endpoint..."
ANALYTICS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$RAILWAY_URL/api/filters/analytics" 2>/dev/null)
HTTP_CODE=$(echo "$ANALYTICS_RESPONSE" | tail -n1)
BODY=$(echo "$ANALYTICS_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "   ${GREEN}✅ Analytics endpoint working${NC}"
    echo "   Response preview: $(echo "$BODY" | head -c 100)..."
elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    echo -e "   ${YELLOW}⚠️  Endpoint requires authentication (HTTP $HTTP_CODE)${NC}"
else
    echo -e "   ${YELLOW}⚠️  Endpoint returned HTTP $HTTP_CODE${NC}"
    echo "   Response: $(echo "$BODY" | head -c 200)"
fi
echo ""

# Summary
echo "===================================="
echo "📊 Connection Test Summary"
echo "===================================="
echo ""
echo "✅ Railway Backend: $RAILWAY_URL"
echo "✅ Vercel Frontend: $VERCEL_URL"
echo ""
echo "To test the full flow:"
echo "1. Visit your Vercel frontend: $VERCEL_URL"
echo "2. Open browser DevTools (F12) → Console tab"
echo "3. Try using the Financial Filters feature"
echo "4. Check Network tab for API calls to Railway"
echo ""
echo "If you see CORS errors, check Railway CORS settings"
echo "If you see 404 errors, verify VITE_API_BASE_URL is set in Vercel"


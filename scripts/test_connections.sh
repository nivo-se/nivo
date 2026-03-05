#!/bin/bash

# Test script to verify all connections are working
# Backend on Mac Mini, frontend on Vercel (Railway removed)

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

# Backend URL: Mac Mini API (from env or default local)
BACKEND_URL="${VITE_API_BASE_URL:-${BACKEND_URL:-http://localhost:8000}}"
VERCEL_URL="${VERCEL_URL:-https://nivo-web.vercel.app}"

echo "📡 Testing Backend (Mac Mini)..."
echo "   URL: $BACKEND_URL"
echo ""

# Test 1: Backend Health Check
echo "1️⃣  Testing Backend Health Endpoint..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/health" 2>/dev/null)
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

# Test 2: Backend API Status
echo "2️⃣  Testing Backend API Status Endpoint..."
STATUS_RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/status" 2>/dev/null)
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

# Test 3: Database (Postgres on Mac Mini)
echo "3️⃣  Checking backend database config..."
if [ "$DATABASE_SOURCE" = "postgres" ] && [ -n "$POSTGRES_HOST" ]; then
    echo -e "   ${GREEN}✅ DATABASE_SOURCE=postgres, POSTGRES_HOST set${NC}"
else
    echo -e "   ${YELLOW}⚠️  DATABASE_SOURCE or POSTGRES_* not set (expected for Mac Mini)${NC}"
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
[ -z "$OPENAI_API_KEY" ] && MISSING_VARS+=("OPENAI_API_KEY")

if [ ${#MISSING_VARS[@]} -eq 0 ]; then
    echo -e "   ${GREEN}✅ Required environment variables are set${NC}"
else
    echo -e "   ${YELLOW}⚠️  Missing: ${MISSING_VARS[*]}${NC}"
fi
echo ""

# Test 6: Analytics endpoint
echo "6️⃣  Testing Financial Filters Analytics Endpoint..."
ANALYTICS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BACKEND_URL/api/filters/analytics" 2>/dev/null)
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
echo "✅ Backend (Mac Mini): $BACKEND_URL"
echo "✅ Vercel Frontend: $VERCEL_URL"
echo ""
echo "To test the full flow:"
echo "1. Visit your Vercel frontend: $VERCEL_URL"
echo "2. Open browser DevTools (F12) → Console tab"
echo "3. Try using the Financial Filters feature"
echo "4. Check Network tab for API calls to backend"
echo ""
echo "If you see CORS errors, check CORS_ORIGINS / CORS_ALLOW_VERCEL_PREVIEWS on the Mac Mini."
echo "If you see 404 errors, verify VITE_API_BASE_URL is set in Vercel to your Mac Mini API URL."

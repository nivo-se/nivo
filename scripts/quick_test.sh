#!/bin/bash
# Quick test script for local features
# Run this after starting backend, Redis, and RQ worker

set -e

BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"

echo "🧪 Quick Local Testing"
echo "======================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Backend health
echo "1. Testing backend health..."
if curl -s -f "$BACKEND_URL/health" > /dev/null; then
    echo -e "${GREEN}   ✅ Backend is running${NC}"
else
    echo -e "${RED}   ❌ Backend is not running${NC}"
    echo "   Start with: cd backend && source venv/bin/activate && uvicorn api.main:app --reload"
    exit 1
fi

# Test 2: Database connection
echo ""
echo "2. Testing database connection..."
if sqlite3 data/nivo_optimized.db "SELECT COUNT(*) FROM companies;" > /dev/null 2>&1; then
    COUNT=$(sqlite3 data/nivo_optimized.db "SELECT COUNT(*) FROM companies;")
    echo -e "${GREEN}   ✅ Database connected (${COUNT} companies)${NC}"
else
    echo -e "${RED}   ❌ Database not found or inaccessible${NC}"
    exit 1
fi

# Test 3: AI Filter endpoint
echo ""
echo "3. Testing AI filter endpoint..."
RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/ai-filter" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Find companies with revenue over 10 million SEK", "limit": 5, "offset": 0}' \
  2>&1)

if echo "$RESPONSE" | grep -q "org_numbers"; then
    TOTAL=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('total', 0))" 2>/dev/null || echo "?")
    echo -e "${GREEN}   ✅ AI filter works (found ${TOTAL} companies)${NC}"
else
    echo -e "${YELLOW}   ⚠️  AI filter returned unexpected response${NC}"
    echo "$RESPONSE" | head -3
fi

# Test 4: Company batch endpoint
echo ""
echo "4. Testing company batch endpoint..."
# Get first company from database
FIRST_ORGNR=$(sqlite3 data/nivo_optimized.db "SELECT orgnr FROM companies LIMIT 1;")
if [ -n "$FIRST_ORGNR" ]; then
    RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/companies/batch" \
      -H "Content-Type: application/json" \
      -d "{\"orgnrs\": [\"$FIRST_ORGNR\"]}" \
      2>&1)
    
    if echo "$RESPONSE" | grep -q "company_name"; then
        echo -e "${GREEN}   ✅ Company batch endpoint works${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Company batch returned unexpected response${NC}"
    fi
else
    echo -e "${RED}   ❌ No companies in database${NC}"
fi

# Test 5: Company financials endpoint
echo ""
echo "5. Testing company financials endpoint..."
if [ -n "$FIRST_ORGNR" ]; then
    RESPONSE=$(curl -s "$BACKEND_URL/api/companies/$FIRST_ORGNR/financials" 2>&1)
    if echo "$RESPONSE" | grep -q "year"; then
        echo -e "${GREEN}   ✅ Company financials endpoint works${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Company financials returned unexpected response${NC}"
    fi
fi

# Test 6: Redis connection
echo ""
echo "6. Testing Redis connection..."
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Redis is running${NC}"
else
    echo -e "${YELLOW}   ⚠️  Redis not running (required for enrichment jobs)${NC}"
    echo "   Start with: redis-server"
fi

# Test 7: Environment variables
echo ""
echo "7. Checking environment variables..."
if [ -n "${OPENAI_API_KEY:-}" ]; then
    echo -e "${GREEN}   ✅ OPENAI_API_KEY is set${NC}"
else
    echo -e "${YELLOW}   ⚠️  OPENAI_API_KEY not set${NC}"
fi

if [ -n "${SUPABASE_URL:-}" ]; then
    echo -e "${GREEN}   ✅ SUPABASE_URL is set${NC}"
else
    echo -e "${YELLOW}   ⚠️  SUPABASE_URL not set (required for ai_profiles)${NC}"
fi

if [ -n "${REDIS_URL:-}" ]; then
    echo -e "${GREEN}   ✅ REDIS_URL is set${NC}"
else
    echo -e "${YELLOW}   ⚠️  REDIS_URL not set (required for background jobs)${NC}"
fi

echo ""
echo "======================"
echo -e "${GREEN}✅ Quick tests complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Start frontend: cd frontend && npm run dev"
echo "  2. Test enrichment: See QUICK_START_TESTING.md"
echo "  3. Test frontend dashboard: http://localhost:5173/dashboard"
echo ""


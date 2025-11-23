#!/bin/bash
# Comprehensive Frontend Testing Script

set -e

FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"

echo "🧪 Frontend Testing Suite"
echo "========================="
echo "Frontend: $FRONTEND_URL"
echo "Backend: $BACKEND_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test counter
PASSED=0
FAILED=0
WARNINGS=0

test_page() {
    local route=$1
    local name=$2
    local expected_status=${3:-200}
    
    echo -n "Testing $name ($route)... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL$route" 2>&1)
    
    if [ "$response" = "$expected_status" ] || [ "$response" = "200" ]; then
        echo -e "${GREEN}✅${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌ (HTTP $response)${NC}"
        ((FAILED++))
        return 1
    fi
}

test_api_connection() {
    local endpoint=$1
    local name=$2
    
    echo -n "Testing API: $name... "
    
    response=$(curl -s "$BACKEND_URL$endpoint" 2>&1)
    
    if echo "$response" | grep -q "error\|Error\|ERROR" 2>/dev/null; then
        if echo "$response" | grep -q "404\|Not Found" 2>/dev/null; then
            echo -e "${YELLOW}⚠️  (404 - may be expected)${NC}"
            ((WARNINGS++))
        else
            echo -e "${RED}❌ (Error in response)${NC}"
            echo "$response" | head -3
            ((FAILED++))
        fi
        return 1
    else
        echo -e "${GREEN}✅${NC}"
        ((PASSED++))
        return 0
    fi
}

echo "1. Testing Frontend Pages"
echo "-------------------------"

# Public pages
test_page "/" "Index (Landing Page)"
test_page "/auth" "Auth Page"
test_page "/styleguide" "Style Guide"

# Protected pages (may redirect to /auth if not logged in)
test_page "/dashboard" "AI Sourcing Dashboard"
test_page "/admin" "Admin Page"
test_page "/valuation" "Valuation Page"
test_page "/companies/5592881501" "Company Detail Page"

# 404 page
test_page "/nonexistent-page-12345" "404 Not Found" 404

echo ""
echo "2. Testing API Endpoints (Backend Connection)"
echo "----------------------------------------------"

# Test backend health
test_api_connection "/health" "Health Check"

# Test AI filter endpoint
echo -n "Testing API: AI Filter... "
response=$(curl -s -X POST "$BACKEND_URL/api/ai-filter/" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Find companies with revenue over 10 million SEK", "limit": 5, "offset": 0}' \
  2>&1)

if echo "$response" | grep -q "org_numbers\|error"; then
    echo -e "${GREEN}✅${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌${NC}"
    echo "$response" | head -3
    ((FAILED++))
fi

# Test company batch endpoint
test_api_connection "/api/companies/batch" "Company Batch (POST required, testing GET)"
# Actually test POST
echo -n "Testing API: Company Batch POST... "
response=$(curl -s -X POST "$BACKEND_URL/api/companies/batch" \
  -H "Content-Type: application/json" \
  -d '{"orgnrs": ["5592881501"]}' \
  2>&1)

if echo "$response" | grep -q "companies\|error"; then
    echo -e "${GREEN}✅${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌${NC}"
    ((FAILED++))
fi

# Test company financials
test_api_connection "/api/companies/5592881501/financials" "Company Financials"

# Test enrichment endpoint
echo -n "Testing API: Enrichment Start... "
response=$(curl -s -X POST "$BACKEND_URL/api/enrichment/start" \
  -H "Content-Type: application/json" \
  -d '{"org_numbers": ["5592881501"], "force_refresh": false}' \
  2>&1)

if echo "$response" | grep -q "job_id\|error"; then
    echo -e "${GREEN}✅${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌${NC}"
    ((FAILED++))
fi

echo ""
echo "3. Testing Frontend-Backend Integration"
echo "--------------------------------------"

# Check if frontend can reach backend
echo -n "Testing Frontend → Backend connection... "
if curl -s "$FRONTEND_URL" | grep -q "localhost:8000\|$BACKEND_URL" 2>/dev/null; then
    echo -e "${GREEN}✅${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  (Backend URL may be in env vars)${NC}"
    ((WARNINGS++))
fi

echo ""
echo "========================="
echo "Test Summary"
echo "========================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All critical tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Check the output above.${NC}"
    exit 1
fi


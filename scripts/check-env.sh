#!/usr/bin/env bash
set -euo pipefail

echo "🔍 Checking Environment Variables"
echo "=================================="
echo ""

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env file not found at: $ENV_FILE"
    echo ""
    echo "Create a .env file in the project root with:"
    echo "  DATABASE_SOURCE=postgres"
    echo "  POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD (or DATABASE_URL)"
    echo "  OPENAI_API_KEY=..."
    echo "  REDIS_URL=redis://localhost:6379/0"
    echo "  VITE_API_BASE_URL=http://localhost:8000"
    exit 1
fi

# Source the .env file
set -a
source "$ENV_FILE"
set +a

MISSING=0

check_var() {
    local var_name=$1
    local required=${2:-false}
    
    if [ -z "${!var_name:-}" ]; then
        if [ "$required" = "true" ]; then
            echo "❌ $var_name - MISSING (REQUIRED)"
            MISSING=$((MISSING + 1))
        else
            echo "⚠️  $var_name - MISSING (optional)"
        fi
    else
        # Mask sensitive values
        local value="${!var_name}"
        if [[ "$var_name" == *"KEY"* ]] || [[ "$var_name" == *"PASSWORD"* ]] || [[ "$var_name" == *"SECRET"* ]]; then
            echo "✅ $var_name - Set (${#value} chars)"
        else
            echo "✅ $var_name - Set"
        fi
    fi
}

echo "Required Variables:"
echo "-------------------"
check_var "DATABASE_SOURCE" true
check_var "OPENAI_API_KEY" true

echo ""
echo "Optional Variables (Postgres when DATABASE_SOURCE=postgres):"
echo "-------------------"
check_var "DATABASE_URL" false
check_var "POSTGRES_HOST" false
check_var "POSTGRES_PORT" false
check_var "POSTGRES_DB" false
check_var "REDIS_URL" false
check_var "VITE_API_BASE_URL" false

echo ""
if [ $MISSING -eq 0 ]; then
    echo "✅ All required environment variables are set!"
    exit 0
else
    echo "❌ Missing $MISSING required variable(s)"
    echo ""
    echo "Add the missing variables to your .env file:"
    echo "  OPENAI_API_KEY=sk-..."
    echo "  REDIS_URL=redis://localhost:6379/0  (optional, has default)"
    echo "  VITE_API_BASE_URL=http://localhost:8000  (optional, has default)"
    exit 1
fi


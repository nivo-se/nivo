#!/usr/bin/env bash
set -euo pipefail

echo "📝 Adding Missing Environment Variables"
echo "======================================="
echo ""

ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env file not found. Creating it..."
    touch "$ENV_FILE"
fi

# Function to add variable if missing
add_if_missing() {
    local var_name=$1
    local default_value=$2
    local comment=$3
    
    if ! grep -q "^${var_name}=" "$ENV_FILE"; then
        echo "" >> "$ENV_FILE"
        echo "# $comment" >> "$ENV_FILE"
        echo "${var_name}=${default_value}" >> "$ENV_FILE"
        echo "✅ Added $var_name"
        return 0
    else
        echo "✓ $var_name already exists"
        return 1
    fi
}

echo "Checking and adding missing variables..."
echo ""

# Add missing variables
add_if_missing "OPENAI_API_KEY" "your_openai_api_key_here" "OpenAI API key for AI report generation (REQUIRED)"
add_if_missing "REDIS_URL" "redis://localhost:6379/0" "Redis connection URL for job queues (optional, has default)"
add_if_missing "VITE_API_BASE_URL" "http://localhost:8000" "Frontend API base URL (optional, has default)"

echo ""
echo "✅ Done!"
echo ""
echo "⚠️  IMPORTANT: Edit .env and add your actual OPENAI_API_KEY:"
echo "   OPENAI_API_KEY=sk-..."
echo ""
echo "You can get your OpenAI API key from: https://platform.openai.com/api-keys"


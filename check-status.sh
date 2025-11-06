#!/bin/bash

# Job ID for the current scraping job
JOB_ID="de2cea99-ce04-4fce-bc15-695c672e4c22"

# Check status
echo "Checking scraping job status..."
echo ""

curl -s "http://localhost:3000/api/segment/status?jobId=${JOB_ID}" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    status = d.get('status', 'unknown').upper()
    stage = d.get('stage', 'unknown')
    processed = d.get('processedCount', 0)
    total = d.get('totalCompanies', 0)
    company_ids = d.get('stats', {}).get('companyIds', 0)
    financials = d.get('stats', {}).get('financials', 0)
    
    progress = (processed / total * 100) if total > 0 else 0
    
    print(f\"📊 Scraping Job Status:\")
    print(f\"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\")
    print(f\"Status: {status}\")
    print(f\"Stage: {stage}\")
    print(f\"\")
    print(f\"Progress: {processed:,}/{total:,} companies ({progress:.2f}%)\")
    print(f\"Company IDs Resolved: {company_ids:,}\")
    print(f\"Financials Fetched: {financials:,}\")
    print(f\"\")
    print(f\"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\")
    
    if d.get('lastError'):
        print(f\"⚠️  Last Error: {d['lastError'][:100]}...\")
except Exception as e:
    print(f\"Error: {e}\")
    sys.exit(1)
"


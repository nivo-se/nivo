#!/bin/bash

# Job ID for the current scraping job
JOB_ID="de2cea99-ce04-4fce-bc15-695c672e4c22"
DB_PATH="scraper/allabolag-scraper/staging/staging_${JOB_ID}.db"

echo "🔍 Verifying Stage 1 & Stage 2 Data Completeness"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "❌ Database not found at: $DB_PATH"
    exit 1
fi

echo "📊 Database: $DB_PATH"
echo ""

# Use sqlite3 to query the database
# Stage 1 Verification: Check companies
echo "📋 STAGE 1 VERIFICATION (Segmentation)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

STAGE1_TOTAL=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM staging_companies WHERE job_id = '$JOB_ID';")
STAGE1_WITH_DATA=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM staging_companies WHERE job_id = '$JOB_ID' AND company_name IS NOT NULL AND company_name != '';")
STAGE1_WITH_ORGNR=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM staging_companies WHERE job_id = '$JOB_ID' AND orgnr IS NOT NULL AND orgnr != '';")

echo "Total Companies: $STAGE1_TOTAL"
echo "Companies with Name: $STAGE1_WITH_DATA"
echo "Companies with Orgnr: $STAGE1_WITH_ORGNR"
echo ""

if [ "$STAGE1_TOTAL" -eq 10000 ] && [ "$STAGE1_WITH_DATA" -eq 10000 ] && [ "$STAGE1_WITH_ORGNR" -eq 10000 ]; then
    echo "✅ Stage 1: PASSED - All 10,000 companies present with complete data"
else
    echo "⚠️  Stage 1: WARNING - Expected 10,000 companies"
    echo "   Missing data detected:"
    echo "   - Total: $STAGE1_TOTAL (expected 10,000)"
    echo "   - With names: $STAGE1_WITH_DATA (expected 10,000)"
    echo "   - With orgnr: $STAGE1_WITH_ORGNR (expected 10,000)"
fi

echo ""
echo "📋 STAGE 2 VERIFICATION (Company ID Resolution)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check company statuses
STAGE2_PENDING=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM staging_companies WHERE job_id = '$JOB_ID' AND status = 'pending';")
STAGE2_RESOLVED=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM staging_companies WHERE job_id = '$JOB_ID' AND status = 'id_resolved';")
STAGE2_NOT_FOUND=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM staging_companies WHERE job_id = '$JOB_ID' AND status = 'id_not_found';")
STAGE2_ERROR=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM staging_companies WHERE job_id = '$JOB_ID' AND status = 'error';")

# Check resolved company IDs
RESOLVED_IDS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM staging_company_ids WHERE job_id = '$JOB_ID';")
RESOLVED_IDS_WITH_ID=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM staging_company_ids WHERE job_id = '$JOB_ID' AND company_id IS NOT NULL AND company_id != '';")

echo "Company Status Breakdown:"
echo "  - Pending: $STAGE2_PENDING"
echo "  - ID Resolved: $STAGE2_RESOLVED"
echo "  - ID Not Found: $STAGE2_NOT_FOUND"
echo "  - Error: $STAGE2_ERROR"
echo ""
echo "Resolved Company IDs:"
echo "  - Total IDs: $RESOLVED_IDS"
echo "  - IDs with valid company_id: $RESOLVED_IDS_WITH_ID"
echo ""

# Calculate processed count
STAGE2_PROCESSED=$((STAGE2_RESOLVED + STAGE2_NOT_FOUND + STAGE2_ERROR))
STAGE2_PROCESSED_PERCENT=$((STAGE2_PROCESSED * 100 / STAGE1_TOTAL))

echo "Stage 2 Processing Status:"
echo "  - Processed: $STAGE2_PROCESSED/$STAGE1_TOTAL ($STAGE2_PROCESSED_PERCENT%)"
echo "  - Remaining: $STAGE2_PENDING"
echo ""

# Verification results
if [ "$STAGE2_PENDING" -eq 0 ] && [ "$STAGE2_PROCESSED" -eq "$STAGE1_TOTAL" ]; then
    echo "✅ Stage 2: PASSED - All companies processed"
    STAGE2_PASS=true
else
    echo "⚠️  Stage 2: WARNING - Not all companies processed"
    echo "   - $STAGE2_PENDING companies still pending"
    echo "   - $STAGE2_PROCESSED/$STAGE1_TOTAL processed"
    STAGE2_PASS=false
fi

if [ "$RESOLVED_IDS" -gt 0 ] && [ "$RESOLVED_IDS_WITH_ID" -eq "$RESOLVED_IDS" ]; then
    echo "✅ Stage 2: PASSED - All resolved IDs have valid company_id values"
    IDS_PASS=true
else
    echo "⚠️  Stage 2: WARNING - Some resolved IDs missing company_id"
    IDS_PASS=false
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$STAGE1_TOTAL" -eq 10000 ] && [ "$STAGE1_WITH_DATA" -eq 10000 ] && [ "$STAGE1_WITH_ORGNR" -eq 10000 ] && [ "$STAGE2_PASS" = true ] && [ "$IDS_PASS" = true ]; then
    echo "✅ ALL VERIFICATIONS PASSED"
    echo ""
    echo "Stage 1: ✅ Complete - 10,000 companies with all required data"
    echo "Stage 2: ✅ Complete - All companies processed, $RESOLVED_IDS company IDs resolved"
    echo ""
    echo "🎉 Ready for Stage 3 (Financial Data Fetching)"
    exit 0
else
    echo "⚠️  VERIFICATION ISSUES DETECTED"
    echo ""
    [ "$STAGE1_TOTAL" -ne 10000 ] && echo "❌ Stage 1: Missing companies"
    [ "$STAGE2_PASS" = false ] && echo "❌ Stage 2: Some companies not processed"
    [ "$IDS_PASS" = false ] && echo "❌ Stage 2: Some resolved IDs missing company_id"
    echo ""
    exit 1
fi


# Two-Stage AI Analysis - Testing & Usage Guide

## Overview

The two-stage AI analysis system is now fully implemented and ready for testing. This guide will help you test and use the new features.

## System Architecture

### Backend Components

1. **`backend/agentic_pipeline/screening_prompt.py`** (NEW)
   - Optimized prompts for rapid screening analysis
   - Swedish language support
   - Batch processing capabilities

2. **`backend/agentic_pipeline/ai_analysis.py`** (UPDATED)
   - `run_screening()` method for batch screening
   - `run()` method for deep analysis with web enrichment
   - Cost estimation and model selection
   - Batch size: 5 companies per API call

3. **`backend/agentic_pipeline/web_enrichment.py`** (NEW)
   - Async web scraping for company websites
   - News article gathering
   - Industry context collection
   - Only runs for deep analysis mode

### API Layer

**`api/ai-analysis.ts`** (UPDATED)
- Handles both `screening` and `deep` analysis types
- Batch processing for screening (5 companies per batch)
- Individual processing for deep analysis
- Model selection:
  - Screening: `gpt-3.5-turbo`
  - Deep: `gpt-4-1106-preview`

### Frontend

**`frontend/src/components/AIAnalysis.tsx`** (UPDATED)
- Complete two-stage workflow UI
- List-based company selection
- Mode toggle (Screening / Deep Analysis)
- Screening results display with selection
- Cost estimation
- Swedish localization

### Database Schema

**`database/ai_ops_schema.sql`** (UPDATED)
- `ai_analysis_runs.analysis_mode` column
- `ai_screening_results` table for screening data
- Row Level Security (RLS) policies applied

## Testing Workflow

### Prerequisites

1. **Create a Saved Company List**
   - Go to "Översikt" page
   - Apply filters to find companies
   - Click "Spara lista"
   - Name your list (e.g., "Test Screening - 40 companies")
   - Ensure you have 30-40 companies for screening test

2. **Verify Database Setup**
   ```sql
   -- Check that screening table exists
   SELECT COUNT(*) FROM ai_ops.ai_screening_results;
   
   -- Check that analysis_mode column exists
   SELECT analysis_mode FROM ai_ops.ai_analysis_runs LIMIT 1;
   ```

### Test 1: Screening Analysis (Quick Assessment)

**Goal:** Test rapid screening of 30-40 companies

1. Navigate to "AI-Insikter" page
2. Select your saved list from dropdown
3. Choose "Screening (Snabb analys)" mode
4. Select 30-40 companies from the list
5. (Optional) Add custom instructions
6. Check estimated cost (should be ~$0.06-0.08 for 30-40 companies)
7. Click "Kör screening"

**Expected Results:**
- Processing time: 3-5 minutes for 40 companies
- Cost: ~$0.002 per company
- Results displayed with:
  - Screening Score (1-100)
  - Risk Flag (Low/Medium/High)
  - Brief Summary (2-3 sentences)
- Results sorted by score (highest first)

**What to Verify:**
- [ ] All selected companies appear in results
- [ ] Scores are reasonable (distributed across range)
- [ ] Risk flags make sense based on summary
- [ ] Summaries are in Swedish and concise
- [ ] No errors in console or UI

### Test 2: Deep Analysis Selection

**Goal:** Select top candidates from screening for detailed analysis

1. After screening completes, review results
2. Select 5-7 companies with highest scores
3. Click "Fortsätt till djupanalys" button
4. Mode automatically switches to "Djupanalys"
5. Selected companies appear in deep analysis section

**Expected Results:**
- Selected companies from screening carry over
- Mode switches automatically
- UI updates to show deep analysis configuration

**What to Verify:**
- [ ] Selected companies are correctly transferred
- [ ] Mode toggle shows "Djupanalys"
- [ ] Company count is correct

### Test 3: Deep Analysis Execution

**Goal:** Run comprehensive analysis on selected companies

1. With 5-7 companies selected for deep analysis
2. (Optional) Select an analysis template or add custom instructions
3. Check estimated cost (should be ~$2.50-3.50 for 5-7 companies)
4. Click "Kör djupanalys"

**Expected Results:**
- Processing time: 10-15 minutes for 5-7 companies
- Cost: ~$0.50 per company
- Web enrichment runs for each company (if homepage available)
- Detailed results with:
  - Executive Summary
  - Recommendation (Pursue/Watchlist/Pass)
  - Confidence Rating (1-5)
  - Risk Score (1-5)
  - Financial Grade (A-D)
  - Commercial Grade (A-D)
  - Operational Grade (A-D)
  - Next Steps (actionable items)
  - Narrative Sections (SWOT, Financial Outlook, etc.)
  - Supporting Metrics

**What to Verify:**
- [ ] All selected companies are analyzed
- [ ] Grades are reasonable and justified
- [ ] Recommendations align with financial data
- [ ] Next steps are specific and actionable
- [ ] Narrative sections are comprehensive
- [ ] No timeout errors
- [ ] Results saved to database

### Test 4: Results Persistence & History

**Goal:** Verify data is saved and retrievable

1. After completing analyses, check "Analyshistorik" section
2. Recent runs should appear in the table
3. Click "Open" on a previous run
4. Results should load from database

**What to Verify:**
- [ ] History shows both screening and deep analysis runs
- [ ] Run IDs are unique
- [ ] Timestamps are correct
- [ ] Can reload previous analyses
- [ ] No data loss

### Test 5: Cost Verification

**Goal:** Confirm cost estimates match actual usage

1. Check estimated costs before running analyses
2. After completion, verify actual costs in:
   - OpenAI usage dashboard
   - `ai_ops.ai_analysis_audit` table

**SQL Query:**
```sql
SELECT 
    run_id,
    COUNT(*) as api_calls,
    SUM(prompt_tokens) as total_prompt_tokens,
    SUM(completion_tokens) as total_completion_tokens,
    SUM(cost_usd) as total_cost_usd
FROM ai_ops.ai_analysis_audit
WHERE run_id = 'YOUR_RUN_ID'
GROUP BY run_id;
```

**Expected Costs:**
- Screening: $0.001-0.003 per company
- Deep Analysis: $0.40-0.60 per company

**What to Verify:**
- [ ] Estimated cost matches actual cost (±20%)
- [ ] Screening uses gpt-3.5-turbo
- [ ] Deep analysis uses gpt-4
- [ ] Batch processing reduces overhead

## Performance Benchmarks

### Screening Mode
- **Companies:** 40
- **Time:** 3-5 minutes
- **Cost:** ~$0.08 total
- **Model:** gpt-3.5-turbo
- **Batch Size:** 5 companies per API call
- **API Calls:** 8 (40 companies / 5 per batch)

### Deep Analysis Mode
- **Companies:** 5
- **Time:** 10-15 minutes
- **Cost:** ~$2.50 total
- **Model:** gpt-4-1106-preview
- **Web Enrichment:** Yes (async)
- **API Calls:** 5 (1 per company)

## Troubleshooting

### Issue: "No companies provided" error
**Solution:** Ensure you've selected companies before clicking analyze

### Issue: Screening results empty
**Solution:** 
- Check console for API errors
- Verify companies have financial data
- Check OpenAI API key is valid

### Issue: Deep analysis timeout
**Solution:**
- Reduce number of companies (max 7)
- Check web enrichment isn't hanging
- Verify company homepages are accessible

### Issue: Cost higher than expected
**Solution:**
- Check if using correct model (gpt-3.5 for screening)
- Verify batch processing is working
- Review token usage in audit table

### Issue: Web enrichment failing
**Solution:**
- Check company homepage URLs are valid
- Verify network connectivity
- Review `web_enrichment.py` logs

## Database Queries for Monitoring

### Check Recent Runs
```sql
SELECT 
    id,
    analysis_mode,
    status,
    model_version,
    started_at,
    completed_at,
    error_message
FROM ai_ops.ai_analysis_runs
ORDER BY started_at DESC
LIMIT 10;
```

### View Screening Results
```sql
SELECT 
    sr.company_name,
    sr.screening_score,
    sr.risk_flag,
    sr.brief_summary,
    sr.created_at
FROM ai_ops.ai_screening_results sr
JOIN ai_ops.ai_analysis_runs r ON r.id = sr.run_id
WHERE r.id = 'YOUR_RUN_ID'
ORDER BY sr.screening_score DESC;
```

### View Deep Analysis Results
```sql
SELECT 
    ca.company_name,
    ca.recommendation,
    ca.confidence,
    ca.risk_score,
    ca.financial_grade,
    ca.commercial_grade,
    ca.operational_grade
FROM ai_ops.ai_company_analysis ca
JOIN ai_ops.ai_analysis_runs r ON r.id = ca.run_id
WHERE r.id = 'YOUR_RUN_ID';
```

### Cost Analysis
```sql
SELECT 
    r.analysis_mode,
    COUNT(DISTINCT ca.orgnr) as companies_analyzed,
    SUM(a.cost_usd) as total_cost,
    AVG(a.cost_usd) as avg_cost_per_call,
    SUM(a.prompt_tokens) as total_prompt_tokens,
    SUM(a.completion_tokens) as total_completion_tokens
FROM ai_ops.ai_analysis_runs r
LEFT JOIN ai_ops.ai_company_analysis ca ON ca.run_id = r.id
LEFT JOIN ai_ops.ai_analysis_audit a ON a.run_id = r.id
WHERE r.started_at > NOW() - INTERVAL '7 days'
GROUP BY r.analysis_mode;
```

## Success Criteria

✅ **Screening Analysis**
- Process 40 companies in under 5 minutes
- Cost under $0.10 total
- All companies receive scores and summaries
- Results sortable and selectable

✅ **Deep Analysis**
- Process 5 companies in under 15 minutes
- Cost under $3.00 total
- Comprehensive analysis with all sections
- Web enrichment data included

✅ **Workflow**
- Smooth transition from screening to deep analysis
- Selected companies carry over correctly
- Cost estimates accurate within 20%
- No data loss or errors

✅ **User Experience**
- All text in Swedish
- Clear step-by-step guidance
- Real-time progress indicators
- Results easily accessible and reviewable

## Next Steps After Testing

1. **Optimize Prompts**
   - Review screening summaries for quality
   - Adjust system prompts if needed
   - Fine-tune scoring criteria

2. **Enhance Web Enrichment**
   - Add more data sources
   - Improve scraping reliability
   - Add industry-specific enrichment

3. **Add Export Features**
   - Export screening results to Excel
   - Generate PDF reports for deep analysis
   - Bulk export for multiple runs

4. **Implement Multi-LLM Support**
   - Add DeepSeek for cost optimization
   - Add Anthropic Claude for comparison
   - Allow provider selection in UI

5. **Performance Optimization**
   - Increase batch size if stable
   - Implement caching for repeated analyses
   - Add progress streaming

## Support & Documentation

- **Backend Code:** `/backend/agentic_pipeline/`
- **API Endpoint:** `/api/ai-analysis.ts`
- **Frontend Component:** `/frontend/src/components/AIAnalysis.tsx`
- **Database Schema:** `/database/ai_ops_schema.sql`
- **Implementation Plan:** `/two-stage-ai-analysis.plan.md`

For issues or questions, check:
1. Browser console for frontend errors
2. Server logs for API errors
3. Database audit table for LLM errors
4. This guide's troubleshooting section

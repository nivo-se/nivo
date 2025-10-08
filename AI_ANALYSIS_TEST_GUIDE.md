# AI Analysis Feature Test Guide

## ✅ Setup Complete

You're now on the `test-ai-analysis` branch locally, which tracks the remote `codex/create-solution-for-company-segmentation-analysis` branch.

### Current Status
- ✅ Local test branch created: `test-ai-analysis`
- ✅ Backend dependencies installed (numpy, scikit-learn, openpyxl)
- ✅ Frontend dependencies verified
- ✅ Supabase connection configured
- ✅ Frontend dev server running on port 8080

## 🚀 Testing the AI Analysis Features

### 1. Frontend AI Analysis Interface

**Access the frontend:**
- URL: http://localhost:8080
- Login with your credentials (jesper@rgcapital.se)

**Navigate to AI Analysis:**
1. Once logged in, look for the **"AI-insikter"** (AI Insights) menu item in the sidebar
2. This is the main interface for the new AI analysis feature

**Test Cases:**

#### Test 1: Template-Based Analysis
1. Click on one of the pre-configured templates:
   - "High growth tech companies"
   - "Regional champions"
   - "Turnaround candidates"
   - "Steady compounders"
2. Click the "Analyze" button
3. Verify that results appear with:
   - Summary statistics (companies found, avg revenue, avg growth)
   - AI-generated insights
   - Top industries
   - Recommendations
   - Sample company results

#### Test 2: Natural Language Query
1. Try entering custom queries like:
   - "Find profitable companies in Stockholm with over 50 employees"
   - "Show me fast-growing companies with high margins"
   - "Companies in Gothenburg with strong digital presence"
2. Press Enter or click "Analyze"
3. Review the AI-generated insights and recommendations

#### Test 3: Data Integration
1. Verify that the results show real company data from Supabase:
   - Company names should be actual Swedish companies
   - Financial metrics (revenue, growth, margins) should display
   - Industry classifications should be visible
   - City/location information should be accurate

### 2. Backend Agentic Pipeline (Optional Advanced Testing)

The branch also includes a sophisticated backend pipeline for company segmentation and analysis.

**To test the backend pipeline:**

```bash
# From the repository root
cd backend
source ../venv/bin/activate

# Run the agentic targeting pipeline
python run_agentic_targeting_pipeline.py --db-path ../allabolag.db --top 30

# Check outputs in the outputs/agentic_targeting/ directory
```

**Expected outputs:**
- Console output showing pipeline progress and summary
- CSV file with segmented companies
- Excel file with detailed analysis
- Database tables updated with new segmentation data

### 3. What's New in This Branch

**Frontend Changes:**
- New `AIAnalysisService` for natural language company queries
- `AIAnalysis` component with template-based analysis
- Supabase data service with fallback to local data
- Integration with existing WorkingDashboard

**Backend Changes:**
- Complete agentic pipeline system in `backend/agentic_pipeline/`:
  - `orchestrator.py` - Main pipeline coordinator
  - `segmentation.py` - Company clustering and grouping
  - `features.py` - Feature engineering for analysis
  - `analysis.py` - Market and financial analysis
  - `ranking.py` - Company scoring and ranking
  - `quality.py` - Data quality checks
- New dependencies: numpy, scikit-learn, openpyxl

### 4. Database Connection Verification

Your environment is already configured with:
- Supabase URL: `https://clysgodrmowieximfaab.supabase.co`
- Supabase connection: ✅ Configured in `.env.local`
- Database: `master_analytics` table with 8,438+ companies

**To verify database connectivity:**
1. Open browser console (F12) when testing the frontend
2. Look for console logs showing "Loaded analytics" with data
3. If Supabase is working, you'll see real company data
4. If there's a fallback to local data, you'll see a warning message

## 🔍 Key Features to Test

### AI Analysis Service Features
- ✅ Natural language query parsing
- ✅ Filter derivation from queries (e.g., "Stockholm" → city filter)
- ✅ Template-based quick analysis
- ✅ Statistical aggregations (avg revenue, growth, margins)
- ✅ Industry and city clustering
- ✅ AI-generated insights and recommendations
- ✅ Graceful fallback when Supabase is unavailable

### Expected Behaviors
- **Fast response times**: Queries should return results in 1-3 seconds
- **Accurate filtering**: Location and financial filters should work
- **Meaningful insights**: AI should provide relevant business insights
- **Sample data fallback**: If Supabase is down, you'll see demo data

## 📊 Test Scenarios

### Scenario 1: Investment Pipeline
Query: "High growth tech companies with strong profitability"
- Expected: Tech segment companies with >15% revenue growth and positive margins
- Check: Do the results make sense for a PE investment pipeline?

### Scenario 2: Regional Focus
Query: "Companies in Stockholm"
- Expected: Only Stockholm-based companies
- Check: Verify city field in results

### Scenario 3: Size Filtering
Query: "Companies with revenue over 10M"
- Expected: Only larger companies
- Check: Revenue figures in results

### Scenario 4: Industry Analysis
Query: "E-commerce companies"
- Expected: Companies in e-commerce/digital retail segments
- Check: Industry classifications

## 🔄 Switching Back to Main

When you're done testing and want to return to the main branch:

```bash
# Commit or stash any changes you've made
git add .
git commit -m "Testing AI analysis features"

# Or stash if you don't want to commit
git stash

# Switch back to main
git checkout main

# Your main branch remains untouched
```

## ⚠️ Important Notes

1. **This is a test branch** - All your testing is isolated from the main branch
2. **Database is shared** - The Supabase database is the same across branches
3. **No main branch impact** - Your main branch and production deployment are safe
4. **Backend pipeline is optional** - The frontend works independently

## 🐛 If You Encounter Issues

### Frontend won't start
```bash
cd frontend
npm install
npm run dev
```

### Backend pipeline errors
```bash
cd backend
source ../venv/bin/activate
pip install -r requirements.txt
```

### Database connection issues
- Check `frontend/.env.local` has Supabase credentials
- Verify Supabase project is accessible at https://clysgodrmowieximfaab.supabase.co

### Port already in use
```bash
# Kill existing process on port 8080
lsof -ti:8080 | xargs kill -9

# Restart frontend
cd frontend && npm run dev
```

## 📝 Providing Feedback

When testing, note:
1. What features work as expected
2. Any bugs or unexpected behaviors
3. Performance issues (slow queries, timeouts)
4. UI/UX improvements you'd like to see
5. Additional AI analysis capabilities you'd want

## 🎯 Success Criteria

The AI analysis feature is working correctly if:
- ✅ You can access the AI Insights page
- ✅ Template queries return relevant results
- ✅ Custom queries are parsed and executed
- ✅ Results show real company data
- ✅ Insights and recommendations are generated
- ✅ The interface is responsive and user-friendly

---

**Current Branch:** `test-ai-analysis`  
**Frontend URL:** http://localhost:8080  
**Backend Path:** `/Users/jesper/nivo/backend/agentic_pipeline/`  
**Database:** Supabase (8,438+ companies)  
**Status:** ✅ Ready for Testing


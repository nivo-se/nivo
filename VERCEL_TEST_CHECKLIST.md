# Vercel Deployment Test Checklist

**Branch:** test-ai-analysis  
**Vercel URL:** https://nivo-web-git-codex-create-solut-1ae41c-jesper-kreugers-projects.vercel.app/  
**Date:** October 7, 2025

## ✅ Test Checklist

### Database Migration (Completed)
- [x] Supabase now has 8,436 companies with 100% financial data
- [x] Revenue column: DOUBLE PRECISION (correct type)
- [x] Profit column: DOUBLE PRECISION (correct type)  
- [x] Employees column: INTEGER (correct type)

### Frontend Tests on Vercel

#### 1. Dashboard/Overview Page
- [ ] Total companies count: Should show ~8,400+
- [ ] Companies with financials: Should show ~8,400+ (not ~1,000)
- [ ] Average revenue: Should be calculated from all companies
- [ ] Revenue distribution charts: Should show complete data

#### 2. Company Search
- [ ] Search for "zeb.consulting AB"
  - [ ] Revenue shows: 66,284 SEK (not null)
  - [ ] Profit shows: 4,618 SEK (not null)
  - [ ] Employees shows: 20 (not null)

- [ ] Search for "Nordlo Syd AB"
  - [ ] Revenue shows: 96,921 SEK
  - [ ] Profit shows: 4,779 SEK
  - [ ] Employees shows: 48

- [ ] Random company search
  - [ ] All companies should have revenue/profit data

#### 3. Filters & Analytics
- [ ] Filter by revenue range: Should work with all companies
- [ ] Filter by employee count: Should work with all companies
- [ ] Growth metrics: Should be calculated correctly
- [ ] Profitability filters: Should work

#### 4. AI Analysis (if available)
- [ ] Natural language queries work
- [ ] Results include financial data
- [ ] Statistics are calculated from full dataset

### Browser Console Check
- [ ] Open Developer Tools → Console
- [ ] Look for: "Companies with financial data (revenue column): 8436"
- [ ] Should NOT see: "using KPI data as proxy"
- [ ] No errors related to missing data

## 🔍 Known Differences from Before

| Metric | Before Migration | After Migration |
|--------|------------------|-----------------|
| Companies with revenue | ~200 (2.5%) | 8,436 (100%) |
| Companies with profit | ~1,070 (12.7%) | 8,436 (100%) |
| Companies with employees | ~950 (11.3%) | 8,436 (100%) |
| Data completeness | Partial | Complete |

## 📝 Issues to Report

If you find any issues during testing, note them here:

### Data Issues
- [ ] Missing data: _______________
- [ ] Incorrect values: _______________
- [ ] Type errors: _______________

### UI Issues  
- [ ] Display problems: _______________
- [ ] Filter not working: _______________
- [ ] Performance issues: _______________

## ✅ Ready to Merge Criteria

Before merging test-ai-analysis → main:
- [ ] All dashboard metrics show complete data
- [ ] Company search returns financial data for all companies
- [ ] No console errors related to data fetching
- [ ] Analytics calculations are correct
- [ ] Performance is acceptable with full dataset

## 🚀 After Testing

If all tests pass:
1. Commit the new migration scripts and reports
2. Push test-ai-analysis branch to origin
3. Create Pull Request: test-ai-analysis → main
4. Review changes one more time
5. Merge to main
6. Deploy main branch to production

---

**Note:** The Supabase database is shared, so the data improvements are already live in all environments!

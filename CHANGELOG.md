# Changelog

## [Latest] - 2025-01-XX

### 🎯 Major Features

#### 1. **Company Context in Search Results**
- Added "What they do" column to company explorer table
- Displays AI-generated product descriptions, business model summaries, or industry segments
- Shows "AI Enriched" badge for companies with full profiles
- Provides immediate context for 13k companies without manual enrichment

#### 2. **Automatic Lightweight Enrichment**
- New `lightweight_enrichment.py` module for fast auto-profiling
- Automatically creates basic AI profiles for companies in search results
- No website scraping - uses company name, segments, and financials only
- Runs automatically when fetching companies (enabled by default)
- Fast: ~2-5 seconds for 50 companies (vs 30-60 seconds for full enrichment)
- Saves to Supabase or local SQLite automatically

#### 3. **Full LLM-Based AI Filter**
- Removed hardcoded rules - now uses full OpenAI LLM analysis
- Comprehensive system prompt with database schema documentation
- Intelligent interpretation of natural language queries
- Handles complex multi-criteria searches (revenue ranges, margins, growth, etc.)
- Better understanding of vague criteria ("around 100M", "healthy margins", etc.)

#### 4. **Semantic Profiling Integration**
- AI filter post-filtering now works with local SQLite
- Checks both Supabase and local SQLite for ai_profiles
- Filters companies based on product/strategy criteria when prompt requires it
- Works without Supabase configuration

#### 5. **Enrichment Pipeline Ready**
- Enrichment works without Supabase (saves to local SQLite)
- Automatic fallback to local storage when Supabase unavailable
- Website discovery and caching (saves to companies.homepage)
- Multi-page scraping with Puppeteer
- Full multi-step AI analysis (content, industry, strategic fit, playbook)

### 🔧 Technical Improvements

#### Backend
- **`backend/api/companies.py`**:
  - Added `segment_names` and `company_context` to batch endpoint
  - Checks both Supabase and local SQLite for ai_profiles
  - Auto-enrichment integration (lightweight profiles)
  
- **`backend/api/ai_filter.py`**:
  - Full LLM-based prompt analysis (not rule-based)
  - Enhanced system prompt with comprehensive schema docs
  - Semantic profiling with local SQLite support
  - Better revenue range handling ("around 100M" = 80M-120M)
  
- **`backend/workers/lightweight_enrichment.py`** (NEW):
  - Fast auto-enrichment for search results
  - Uses only available data (no scraping)
  - Creates basic profiles with product description and industry classification
  
- **`backend/workers/enrichment_worker.py`**:
  - Supabase is now optional (graceful fallback)
  - Saves to local SQLite when Supabase unavailable
  - Creates ai_profiles table automatically in local DB

#### Frontend
- **`frontend/src/components/CompanyExplorer.tsx`**:
  - Added "What they do" column
  - Displays company context (product description or industry segments)
  - Shows "AI Enriched" badge
  - Updated CompanyRow interface with new fields
  
- **`frontend/src/lib/apiService.ts`**:
  - Updated CompanyRow interface
  - Added auto_enrich parameter support

### 📊 Data Improvements

- **Revenue Display Consistency**: List view and detail view now both use latest year revenue
- **Account Code Mapping**: Corrected mappings (SI for revenue, resultat_e_avskrivningar for EBIT)
- **Margin Calculations**: Weighted average margins (total profit / total revenue)
- **Database Units**: All values stored in actual SEK (not thousands)

### 🗄️ Database

- **Local SQLite**: `ai_profiles` table created automatically when needed
- **Supabase**: Optional - enrichment works without it
- **Dual Storage**: Saves to Supabase if available, local SQLite as fallback

### 📝 Documentation

- **`COMPANY_CONTEXT_IMPLEMENTATION.md`**: Full implementation guide
- **`ENRICHMENT_READY.md`**: Enrichment pipeline status
- **`AI_FILTER_ARCHITECTURE.md`**: AI filter architecture and public info integration
- **`AI_FILTER_IMPROVEMENTS.md`**: Summary of AI filter enhancements

### 🐛 Bug Fixes

- Fixed frontend crashes (undefined metadata, toLocaleString errors)
- Fixed React setState during render warnings
- Fixed revenue mismatch between list and detail views
- Fixed semantic profiling to work with local SQLite
- Fixed enrichment to work without Supabase

### ⚡ Performance

- Lightweight enrichment: ~2-5 seconds for 50 companies
- Auto-enrichment limited to 50 companies per batch
- Caching: Websites saved to companies.homepage (persistent)
- Efficient: Only enriches companies without existing profiles

### 🔄 Workflow Changes

**Before:**
1. Search → Get company names + financials
2. Manually select companies
3. Click "Enrich selection"
4. Wait for full enrichment
5. See product descriptions

**After:**
1. Search → Get company names + financials + **context automatically**
2. See what companies do immediately (product description or industry segments)
3. Optionally enrich selected companies for full profiles

### 🎯 User Impact

- **13k companies** now have immediate context in search results
- **No manual steps** required to see what companies do
- **Faster decisions** - can identify interesting companies at a glance
- **Progressive enhancement** - basic context immediately, full profiles on demand

## Previous Updates

### Financial Data Accuracy
- Fixed account code extraction (type mismatch in year comparison)
- Corrected revenue units (thousands to actual SEK conversion)
- Fixed margin calculations (weighted average)
- All financial metrics now 100% accurate

### AI Filter Enhancements
- Improved revenue filtering (uses latest year from financials table)
- Better prompt interpretation (LLM-based, not rule-based)
- Enhanced fallback parser for when OpenAI unavailable

### Enrichment Pipeline
- Website discovery with SerpAPI
- Multi-page scraping with Puppeteer
- Full AI analysis pipeline
- Persistent website caching


# Phase 2: Planning & Priorities

## ✅ Phase 1 Complete

**What we built:**
- Full universe screening with advanced filters (include/exclude logic)
- Working lists management (create, view, delete)
- Prospects pipeline with status tracking
- Work dashboard showing progress
- Company detail pages
- Complete data model aligned with backend (13,610 companies with real Swedish data)
- All field names updated to match backend exactly

**Current Status:**
- App is fully functional with mock data
- Data structures ready for API integration
- UI components complete and tested
- Filter builder working with complex nested logic

---

## 🚀 Phase 2: Proposed Features & Priorities

### A. **Backend Integration (HIGH PRIORITY)**
Replace mock data with real API calls

**Tasks:**
1. Create API client service (`/src/services/api.ts`)
2. Implement authentication/authorization
3. Replace Universe table with `POST /api/universe/query`
4. Implement list CRUD operations
5. Add loading states and error handling
6. Implement pagination properly
7. Add retry logic and error boundaries

**Benefits:**
- Real-time data
- Persistent storage
- Multi-user collaboration
- Better performance with server-side filtering

---

### B. **AI Analysis Workflow (HIGH PRIORITY)**
Implement the core OpenAI-powered analysis pipeline

**Tasks:**
1. AI Lab page with prompt template builder
2. Run creation UI (select list, configure prompts, scoring rules)
3. Run progress dashboard
4. Results viewer with company scores/insights
5. Export/download AI results
6. Company AI profile display (when available)

**Features:**
- Custom prompt templates with variables
- Strict scoring rulesets (0-100 scale)
- Batch processing with progress indicators
- Review and approve AI-generated insights
- Integration with OpenAI API (GPT-4)

**UI Requirements:**
- Run status: queued → running → completed
- Progress: "Analyzing company 45 of 210"
- Error handling for API failures
- Ability to cancel/pause runs

---

### C. **Advanced Filtering Enhancements (MEDIUM)**
Improve the filter builder experience

**Tasks:**
1. Add saved filter templates (common queries)
2. Filter preview with company count
3. Filter history/recent searches
4. Column customization (show/hide fields)
5. Bulk export filtered results
6. Advanced operators: "between", "in list", "not in"

**Benefits:**
- Faster workflow for common searches
- Better visibility into filter results
- More flexible data export

---

### D. **Data Quality & Coverage UI (MEDIUM)**
Surface data quality issues and enrichment opportunities

**Tasks:**
1. Coverage snapshot dashboard widget
2. Data quality badges in tables
3. Stale data indicators
4. "Missing AI Profile" prompts with enrichment CTA
5. Enrichment request UI (trigger background jobs)
6. Data freshness timeline

**UI Elements:**
- ⚠️ Stale data warning
- 🔴 Low quality score (0-1)
- ✅ High quality score (3-4)
- 🤖 AI profile available badge
- 📊 Coverage % by industry/region

---

### E. **Collaboration Features (MEDIUM)**
Enable team workflows

**Tasks:**
1. Company labels (private/team scope)
2. List sharing and permissions
3. Activity feed (who added what, when)
4. Comments on companies
5. @mentions in notes
6. Notifications

**Benefits:**
- Better team coordination
- Avoid duplicate work
- Track decision history

---

### F. **Saved Views vs Lists (LOW)**
Distinguish between dynamic queries and static shortlists

**Current:** Lists can optionally store filters  
**Proposed:** Separate concepts entirely

**Saved Views:**
- Store filter recipes
- Always reload fresh data
- Show "Modified" indicator if results changed
- Can be converted to static list

**Lists:**
- Static snapshot of companies
- Can't auto-reload (but can manually refresh if created from view)
- Focus on workflow stage management

**Tasks:**
1. Add "Views" tab in navigation
2. Views page (similar to Lists)
3. "Convert View to List" action
4. "Reload from Source View" on lists

---

### G. **Outreach Workflow (LOW)**
Track actual contact attempts and outcomes

**Current:** Basic status tracking in Prospects  
**Proposed:** Full outreach management

**Features:**
1. Email templates
2. Call scripts
3. Schedule reminders
4. Track response rates
5. Integration with calendar
6. Deal stage progression

---

### H. **Analytics & Reporting (LOW)**
Insights on portfolio and pipeline

**Features:**
1. Funnel analysis (Universe → Lists → Prospects → Deals)
2. Industry/geography breakdown
3. Financial metrics distributions
4. AI score distributions
5. Time-to-close metrics
6. Team activity reports

---

## 🎯 Recommended Phase 2 Scope

**My recommendation for immediate next steps:**

### **Option 1: Backend-First Approach**
Focus on making the app production-ready with real data
- Backend Integration (A)
- Data Quality UI (D)
- Basic AI Analysis workflow (B - simplified version)

### **Option 2: Feature-First Approach**  
Build out the AI analysis workflow with mock data first
- AI Analysis Workflow (B) - full version
- Advanced Filtering (C)
- Then Backend Integration (A)

### **Option 3: Balanced Approach** (RECOMMENDED)
- Start with Backend Integration for Universe + Lists (A.1-A.6)
- Add Data Quality indicators (D.1-D.4)
- Build simplified AI Analysis MVP (B.1-B.4)
- Defer advanced features (E, F, G, H) to Phase 3

---

## 💬 Questions for You

1. **Which approach appeals to you most?** (Backend-first, Feature-first, or Balanced)

2. **Is OpenAI integration a hard requirement for Phase 2**, or can we mock AI responses initially?

3. **Do you have backend API endpoints ready**, or are you building those in parallel?

4. **What's your priority:**
   - Get to production with real data ASAP?
   - Perfect the AI analysis workflow first?
   - Both equally important?

5. **Team size:** Is this still a 3-person team, or has that changed?

6. **Timeline:** What's your target for Phase 2 completion?

---

## 🛠️ My Suggestion

Let's start with a **mini Phase 2A** to prove out the core workflow:

**Week 1-2: Backend Integration MVP**
- Connect Universe page to real API
- Implement list CRUD with persistence
- Add basic loading states

**Week 3-4: AI Analysis MVP**
- Simple prompt template UI
- Run creation & progress tracking
- Display AI results on company cards

**Week 5: Polish & Data Quality**
- Add data quality badges
- Coverage snapshot widget
- Stale data warnings

This gives you a working system with real data + AI analysis in ~5 weeks, then we can iterate on advanced features.

---

**What would you like to tackle first?** Let me know your priorities and I'll start building!

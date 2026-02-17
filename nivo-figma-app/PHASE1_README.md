# Nivo Group Investment Platform - Phase 1 MVP

## What's Been Built

This is a **Phase 1 MVP** implementation of the Nivo Group internal investment platform. It focuses on the core screening and list management workflow.

### ✅ Implemented Features

#### 1. Work Dashboard (Home)
- Overview of all lists organized by stage
- Quick stats (total companies, active lists, prospects)
- Prospects pipeline summary
- Recent activity feed
- Quick shortcuts to main sections

#### 2. Universe (Main Screening)
- Table view of all 13,240 companies
- **Advanced Filter Builder** with:
  - Include/Exclude logic
  - Multiple filter types (Revenue, Industry, Geography, PE-backed, etc.)
  - Real-time filtering
  - Support for financial KPIs (Revenue CAGR, EBITDA Margin, etc.)
- Sortable columns
- Multi-select companies
- Save filtered results as Lists
- Pagination (50 per page)

#### 3. Filter Persistence
- When creating a list from filters, filters are **automatically saved**
- Lists remember their source filters
- **"Reload & Modify"** feature allows you to:
  - Load the original filters
  - See current results (may differ if data changed)
  - Modify filters
  - Update the list with new results

#### 4. My Lists
- View all your lists (Private and Shareable)
- See list metadata (company count, creator, date)
- Visual indicators for lists created from filters
- Delete lists
- Open list detail view

#### 5. List Detail
- View companies in a list
- Reload and modify filters
- Select companies to add to Prospects
- Integration point for AI Analysis (Phase 2)

#### 6. Company Detail
- Tabs: Overview, Financials, AI Insights
- 4-year financial history table
- Key metrics cards (Revenue, CAGR, EBITDA Margin, etc.)
- Ownership flags (PE-backed, Subsidiary)
- AI insights display (when available)

#### 7. Prospects (Team List)
- Public pipeline for all team members
- Status tracking (New, Contacted, In Discussion, etc.)
- Add notes/call outcomes
- Filter by status
- Update status per company
- Activity log per company

### 🗂️ Data Model

**Mock Data:**
- 13,240 companies with realistic data
- 4-year financial history per company (2022-2025)
- Industries: Manufacturing, Software/SaaS, Distribution, etc.
- ~30% have AI insights pre-populated

**Key Entities:**
- **Companies** - Base company data + 4Y financials
- **Lists** - User-created lists with optional filter persistence
- **Prospects** - Team pipeline with status tracking
- **Filters** - Nested include/exclude logic

### 🎨 Design Principles

- **Desktop-first** - Optimized for internal team use
- **Dense but scannable** - More data visible without scrolling
- **Table-centric** - Fast scanning of many companies
- **Progressive filtering** - Build filters iteratively
- **Clear hierarchy** - Visual weight guides attention

### 🔧 Technical Stack

- **React** with TypeScript
- **React Router** (data mode) for navigation
- **Tailwind CSS** for styling
- **Radix UI** components (via shadcn/ui)
- **Lucide React** for icons
- **Sonner** for toast notifications

### 🧭 Navigation Structure

```
Work Dashboard (/)
├── Universe (/universe)
│   └── Company Detail (/company/:id)
├── My Lists (/lists)
│   └── List Detail (/lists/:id)
├── Prospects (/prospects)
├── AI Lab (/ai-lab) [Phase 2]
└── Admin (/admin) [Placeholder]
```

### 📊 Key Workflows Implemented

#### Workflow 1: Filter → Save → Review
1. Open Universe
2. Build complex filter (e.g., Revenue > $5M AND Manufacturing)
3. See results update in real-time
4. Save as List (filters are persisted)
5. Open list later, reload filters, modify, update list

#### Workflow 2: List → Prospects
1. Open a list
2. Select companies
3. Add to Prospects
4. Track outreach in Prospects view
5. Update status, add notes

#### Workflow 3: Deep Dive
1. Click any company from Universe or List
2. View Overview (key metrics)
3. Review Financials (4Y history)
4. Check AI Insights (if available)

### 🚀 What's Next (Phase 2)

**Not Yet Implemented:**
- AI Lab (prompt templates, bulk analysis)
- AI Analysis workflow (run analysis on lists)
- Scoring rulesets
- Advanced filter features (OR groups, nested logic)
- Export functionality
- Admin panel (user management)
- Real-time collaboration features

### 💡 Key UX Decisions

1. **Filters Save with Lists** - Eliminates confusion about "Views vs Lists"
2. **Reload & Modify** - Lets you iterate on filters without losing work
3. **Prospects = Public** - Team pipeline is always shared
4. **My Lists = Private by default** - Early research stays private until ready
5. **Stage indicators** - Visual cues for where a list is in the workflow

### 🎯 Success Criteria (Phase 1)

- ✅ Users can build complex filters
- ✅ Users can save lists with filters
- ✅ Users can reload and modify filters
- ✅ Users can move companies to Prospects
- ✅ Users can track outreach progress
- ✅ Filtering feels fast and powerful

### 🐛 Known Limitations

- Mock data only (no backend integration)
- No user authentication (always "Sarah")
- No real AI analysis (just mock data)
- Filter logic is basic (no deep nesting yet)
- No export functionality
- No bulk operations beyond select + add to prospects

### 📝 Notes for Development Team

**Mock Data Generation:**
- Companies are generated with realistic variations
- Financial data shows realistic growth patterns
- ~30% have AI insights to show the UI
- PE-backed and subsidiary flags are realistic percentages

**Filter Evaluation:**
- Client-side filtering for MVP (fast with 13k records)
- Production should use server-side filtering
- Filter query format is designed to map to SQL/API queries

**State Management:**
- React Context for data (simple for MVP)
- Production should use React Query or similar
- Lists/Prospects updates are optimistic

---

**Built:** February 2026  
**Version:** Phase 1 MVP  
**Status:** Ready for user testing

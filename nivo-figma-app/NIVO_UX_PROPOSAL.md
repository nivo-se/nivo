# Nivo Group – UX & Information Architecture Proposal

**Version 1.0** | Internal Investment Platform  
**Date:** February 16, 2026

---

## Executive Summary

This document proposes a coherent, operator-grade UX and information architecture for Nivo Group's internal investment platform. The design prioritizes **speed, clarity, and iterative workflows** to help a small team efficiently screen, shortlist, enrich, and acquire small/medium businesses from a universe of ~13,000 companies.

**Core Design Principles:**
- **Table-first, drill-down easy** – Dense data exploration with quick access to detail
- **Iterative filtering** – Apply filters progressively without complex modal flows
- **First-class shortlisting** – Views and Lists as primary collaboration tools
- **Transparent coverage** – Always know what data exists and what's missing
- **Personal + Team workspaces** – Support individual work and team collaboration
- **Action-oriented** – Every screen answers "what should I do next?"

---

## 1. Information Architecture

### 1.1 Primary Navigation Structure

```
┌─────────────────────────────────────────────────────────────┐
│  NIVO GROUP                    [Search]      👤 User Menu    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  🏠 Home                                                      │
│  🌍 Universe                                                  │
│  📊 Views          [My Views | Team Views]                   │
│  📋 Lists          [My Lists | Team Lists]                   │
│  🔬 Enrichment                                               │
│  📈 Reports        (Phase 2)                                 │
│  ⚙️  Admin                                                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Navigation Philosophy:**
- **Left sidebar** for primary sections (always visible)
- **Context tabs** within sections (e.g., My Views vs Team Views)
- **Breadcrumbs** for deep drilldowns (e.g., Universe → Company Detail → Financials)
- **Global search** in header (companies, lists, views)

---

### 1.2 Screen Inventory & Purpose

| Screen | Purpose | Key Actions |
|--------|---------|-------------|
| **Home** | Daily dashboard – what's changed, what needs attention | Quick stats, recent activity, shortcuts to common tasks |
| **Universe** | Main data exploration – table of all companies with inline filtering | Filter, sort, multi-select, save view, create list |
| **Company Detail** | Deep dive on a single company | View financials, enrichment, notes, trigger jobs |
| **Views (My/Team)** | Manage saved queries and filters | View, edit, share, archive, convert to list |
| **Lists (My/Team)** | Manage shortlists and collaborate | Edit items, add notes/tags, export, share |
| **List Detail** | Work on a specific shortlist | Reorder, annotate, bulk enrich, produce output |
| **Enrichment** | Monitor data coverage and background jobs | View coverage stats, trigger jobs, see runs history |
| **Reports** | Generate memos, IC reports, outputs | (Phase 2) Template selection, data binding, export |
| **Admin** | User management, settings, system config | (Minimal for MVP) |

---

## 2. Core Workflows

### 2.1 Workflow #1: Screening & Shortlisting (Primary Loop)

```
START: Home
  ↓
Universe (table view, ~13k companies)
  ↓ Apply filter #1 (e.g., Revenue > $5M)
  → 3,200 companies
  ↓ Apply filter #2 (e.g., Industry = Manufacturing)
  → 480 companies
  ↓ Apply filter #3 (e.g., Has 3Y financials)
  → 210 companies
  ↓
[Save View] → "Manufacturing 5M+ 3Y Financials"
  ↓
[Create List from View] → "Q1 Manufacturing Targets"
  ↓
List Detail (collaborate, annotate, enrich)
  ↓
Select 15 finalists → Trigger enrichment
  ↓
Review enriched profiles
  ↓
Produce report (Phase 2)
```

**Key UX Patterns:**
- **Inline filtering** – Filter chips appear above table, applied immediately
- **Filter counter** – "3,200 of 13,000 companies" always visible
- **Save View button** – One-click save with naming modal
- **Create List from View** – Snapshots current filtered set
- **List vs View distinction** – Views are dynamic queries; Lists are static snapshots you can edit

---

### 2.2 Workflow #2: Collaboration on Shortlists

```
User A creates List "Q1 Targets" (50 companies)
  ↓
User A tags 10 companies as "High Priority"
  ↓
User A shares List with Team
  ↓
User B opens List
  ↓
User B adds notes to 5 companies
  ↓
User C removes 3 companies, adds 2 new ones
  ↓
All changes tracked with timestamps + user attribution
```

**Key UX Patterns:**
- **List Items** – Each company in a list is a "list item" with metadata (added_by, tags, notes, priority)
- **Activity log** – Sidebar shows who did what and when
- **Inline editing** – Add notes/tags directly in table cells
- **Ownership model** – Creator owns, but team members can edit (with clear attribution)

---

### 2.3 Workflow #3: Enrichment & Coverage Management

```
User opens Enrichment dashboard
  ↓
Sees coverage stats:
  - 8,200 companies have AI profiles (63%)
  - 4,800 companies missing 3Y financials (37%)
  - 320 enrichments stale (>90 days)
  ↓
Drills into "Missing AI Profiles" segment
  ↓
Creates View or List of companies to enrich
  ↓
Triggers bulk enrichment job
  ↓
Job runs in background, tracked in Jobs table
  ↓
User receives notification when complete
```

**Key UX Patterns:**
- **Coverage dashboard** – Visual cards showing % complete, gaps, staleness
- **Drillable segments** – Click any stat to see underlying companies
- **Bulk actions** – Select companies → Trigger enrichment
- **Jobs queue** – Table showing running/completed/failed jobs

---

### 2.4 Workflow #4: Company Deep Dive

```
User clicks company from Universe/List
  ↓
Company Detail page opens
  ↓
Tabs: Overview | Financials | Enrichment | Activity
  ↓
Overview: Basic info, key metrics, tags, quality score
Financials: Multi-year table (revenue, EBITDA, growth, ratios)
Enrichment: AI profile, web intel, risk flags, summaries
Activity: Notes, list memberships, enrichment history
  ↓
User can:
  - Add to List
  - Trigger enrichment
  - Add notes/tags
  - Export data
```

**Key UX Patterns:**
- **Tabbed layout** – Dense info, easy navigation
- **Actions panel** – Sticky right sidebar with quick actions
- **Data freshness indicators** – Show when data was last updated
- **Related companies** – Similar companies based on industry/size

---

## 3. Key Components & Patterns

### 3.1 Filtering System (Critical)

**Design Goal:** Fast, iterative, no modals

**Proposed Pattern:**

```
┌───────────────────────────────────────────────────────┐
│ [+ Add Filter ▼]  [Industry: Manufacturing ×]         │
│                   [Revenue > $5M ×]                   │
│                   [Has 3Y Financials ×]               │
│                                                        │
│ Showing 210 of 13,000 companies                       │
│                                                        │
│ [Save View]  [Create List]  [Export]  [⚙️ Columns]   │
└─────────────���─────────────────────────────────────────┘
```

**Filter Interaction:**
1. Click `+ Add Filter` → Dropdown with filter categories (Industry, Revenue, Geography, Data Coverage, Custom KPIs)
2. Select filter → Inline editor appears (e.g., slider for Revenue, multi-select for Industry)
3. Filter applies immediately, results update
4. Filter appears as chip, can be edited or removed
5. All filters visible at once (no hidden state)

**Advanced Filters:**
- **Quick filters** – Pre-set buttons (e.g., "Has AI Profile", "Missing Financials", "High Quality")
- **Saved filter sets** – Load filters from saved views
- **Boolean logic** – AND by default, support for OR via grouped chips (Phase 2)

---

### 3.2 Company Table (Primary Data Interface)

**Design Goal:** Dense, scannable, sortable, actionable

**Proposed Pattern:**

```
┌─────────────────────────────────────────────────────────────────────┐
│ ☑️ | Company Name         | Industry      | Rev ($M) | Growth | ... │
├─────────────────────────────────────────────────────────────────────┤
│ ☐ | Acme Manufacturing    | Manufacturing | 12.5     | 18%    | ... │
│ ☐ | BrightCo Industries   | Manufacturing | 8.2      | -3%    | ... │
│ ☐ | ...                   | ...           | ...      | ...    | ... │
└─────────────────────────────────────────────────────────────────────┘
```

**Features:**
- **Row selection** – Multi-select with checkboxes for bulk actions
- **Sortable columns** – Click header to sort
- **Inline indicators** – Icons for data coverage (✓ = has AI, ⚠️ = stale, ✗ = missing)
- **Click row** → Open company detail
- **Hover actions** – Quick add to list, view financials
- **Column customization** – Show/hide columns, reorder, save column sets
- **Pagination + virtual scroll** – Handle large datasets smoothly

---

### 3.3 Views vs Lists (Core Abstraction)

**Saved Views:**
- **What:** Stored query configuration (filters, sorts, columns)
- **When:** Use to save a screening logic you'll re-run
- **Dynamic:** Always shows current data matching filters
- **Example:** "Manufacturing 5M+ 3Y Financials" – may show 210 companies today, 220 next week

**Saved Lists:**
- **What:** Static snapshot of companies with collaboration metadata
- **When:** Use to create a shortlist you'll work on with team
- **Static:** Companies don't change unless manually added/removed
- **Example:** "Q1 Manufacturing Targets" – locked to 50 specific companies, with notes/tags/priority

**Conversion Flow:**
- View → Create List: Takes current filtered companies and creates a new list
- List → View: Not typical, but could "extract filters" from list criteria

---

### 3.4 Data Coverage Dashboard (Enrichment)

**Proposed Layout:**

```
┌─────────────────────────────────────────────────────┐
│  DATA COVERAGE OVERVIEW                             │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ AI Profiles  │  │ 3Y Financials│  │ Web Intel │ │
│  │   63%        │  │   74%        │  │   45%     │ │
│  │ 8,200 / 13k  │  │ 9,620 / 13k  │  │ 5,850/13k │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ STALE ENRICHMENTS (>90 days)                 │  │
│  │ 320 companies                [Refresh All]   │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ ACTIVE JOBS                                   │  │
│  │ • AI Profile Batch #42  [Running... 60%]     │  │
│  │ • Financials Refresh    [Completed]          │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Interactions:**
- Click any coverage card → Drills to filtered Universe view (e.g., "Companies missing AI profiles")
- Click job → View job detail (log, errors, affected companies)
- Bulk trigger enrichment from Universe/List selection

---

### 3.5 Home Dashboard (Daily Workspace)

**Proposed Layout:**

```
┌─────────────────────────────────────────────────────┐
│  WELCOME BACK, [USER]                               │
├─────────────────────────────────────────────────────┤
│                                                      │
│  QUICK STATS                                        │
│  • 13,240 companies in universe (+40 this week)     │
│  • 8 active lists (3 yours, 5 team)                 │
│  • 12 enrichment jobs completed today               │
│                                                      │
│  RECENT ACTIVITY                                    │
│  • Sarah edited "Q1 Manufacturing Targets"          │
│  • AI profile completed for Acme Manufacturing      │
│  • New view saved: "High Growth SaaS"               │
│                                                      │
│  NEEDS ATTENTION                                    │
│  • 320 companies have stale enrichment [Review]     │
│  • 3 jobs failed last night [View Logs]             │
│                                                      │
│  SHORTCUTS                                          │
│  [Explore Universe] [My Lists] [Run Enrichment]    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Purpose:**
- **Situational awareness** – What's changed, what needs attention
- **Quick access** – Jump to common tasks
- **Activity feed** – Recent team actions (who did what)
- **Alerts** – Failed jobs, stale data, quality issues

---

## 4. MVP Phasing Plan

### Phase 1: Core Screening & Collaboration (Weeks 1-4)

**Goal:** Support primary loop (filter → save view → create list → collaborate)

**Features:**
- ✅ Home dashboard (basic stats + shortcuts)
- ✅ Universe table with inline filtering (revenue, industry, geography)
- ✅ Company detail page (overview + financials tabs)
- ✅ Saved Views (create, edit, delete, My/Team tabs)
- ✅ Saved Lists (create from view, My/Team tabs)
- ✅ List detail with inline editing (add notes, tags)
- ✅ Basic enrichment triggers (single company, bulk select)
- ✅ Simple admin (user list, basic settings)

**Success Criteria:**
- Users can filter universe, save views, create lists
- Users can collaborate on lists (add notes, tag companies)
- Users can trigger enrichment for selected companies

---

### Phase 2: Enrichment Pipeline & Coverage (Weeks 5-6)

**Goal:** Make data coverage transparent and manageable

**Features:**
- ✅ Enrichment dashboard (coverage cards, stale data)
- ✅ Jobs queue and monitoring (status, logs, retry)
- ✅ Drillable coverage stats (click card → filtered universe)
- ✅ Bulk enrichment from lists
- ✅ Data freshness indicators throughout app
- ✅ Company detail: Enrichment tab (AI profile, web intel, history)

**Success Criteria:**
- Users understand what data exists and what's missing
- Users can efficiently queue enrichment jobs
- Users can monitor job progress and troubleshoot failures

---

### Phase 3: Advanced Filtering & Outputs (Weeks 7-8)

**Goal:** Power-user features and output generation

**Features:**
- ✅ Advanced filters (custom KPIs, Boolean logic, relative dates)
- ✅ Saved filter sets (reusable filter templates)
- ✅ Column customization (show/hide, reorder, save presets)
- ✅ Reports module (basic templates: IC memo, shortlist export)
- ✅ Export options (CSV, PDF, formatted reports)
- ✅ Activity logs (full audit trail for lists and views)

**Success Criteria:**
- Power users can build complex filters quickly
- Team can generate presentable outputs for IC meetings
- Full audit trail for compliance/governance

---

### Phase 4: Intelligence Layer (Future)

**Goal:** Make the platform smarter and more proactive

**Features (Future):**
- 🔮 Smart recommendations (suggested companies based on list patterns)
- 🔮 Anomaly detection (flag unusual financials, risks)
- 🔮 Auto-tagging (ML-based categorization)
- 🔮 Natural language queries ("Show me profitable SaaS companies in Texas")
- 🔮 Workflow automation (auto-enrich when added to list, scheduled reports)
- 🔮 Deal pipeline management (stages: sourced → screened → DD → offer → closed)

---

## 5. Smart Ideas & UX Innovations

### 5.1 "Quick Actions" Panel (Always Accessible)

**Idea:** Floating action button (FAB) or keyboard shortcut (Cmd+K) for power users

**Actions:**
- `C` → Create new list
- `V` → Save current view
- `E` → Trigger enrichment on selected companies
- `S` → Global search
- `N` → Add note to current context

**Why:** Reduces clicks for common actions, feels operator-grade

---

### 5.2 "Comparison Mode" (Multi-Company Analysis)

**Idea:** Select 2-5 companies → Side-by-side comparison table

**Use Case:**
- User has narrowed to 5 finalists
- Wants to compare financials, quality scores, AI insights directly
- Exports comparison as memo

**Why:** Critical for final decision-making, avoids toggling between tabs

---

### 5.3 "Coverage Score" per Company

**Idea:** Single 0-100 score indicating data completeness

**Calculation:**
- Has 3Y financials? +30
- Has AI profile? +20
- Has web intel? +20
- Enrichment <90 days? +15
- Has industry tags? +10
- Has geo data? +5

**Display:** Color-coded badge (red <50, yellow 50-80, green 80+)

**Why:** Instantly signals whether a company is "ready to evaluate"

---

### 5.4 "Smart Lists" (Dynamic Lists with Rules)

**Idea:** Hybrid of Views and Lists – lists that auto-update based on criteria

**Use Case:**
- "Always show me profitable manufacturing companies added in last 30 days"
- List updates automatically as new companies enter universe
- Team can still annotate/tag companies in the list

**Why:** Combines best of views (dynamic) and lists (collaborative)

---

### 5.5 "Deal Pipeline" Module (Post-MVP)

**Idea:** Move beyond screening to full deal workflow

**Stages:**
1. Sourced (in universe)
2. Screened (on shortlist)
3. Contacted (outreach started)
4. Due Diligence (deep analysis)
5. Offer (term sheet)
6. Closed (acquired or passed)

**Why:** Natural evolution as firm matures – track deals from discovery to close

---

### 5.6 "Stale Data" Alerts & Auto-Refresh

**Idea:** System proactively flags and queues stale enrichments

**Behavior:**
- If company added to list AND enrichment >90 days → Auto-trigger refresh
- If company viewed 3+ times AND missing AI profile → Suggest enrichment
- Weekly digest: "50 companies need refresh, [Queue Jobs]"

**Why:** Keeps data fresh without manual intervention

---

### 5.7 "Collaborative Annotations" (Inline Comments)

**Idea:** Google Docs-style commenting on any data point

**Use Case:**
- User clicks on "Revenue: $12.5M" → Adds comment "Verify with audited financials"
- Team sees comment indicator, can reply
- Resolves when verified

**Why:** Keeps context attached to specific data points, not just general notes

---

### 5.8 "Universe Segmentation" (Pre-Defined Views)

**Idea:** Ship with intelligent default views

**Examples:**
- "High Quality" – Coverage score >80, has 3Y financials, recent enrichment
- "Undiscovered Gems" – Good financials but low enrichment coverage
- "Needs Attention" – On team lists but stale data
- "New This Month" – Recently added companies

**Why:** Helps users get started, teaches filtering patterns

---

## 6. Technical Architecture Notes

### 6.1 Frontend Stack (Assumed)

- **React** with TypeScript
- **Tailwind CSS** for styling
- **React Router** for navigation (data mode)
- **TanStack Table** or similar for high-performance tables
- **React Query** for server state management
- **Zustand** or Context for client state

### 6.2 Key Performance Considerations

- **Virtual scrolling** for 13k+ row tables
- **Debounced filters** to avoid excessive API calls
- **Optimistic updates** for collaborative edits (notes, tags)
- **WebSocket or polling** for job status updates
- **Indexed search** for global search (consider Algolia/Meilisearch)

### 6.3 Data Model (High-Level)

```
Companies
  - id, name, industry, revenue, growth, ...
  - coverage_score, last_enriched_at, quality_flags

Views
  - id, name, user_id, team_shared, filters_json, created_at

Lists
  - id, name, user_id, team_shared, created_at

ListItems
  - id, list_id, company_id, added_by, notes, tags, priority

Jobs
  - id, type, status, progress, created_by, started_at, completed_at

Notes (optional table for company notes)
  - id, company_id, user_id, text, created_at
```

---

## 7. Design System & UI Density

### 7.1 Design Principles

- **Dense but readable** – More data visible without scrolling
- **Monochrome + accent color** – Professional, not playful
- **Consistent spacing** – 4px/8px/16px/24px scale
- **Clear hierarchy** – Use size, weight, color intentionally
- **Fast interactions** – Instant feedback, no unnecessary animations

### 7.2 Component Library

Use or build:
- **Data Table** – High-performance, sortable, filterable
- **Filter Chip** – Removable, editable filter tags
- **Coverage Badge** – Color-coded data completeness indicator
- **Status Indicator** – Job/enrichment status (running, complete, failed)
- **Action Dropdown** – Bulk action menu (add to list, enrich, export)
- **Inline Editor** – Edit notes/tags directly in table cells
- **Modal** – For save view, create list, confirmation dialogs

### 7.3 Typography & Colors

**Typography:**
- Headings: 24px/20px/16px (bold)
- Body: 14px (regular)
- Small/meta: 12px (medium)
- Mono: For numbers, codes, IDs

**Colors:**
- Primary: Blue (actions, links)
- Success: Green (complete, high quality)
- Warning: Yellow/Orange (stale, needs attention)
- Danger: Red (missing, failed)
- Neutral: Grays for backgrounds, borders, text

---

## 8. Success Metrics

How to measure if the UX is working:

### 8.1 Speed Metrics
- **Time to create shortlist** – From universe to list <2 minutes
- **Time to find company** – Using search/filters <10 seconds
- **Page load time** – Universe table <1 second

### 8.2 Adoption Metrics
- **% of lists with notes/tags** – Indicates collaboration
- **% of views re-used** – Indicates saved views are valuable
- **Enrichment trigger rate** – Users actively managing data coverage

### 8.3 Quality Metrics
- **Average coverage score** – Are we filling gaps?
- **% stale data** – Trending down over time?
- **User-reported friction** – Weekly feedback sessions

---

## 9. Implementation Priorities (Summary)

### Must Have (MVP Week 1-4)
1. ✅ Universe table with inline filtering
2. ✅ Saved Views (My/Team)
3. ✅ Saved Lists (My/Team)
4. ✅ Company Detail (overview + financials)
5. ✅ Basic enrichment triggers

### Should Have (Week 5-8)
6. ✅ Enrichment dashboard (coverage visibility)
7. ✅ Jobs monitoring
8. ✅ Advanced filters (custom KPIs, Boolean)
9. ✅ Reports module (basic templates)
10. ✅ Column customization

### Could Have (Post-MVP)
11. 🔮 Smart recommendations
12. 🔮 Comparison mode
13. 🔮 Natural language queries
14. 🔮 Collaborative annotations
15. 🔮 Deal pipeline stages

---

## 10. Final Recommendations

### 10.1 Critical Success Factors

1. **Nail the filtering UX** – This is the core workflow; if filtering feels slow or confusing, the whole app fails
2. **Make Views vs Lists obvious** – Users must understand when to save a view vs create a list
3. **Show coverage everywhere** – Users should always know "how good is this data?" at a glance
4. **Minimize modals** – Keep interactions inline and fast
5. **Over-communicate state** – Loading, saving, syncing – always visible

### 10.2 What to Avoid

- ❌ **Over-engineering filtering** – Don't build a query builder with complex Boolean UI in v1
- ❌ **Hiding actions in menus** – Put common actions (save view, create list) prominently
- ❌ **Slow tables** – 13k rows must render fast or users will hate it
- ❌ **Unclear permissions** – Always show if something is personal vs team, editable vs read-only
- ❌ **Feature creep** – Resist adding "nice-to-haves" before core loops are solid

### 10.3 Next Steps

1. **Review this proposal** with the team – Align on vision and priorities
2. **Design high-fidelity mockups** – Focus on Universe, List Detail, Enrichment dashboard
3. **Build Phase 1 MVP** – Core screening loop only
4. **User test internally** – Get feedback from 3-person team using real data
5. **Iterate based on usage** – Watch what works, what's confusing, what's missing
6. **Expand in phases** – Don't rush to reports/pipeline before core is solid

---

## Appendix: Screen Wireframes (Text-Based)

### A1: Home Dashboard
```
┌─────────────────────────────────────────────────────┐
│ NIVO GROUP                              👤 User     │
├─────────────────────────────────────────────────────┤
│ 🏠 Home                                              │
│ 🌍 Universe       ← MAIN NAVIGATION                 │
│ 📊 Views                                             │
│ 📋 Lists                                             │
│ 🔬 Enrichment                                        │
│ ⚙️  Admin                                            │
├─────────────────────────────────────────────────────┤
│                                                      │
│ WELCOME BACK, SARAH                                 │
│                                                      │
│ QUICK STATS                                         │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│ │  13,240 │ │    8    │ │   12    │               │
│ │Companies│ │  Lists  │ │  Jobs   │               │
│ └─────────┘ └─────────┘ └─────────┘               │
│                                                      │
│ RECENT ACTIVITY                                     │
│ • Sarah edited "Q1 Targets"        2 min ago       │
│ • AI profile completed for Acme    10 min ago      │
│ • New view: "High Growth SaaS"     1 hour ago      │
│                                                      │
│ NEEDS ATTENTION                                     │
│ ⚠️ 320 companies have stale data  [Review]          │
│ ❌ 3 jobs failed last night        [View Logs]      │
│                                                      │
│ SHORTCUTS                                           │
│ [Explore Universe] [My Lists] [Run Enrichment]     │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### A2: Universe (Main Screening)
```
┌─────────────────────────────────────────────────────┐
│ NIVO GROUP          [🔍 Search companies]  👤 User  │
├─────────────────────────────────────────────────────┤
│ Universe > All Companies                            │
├─────────────────────────────────────────────────────┤
│ [+ Add Filter ▼]  [Industry: Manufacturing ×]       │
│                   [Revenue > $5M ×]                 │
│                                                      │
│ Showing 210 of 13,000 companies                     │
│                                                      │
│ [💾 Save View] [📋 Create List] [Export] [⚙️ Cols]  │
├─────────────────────────────────────────────────────┤
│ ☑️ | Company           | Industry    | Rev   | ... │
├─────────────────────────────────────────────────────┤
│ ☐ | Acme Mfg          | Mfg         | 12.5M | ✓✓✓ │
│ ☐ | BrightCo          | Mfg         | 8.2M  | ✓⚠✗ │
│ ☐ | Cascade Inc       | Mfg         | 15.1M | ✓✓✓ │
│ ...                                                 │
│                                                      │
│ [1] 2 3 4 ... 15                                    │
└─────────────────────────────────────────────────────┘

Legend:
✓ = Has data    ⚠️ = Stale    ✗ = Missing
```

### A3: List Detail (Collaboration)
```
┌─────────────────────────────────────────────────────┐
│ NIVO GROUP                              👤 User     │
├─────────────────────────────────────────────────────┤
│ Lists > Q1 Manufacturing Targets                    │
├─────────────────────────────────────────────────────┤
│ 📋 Q1 Manufacturing Targets                         │
│ 50 companies • Created by Sarah • Team List         │
│                                                      │
│ [+ Add Companies] [Bulk Enrich] [Export] [Share]    │
├─────────────────────────────────────────────────────┤
│ Company         | Tags         | Notes        | ... │
├─────────────────────────────────────────────────────┤
│ Acme Mfg        | High Priority| Strong fins  | ... │
│ BrightCo        | Watch List   | Call CEO     | ... │
│ Cascade Inc     | High Priority| (add note)   | ... │
│ ...                                                 │
│                                                      │
│ ┌────────────────────────────────────┐             │
│ │ ACTIVITY LOG                       │             │
│ │ • Sarah tagged Acme as HP          │             │
│ │ • Mike added note to BrightCo      │             │
│ │ • Sarah added Cascade to list      │             │
│ └────────────────────────────────────┘             │
└─────────────────────────────────────────────────────┘
```

### A4: Enrichment Dashboard
```
┌─────────────────────────────────────────────────────┐
│ NIVO GROUP                              👤 User     │
├─────────────────────────────────────────────────────┤
│ Enrichment > Coverage Overview                      │
├─────────────────────────────────────────────────────┤
│ DATA COVERAGE                                       │
│                                                      │
│ ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│ │ AI Prof  │  │ 3Y Fins  │  │ Web Int  │          │
│ │   63%    │  │   74%    │  │   45%    │          │
│ │ 8.2k/13k │  │ 9.6k/13k │  │ 5.8k/13k │          │
│ └──────────┘  └──────────┘  └──────────┘          │
│   [Drill ▼]     [Drill ▼]     [Drill ▼]           │
│                                                      │
│ ⚠️ STALE ENRICHMENTS (>90 days)                     │
│ 320 companies                [Refresh All]          │
│                                                      │
│ ACTIVE JOBS                                         │
│ • AI Profile Batch #42    [████░░░░] 60%           │
│ • Financials Refresh      [✓ Complete]             │
│ • Web Intel Update        [❌ Failed - View Log]    │
│                                                      │
│ [+ New Job] [View History]                          │
└─────────────────────────────────────────────────────┘
```

### A5: Company Detail
```
┌─────────────────────────────────────────────────────┐
│ NIVO GROUP              [🔍 Search]       👤 User   │
├─────────────────────────────────────────────────────┤
│ Universe > Acme Manufacturing                       │
├─────────────────────────────────────────────────────┤
│ Acme Manufacturing Inc.                             │
│ Manufacturing • California • Coverage: 85% 🟢       │
│                                                      │
│ [Overview] [Financials] [Enrichment] [Activity]     │
├─────────────────────────────────────────────────────┤
│                                     ┌──────────────┐│
│ OVERVIEW                            │ QUICK ACTIONS││
│                                     │              ││
│ Revenue (2025): $12.5M              │ [+ To List]  ││
│ Growth: 18% YoY                     │ [Enrich]     ││
│ EBITDA Margin: 22%                  │ [Export]     ││
│ Employees: ~45                      │ [+ Note]     ││
│                                     │              ││
│ KEY METRICS (3Y)                    │ IN LISTS (2) ││
│ ┌────────────────────┐              │ • Q1 Targets ││
│ │ Rev: 8.2 → 12.5M   │              │ • Watch List ││
│ │ Growth: stable 15% │              │              ││
│ └────────────────────┘              └──────────────┘│
│                                                      │
│ TAGS: High Priority, Strong Financials              │
│                                                      │
│ NOTES:                                              │
│ • Strong financials - verify with CPA (Sarah)       │
│ • CEO open to conversation (Mike)                   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

**END OF PROPOSAL**

*This document is a living guide. Update as we learn from user feedback and usage patterns.*

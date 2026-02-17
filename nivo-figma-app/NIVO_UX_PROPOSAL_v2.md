# Nivo Group – UX & Information Architecture Proposal

**Version 2.0 (REVISED)** | Internal Investment Platform  
**Date:** February 16, 2026

---

## Executive Summary

This document proposes a stage-based, operator-grade UX for Nivo Group's internal investment platform. The design supports a **progressive filtering → AI analysis → outreach workflow** to help a 3-person team efficiently move from 13,000 companies to ~50 qualified call targets.

**Core Design Principles:**
- **Filter-first** – Sophisticated filtering with nested logic, include/exclude rules
- **AI as a first-class feature** – Prompt templates, stored insights, scoring
- **Stage-based workflow** – Clear progression from Universe → Research → AI → Prospects → Outreach
- **Persistent filters** – All lists remember their filters so you can modify and refine
- **Progress tracking** – Public "Prospects" list with call outcomes and status

---

## 1. The Real Workflow

```
UNIVERSE (13k companies with 4Y financials)
  ↓ [Apply complex filters]
  ↓
RESEARCH LIST (~100-200 companies)
  ↓ [Manual curation, edit filters, narrow further]
  ↓
REFINED LIST (~50-100 companies)
  ↓ [Send to AI with prompt templates]
  ↓
AI ANALYSIS COMPLETE
  ↓ [Review insights, scores, flags]
  ↓
PROSPECTS LIST (~50 companies) - PUBLIC
  ↓ [Track outreach: contacted, interested, passed]
  ↓
ACTIVE DEALS (~10-20 companies)
  ↓
CLOSED (acquired or passed)
```

**Key Insight:** Lists are **working states** in a progression, not just static snapshots. Each list:
- Remembers its filters (can reload and modify)
- Has a stage (Research, AI Analysis, Prospects, etc.)
- Can be private (early research) or public (qualified prospects)
- Tracks progress appropriate to its stage

---

## 2. Information Architecture

### 2.1 Revised Navigation

```
┌─────────────────────────────────────────────────────┐
│  NIVO GROUP            [🔍 Search]      👤 User     │
├─────────────────────────────────────────────────────┤
│                                                      │
│  🏠 Work Dashboard                                   │
│  🌍 Universe                                         │
│  📋 My Lists                                         │
│  🎯 Prospects (Team)                                 │
│  🤖 AI Lab                                           │
│  ⚙️  Admin                                           │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Simplified from v1:**
- **Work Dashboard** replaces generic "Home" - shows your lists by stage
- **Universe** is the main filtering/exploration screen
- **My Lists** - your private working lists (can share when ready)
- **Prospects** - the public/team list of qualified targets with outreach tracking
- **AI Lab** - prompt templates, run analysis, view results
- **Admin** - user management, prompt template editing

---

### 2.2 Screen Inventory

| Screen | Purpose | Key Features |
|--------|---------|--------------|
| **Work Dashboard** | See all lists by stage, recent activity, what needs attention | List cards by stage, quick actions, activity feed |
| **Universe** | Main filtering screen - build complex queries | Advanced filter builder, table view, save as list |
| **Company Detail** | Deep dive on one company | Financials (4Y), AI insights, notes, list memberships |
| **My Lists** | Manage private working lists | Create, edit, share, delete, reload filters |
| **List Detail** | Work on a specific list | Edit items, reload/modify filters, send to AI, promote to Prospects |
| **Prospects (Team)** | Shared list of qualified targets | Status tracking, call outcomes, notes, next actions |
| **AI Lab** | Manage prompts and run analysis | Template library, run analysis, view results, compare prompts |
| **Admin** | System management | Users, permissions, prompt templates |

---

## 3. Core Components & UX Patterns

### 3.1 Advanced Filter Builder (Critical)

**Design Goal:** Support nested logic with include/exclude rules

```
┌─────────────────────────────────────────────────────┐
│ FILTER BUILDER                                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│ INCLUDE ALL of the following:                       │
│                                                      │
│  ├─ Revenue > $5M                         [×]       │
│  ├─ Industry = Manufacturing              [×]       │
│  └─ ANY of:                              [+ Add OR] │
│      ├─ Revenue CAGR > 15%                [×]       │
│      └─ EBITDA Margin > 20%               [×]       │
│                                                      │
│ EXCLUDE ANY of the following:                       │
│                                                      │
│  ├─ Description contains "lawyer"         [×]       │
│  ├─ Owned by PE firm = Yes                [×]       │
│  └─ Part of larger group = Yes            [×]       │
│                                                      │
│ [+ Add Include Rule]  [+ Add Exclude Rule]          │
│                                                      │
│ Results: 210 companies                              │
│                                                      │
│ [Apply Filters]  [Save As List]  [Clear]            │
└─────────────────────────────────────────────────────┘
```

**Interaction Model:**

1. **Add Rule** → Select field type (Financial KPI, Company Info, AI Data, etc.)
2. **Choose operator** → For numbers: >, <, =, between; For text: contains, equals, starts with
3. **Enter value** → Inline input, applies on blur or Enter
4. **Group with OR** → Select multiple rules, group them
5. **Nested groups** → Unlimited nesting (but keep UI manageable with indentation)

**Available Filter Fields (Examples):**

**Financial KPIs (4Y historical):**
- Revenue, EBITDA, Gross Margin, Net Margin
- Revenue CAGR, EBITDA CAGR
- Growth rates (YoY, 2Y, 3Y)
- Ratios (debt/equity, current ratio, etc.)
- Custom calculated KPIs from backend

**Company Info:**
- Industry, geography, employee count
- Description (text search)
- Ownership structure (PE-backed, subsidiary, independent)
- Founded date, years in business

**AI Data (if exists):**
- AI quality score
- Has red flags = Yes/No
- Market positioning = Strong/Weak
- Risk level = High/Medium/Low

**Metadata:**
- In list = [List Name]
- Tagged with = [Tag]
- Has notes = Yes/No
- Last AI analysis date

---

### 3.2 Filter Persistence & Modification

**When creating a list from filters:**

```
┌─────────────────────────────────────────────────────┐
│ Save Filtered Results as List                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│ List Name: [Q1 Manufacturing Targets           ]    │
│                                                      │
│ Privacy:  ( ) Private  (•) Shareable                │
│                                                      │
│ ☑ Save filters with this list                       │
│   (You can reload and modify filters later)         │
│                                                      │
│ This list will contain 210 companies.               │
│                                                      │
│ [Cancel]  [Create List]                             │
└─────────────────────────────────────────────────────┘
```

**When opening a list created from filters:**

```
┌─────────────────────────────────────────────────────┐
│ Q1 Manufacturing Targets                            │
│ 210 companies • Created by Sarah • Shareable        │
├─────────────────────────────────────────────────────┤
│                                                      │
│ [📊 View Source Filters]  [🔄 Reload & Modify]      │
│                                                      │
│ ☐ | Company           | Industry    | Rev    | ... │
│ ☐ | Acme Mfg          | Mfg         | 12.5M  | ... │
│ ☐ | BrightCo          | Mfg         | 8.2M   | ... │
│ ...                                                 │
└─────────────────────────────────────────────────────┘
```

**Clicking "Reload & Modify":**
- Opens filter builder with original filters loaded
- Shows current results (may differ from when list was created)
- Option to "Update List" (replace companies) or "Save as New List"

**Use Case:**
1. Create list with filters → 210 companies
2. Week later, reload filters → Now shows 225 companies (new data added)
3. Tweak filters (add "EBITDA > $1M") → Now 180 companies
4. Update list → List now has 180 companies

---

### 3.3 AI Lab (First-Class Feature)

**Purpose:** Manage prompt templates, run AI analysis, view/compare results

```
┌─────────────────────────────────────────────────────┐
│ AI LAB                                              │
├─────────────────────────────────────────────────────┤
│                                                      │
│ [Prompt Templates] [Run Analysis] [Results]         │
│                                                      │
│ ── PROMPT TEMPLATES ──                              │
│                                                      │
│ ┌─────────────────────────────────────────────┐    │
│ │ 📋 Acquisition Red Flags                     │    │
│ │ Identify potential risks and deal-breakers   │    │
│ │ [Edit] [Duplicate] [Delete]                  │    │
│ └─────────────────────────────────────────────┘    │
│                                                      │
│ ┌─────────────────────────────────────────────┐    │
│ │ 📊 Market Positioning Analysis               │    │
│ │ Assess competitive position and moats        │    │
│ │ [Edit] [Duplicate] [Delete]                  │    │
│ └─────────────────────────────────────────────┘    │
│                                                      │
│ ┌─────────────────────────────────────────────┐    │
│ │ 🎯 Investment Score (0-100)                  │    │
│ │ Score based on strict ruleset                │    │
│ │ [Edit Rules] [Duplicate] [Delete]            │    │
│ └─────────────────────────────────────────────┘    │
│                                                      │
│ [+ New Prompt Template]                             │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

#### 3.3.1 Prompt Template Editor

```
┌─────────────────────────────────────────────────────┐
│ Edit Prompt Template                                │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Template Name:                                      │
│ [Acquisition Red Flags                         ]    │
│                                                      │
│ Description:                                        │
│ [Identify potential risks and deal-breakers    ]    │
│                                                      │
│ Data to Send:                                       │
│ ☑ Company description                               │
│ ☑ 4Y financial data (revenue, EBITDA, margins)      │
│ ☑ Growth rates                                      │
│ ☑ Ownership structure                               │
│ ☐ Previous AI analysis results                      │
│                                                      │
│ System Prompt:                                      │
│ ┌───────────────────────────────────────────────┐  │
│ │ You are an investment analyst. Analyze the    │  │
│ │ provided company data and identify any red    │  │
│ │ flags or concerns for acquisition:            │  │
│ │                                               │  │
│ │ - Financial anomalies (declining revenue,     │  │
│ │   margin compression, etc.)                   │  │
│ │ - Ownership risks (PE-backed, subsidiary)     │  │
│ │ - Market risks (declining industry, etc.)     │  │
│ │                                               │  │
│ │ Return structured JSON with:                  │  │
│ │ {                                             │  │
│ │   "red_flags": [...],                         │  │
│ │   "concerns": [...],                          │  │
│ │   "recommendation": "proceed|caution|pass"    │  │
│ │ }                                             │  │
│ └───────────────────────────────────────────────┘  │
│                                                      │
│ Expected Output Format:                             │
│ ( ) Structured JSON                                 │
│ (•) Free text                                       │
│ ( ) Score (0-100)                                   │
│                                                      │
│ Model: [gpt-4o ▼]                                   │
│                                                      │
│ [Test with Sample Company]  [Save]  [Cancel]        │
└─────────────────────────────────────────────────────┘
```

---

#### 3.3.2 Running AI Analysis

**From List Detail View:**

```
┌─────────────────────────────────────────────────────┐
│ Q1 Manufacturing Targets                            │
│ 210 companies                                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│ [+ Add Companies]  [🤖 Run AI Analysis]  [Export]   │
│                                                      │
│ 42 companies selected                               │
│                                                      │
│ ☑ | Company           | Industry    | Rev    | ... │
│ ...                                                 │
└─────────────────────────────────────────────────────┘
```

**Click "Run AI Analysis":**

```
┌─────────────────────────────────────────────────────┐
│ Run AI Analysis                                     │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Companies: 42 selected                              │
│                                                      │
│ Select Prompt Templates:                            │
│ ☑ Acquisition Red Flags                             │
│ ☑ Market Positioning Analysis                       │
│ ☑ Investment Score (0-100)                          │
│                                                      │
│ Estimated Cost: ~$8.40 (42 companies × 3 prompts)   │
│                                                      │
│ ⚠️ Results will be stored and attached to companies │
│                                                      │
│ [Cancel]  [Run Analysis]                            │
└─────────────────────────────────────────────────────┘
```

**During Analysis:**

```
┌─────────────────────────────────────────────────────┐
│ AI Analysis Running...                              │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Progress: 28 / 42 companies completed               │
│                                                      │
│ [████████████░░░░░░] 67%                            │
│                                                      │
│ Current: Analyzing BrightCo Industries              │
│ Templates: 3 per company                            │
│ Estimated time remaining: 2 minutes                 │
│                                                      │
│ ☑ Acme Manufacturing      (✓ All 3 complete)        │
│ ☑ BrightCo Industries     (⏳ In progress)          │
│ ☐ Cascade Inc             (⏱ Queued)                │
│ ...                                                 │
│                                                      │
│ [Cancel Analysis]                                   │
└─────────────────────────────────────────────────────┘
```

---

#### 3.3.3 Viewing AI Results

**On Company Detail Page:**

```
┌─────────────────────────────────────────────────────┐
│ Acme Manufacturing Inc.                             │
├─────────────────────────────────────────────────────┤
│ [Overview] [Financials] [AI Insights] [Activity]    │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ── AI INSIGHTS ──                                   │
│                                                      │
│ ┌─────────────────────────────────────────────┐    │
│ │ 🎯 Investment Score: 78/100           🟢    │    │
│ │ Run by Sarah • Feb 14, 2026                 │    │
│ │                                             │    │
│ │ Strong fundamentals, stable growth, clean   │    │
│ │ ownership. Minor concerns on market size.   │    │
│ │                                             │    │
│ │ [View Full Analysis]                        │    │
│ └─────────────────────────────────────────────┘    │
│                                                      │
│ ┌─────────────────────────────────────────────┐    │
│ │ 🚩 Acquisition Red Flags          ⚠️ Caution│    │
│ │ Run by Sarah • Feb 14, 2026                 │    │
│ │                                             │    │
│ │ • Declining margins last 2 years (-3%)      │    │
│ │ • High customer concentration (top 3 = 65%) │    │
│ │                                             │    │
│ │ Recommendation: Proceed with caution        │    │
│ │                                             │    │
│ │ [View Full Analysis]                        │    │
│ └─────────────────────────────────────────────┘    │
│                                                      │
│ ┌─────────────────────────────────────────────┐    │
│ │ 📊 Market Positioning Analysis      🟢 Pass │    │
│ │ Run by Mike • Feb 12, 2026                  │    │
│ │                                             │    │
│ │ Strong regional player with defensible moat.│    │
│ │ Limited competition in niche segment.       │    │
│ │                                             │    │
│ │ [View Full Analysis]                        │    │
│ └─────────────────────────────────────────────┘    │
│                                                      │
│ [🤖 Run New Analysis]                               │
│                                                      │
└────────────��────────────────────────────────────────┘
```

---

#### 3.3.4 AI Scoring System (Strict Ruleset)

**For scoring prompts, need clear rules:**

```
┌─────────────────────────────────────────────────────┐
│ Investment Score Ruleset                            │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Financial Health (40 points max)                    │
│  • Revenue CAGR > 15%:           +10 pts            │
│  • EBITDA Margin > 20%:          +10 pts            │
│  • Consistent growth (3Y):       +10 pts            │
│  • Debt/Equity < 0.5:            +10 pts            │
│                                                      │
│ Market Position (30 points max)                     │
│  • Niche leader:                 +15 pts            │
│  • Defensible moat:              +10 pts            │
│  • Low competition:              +5 pts             │
│                                                      │
│ Acquisition Fit (30 points max)                     │
│  • Independent ownership:        +15 pts            │
│  • Clean structure:              +10 pts            │
│  • No red flags:                 +5 pts             │
│                                                      │
│ PENALTIES (subtract from total)                     │
│  • PE-backed:                    -20 pts            │
│  • Subsidiary of large group:    -30 pts            │
│  • Declining revenue:            -15 pts            │
│  • Major red flags:              -25 pts            │
│                                                      │
│ [Edit Rules]  [Save]  [Test on Sample]              │
└─────────────────────────────────────────────────────┘
```

**AI receives these rules in the prompt and must return:**
```json
{
  "score": 78,
  "breakdown": {
    "financial_health": 35,
    "market_position": 25,
    "acquisition_fit": 30,
    "penalties": -12
  },
  "reasoning": "Strong fundamentals..."
}
```

---

### 3.4 Prospects List (Public/Team)

**Purpose:** Qualified targets ready for outreach, tracked by entire team

```
┌─────────────────────────────────────────────────────┐
│ 🎯 PROSPECTS (Team List)                            │
│ 47 companies • Public • All team members can edit   │
├─────────────────────────────────────────────────────┤
│                                                      │
│ [+ Add Company]  [Bulk Update Status]  [Export]     │
│                                                      │
│ Filter by Status: [All ▼] [New] [Contacted] [...]   │
│                                                      │
├─────────────────────────────────────────────────────┤
│ Company      | Status      | Owner | Last Contact  |│
├─────────────────────────────────────────────────────┤
│ Acme Mfg     | In Discussion| Sarah| Feb 14, 2026  |│
│              | 📞 Called CEO, interested in chat    |│
│              | Next: Send deck by Friday            |│
│              | [Edit Status] [Add Note]             |│
├─────────────────────────────────────────────────────┤
│ BrightCo     | Contacted   | Mike  | Feb 10, 2026  |│
│              | 📧 Email sent, no response yet       |│
│              | Next: Follow up next week            |│
│              | [Edit Status] [Add Note]             |│
├─────────────────────────────────────────────────────┤
│ Cascade Inc  | New         | -     | -             |│
│              | Just added to prospects              |│
│              | [Edit Status] [Assign]               |│
├─────────────────────────────────────────────────────┤
│ ...                                                 │
└─────────────────────────────────────────────────────┘
```

**Status Options:**
- **New** - Just added, not yet contacted
- **Researching** - Gathering more info before outreach
- **Contacted** - Initial outreach sent
- **In Discussion** - Active conversation
- **Meeting Scheduled** - Call/meeting set up
- **Interested** - Positive response, exploring further
- **Not Interested** - Declined or not a fit
- **Passed** - We decided not to pursue
- **Deal in Progress** - Term sheet / LOI stage

**Per-Company Tracking:**
- Status (dropdown)
- Owner (assigned team member)
- Last contact date (auto-updated when note added)
- Call outcomes (notes)
- Next actions (text field)
- Timeline/history (activity log)

---

### 3.5 Work Dashboard (Home)

**Purpose:** See all work in progress, organized by stage

```
┌─────────────────────────────────────────────────────┐
│ NIVO GROUP                              👤 Sarah    │
├─────────────────────────────────────────────────────┤
│ 🏠 Work Dashboard                                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│ QUICK STATS                                         │
│ 13,240 companies • 8 active lists • 47 prospects    │
│                                                      │
│ ── MY LISTS ──                                      │
│                                                      │
│ 🔍 RESEARCH (3 lists)                               │
│ ┌─────────────────────────────────────────────┐    │
│ │ Q1 Manufacturing Targets                    │    │
│ │ 210 companies • Last edited 2 hours ago     │    │
│ │ [Open List] [Run AI Analysis]               │    │
│ └─────────────────────────────────────────────┘    │
│                                                      │
│ ┌─────────────────────────────────────────────┐    │
│ │ SaaS Prospects                              │    │
│ │ 85 companies • Last edited yesterday        │    │
│ │ [Open List] [Run AI Analysis]               │    │
│ └─────────────────────────────────────────────┘    │
│                                                      │
│ 🤖 AI ANALYSIS IN PROGRESS (1 list)                 │
│ ┌─────────────────────────────────────────────┐    │
│ │ High Growth Tech                            │    │
│ │ 42 companies • Running... 67% complete      │    │
│ │ [View Progress]                             │    │
│ └─────────────────────────────────────────────┘    │
│                                                      │
│ ── TEAM ──                                          │
│                                                      │
│ 🎯 PROSPECTS (47 companies)                         │
│ • 12 New • 18 Contacted • 8 In Discussion           │
│ • 5 Interested • 4 Not Interested                   │
│ [View Prospects List]                               │
│                                                      │
│ ── RECENT ACTIVITY ──                               │
│ • Mike added note to "Acme Mfg" in Prospects        │
│ • AI analysis completed for "SaaS Prospects"        │
│ • Sarah created list "Q1 Manufacturing Targets"     │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Key Features:**
- Lists organized by stage (Research, AI Analysis, Prospects)
- Quick access to common actions (Open, Run AI, View Progress)
- Team section shows shared Prospects with status breakdown
- Activity feed shows what teammates are doing

---

### 3.6 Stage-Based Workflow (Complete Flow)

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│  1. UNIVERSE                                        │
│     └─ Apply complex filters                        │
│     └─ Save as "Research List" (private)            │
│                                                      │
│  2. RESEARCH LIST (My Lists)                        │
│     └─ 100-200 companies                            │
│     └─ Reload filters, modify, narrow               │
│     └─ Manual curation (remove obvious no-gos)      │
│     └─ Refine to ~50-100 companies                  │
│                                                      │
│  3. AI ANALYSIS                                     │
│     └─ Select prompt templates                      │
│     └─ Run analysis on all companies                │
│     └─ Review insights, scores, flags               │
│     └─ Narrow to ~50 strong candidates              │
│                                                      │
│  4. PROMOTE TO PROSPECTS                            │
│     └─ Move best companies to public Prospects list │
│     └─ Assign owners                                │
│     └─ Set status = "New"                           │
│                                                      │
│  5. OUTREACH (Prospects List)                       │
│     └─ Track calls, emails, meetings                │
│     └─ Update status (Contacted → In Discussion)    │
│     └─ Add notes and next actions                   │
│     └─ Move interested companies forward            │
│                                                      │
│  6. ACTIVE DEALS                                    │
│     └─ Status = "Deal in Progress"                  │
│     └─ (Future: Move to CRM or deal pipeline)       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 4. Key User Flows

### 4.1 Flow: Create Research List from Filters

```
1. User opens Universe
2. Clicks "Filter Builder"
3. Builds complex filter:
   - Include: Revenue > 5M AND Industry = Mfg
   - Exclude: PE-backed OR Subsidiary
4. Sees 210 results in table
5. Clicks "Save as List"
6. Names it "Q1 Manufacturing Targets"
7. Selects "Private" (not ready to share)
8. Checks "Save filters with list"
9. List created, appears in "My Lists" → Research stage
```

### 4.2 Flow: Modify Filters on Existing List

```
1. User opens "Q1 Manufacturing Targets" from My Lists
2. Clicks "Reload & Modify Filters"
3. Filter builder opens with original filters loaded
4. User adds: "EBITDA Margin > 15%"
5. Results update: 210 → 180 companies
6. User clicks "Update List"
7. Modal: "This will replace 210 companies with 180. Continue?"
8. User confirms
9. List updated to 180 companies
```

### 4.3 Flow: Run AI Analysis on List

```
1. User opens list (180 companies)
2. Clicks "Run AI Analysis"
3. Selects prompt templates:
   - ☑ Investment Score
   - ☑ Acquisition Red Flags
   - ☑ Market Positioning
4. Sees estimated cost: $36 (180 × 3 prompts)
5. Clicks "Run Analysis"
6. Analysis runs in background (2-5 minutes)
7. User receives notification when complete
8. Opens list, sees AI insights attached to each company
9. Sorts by Investment Score (highest first)
10. Reviews top 50 companies
```

### 4.4 Flow: Promote Companies to Prospects

```
1. User has list with AI analysis complete
2. Filters/sorts by Investment Score > 75
3. Reviews AI insights, removes any with major red flags
4. Selects 47 companies (checkboxes)
5. Clicks "Add to Prospects"
6. Modal: "Add 47 companies to team Prospects list?"
7. User confirms
8. Companies added to Prospects with Status = "New"
9. Team can now see and track them
```

### 4.5 Flow: Track Outreach in Prospects

```
1. User opens Prospects list (team view)
2. Filters Status = "New"
3. Assigns 10 companies to Sarah
4. Sarah calls first company (Acme Mfg)
5. After call, clicks "Edit Status"
6. Changes Status to "In Discussion"
7. Adds note: "Called CEO, interested in chat. Send deck by Friday."
8. Sets Next Action: "Follow up Friday"
9. Status updated, visible to whole team
10. Repeat for other companies
```

---

## 5. MVP Phasing Plan (Revised)

### Phase 1: Core Filtering & Lists (Weeks 1-3)

**Goal:** Support filter → list workflow with filter persistence

**Features:**
- ✅ Universe table (basic view of 13k companies)
- ✅ Advanced filter builder (nested logic, include/exclude, financial KPIs)
- ✅ Save filtered results as List (with filter persistence)
- ✅ My Lists view (private lists)
- ✅ List detail with reload/modify filters
- ✅ Company detail (basic overview + 4Y financials table)
- ✅ Work Dashboard (list cards by stage)
- ✅ Basic admin (user management)

**Success Criteria:**
- Users can build complex filters
- Users can save lists with filters
- Users can reload and modify filters later
- Filters feel fast and powerful

---

### Phase 2: AI Analysis Layer (Weeks 4-5)

**Goal:** Integrate AI analysis as first-class feature

**Features:**
- ✅ AI Lab (prompt template library)
- ✅ Prompt template editor (system prompt, data selection, output format)
- ✅ Run analysis on selected companies or whole list
- ✅ Progress tracking during analysis
- ✅ AI insights on company detail page
- ✅ Sort/filter by AI scores and flags
- ✅ Cost estimation before running analysis

**Success Criteria:**
- Users can create and manage prompt templates
- Users can run analysis on lists efficiently
- AI insights are stored and visible on company profiles
- Users can make decisions based on AI data

---

### Phase 3: Prospects & Outreach Tracking (Weeks 6-7)

**Goal:** Support outreach stage with status tracking

**Features:**
- ✅ Prospects team list (public by default)
- ✅ Status tracking (New, Contacted, In Discussion, etc.)
- ✅ Assign owner to companies
- ✅ Call outcome notes
- ✅ Next actions field
- ✅ Activity log per company
- ✅ Filter Prospects by status
- ✅ Export Prospects with status data

**Success Criteria:**
- Team can track outreach progress
- Everyone knows who's working on what
- Call outcomes are documented
- Easy to see what needs attention

---

### Phase 4: Polish & Advanced Features (Weeks 8-10)

**Goal:** Improve UX and add power features

**Features:**
- ✅ Comparison mode (select 2-5 companies, side-by-side view)
- ✅ Saved filter templates (reusable filter sets)
- ✅ Bulk operations (bulk status update, bulk AI analysis)
- ✅ Advanced sorting (multi-column sort)
- ✅ Custom column sets (save column preferences)
- ✅ Export options (PDF company report, Excel list export)
- ✅ Notifications (AI complete, teammate activity)
- ✅ Global search improvements

**Success Criteria:**
- Power users feel efficient
- Common tasks take fewer clicks
- Export/reporting works well

---

### Future Enhancements (Post-MVP)

**Stage Management:**
- 🔮 Formal stage progression (Research → AI → Prospects → Deals)
- 🔮 Stage-specific views and actions
- 🔮 Automatic stage transitions based on rules

**Deal Pipeline:**
- 🔮 Full CRM-like features (tasks, reminders, calendar integration)
- 🔮 Deal stages beyond Prospects (LOI, Due Diligence, Closed)
- 🔮 Document management (store NDA, term sheet, etc.)

**Intelligence:**
- 🔮 Auto-suggest companies based on what you've liked
- 🔮 Anomaly detection (flag unusual patterns)
- 🔮 Automated enrichment (trigger AI when company added to list)
- 🔮 Natural language queries ("Show me profitable SaaS companies in Texas")

**Integrations:**
- 🔮 Calendar (schedule calls from Prospects)
- 🔮 Email (send from Prospects, log in activity)
- 🔮 CRM export (push deals to HubSpot, Salesforce, etc.)

---

## 6. Technical Considerations

### 6.1 Filter Query Builder

**Backend Requirements:**
- Flexible query API that accepts nested AND/OR logic
- Support for financial calculations (CAGR, margins, ratios)
- Efficient indexing for common filter fields
- Query result caching (filter results shouldn't re-run on every page load)

**Example API Request:**
```json
{
  "filters": {
    "and": [
      { "field": "revenue_2025", "op": "gt", "value": 5000000 },
      { "field": "industry", "op": "eq", "value": "Manufacturing" },
      {
        "or": [
          { "field": "revenue_cagr_3y", "op": "gt", "value": 15 },
          { "field": "ebitda_margin", "op": "gt", "value": 20 }
        ]
      }
    ],
    "not": [
      { "field": "description", "op": "contains", "value": "lawyer" },
      { "field": "pe_backed", "op": "eq", "value": true },
      { "field": "is_subsidiary", "op": "eq", "value": true }
    ]
  }
}
```

---

### 6.2 AI Analysis Architecture

**Workflow:**
1. User selects companies + prompt templates
2. Frontend sends request to backend: `POST /api/ai/analyze`
3. Backend queues analysis jobs (1 job per company per template)
4. Backend calls OpenAI API with company data + prompt
5. Response stored in database linked to company
6. Frontend polls for progress or receives websocket updates
7. When complete, AI insights appear on company profiles

**Database Schema (simplified):**
```sql
ai_analyses (
  id, 
  company_id, 
  prompt_template_id,
  run_by_user_id,
  status (queued|running|complete|failed),
  prompt_text,
  company_data_sent (JSON),
  ai_response (JSON),
  created_at,
  completed_at
)

prompt_templates (
  id,
  name,
  description,
  system_prompt,
  data_fields (JSON array),
  output_format (json|text|score),
  created_by,
  is_shared (boolean)
)
```

---

### 6.3 Performance Optimization

**Universe Table:**
- Virtual scrolling for 13k rows (react-window or similar)
- Server-side pagination (load 100 at a time)
- Column virtualization if >20 columns
- Debounced filter application (300ms)

**AI Analysis:**
- Queue-based processing (don't hit OpenAI API 100 times simultaneously)
- Rate limiting (OpenAI has per-minute limits)
- Cost tracking (show estimated + actual costs)
- Retry logic for failed requests

**Real-time Updates:**
- WebSocket for AI progress updates
- Optimistic UI updates for notes/status changes
- Conflict resolution if two users edit same company

---

### 6.4 Data Persistence for Filters

**When user saves list with filters:**
```json
{
  "list_id": "abc123",
  "name": "Q1 Manufacturing Targets",
  "created_by": "user_sarah",
  "is_public": false,
  "filters": {
    "and": [...],
    "not": [...]
  },
  "companies_snapshot": [
    { "company_id": "comp_001", "added_at": "2026-02-14" },
    { "company_id": "comp_002", "added_at": "2026-02-14" },
    ...
  ]
}
```

**When user clicks "Reload & Modify":**
- Load `filters` from list
- Re-run query against current database
- Show results (may differ from `companies_snapshot`)
- User can modify filters, then "Update List" (replace snapshot)

---

## 7. UI/UX Design Guidelines

### 7.1 Design Principles

- **Dense but scannable** - More data visible, clear visual hierarchy
- **Keyboard-friendly** - Power users should rarely need mouse
- **Instant feedback** - Loading states, optimistic updates, clear errors
- **Contextual actions** - Show relevant actions based on what's selected
- **Forgiving** - Easy to undo, confirm destructive actions

### 7.2 Component Library

**Core Components:**
- **FilterBuilder** - Nested logic with AND/OR/NOT groups
- **DataTable** - High-performance, sortable, selectable, virtual scroll
- **CompanyCard** - Compact view with key metrics and actions
- **StatusBadge** - Color-coded status indicators
- **AIInsightCard** - Collapsible card showing AI results
- **ProgressIndicator** - For AI analysis jobs
- **ModalDialog** - For confirmations, forms
- **InlineEdit** - Edit notes/status directly in table
- **ActivityFeed** - Timeline of actions

### 7.3 Color System

**Functional Colors:**
- **Blue** - Primary actions, links
- **Green** - Success, high score, positive
- **Yellow/Orange** - Warning, needs attention
- **Red** - Error, red flag, negative
- **Gray** - Neutral, disabled

**Status Colors (Prospects):**
- **New** - Light blue
- **Contacted** - Yellow
- **In Discussion** - Orange
- **Interested** - Green
- **Not Interested** - Gray
- **Passed** - Red
- **Deal in Progress** - Purple

### 7.4 Typography

- **Headings:** 24px / 20px / 16px (semibold)
- **Body:** 14px (regular)
- **Small/Meta:** 12px (regular)
- **Monospace:** Financial data, IDs, codes

---

## 8. Success Metrics

### 8.1 Efficiency Metrics

- **Time to create qualified list:** Universe → 50 targets in <30 minutes
- **Filter modification speed:** Reload/modify filters in <10 seconds
- **AI analysis throughput:** 100 companies analyzed in <5 minutes
- **Prospects update frequency:** Status updated within 1 day of contact

### 8.2 Quality Metrics

- **AI cost efficiency:** Cost per qualified target <$2
- **List conversion rate:** % of research lists → prospects >30%
- **Outreach success rate:** % contacts → interested >15%

### 8.3 Adoption Metrics

- **Daily active users:** All 3 team members using daily
- **Lists created per week:** >5 new research lists
- **AI analyses run per week:** >3 analysis runs
- **Prospects pipeline:** Maintain 40-60 active prospects

---

## 9. Open Questions & Decisions Needed

### 9.1 AI Scoring Rules

**Question:** How strict should the Investment Score ruleset be?

**Options:**
- **Option A:** Very strict (exact point values, AI must follow precisely)
  - Pros: Consistent, comparable across companies
  - Cons: Less flexible, may miss nuance
  
- **Option B:** Guidelines only (AI has discretion within ranges)
  - Pros: More nuanced, AI can consider context
  - Cons: Less consistent, harder to compare

**Recommendation:** Start with strict rules (Option A), refine based on results

---

### 9.2 List Privacy Model

**Question:** How should list sharing work?

**Current Proposal:**
- Lists start **private** by default
- Creator can make **shareable** (team can view)
- Only **Prospects** is always public (team can edit)

**Alternative:**
- All lists visible to team (full transparency)
- But only creator can edit (unless shared explicitly)

**Recommendation:** Stick with private by default, explicit sharing

---

### 9.3 Filter Template Library

**Question:** Should we ship with pre-built filter templates?

**Examples:**
- "High-Growth Manufacturing" (Revenue CAGR >15%, Industry = Mfg)
- "Profitable SaaS" (EBITDA Margin >25%, Industry = Software)
- "Acquisition-Ready" (Independent, >$5M rev, clean structure)

**Recommendation:** Yes, ship with 5-7 starter templates

---

### 9.4 Export Formats

**Question:** What export formats are needed?

**Options:**
- **Excel:** Full list with all data columns
- **PDF:** Formatted company report (one-pager per company)
- **CSV:** Raw data for further analysis
- **Slide Deck:** Overview of shortlist for presentations

**Recommendation:** Start with Excel + CSV, add PDF report in Phase 4

---

## 10. Implementation Priorities

### Must Have (Phase 1-2)

1. ✅ Advanced filter builder with nested logic
2. ✅ Filter persistence on lists
3. ✅ Reload & modify filters
4. ✅ AI Lab with prompt templates
5. ✅ Run AI analysis on lists
6. ✅ AI insights on company profiles
7. ✅ Work Dashboard organized by stage

### Should Have (Phase 3)

8. ✅ Prospects list with status tracking
9. ✅ Activity log per company
10. ✅ Basic export (Excel/CSV)
11. ✅ Cost tracking for AI analysis

### Nice to Have (Phase 4)

12. ✅ Comparison mode (side-by-side)
13. ✅ Saved filter templates
14. ✅ Bulk operations
15. ✅ PDF company reports

---

## 11. Final Recommendations

### 11.1 Critical Success Factors

1. **Nail the filter builder** - This is the foundation. If filtering is clunky, everything fails.
2. **Make AI analysis feel magical** - Fast, reliable, actionable results.
3. **Keep stages clear** - Users should always know where a list is in the workflow.
4. **Prospects tracking must be bulletproof** - This is where deals happen.

### 11.2 What to Build First (Week 1)

**Absolute MVP:**
1. Universe table (read-only, all 13k companies visible)
2. Basic filter builder (2-3 filter types: Revenue, Industry, EBITDA)
3. Save filtered results as list
4. List detail view (table of companies)
5. Company detail (overview + financials)

**This proves the core loop:** Filter → Save → Review

---

### 11.3 What to Avoid

- ❌ **Don't build full CRM features yet** - Focus on screening, not deal management
- ❌ **Don't over-engineer AI** - Start with simple prompts, iterate based on results
- ❌ **Don't add integrations early** - Get core workflow solid first
- ❌ **Don't make filtering too abstract** - Keep UI concrete, show examples

---

### 11.4 Next Steps

1. **Review & align** - Discuss this proposal with team, get buy-in
2. **Design mockups** - Focus on filter builder, AI Lab, Prospects list
3. **Set up backend** - API endpoints for filters, lists, AI analysis
4. **Build Phase 1** - Universe + filters + lists (3 weeks)
5. **User test** - Use with real data, gather feedback
6. **Build Phase 2** - AI analysis layer (2 weeks)
7. **Build Phase 3** - Prospects tracking (2 weeks)
8. **Polish & launch** - Final refinements, train team

---

## Appendix: Detailed Wireframes

### A1: Universe with Filter Builder

```
┌──────────────────────────────────────────────────────────────┐
│ NIVO GROUP              [🔍 Search]            👤 Sarah      │
├──────────────────────────────────────────────────────────────┤
│ 🌍 Universe                                                   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ [📊 Filter Builder ▼]  [Clear All]                           │
│                                                               │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ INCLUDE ALL of the following:                          │  │
│ │                                                         │  │
│ │  ├─ Revenue > $5M                              [×]     │  │
│ │  ├─ Industry = Manufacturing                   [×]     │  │
│ │  └─ ANY of:                          [+ Add OR]        │  │
│ │      ├─ Revenue CAGR > 15%                     [×]     │  │
│ │      └─ EBITDA Margin > 20%                    [×]     │  │
│ │                                                         │  │
│ │ EXCLUDE ANY of the following:                          │  │
│ │                                                         │  │
│ │  ├─ Description contains "lawyer"              [×]     │  │
│ │  ├─ PE Backed = Yes                            [×]     │  │
│ │  └─ Is Subsidiary = Yes                        [×]     │  │
│ │                                                         │  │
│ │ [+ Add Include Rule]  [+ Add Exclude Rule]             │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                               │
│ Results: 210 companies                                        │
│                                                               │
│ [💾 Save as List]  [📥 Export]  [⚙️ Columns]                  │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│ ☐ | Company Name         | Industry    | Rev (M) | CAGR | ..│
├──────────────────────────────────────────────────────────────┤
│ ☐ | Acme Manufacturing   | Mfg         | 12.5    | 18%  | ..│
│ ☐ | BrightCo Industries  | Mfg         | 8.2     | 22%  | ..│
│ ☐ | Cascade Inc          | Mfg         | 15.1    | 12%  | ..│
│ ☐ | ...                                                       │
│                                                               │
│ Showing 1-50 of 210    [1] 2 3 4 5                           │
└──────────────────────────────────────────────────────────────┘
```

---

### A2: List Detail with Reload Filters

```
┌──────────────────────────────────────────────────────────────┐
│ NIVO GROUP                                      👤 Sarah     │
├──────────────────────────────────────────────────────────────┤
│ My Lists > Q1 Manufacturing Targets                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ 📋 Q1 Manufacturing Targets                                  │
│ 210 companies • Created by Sarah • Private • Feb 14, 2026    │
│                                                               │
│ Created from filters:                                        │
│ • Revenue > $5M, Industry = Mfg, (Rev CAGR >15% OR EBITDA..  │
│ [📊 View Full Filters]  [🔄 Reload & Modify]                 │
│                                                               │
│ [+ Add Companies]  [🤖 Run AI Analysis]  [📥 Export]         │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│ ☐ | Company Name         | Industry    | Rev (M) | AI Score │
├──────────────────────────────────────────────────────────────┤
│ ☐ | Acme Manufacturing   | Mfg         | 12.5    | 78      │
│ ☐ | BrightCo Industries  | Mfg         | 8.2     | -       │
│ ☐ | Cascade Inc          | Mfg         | 15.1    | 82      │
│ ...                                                           │
│                                                               │
│ Showing 1-50 of 210    [1] 2 3 4 5                           │
│                                                               │
│ ┌────────────────────────────────────────┐                  │
│ │ RECENT ACTIVITY                        │                  │
│ │ • Sarah ran AI analysis on 42 comp.    │                  │
│ │ • Sarah added Cascade Inc to list      │                  │
│ │ • Sarah created list                   │                  │
│ └────────────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────┘
```

---

### A3: AI Lab - Prompt Templates

```
┌──────────────────────────────────────────────────────────────┐
│ NIVO GROUP                                      👤 Sarah     │
├──────────────────────────────────────────────────────────────┤
│ 🤖 AI Lab                                                     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ [Prompt Templates] [Analysis History]                        │
│                                                               │
│ ── PROMPT TEMPLATES ──                                       │
│                                                               │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ 🎯 Investment Score (0-100)                          │    │
│ │ Score companies based on strict ruleset              │    │
│ │ Last used: Feb 14, 2026 • Used 42 times              │    │
│ │                                                       │    │
│ │ [Run on List] [Edit Template] [View Rules]           │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                               │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ 🚩 Acquisition Red Flags                             │    │
│ │ Identify potential risks and deal-breakers           │    │
│ │ Last used: Feb 14, 2026 • Used 42 times              │    │
│ │                                                       │    │
│ │ [Run on List] [Edit Template] [Duplicate]            │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                               │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ 📊 Market Positioning Analysis                       │    │
│ │ Assess competitive position and moats                │    │
│ │ Last used: Feb 12, 2026 • Used 18 times              │    │
│ │                                                       │    │
│ │ [Run on List] [Edit Template] [Duplicate]            │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                               │
│ [+ New Prompt Template]                                      │
│                                                               │
│ ── ANALYSIS HISTORY ──                                       │
│                                                               │
│ • Q1 Manufacturing Targets (42 companies) - Complete         │
│   3 prompts • Cost: $8.40 • Feb 14, 2026                     │
│                                                               │
│ • SaaS Prospects (18 companies) - Complete                   │
│   2 prompts • Cost: $3.60 • Feb 12, 2026                     │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

### A4: Company Detail with AI Insights

```
┌──────────────────────────────────────────────────────────────┐
│ NIVO GROUP                                      👤 Sarah     │
├──────────────────────────────────────────────────────────────┤
│ Universe > Acme Manufacturing Inc.                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ Acme Manufacturing Inc.                                      │
│ Manufacturing • California • 45 employees                    │
│                                                               │
│ [Overview] [Financials] [AI Insights] [Activity]             │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│                                             ┌───────────────┐│
│ ── AI INSIGHTS ──                           │ QUICK ACTIONS ││
│                                             │               ││
│ ┌────────────────────────────────────┐     │ [+ To List]   ││
│ │ 🎯 Investment Score: 78/100   🟢   │     │ [🤖 Analyze]  ││
│ │ Run by Sarah • Feb 14, 2026        │     │ [📄 Export]   ││
│ │                                    │     │ [+ Note]      ││
│ │ Strong fundamentals with stable    │     │               ││
│ │ growth. Minor concerns on market   │     │ IN LISTS (2)  ││
│ │ size and customer concentration.   │     │ • Q1 Targets  ││
│ │                                    │     │ • Watch List  ││
│ │ Breakdown:                         │     │               ││
│ │ • Financial Health: 35/40          │     └───────────────┘│
│ │ • Market Position: 25/30           │                      │
│ │ • Acquisition Fit: 30/30           │                      │
│ │ • Penalties: -12                   │                      │
│ │                                    │                      │
│ │ [View Full Analysis]               │                      │
│ └────────────────────────────────────┘                      │
│                                                               │
│ ┌────────────────────────────────────┐                      │
│ │ 🚩 Acquisition Red Flags  ⚠️ Caution│                      │
│ │ Run by Sarah • Feb 14, 2026        │                      │
│ │                                    │                      │
│ │ Identified concerns:               │                      │
│ │ • Declining EBITDA margin (-3% 2Y) │                      │
│ │ • High customer concentration      │                      │
│ │   (top 3 customers = 65% revenue)  │                      │
│ │                                    │                      │
│ │ Recommendation: Proceed with       │                      │
│ │ caution. Verify customer contracts.│                      │
│ │                                    │                      │
│ │ [View Full Analysis]               │                      │
│ └────────────────────────────────────┘                      │
│                                                               │
│ ┌────────────────────────────────────┐                      │
│ │ 📊 Market Positioning      🟢 Pass │                      │
│ │ Run by Mike • Feb 12, 2026         │                      │
│ │                                    │                      │
│ │ Strong regional player with        │                      │
│ │ defensible moat. Limited comp.     │                      │
│ │                                    │                      │
│ │ [View Full Analysis]               │                      │
│ └────────────────────────────────────┘                      │
│                                                               │
│ [🤖 Run New Analysis]                                        │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

### A5: Prospects List (Outreach Tracking)

```
┌──────────────────────────────────────────────────────────────┐
│ NIVO GROUP                                      👤 Sarah     │
├──────────────────────────────────────────────────────────────┤
│ 🎯 PROSPECTS (Team List)                                     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ 47 companies • Public • All team members can edit            │
│                                                               │
│ [+ Add Company]  [Bulk Update]  [📥 Export]  [📊 Analytics]  │
│                                                               │
│ Filter by: [All ▼] [New] [Contacted] [In Discussion] [...]   │
│ Owner: [All ▼] [Sarah] [Mike] [Alex]                         │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ Acme Manufacturing                                           │
│ Status: In Discussion 🟠 | Owner: Sarah | Updated: 1 day ago │
│                                                               │
│ Latest Note (Sarah):                                         │
│ 📞 Called CEO yesterday - interested in exploratory chat.    │
│ Sending overview deck by Friday. Schedule follow-up call     │
│ for next Tuesday.                                            │
│                                                               │
│ Next Action: Send deck by Friday                             │
│                                                               │
│ [Edit Status] [Add Note] [View Full Profile]                 │
│ ─────────────────────────────────────────────────────────────│
│                                                               │
│ BrightCo Industries                                          │
│ Status: Contacted 🟡 | Owner: Mike | Updated: 3 days ago     │
│                                                               │
│ Latest Note (Mike):                                          │
│ 📧 Sent intro email on Monday, no response yet. Will follow  │
│ up early next week if no reply.                              │
│                                                               │
│ Next Action: Follow up on Tuesday                            │
│                                                               │
│ [Edit Status] [Add Note] [View Full Profile]                 │
│ ─────────────────────────────────────────────────────────────│
│                                                               │
│ Cascade Inc                                                  │
│ Status: New 🔵 | Owner: Not assigned | Updated: Today        │
│                                                               │
│ Just added to prospects. No activity yet.                    │
│                                                               │
│ [Assign to Me] [Edit Status] [Add Note]                      │
│ ─────────────────────────────────────────────────────────────│
│                                                               │
│ ...                                                           │
│                                                               │
│ Showing 1-10 of 47    [1] 2 3 4 5                            │
└──────────────────────────────────────────────────────────────┘
```

---

### A6: Work Dashboard (Home)

```
┌──────────────────────────────────────────────────────────────┐
│ NIVO GROUP                                      👤 Sarah     │
├──────────────────────────────────────────────────────────────┤
│ 🏠 Work Dashboard                                             │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ WELCOME BACK, SARAH                                          │
│                                                               │
│ Quick Stats:                                                 │
│ 13,240 companies • 8 active lists • 47 prospects             │
│                                                               │
│ ── MY LISTS ──                                               │
│                                                               │
│ 🔍 RESEARCH (3 lists)                                        │
│                                                               │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ Q1 Manufacturing Targets                             │    │
│ │ 210 companies • Last edited 2 hours ago              │    │
│ │ Created from filters • Ready for AI analysis         │    │
│ │                                                       │    │
│ │ [Open List] [Run AI Analysis]                        │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                               │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ SaaS Prospects                                       │    │
│ │ 85 companies • Last edited yesterday                 │    │
│ │ Created from filters • Not yet analyzed              │    │
│ │                                                       │    │
│ │ [Open List] [Run AI Analysis]                        │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                               │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ High Growth Tech                                     │    │
│ │ 42 companies • Created last week                     │    │
│ │ AI analysis complete • Review insights               │    │
│ │                                                       │    │
│ │ [Open List] [View AI Results]                        │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                               │
│ 🤖 AI ANALYSIS (1 in progress)                               │
│                                                               │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ Tech Scale-ups - RUNNING                             │    │
│ │ 28 / 35 companies complete (80%)                     │    │
│ │ Estimated time: 2 minutes remaining                  │    │
│ │                                                       │    │
│ │ [View Progress]                                      │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                               │
│ ── TEAM ──                                                   │
│                                                               │
│ 🎯 PROSPECTS (47 companies)                                  │
│ • 12 New • 18 Contacted • 8 In Discussion                    │
│ • 5 Interested • 4 Not Interested                            │
│                                                               │
│ Your assignments (10 companies):                             │
│ • 2 need follow-up today                                     │
│ • 3 awaiting response                                        │
│                                                               │
│ [View Prospects List]  [View My Assignments]                 │
│                                                               │
│ ── RECENT ACTIVITY ──                                        │
│ • Mike added note to "Acme Mfg" in Prospects - 1 hour ago    │
│ • AI analysis completed for "Q1 Targets" - 2 hours ago       │
│ • Sarah created list "SaaS Prospects" - Yesterday            │
│ • Alex updated status for "BrightCo" → Contacted - Yesterday │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

**END OF PROPOSAL v2.0**

*This document reflects the revised understanding of Nivo Group's workflow and requirements. It emphasizes filter persistence, AI analysis as a first-class feature, and stage-based progression from Universe → Research → AI → Prospects → Outreach.*

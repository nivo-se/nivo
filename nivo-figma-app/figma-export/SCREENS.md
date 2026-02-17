# Screen Specifications

## Screen 1: Dashboard (Work Dashboard)

**Route:** `/` (home)

**Figma Reference:** Main dashboard showing work overview

**Layout:**
- Full-width page with sidebar
- Centered content: max-w-5xl, px-8, py-8
- Background: gray-50

**Header:**
- Page title: "Dashboard" (text-2xl, font-semibold, mb-2)
- Subtitle: "Here's what's happening with your investment pipeline" (text-sm, gray-600)

**Content Sections:**

### 1. Quick Stats (3-column grid, gap-6, mb-8)
Three stat cards showing:
- **Total Companies**: Count of universe (2xl number, sm label "Total Companies")
- **Active Lists**: Count of working lists (2xl number, sm label "Active Lists")
- **Prospects**: Count in pipeline (2xl number, sm label "Prospects")

Each card:
- White background, border-gray-200, rounded-lg
- Padding: 24px
- Hover: subtle shadow

### 2. My Lists Section (mb-8)
- Section header: "My Lists" (text-base, font-medium, mb-4)
- "View All" link (text-sm, gray-600, right-aligned)

**Research Lists Subsection:**
- Subsection label: "RESEARCH" (text-sm, font-medium, gray-600, mb-3, uppercase)
- List items (space-y-3):
  - White card, border, rounded-lg, p-5
  - List name (text-sm, font-medium, gray-900)
  - Metadata: "X companies • Last edited Y ago" (text-sm, gray-600)
  - View button (outline, h-8, text-sm)
  - Hover: border-gray-300

**AI Analysis Lists Subsection:**
- Subsection label: "AI ANALYSIS" (text-sm, font-medium, gray-600, mb-3, uppercase)
- Similar card structure
- Status text: "Running analysis..." (text-sm, gray-600)
- Button: "View Progress" (outline, h-8, text-sm)

### 3. Team Prospects Section
- Section header: "Team Prospects" (text-base, font-medium, mb-4)
- "View All" link (text-sm, gray-600, right-aligned)
- White card container (border, rounded-lg, p-6):
  - Title: "X Companies in Pipeline" (text-sm, font-medium, mb-6)
  - 5-column grid (gap-6):
    - Each column: large number (text-2xl, font-semibold) + label below (text-sm, gray-600, mt-2)
    - Columns: New | Contacted | In Discussion | Interested | Not Interested

**Interactions:**
- Click stat card → (no action, display only)
- Click "View All" (Lists) → Navigate to /lists
- Click "View" on list → Navigate to /lists/:id
- Click "View All" (Prospects) → Navigate to /prospects

**Responsive:**
- Desktop (>1024px): 3-column stats, 5-column prospects
- Tablet (768-1023px): 2-column stats, 3-column prospects
- Mobile (<768px): 1-column stats, 2-column prospects

**Empty States:**
- No lists: Show placeholder text "No lists yet"
- No prospects: Show "0" in all status columns

---

## Screen 2: Universe (Browse & Filter)

**Route:** `/universe`

**Figma Reference:** Company browsing and filtering interface

**Layout:**
- Centered content: max-w-5xl, px-8, py-8
- Background: gray-50

**Header:**
- Page title: "Universe" (text-2xl, font-semibold, mb-2)
- Subtitle: "13,421 companies • Filter to create working lists" (text-sm, gray-600)

**Filter Section (mb-6):**
- FilterBuilder component (expandable panel)
- White background, border, rounded-lg, p-6
- Default: collapsed, showing "Add filters..."
- Expanded: Shows filter rows with:
  - AND/OR group selector (toggle button)
  - Field dropdown (select metric)
  - Operator dropdown (>, <, =, etc.)
  - Value input
  - Include/Exclude toggle
  - Add/Remove row buttons

**Results Section:**
- Result count: "Showing X of 13,421 companies" (text-sm, gray-600, mb-4)
- Action bar (flex, justify-between, mb-4):
  - Left: Search input (w-64, placeholder "Search by name...")
  - Right: "Create List from Results" button (primary, h-9)

**Company Grid:**
- Cards grid (gap-4)
- Each company card (white, border, rounded-lg, p-4):
  - Company name (text-sm, font-medium, mb-1)
  - Industry & location (text-xs, gray-600, mb-3)
  - Metrics row (flex, gap-4, text-xs):
    - Revenue: "$X.XM" (gray-700)
    - EBITDA: "$X.XM" (gray-700)
    - Employees: "X" (gray-700)
  - Growth badge (if positive): "+X%" (green bg)
  - Checkbox (top-right corner, for multi-select)
  - Hover: border-blue-300, shadow

**Interactions:**
- Click company card → Navigate to /companies/:id
- Check checkbox → Add to selection
- Click "Create List from Results" → Open modal:
  - Input: List name
  - Select: Scope (private/team)
  - Select: Stage (research/analysis)
  - Buttons: Cancel | Create (primary)
- Apply filters → Update results in real-time
- Search input → Filter by company name (debounced)

**Responsive:**
- Desktop: 3-column grid
- Tablet: 2-column grid
- Mobile: 1-column list

**Empty States:**
- No filters applied: Show all companies
- Filters produce 0 results: "No companies match your filters. Try adjusting criteria."
- Loading: Skeleton cards with pulse animation

---

## Screen 3: Company Detail

**Route:** `/companies/:id`

**Figma Reference:** Single company deep-dive page

**Layout:**
- Centered content: max-w-5xl, px-8, py-8
- Background: gray-50

**Header:**
- Back button: "← Universe" (text-sm, gray-600, mb-4)
- Company name (text-2xl, font-semibold, mb-1)
- Industry | Location | Website link (text-sm, gray-600, flex gap-4)

**AI Insights Section (if available, mb-8):**
- Blue-tinted card (bg-blue-50, border-blue-200, p-6, rounded-lg)
- Icon: Brain (blue, w-5 h-5)
- Title: "AI Insights" (text-base, font-medium, mb-3)
- Insight text (text-sm, gray-700, line-height relaxed)
- Link: "View full analysis →" (text-sm, blue-600)

**Quick Stats Section (mb-8):**
- 4-column grid (gap-6)
- Each stat card (white, border, p-5, rounded-lg):
  - Label above (text-sm, gray-600, mb-2)
  - Value below (text-2xl, font-semibold)
  - Stats: Revenue | EBITDA | Employees | Founded

**Financials Section (mb-8):**
- Section header: "Financials" (text-base, font-medium, mb-4)
- White card (border, rounded-lg, p-6)
- Table with 4 years of data:
  - Columns: Metric | 2023 | 2022 | 2021 | 2020
  - Rows: Revenue, EBITDA, Gross Margin, Employee Count
  - Numbers right-aligned, currency formatted
  - Headers: text-sm, font-medium, gray-700
  - Cells: text-sm, gray-900

**Growth Metrics Section (mb-8):**
- Section header: "Growth" (text-base, font-medium, mb-4)
- White card (border, rounded-lg, p-6)
- 3-column grid:
  - Revenue Growth YoY: "+X%" (green if positive, red if negative)
  - EBITDA Growth YoY: "+X%"
  - Employee Growth YoY: "+X%"

**Actions Section:**
- Fixed bottom bar OR floating action button
- Buttons (gap-3):
  - "Add to List" (outline, h-9)
  - "Create Prospect" (primary, h-9)
  - "Run AI Analysis" (outline, h-9, with Brain icon)

**Interactions:**
- Click "← Universe" → Navigate back to /universe
- Click website link → Open in new tab
- Click "View full analysis" → Navigate to AI run results
- Click "Add to List" → Open modal:
  - Select existing list (dropdown)
  - Buttons: Cancel | Add
- Click "Create Prospect" → Add to prospects pipeline, show toast "Added to prospects"
- Click "Run AI Analysis" → Navigate to /ai-lab/create-run with pre-selected company

**Responsive:**
- Desktop: 4-column stats, table horizontal scroll if needed
- Tablet: 2-column stats
- Mobile: 1-column stats, table horizontal scroll

**Empty States:**
- No AI insights: Don't show AI Insights section
- Missing financial data: Show "Data not available" in cells

---

## Screen 4: My Lists

**Route:** `/lists`

**Figma Reference:** List management page

**Layout:**
- Centered content: max-w-5xl, px-8, py-8
- Background: gray-50

**Header:**
- Page title: "My Lists" (text-2xl, font-semibold, mb-2)
- Subtitle: "Manage your saved company lists" (text-sm, gray-600)

**Content Sections:**

### 1. Private Lists Section (mb-8)
- Section header: "Private Lists" (text-base, font-medium, mb-4)
- List items (grid, gap-3):
  - Each list card (white, border, rounded-lg, p-5):
    - List name (text-sm, font-medium, mb-2)
    - Metadata: "X companies • Stage: Y • Last edited Z" (text-sm, gray-600)
    - Buttons row (flex, gap-2, justify-end):
      - "View" (outline, h-8, text-sm)
      - Delete icon button (ghost, red on hover)
    - Hover: border-gray-300

**Empty state (if no private lists):**
- White card (border, p-8, text-center)
- Text: "No private lists yet" (text-sm, gray-500)
- Button: "Create Your First List" (primary, h-9, mt-4)
- Click → Navigate to /universe

### 2. Shareable Lists Section
- Section header: "Shareable Lists" (text-base, font-medium, mb-4)
- Similar card structure as private lists
- Badge showing "Team" (blue) next to list name

**Empty state (if no shared lists):**
- White card (border, p-8, text-center)
- Text: "No shared lists yet" (text-sm, gray-500)

**Interactions:**
- Click "View" → Navigate to /lists/:id
- Click delete icon → Show confirmation dialog:
  - Title: "Delete list?"
  - Text: "This will remove the list. Companies won't be affected."
  - Buttons: Cancel | Delete (destructive)
- Click "Create Your First List" → Navigate to /universe

**Responsive:**
- Desktop: Full width cards
- Tablet: Same
- Mobile: Stack buttons vertically

---

## Screen 5: List Detail

**Route:** `/lists/:id`

**Figma Reference:** Single list view with companies

**Layout:**
- Centered content: max-w-5xl, px-8, py-8
- Background: gray-50

**Header:**
- Back button: "← My Lists" (text-sm, gray-600, mb-4)
- List name (text-2xl, font-semibold, mb-1, editable on click)
- Metadata row (flex, gap-4, text-sm, gray-600):
  - "X companies"
  - Stage badge (blue)
  - Scope: "Private" or "Team"
  - "Last edited Y ago"

**Actions Bar (mb-6):**
- Flex row, justify-between
- Left:
  - Search input (w-64, placeholder "Search companies...")
- Right:
  - "Export" button (outline, h-9, Download icon)
  - "Run AI Analysis" button (primary, h-9, Brain icon)

**Companies Section:**
- Table view (white card, border, rounded-lg):
  - Headers: Company | Industry | Revenue | EBITDA | Employees | Growth | Actions
  - Rows (hover: bg-gray-50):
    - Company name (font-medium, clickable)
    - Industry (text-sm, gray-600)
    - Revenue (text-sm, right-aligned)
    - EBITDA (text-sm, right-aligned)
    - Employees (text-sm, right-aligned)
    - Growth badge (+X%, green or red)
    - Actions: Remove icon (trash, hover only)

**Interactions:**
- Click back button → Navigate to /lists
- Click list name → Enter edit mode (input field)
- Type in search → Filter companies in list
- Click "Export" → Download CSV (show toast)
- Click "Run AI Analysis" → Navigate to /ai-lab/create-run with list pre-selected
- Click company name → Navigate to /companies/:id
- Click remove icon → Remove company from list (confirm with toast)

**Responsive:**
- Desktop: Full table
- Tablet: Horizontal scroll
- Mobile: Vertical card layout (not table)

**Empty States:**
- No companies in list: "This list is empty. Go to Universe to add companies."
- Search produces 0 results: "No companies match your search."

---

## Screen 6: Prospects

**Route:** `/prospects`

**Figma Reference:** Pipeline management page

**Layout:**
- Centered content: max-w-5xl, px-8, py-8
- Background: gray-50

**Header:**
- Page title: "Prospects" (text-2xl, font-semibold, mb-2)
- Subtitle: "Team pipeline • X companies" (text-sm, gray-600)

**Filter Bar (mb-6):**
- Flex row, gap-4
- Label: "Filter by status:" (text-sm, font-medium, gray-700)
- Select dropdown (w-48, h-9): "All Statuses" | New | Contacted | etc.
- Result count: "Showing X of Y" (text-sm, gray-600)

**Prospects List:**
- Vertical stack (gap-4)
- Each prospect card (white, border, rounded-lg, p-5):
  - **Header row** (flex, justify-between, mb-3):
    - Left:
      - Company name (text-sm, font-medium)
      - Industry | Location (text-xs, gray-600)
    - Right:
      - Status badge (colored, text-xs)
      - Status dropdown (select, w-48, h-8)
  
  - **Metrics row** (flex, gap-6, mb-4, text-xs, gray-700):
    - Revenue: $X.XM
    - EBITDA: $X.XM
    - Employees: X
    - Growth: +X% (green badge)
  
  - **Notes section**:
    - Expand/collapse toggle: "X notes" (text-sm, blue-600, cursor-pointer)
    - When expanded:
      - Notes list (space-y-3, mt-3):
        - Each note (border-t, pt-3):
          - User & timestamp (text-xs, gray-500, mb-1)
          - Note text (text-sm, gray-700)
          - Edit/Delete icons (hover only, text-xs)
      - Add note form (mt-3):
        - Textarea (placeholder "Add a note...", rows 2)
        - "Add Note" button (primary, h-8, text-sm, mt-2)

**Interactions:**
- Select status filter → Update visible prospects
- Click company name → Navigate to /companies/:id
- Change status dropdown → Update prospect status (show toast)
- Click "X notes" → Expand/collapse notes section
- Type in note textarea → Enable "Add Note" button
- Click "Add Note" → Add note to prospect (show toast, clear textarea)
- Click edit icon → Enter edit mode (textarea replaces text)
- Click delete icon → Show confirmation, then delete note
- Click save (in edit mode) → Update note (show toast)
- Click cancel (in edit mode) → Exit edit mode

**Responsive:**
- Desktop: Full width cards
- Tablet: Same
- Mobile: Stack metrics vertically, smaller status dropdown

**Empty States:**
- No prospects: "No prospects yet. Add companies from Universe or AI analysis."
- Filter produces 0 results: "No prospects with status: X"

---

## Screen 7: AI Lab

**Route:** `/ai-lab`

**Figma Reference:** AI analysis hub

**Layout:**
- Centered content: max-w-5xl, px-8, py-8
- Background: gray-50

**Header:**
- Page title: "AI Lab" (text-2xl, font-semibold, mb-2)
- Subtitle: "Analyze companies using AI-powered prompt templates" (text-sm, gray-600)

**Actions Section (mb-8):**
- White card (border, rounded-lg, p-6, text-center):
  - Icon: Brain (blue, w-12 h-12, mb-4)
  - Heading: "Run New Analysis" (text-base, font-medium, mb-2)
  - Text: "Select companies and a prompt template to start" (text-sm, gray-600, mb-4)
  - Button: "Create New Run" (primary, h-10, text-base)

**Recent Runs Section:**
- Section header: "Recent Runs" (text-base, font-medium, mb-4)
- Runs list (space-y-3):
  - Each run card (white, border, rounded-lg, p-5):
    - **Top row** (flex, justify-between, mb-2):
      - Run name (text-sm, font-medium)
      - Status badge (running/completed/failed)
    - **Metadata row** (text-sm, gray-600, mb-3):
      - Template name
      - X companies
      - Created timestamp
    - **Progress** (if running):
      - Progress bar (h-2, bg-gray-200, rounded-full)
      - Fill bar (bg-blue-500, animated)
      - Text: "X of Y analyzed" (text-xs, gray-600, mt-1)
    - **Actions row** (flex, gap-2):
      - "View Results" button (outline, h-8, text-sm)
      - "View Details" button (ghost, h-8, text-sm)

**Interactions:**
- Click "Create New Run" → Open template dialog:
  - Modal (max-w-3xl)
  - Title: "Select Analysis Template"
  - List of 3 templates (radio selection):
    - Strategic Fit Analysis
    - Financial Health Assessment
    - Acquisition Opportunity Score
  - Each template shows: name, description, sample output
  - Buttons: Cancel | Continue (primary)
  - After selection → Navigate to /ai-lab/create-run?template=X
- Click "View Results" → Navigate to /ai-lab/runs/:id/results
- Click "View Details" → Navigate to /ai-lab/runs/:id

**Responsive:**
- Desktop: Full width
- Tablet: Same
- Mobile: Stack buttons in run cards

**Empty States:**
- No runs yet: 
  - Show actions section only
  - Text: "No analysis runs yet. Create your first run to get started."

---

## Screen 8: Create Run

**Route:** `/ai-lab/create-run`

**Query params:** `?template=strategic-fit` (optional, pre-selects template)

**Figma Reference:** AI run creation form

**Layout:**
- Centered content: max-w-4xl, px-8, py-8
- Background: gray-50

**Header:**
- Back button: "← AI Lab" (text-sm, gray-600, mb-4)
- Page title: "Create Analysis Run" (text-2xl, font-semibold, mb-2)
- Subtitle: "Configure your AI analysis" (text-sm, gray-600)

**Form (white card, border, rounded-lg, p-6, space-y-6):**

### 1. Run Name
- Label: "Run Name" (text-sm, font-medium, mb-2)
- Input: text field (placeholder "e.g., Q1 2026 - Manufacturing Batch", max-w-xl)

### 2. Template Selection
- Label: "Prompt Template" (text-sm, font-medium, mb-2)
- Select dropdown (w-full, max-w-xl):
  - Options: Strategic Fit Analysis | Financial Health Assessment | Acquisition Opportunity Score
- Template preview (mt-3, p-4, bg-gray-50, rounded, border):
  - Template description (text-sm, gray-700)
  - "View full template" link (text-sm, blue-600)

### 3. Company Selection
- Label: "Select Companies" (text-sm, font-medium, mb-2)
- Two options (radio buttons):
  - "From existing list" → Show list dropdown
  - "Select manually" → Show search + multi-select
- Selected companies count: "X companies selected" (text-sm, gray-600)
- Company chips (flex-wrap, gap-2):
  - Each chip: company name + remove X button

### 4. Settings (collapsible section)
- Toggle: "Advanced Settings" (text-sm, blue-600, cursor-pointer)
- When expanded:
  - Model selection (dropdown): GPT-4, GPT-3.5-turbo
  - Temperature slider (0-1, default 0.7)
  - Max tokens input

**Actions (mt-6, flex, gap-3):**
- "Cancel" button (outline, h-9)
- "Start Analysis" button (primary, h-10, disabled if validation fails)

**Interactions:**
- Type run name → Enable start button (if companies selected)
- Select template → Show template preview, update start button state
- Select "From existing list" → Show list dropdown
- Select list → Auto-populate company chips
- Select "Select manually" → Show search input
- Type in search → Show company results dropdown
- Click company in results → Add to selected chips
- Click X on chip → Remove company from selection
- Click "View full template" → Open modal with full template text
- Click "Cancel" → Navigate back to /ai-lab
- Click "Start Analysis" → Create run, navigate to /ai-lab/runs/:newId

**Validation:**
- Run name required (min 3 chars)
- Template required
- At least 1 company required
- Show error messages below fields

**Responsive:**
- Desktop: Max-w-4xl form
- Tablet: Full width form
- Mobile: Stack inputs, full width

---

## Screen 9: Run Detail (Progress View)

**Route:** `/ai-lab/runs/:id`

**Figma Reference:** AI run progress/status page

**Layout:**
- Centered content: max-w-5xl, px-8, py-8
- Background: gray-50

**Header:**
- Back button: "← AI Lab" (text-sm, gray-600, mb-4)
- Run name (text-2xl, font-semibold, mb-1)
- Status badge (text-sm, mb-4): Running | Completed | Failed

**Summary Section (mb-8):**
- White card (border, rounded-lg, p-6):
  - Grid (2 columns, gap-6):
    - Template: "Strategic Fit Analysis" (text-sm, label + value)
    - Companies: "25" (text-sm, label + value)
    - Started: "2 hours ago" (text-sm, label + value)
    - Progress: "18 of 25 analyzed" (text-sm, label + value)

**Progress Section (mb-8):**
- White card (border, rounded-lg, p-6):
  - Label: "Analysis Progress" (text-base, font-medium, mb-4)
  - Large progress bar (h-4, bg-gray-200, rounded-full, mb-2):
    - Fill (bg-blue-500, animated, width = percentage)
  - Text: "72% complete" (text-sm, gray-600, text-center)
  - Estimated time: "~15 minutes remaining" (text-xs, gray-500, text-center, mt-1)

**Company Status List:**
- Section header: "Company Analysis Status" (text-base, font-medium, mb-4)
- Table (white card, border, rounded-lg):
  - Headers: Company | Status | Time | Result
  - Rows:
    - Company name (text-sm, font-medium)
    - Status icon + text (pending/analyzing/complete/error)
    - Time elapsed (text-xs, gray-600)
    - Quick preview (text-xs, gray-700, truncated)
  - Completed rows: checkmark icon (green)
  - In progress rows: spinner icon (animated)
  - Pending rows: clock icon (gray)

**Actions (if running):**
- "Cancel Run" button (destructive, outline, h-9)
- Confirmation dialog on click

**Actions (if completed):**
- "View Results" button (primary, h-10)
- "Export Report" button (outline, h-9)

**Interactions:**
- Auto-refresh: Poll every 2 seconds while status = running
- Click "Cancel Run" → Show confirmation, then stop run
- Click "View Results" → Navigate to /ai-lab/runs/:id/results
- Click "Export Report" → Download CSV/PDF
- Click company row → Navigate to /companies/:id

**Responsive:**
- Desktop: Full table
- Tablet: Horizontal scroll for table
- Mobile: Card layout instead of table

**Real-time Updates:**
- Progress bar updates live
- Company status updates live
- Show toast when run completes: "Analysis complete! View results."

---

## Screen 10: Run Results

**Route:** `/ai-lab/runs/:id/results`

**Figma Reference:** AI analysis results viewer

**Layout:**
- Centered content: max-w-5xl, px-8, py-8
- Background: gray-50

**Header:**
- Back button: "← Run Detail" (text-sm, gray-600, mb-4)
- Run name (text-2xl, font-semibold, mb-1)
- Metadata: "Strategic Fit Analysis • 25 companies • Completed 1 hour ago" (text-sm, gray-600)

**Filter/Sort Bar (mb-6):**
- Flex row, gap-4
- Left:
  - "Filter:" label (text-sm, font-medium)
  - Tabs: All | Approved | Rejected | Pending
- Right:
  - Sort dropdown: "Sort by: Score (High to Low)"
  - Options: Score High-Low, Score Low-High, Name A-Z

**Results List:**
- Vertical stack (space-y-4)
- Each result card (white, border, rounded-lg, p-6):
  - **Header row** (flex, justify-between, mb-4):
    - Left:
      - Company name (text-base, font-medium)
      - Industry | Location (text-xs, gray-600)
    - Right:
      - Score badge (large, text-xl, font-semibold, colored):
        - 80-100: green (bg-green-100, text-green-800)
        - 60-79: blue (bg-blue-100, text-blue-800)
        - 40-59: yellow (bg-yellow-100, text-yellow-800)
        - 0-39: red (bg-red-100, text-red-800)
  
  - **AI Analysis** (mb-4):
    - Label: "Analysis" (text-sm, font-medium, mb-2)
    - Text content (text-sm, gray-700, line-height-relaxed)
    - "Read more" toggle if text is long
  
  - **Key Metrics** (mb-4):
    - 3-column grid:
      - Revenue: $X.XM
      - EBITDA: $X.XM
      - Growth: +X%
  
  - **Actions row** (flex, gap-3):
    - "Approve" button (outline with checkmark icon, h-8, text-sm)
    - "Reject" button (ghost with X icon, h-8, text-sm)
    - "View Details" link (text-sm, blue-600)
    - Decision badge (if already approved/rejected): "✓ Approved" (green) or "✗ Rejected" (red)

**Interactions:**
- Click filter tab → Update visible results
- Change sort → Reorder results
- Click "Read more" → Expand full analysis text
- Click "Approve" → Mark as approved, show green badge, move to Approved tab, show toast
- Click "Reject" → Mark as rejected, show red badge, move to Rejected tab, show toast
- Click "View Details" → Navigate to /companies/:id
- Click company name → Navigate to /companies/:id

**Responsive:**
- Desktop: Full width cards
- Tablet: Same
- Mobile: Stack metrics vertically, smaller buttons

**Empty States:**
- Approved tab with 0 results: "No approved companies yet"
- Rejected tab with 0 results: "No rejected companies yet"

---

## Screen 11: Admin Panel

**Route:** `/admin`

**Figma Reference:** Admin dashboard with tabs

**Layout:**
- Centered content: max-w-5xl, px-8, py-8
- Background: gray-50

**Header:**
- Page title: "Admin Panel" (text-2xl, font-semibold, mb-2)
- Subtitle: "System configuration and team management" (text-sm, gray-600)

**Tabs Component (mb-6):**
- Horizontal tabs (bg-white, border, rounded-lg):
  - Overview
  - Team
  - API Config
  - Settings
  - Audit Log

### Tab 1: Overview

**Content:**

**System Stats Grid (3 columns, gap-6, mb-8):**
- Total Users: 3
- Active Lists: 12
- Total Companies: 13,421
- AI Runs (30 days): 47

**Recent Activity Section:**
- Section header: "Recent Activity" (text-base, font-medium, mb-4)
- Activity list (white card, border, rounded-lg):
  - Each item (border-b, p-4, text-sm):
    - User avatar + name (font-medium)
    - Action text (gray-700)
    - Timestamp (gray-500, text-xs)
  - Icons vary by action type (user icon, list icon, brain icon, etc.)

**System Health:**
- Section header: "System Health" (text-base, font-medium, mb-4)
- Grid (2 columns):
  - API Status: "✓ Operational" (green)
  - Database: "✓ Connected" (green)
  - Last Backup: "2 hours ago"
  - Storage Used: "2.3 GB of 100 GB"

### Tab 2: Team

**Team Members List:**
- Section header: "Team Members (3)" (text-base, font-medium, mb-4)
- Table (white card, border, rounded-lg):
  - Headers: Name | Email | Role | Status | Actions
  - Rows:
    - Avatar + name (font-medium)
    - Email (text-sm, gray-600)
    - Role badge (Admin/Member)
    - Status badge (Active/Inactive)
    - Actions: Edit | Remove (icons)

**Add Member Button:**
- "Add Team Member" (primary, h-9, top-right)
- Opens modal:
  - Name input
  - Email input
  - Role select (Admin/Member)
  - Buttons: Cancel | Add

### Tab 3: API Config

**OpenAI Configuration:**
- Section header: "OpenAI API" (text-base, font-medium, mb-4)
- Form (white card, border, rounded-lg, p-6, space-y-4):
  - API Key input (password type, placeholder "sk-...")
  - Test Connection button (outline, h-8)
  - Connection status indicator (green dot + "Connected" or red dot + "Not connected")
  - Default Model dropdown (gpt-4, gpt-3.5-turbo)
  - Temperature slider (0-1)
  - Max Tokens input
  - "Save Configuration" button (primary, h-9)

### Tab 4: Settings

**General Settings:**
- Form (white card, border, rounded-lg, p-6, space-y-6):
  
  **Data Retention:**
  - Label + description
  - Input: Days to keep audit logs (default 90)
  
  **Email Notifications:**
  - Checkboxes:
    - ☑ AI analysis complete
    - ☑ New prospect added
    - ☐ Weekly summary report
  
  **Default List Settings:**
  - Default scope: Private | Team (radio)
  - Default stage: Research | Analysis | Finalists (select)
  
  **"Save Settings" button** (primary, h-9)

### Tab 5: Audit Log

**Filters (mb-4):**
- Date range picker (last 7 days, last 30 days, custom)
- User filter (dropdown, "All users")
- Action type filter (dropdown, "All actions")

**Log Table:**
- Table (white card, border, rounded-lg):
  - Headers: Timestamp | User | Action | Details | IP Address
  - Rows (text-sm):
    - Timestamp (gray-600)
    - User name (font-medium)
    - Action text (gray-700)
    - Details (gray-600, truncated)
    - IP address (gray-500, monospace)
  - Pagination at bottom

**Interactions:**
- Change tab → Update content view
- Click "Add Team Member" → Open modal
- Submit member form → Add member, show toast, close modal
- Click "Test Connection" → Verify API key, show status
- Click "Save Configuration" → Save API settings, show toast
- Click "Save Settings" → Save general settings, show toast
- Change audit log filters → Update log table
- Click pagination → Load next/prev page

**Responsive:**
- Desktop: Full width
- Tablet: Tabs scroll horizontally if needed
- Mobile: Vertical tab list, tables scroll horizontally

---

## Screen 12: Not Found (404)

**Route:** `*` (catch-all)

**Layout:**
- Centered content (flex items-center justify-center, min-h-screen)

**Content:**
- Large "404" text (text-6xl, font-bold, gray-900)
- Heading: "Page not found" (text-2xl, font-semibold, gray-900, mb-2)
- Text: "The page you're looking for doesn't exist." (text-sm, gray-600, mb-6)
- "Go to Dashboard" button (primary, h-10)

**Interactions:**
- Click button → Navigate to /

# Navigation & User Flows

## Application Shell

### Sidebar (Left, 240px wide, fixed)
**Structure:**
- Logo/Brand Area (top, h-16, p-4)
- Navigation Items (flex-1, space-y-1, p-4)
- Bottom Items (p-4)

**Navigation Items:**
1. **Dashboard** (/)
   - Icon: LayoutDashboard
   - Label: "Dashboard"
   - Active state: blue background (bg-blue-50), blue text (text-blue-600)
   - Sub-item (indented):
     - **Prospects** (/prospects)
     - Icon: none (bullet or dash)
     - Label: "Prospects"

2. **Universe** (/universe)
   - Icon: Globe
   - Label: "Universe"
   - No sub-items

3. **Lists** (/lists)
   - Icon: List
   - Label: "Lists"
   - No sub-items

4. **AI Lab** (/ai-lab)
   - Icon: Brain
   - Label: "AI Lab"
   - No sub-items

5. **Admin** (/admin) [Bottom]
   - Icon: Settings
   - Label: "Admin"
   - Separated by divider or pushed to bottom

**Interaction:**
- Click nav item → Navigate to route, update active state
- Keyboard: Arrow keys to navigate, Enter to select
- Sub-items: Always visible (no collapse/expand)

### Top Bar (Optional)
Currently not implemented. Sidebar navigation only.

### Content Area
- Left margin: 240px (sidebar width)
- Full height minus any fixed headers
- Scrollable independently from sidebar

---

## Primary User Flows

### Flow 1: Discover Companies → Create List
**Goal:** Browse universe and create a working list

**Steps:**
1. User clicks **Universe** in sidebar
2. Lands on `/universe` with all 13k companies visible
3. User applies filters:
   - Clicks "Add filters" to open FilterBuilder
   - Selects field (e.g., "Revenue")
   - Selects operator (e.g., ">")
   - Enters value (e.g., "5000000")
   - Clicks "Apply" or filters auto-apply
   - Results update in real-time
4. User reviews filtered results (cards grid)
5. User clicks **"Create List from Results"** button
6. Modal opens:
   - User enters list name (e.g., "Manufacturing - Q1 2026")
   - User selects scope (Private or Team)
   - User selects stage (Research)
   - User clicks "Create"
7. List is created, modal closes
8. Toast notification: "List created successfully"
9. User clicks **Lists** in sidebar to view new list

**Alternative paths:**
- User can manually select companies (checkboxes) instead of using all filtered results
- User can cancel list creation (modal closes, no list created)

---

### Flow 2: Research Companies in List
**Goal:** Review list of companies and add research notes

**Steps:**
1. User navigates to **Lists** (/lists)
2. User sees list of Private Lists and Shareable Lists
3. User clicks **"View"** on a specific list
4. Lands on `/lists/:id` with table of companies
5. User clicks on a company name
6. Navigates to `/companies/:id` (Company Detail)
7. User reviews:
   - Company overview
   - Financial data (4 years)
   - Growth metrics
8. User clicks **"Add to List"** or **"Create Prospect"**
9. If "Create Prospect":
   - Company is added to Prospects pipeline
   - Toast: "Added to prospects"
   - User navigates to **Prospects** (/prospects)
10. User sees company in prospects list
11. User expands notes section (click "X notes")
12. User types note in textarea
13. User clicks **"Add Note"**
14. Note appears in list with timestamp
15. User can edit or delete notes (hover for icons)

**Alternative paths:**
- User can run AI analysis on the entire list from List Detail page
- User can export list as CSV
- User can remove companies from list

---

### Flow 3: AI Analysis on Shortlist
**Goal:** Run AI-powered analysis on a list of companies

**Steps:**
1. User is on **List Detail** page (/lists/:id)
2. User clicks **"Run AI Analysis"** button
3. Navigates to `/ai-lab/create-run?list=:id`
4. Create Run page pre-populates:
   - Company selection: "From existing list" selected
   - List dropdown shows selected list
   - Company chips display all companies in list
5. User enters run name (e.g., "Q1 Batch - Strategic Fit")
6. User selects prompt template from dropdown:
   - Options: Strategic Fit Analysis, Financial Health Assessment, Acquisition Opportunity Score
7. Template preview shows description below dropdown
8. User clicks **"Start Analysis"** button
9. Run is created, navigates to `/ai-lab/runs/:newId`
10. Run Detail page shows:
    - Progress bar (animated)
    - Company status list (pending → analyzing → complete)
    - Auto-refreshes every 2 seconds
11. When analysis completes:
    - Toast notification: "Analysis complete! View results."
    - **"View Results"** button becomes primary CTA
12. User clicks **"View Results"**
13. Navigates to `/ai-lab/runs/:id/results`
14. Results page shows:
    - All companies with AI-generated analysis
    - Scores (0-100, color-coded)
    - Key insights per company
15. User reviews each company:
    - Reads AI analysis
    - Checks score and metrics
    - Decides to approve or reject
16. User clicks **"Approve"** on promising companies
    - Badge changes to "✓ Approved" (green)
    - Company moves to Approved tab
    - Toast: "Company approved"
17. User clicks **"Reject"** on non-fits
    - Badge changes to "✗ Rejected" (red)
    - Company moves to Rejected tab
    - Toast: "Company rejected"
18. Approved companies automatically added to Prospects pipeline

**Alternative paths:**
- User can create run from AI Lab home (/ai-lab) instead
- User can select companies manually instead of from list
- User can cancel run while in progress
- User can export results as report (CSV/PDF)

---

### Flow 4: Manage Prospects Pipeline
**Goal:** Track prospect status from new to deal close

**Steps:**
1. User navigates to **Prospects** (/prospects) from Dashboard sub-item
2. Prospects page shows all companies in pipeline
3. User filters by status (dropdown): "All Statuses" → "New"
4. Only new prospects are shown
5. User finds a prospect to work on
6. User changes status dropdown on prospect card:
   - New → Researching
   - Toast: "Status updated"
7. User expands notes (click "X notes")
8. User adds research note:
   - Types in textarea
   - Clicks "Add Note"
   - Note appears with username and timestamp
9. After research, user changes status:
   - Researching → Contacted
10. User adds note: "Sent initial email, awaiting response"
11. Next day, user updates:
    - Contacted → In Discussion
12. User adds note: "Call scheduled for next week"
13. After meeting:
    - In Discussion → Interested
14. User adds note: "Interested in $5M acquisition, requesting financials"
15. If deal progresses:
    - Interested → Deal in Progress
16. If deal doesn't work out:
    - Interested → Not Interested or Passed

**Alternative paths:**
- User can click company name to view full Company Detail
- User can edit or delete existing notes
- Multiple team members can add notes (collaboration)
- User can filter by status to focus on specific stage

---

### Flow 5: Dashboard Overview
**Goal:** Quick view of work in progress

**Steps:**
1. User navigates to **Dashboard** (/) - home page
2. Dashboard shows:
   - **Quick Stats**: Total companies, active lists, prospects count
   - **My Lists**: Recent research and AI analysis lists
   - **Team Prospects**: Pipeline status breakdown (new, contacted, etc.)
3. User clicks **"View All"** under My Lists
   - Navigates to /lists
4. User clicks **"View"** on a specific list
   - Navigates to /lists/:id
5. User clicks **"View All"** under Team Prospects
   - Navigates to /prospects
6. User clicks on a list card:
   - Navigates to /lists/:id

**Purpose:**
- Central hub to see all work at a glance
- Quick access to recent lists and prospect pipeline
- No dead ends - every section links to detail pages

---

### Flow 6: Admin Configuration
**Goal:** Configure system settings and manage team

**Steps:**
1. User (admin) navigates to **Admin** (/admin)
2. Admin Panel opens with Overview tab active
3. User sees:
   - System stats (users, lists, companies, AI runs)
   - Recent activity log
   - System health indicators
4. User clicks **Team** tab
5. Team management view shows:
   - List of 3 team members
   - Each with name, email, role, status
6. User clicks **"Add Team Member"** button
7. Modal opens with form:
   - User enters: name, email, role (Admin or Member)
   - Clicks "Add"
8. New member added, modal closes, toast confirms
9. User clicks **API Config** tab
10. API Configuration shows:
    - OpenAI API key input (masked)
    - User enters new API key
    - Clicks "Test Connection"
    - Status shows "✓ Connected" (green)
11. User adjusts settings:
    - Default model: GPT-4
    - Temperature: 0.7
    - Max tokens: 2000
12. User clicks **"Save Configuration"**
13. Toast: "API configuration saved"
14. User clicks **Settings** tab
15. Adjusts general settings:
    - Data retention: 90 days
    - Email notifications: checks relevant boxes
    - Default list settings
16. Clicks **"Save Settings"**
17. Toast: "Settings saved"
18. User clicks **Audit Log** tab
19. Reviews recent system activity:
    - Filters by date range, user, action type
    - Views detailed log entries

**Alternative paths:**
- Non-admin users cannot access Admin panel (show 403 or hide nav item)
- User can edit existing team members
- User can remove team members (with confirmation)

---

## Modal / Dialog Flows

### Create List Modal
**Trigger:** Click "Create List from Results" button on Universe page

**Flow:**
1. Modal opens (centered, overlay darkens background)
2. Focus moves to first input (list name)
3. User types list name
4. User selects scope: Private (default) or Team
5. User selects stage: Research (default), AI Analysis, or Finalists
6. User clicks "Create" or "Cancel"
7. If Create:
   - Modal closes
   - List is created with filtered companies
   - Toast: "List created successfully"
   - Optionally navigate to new list (/lists/:newId)
8. If Cancel:
   - Modal closes
   - No changes made

**Keyboard:**
- ESC to close (same as Cancel)
- Enter to submit (same as Create, if form valid)

### Template Selection Dialog
**Trigger:** Click "Create New Run" button on AI Lab page

**Flow:**
1. Large modal opens (max-w-3xl)
2. Shows 3 AI prompt templates as radio options
3. Each template displays:
   - Name (e.g., "Strategic Fit Analysis")
   - Description (2-3 sentences)
   - Sample output preview
4. User clicks radio button to select
5. User clicks "Continue" button
6. Modal closes
7. Navigates to /ai-lab/create-run?template=:id

**Keyboard:**
- Arrow keys to select template
- Enter to confirm and continue
- ESC to cancel

### Delete Confirmation Dialog
**Trigger:** Click delete icon on list, note, team member, etc.

**Flow:**
1. Small modal opens (centered)
2. Title: "Delete [item]?"
3. Text: "This action cannot be undone."
4. Buttons: "Cancel" (outline) | "Delete" (destructive red)
5. User clicks "Delete":
   - Modal closes
   - Item is deleted
   - Toast: "[Item] deleted"
   - View updates (item removed)
6. User clicks "Cancel" or ESC:
   - Modal closes
   - No changes

### Add to List Modal
**Trigger:** Click "Add to List" button on Company Detail page

**Flow:**
1. Modal opens
2. Dropdown shows user's existing lists
3. User selects a list from dropdown
4. User clicks "Add" button
5. Modal closes
6. Company added to selected list
7. Toast: "Added to [list name]"

**Alternative:**
- User clicks "Create New List" option in dropdown
- Inline form appears to create new list
- After creation, company is added to new list

---

## Navigation Patterns

### Breadcrumb Navigation
**Not currently implemented**, but could be added for deep navigation:
- Example: Dashboard > Lists > Q1 Manufacturing > Acme Corp

### Back Button Pattern
Used on detail pages:
- Company Detail: "← Universe"
- List Detail: "← My Lists"
- Run Detail: "← AI Lab"
- Run Results: "← Run Detail"
- Create Run: "← AI Lab"

Clicking back button navigates to previous page in hierarchy (not browser back).

### External Links
- Company website links open in new tab (target="_blank")
- Icon: ExternalLink (lucide-react)

### Deep Linking
All pages support direct URL access:
- `/companies/:id` - Direct link to company
- `/lists/:id` - Direct link to list
- `/ai-lab/runs/:id` - Direct link to run
- Shareable URLs for collaboration

---

## Error States & Edge Cases

### Empty States
- **No lists**: "No lists yet. Create your first list from Universe."
- **No prospects**: "No prospects yet. Add companies from Universe or AI analysis."
- **No AI runs**: "No analysis runs yet. Create your first run to get started."
- **Empty list**: "This list is empty. Go to Universe to add companies."
- **Filter produces 0 results**: "No companies match your filters. Try adjusting criteria."

### Error States
- **API connection failed**: Show error banner with "Retry" button
- **AI run failed**: Show error badge and message, allow retry
- **Form validation errors**: Inline error messages below fields
- **404 Not Found**: Dedicated 404 page with link to Dashboard
- **Network error**: Toast notification with retry option

### Loading States
- **Initial page load**: Skeleton loaders for cards/tables
- **Filter application**: Loading spinner + "Applying filters..."
- **AI run progress**: Animated progress bar + percentage
- **Table pagination**: Loading spinner on rows
- **Form submission**: Disabled button + spinner icon

### Confirmation Dialogs Required For:
- Delete list
- Delete prospect
- Cancel AI run
- Remove team member
- Delete note

### Toast Notifications
- **Success actions**: Green toast, 3 second duration
- **Error actions**: Red toast, 5 second duration
- **Info notifications**: Blue toast, 3 second duration
- Position: Top-right corner (or bottom-right for mobile)

---

## Keyboard Shortcuts (Future Enhancement)

Suggested shortcuts for power users:
- `/` - Focus search
- `n` - New list
- `f` - Toggle filters
- `Cmd+K` - Command palette
- `ESC` - Close modal/dialog
- Arrow keys - Navigate tables/lists
- Enter - Select/confirm
- Tab - Move through form fields

---

## Mobile Navigation (Responsive)

### Mobile Sidebar (<768px)
- Sidebar hidden by default
- Hamburger menu icon (top-left)
- Click hamburger → Sidebar slides in from left
- Overlay darkens content area
- Click overlay or X button → Sidebar closes

### Mobile Bottom Nav (Alternative)
Could replace sidebar on mobile with bottom navigation:
- 5 tabs: Dashboard, Universe, Lists, AI Lab, More (Admin)
- Fixed to bottom of screen
- Icons only (no labels)
- Active state highlighted

### Tablet (768-1023px)
- Sidebar visible, collapsed (icons only, 64px wide)
- Hover or click to expand to full width
- Content area adjusts automatically

---

## State Persistence

### URL State
- Filters: Encoded in URL query params (shareable)
- Selected tab: Stored in URL hash
- Sort order: Query param
- Pagination: Query param (page number)

### Local Storage
- User preferences (e.g., default sort order)
- Recently viewed companies
- Draft notes (auto-save before navigate away)

### Session State
- Authentication token
- User profile data
- Team members list (cached)

---

## Analytics / Tracking Points

Key user actions to track:
- Filter application (which fields, how often)
- List creation (frequency, size)
- AI run creation (template usage)
- Approval/rejection rate in AI results
- Prospect status changes (conversion funnel)
- Time spent on Company Detail pages
- Search queries in Universe

---

## Accessibility Navigation

- All interactive elements keyboard accessible
- Skip to main content link (for screen readers)
- Focus indicators visible on all elements
- ARIA labels on icon buttons
- Logical tab order throughout
- Heading hierarchy (h1 → h2 → h3)
- Landmark regions: nav, main, aside, footer

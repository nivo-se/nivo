# Component Inventory

## Design System Components (shadcn/ui + Radix UI)

### Button
**Variants:**
- `default` - Primary blue button
- `outline` - White with gray border
- `ghost` - Transparent, text only
- `destructive` - Red for delete actions
- `link` - Underlined text link

**Sizes:**
- `sm` - Height: 32px (h-8), text: 14px
- `default` - Height: 36px (h-9), text: 14px
- `lg` - Height: 40px (h-10), text: 16px

**States:**
- Default
- Hover (darker shade)
- Active (pressed)
- Disabled (opacity 50%)
- Loading (with spinner icon)

**Props:**
- `variant`: "default" | "outline" | "ghost" | "destructive" | "link"
- `size`: "sm" | "default" | "lg"
- `disabled`: boolean
- `className`: string
- `onClick`: function

**File:** `/src/app/components/ui/button.tsx`

---

### Card
**Variants:**
- Plain card (white background, border)
- Hoverable card (border changes on hover)
- Clickable card (cursor pointer, shadow on hover)

**Sub-components:**
- `CardHeader` - Top section with title
- `CardTitle` - Heading text
- `CardDescription` - Subtitle/description
- `CardContent` - Main content area
- `CardFooter` - Bottom section with actions

**Props:**
- `className`: string
- Standard div props

**File:** `/src/app/components/ui/card.tsx`

---

### Input
**Types:**
- Text input
- Number input
- Search input
- Password input

**States:**
- Default
- Focus (blue ring)
- Error (red ring)
- Disabled (grayed out)

**Props:**
- `type`: "text" | "number" | "email" | "password" | "search"
- `placeholder`: string
- `value`: string
- `onChange`: function
- `disabled`: boolean
- `className`: string

**File:** `/src/app/components/ui/input.tsx`

---

### Select
**Style:** Dropdown with trigger button and popup menu

**States:**
- Closed (shows selected value)
- Open (shows options list)
- Focused

**Sub-components:**
- `Select` - Root container
- `SelectTrigger` - Button that opens dropdown
- `SelectValue` - Displays selected value
- `SelectContent` - Dropdown menu container
- `SelectItem` - Individual option
- `SelectGroup` - Group options
- `SelectLabel` - Group label
- `SelectSeparator` - Divider line

**Props:**
- `value`: string
- `onValueChange`: function
- `disabled`: boolean

**File:** `/src/app/components/ui/select.tsx`

---

### Badge
**Variants:**
- `default` - Gray background
- `secondary` - Light blue background
- `destructive` - Red background
- `outline` - Transparent with border
- `success` - Green background
- `warning` - Yellow background

**Sizes:**
- Small (default): height 20px, text 12px
- Large: height 24px, text 14px

**Props:**
- `variant`: string
- `className`: string

**File:** `/src/app/components/ui/badge.tsx`

---

### Dialog / Modal
**Components:**
- `Dialog` - Root container
- `DialogTrigger` - Opens dialog
- `DialogContent` - Modal content container (max-w-lg by default)
- `DialogHeader` - Top section
- `DialogTitle` - Modal title (text-lg font-semibold)
- `DialogDescription` - Subtitle
- `DialogFooter` - Bottom actions area
- `DialogClose` - Close button
- `DialogOverlay` - Background overlay (black 50% opacity)

**Behavior:**
- Overlay closes on click (optional)
- ESC key closes
- Focus trap inside modal
- Scroll lock on body

**Props:**
- `open`: boolean
- `onOpenChange`: function

**File:** `/src/app/components/ui/dialog.tsx`

---

### Textarea
**Style:** Multi-line text input

**States:**
- Default
- Focus (blue ring)
- Disabled

**Props:**
- `placeholder`: string
- `value`: string
- `onChange`: function
- `rows`: number
- `disabled`: boolean
- `className`: string

**File:** `/src/app/components/ui/textarea.tsx`

---

### Table
**Sub-components:**
- `Table` - Root container
- `TableHeader` - Header row container
- `TableBody` - Body rows container
- `TableFooter` - Footer row container
- `TableRow` - Single row
- `TableHead` - Header cell (font-medium)
- `TableCell` - Data cell
- `TableCaption` - Table caption

**Style:**
- Striped rows (optional)
- Hover highlight on rows
- Borders between rows

**File:** `/src/app/components/ui/table.tsx`

---

### Tabs
**Sub-components:**
- `Tabs` - Root container
- `TabsList` - Tab buttons container (gray background)
- `TabsTrigger` - Individual tab button
- `TabsContent` - Content panel for each tab

**Behavior:**
- Keyboard navigation (arrow keys)
- Active tab highlighted (white background)
- Smooth transition between panels

**Props:**
- `value`: string (active tab)
- `onValueChange`: function
- `defaultValue`: string

**File:** `/src/app/components/ui/tabs.tsx`

---

### Tooltip
**Sub-components:**
- `TooltipProvider` - Wrap app root
- `Tooltip` - Root container
- `TooltipTrigger` - Element to hover
- `TooltipContent` - Popup content

**Behavior:**
- Shows on hover after delay
- Hides on mouse leave
- Positioned above trigger (adjusts if no space)

**File:** `/src/app/components/ui/tooltip.tsx`

---

## Custom Application Components

### Sidebar
**Location:** Left side navigation (240px wide)

**Structure:**
- Logo/brand at top
- Navigation items with icons
- Active state highlighting (blue background)
- Nested sub-items (indented)

**Navigation Items:**
1. Dashboard (LayoutDashboard icon)
   - Prospects (sub-item)
2. Universe (Globe icon)
3. Lists (List icon)
4. AI Lab (Brain icon)
5. Admin (Settings icon, bottom of sidebar)

**Props:**
- None (reads from router context)

**File:** `/src/app/components/Sidebar.tsx`

---

### FilterBuilder
**Purpose:** Complex filtering UI for company universe

**Structure:**
- AND/OR group toggle
- Multiple filter rows
- Each row: field selector + operator + value input
- Add/remove row buttons
- Include/Exclude toggle per row

**Field Types:**
- Number (revenue, ebitda, employees)
- Percentage (growth rates)
- Text (industry, location, name)
- Enum (stage, status)

**Operators:**
- Numeric: >, <, =, >=, <=, between
- Text: contains, equals, starts with
- Set: in, not in

**Props:**
- `filters`: Filter[]
- `onChange`: (filters: Filter[]) => void

**File:** `/src/app/components/FilterBuilder.tsx`

---

### TemplateDialog
**Purpose:** Modal to select AI prompt template

**Structure:**
- Large modal (max-w-3xl)
- List of 3 templates with radio selection
- Each template shows: name, description, sample output
- Select & Cancel buttons in footer

**Templates:**
1. Strategic Fit Analysis
2. Financial Health Assessment
3. Acquisition Opportunity Score

**Props:**
- `open`: boolean
- `onClose`: () => void
- `onSelect`: (templateId: string) => void

**File:** `/src/app/components/TemplateDialog.tsx`

---

### CompanyCard
**Purpose:** Display company summary in lists

**Structure:**
- Company name (font-semibold, text-sm)
- Industry & location (text-xs, gray-600)
- Revenue & EBITDA metrics
- Employees count
- Growth indicators
- Hover state: border color change

**Variants:**
- Default (in list views)
- Compact (in tables)
- Expanded (with more details)

**Props:**
- `company`: Company
- `onClick`: () => void
- `selected`: boolean (optional)

**File:** Inline in various pages (candidate for extraction)

---

### StatCard
**Purpose:** Display key metrics on dashboard

**Structure:**
- Label text (text-sm, gray-600, top)
- Large number (text-2xl, font-semibold)
- Optional trend indicator (arrow icon + percentage)
- White background, border, rounded corners
- Padding: 24px

**Props:**
- `label`: string
- `value`: number | string
- `trend`: { value: number, direction: "up" | "down" } (optional)

**File:** Inline in WorkDashboard.tsx

---

### StatusBadge
**Purpose:** Show prospect status with color coding

**Colors by Status:**
- New: blue (bg-blue-100, text-blue-800)
- Researching: purple (bg-purple-100, text-purple-800)
- Contacted: yellow (bg-yellow-100, text-yellow-800)
- In Discussion: orange (bg-orange-100, text-orange-800)
- Interested: green (bg-green-100, text-green-800)
- Not Interested: gray (bg-gray-100, text-gray-800)
- Passed: red (bg-red-100, text-red-800)
- Deal in Progress: emerald (bg-emerald-100, text-emerald-800)

**Props:**
- `status`: string
- `className`: string (optional)

**File:** Inline in Prospects.tsx (uses Badge component)

---

### NoteCard
**Purpose:** Display user notes on prospects/companies

**Structure:**
- User name (font-medium, text-sm)
- Timestamp (text-xs, gray-500)
- Note text (text-sm, gray-700)
- Edit/Delete buttons (on hover)
- Border between notes

**States:**
- View mode (default)
- Edit mode (textarea replaces text)

**Props:**
- `note`: { user: string, text: string, timestamp: string }
- `onEdit`: (text: string) => void
- `onDelete`: () => void

**File:** Inline in Prospects.tsx

---

### ListCard
**Purpose:** Display list summary in My Lists page

**Structure:**
- List name (font-medium, text-sm)
- Metadata: company count, last edited timestamp (text-sm, gray-600)
- View button (outline variant)
- Delete button (ghost, hover only)
- White background, border, hover effect

**Props:**
- `list`: List
- `onDelete`: (id: string) => void

**File:** `/src/app/pages/MyLists.tsx`

---

### ProgressBar
**Purpose:** Show AI run progress

**Structure:**
- Gray background bar (full width)
- Blue fill bar (width = percentage)
- Text overlay: "X of Y analyzed"
- Height: 8px

**Props:**
- `current`: number
- `total`: number

**File:** Inline in RunDetail.tsx

---

## Icons (Lucide React)

All icons from `lucide-react` package, size 16px (w-4 h-4) or 20px (w-5 h-5)

**Navigation:**
- LayoutDashboard
- Globe
- List
- Brain
- Settings

**Actions:**
- Plus
- Trash2
- Pencil
- Check
- X
- ExternalLink
- ArrowRight
- Filter
- Search
- Download
- Upload
- RefreshCw

**Status:**
- TrendingUp
- TrendingDown
- AlertCircle
- CheckCircle
- XCircle
- Clock
- Zap

**Utility:**
- ChevronDown
- ChevronRight
- MoreHorizontal
- Info
- Eye
- EyeOff

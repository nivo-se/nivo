# Implementation Guide for Cursor/Codex

## Quick Start

This export contains complete specifications for the Nivo Group Investment Platform - an internal tool for a 3-person team to screen, shortlist, and acquire small/medium businesses from 13k+ companies.

### What's Included

1. **PROJECT_DESCRIPTION.md** - Complete project overview, tech stack, data model, current status
2. **design-tokens.json** - All design tokens (colors, typography, spacing, etc.)
3. **COMPONENT_INVENTORY.md** - Every UI component with variants, props, and file locations
4. **SCREENS.md** - 12 detailed screen specifications with layouts, interactions, responsive behavior
5. **NAVIGATION.md** - User flows, navigation patterns, modal flows, error states
6. **assets/** - Asset requirements and icon library details

### Project Status

**✅ Completed (Phase 1 & 2A):**
- Complete React + TypeScript app with Tailwind v4
- All 12 screens implemented and functional
- Sidebar navigation with Dashboard, Universe, Lists, AI Lab, Admin
- Advanced filtering with nested logic
- List management (private/team)
- Prospects pipeline with notes
- AI Lab with 3 templates, run creation, progress tracking, results viewer
- Admin panel with 5 tabs
- Complete design system consistency

**🎯 Current Design Goals:**
- Maintain centered layout (max-w-5xl)
- Consistent typography hierarchy
- Clean card-based UI with generous spacing
- Gray-50 backgrounds, white cards with borders

---

## For Cursor AI: Implementation Instructions

### Context Files to Read First

1. **Start here:** `/figma-export/PROJECT_DESCRIPTION.md`
   - Understand the project, tech stack, and file structure
   
2. **Design system:** `/figma-export/design-tokens.json`
   - All colors, typography, spacing values
   
3. **Components:** `/figma-export/COMPONENT_INVENTORY.md`
   - What components exist, their variants and props
   
4. **Screens:** `/figma-export/SCREENS.md`
   - Detailed spec for each page/route

5. **Flows:** `/figma-export/NAVIGATION.md`
   - How users navigate through the app

### Existing Code Structure

```
src/
├── app/
│   ├── App.tsx                 # RouterProvider root
│   ├── routes.ts               # React Router v7 configuration
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components (Button, Card, etc.)
│   │   ├── Sidebar.tsx         # Main navigation
│   │   ├── FilterBuilder.tsx   # Complex filter UI
│   │   └── TemplateDialog.tsx  # AI template picker
│   ├── pages/
│   │   ├── Root.tsx            # Layout wrapper with Sidebar
│   │   ├── WorkDashboard.tsx   # Dashboard (home)
│   │   ├── Universe.tsx        # Browse/filter companies
│   │   ├── MyLists.tsx         # List management
│   │   ├── ListDetail.tsx      # Single list view
│   │   ├── Prospects.tsx       # Pipeline management
│   │   ├── AILab.tsx           # AI analysis hub
│   │   ├── CreateRun.tsx       # New AI run form
│   │   ├── RunDetail.tsx       # Run progress view
│   │   ├── RunResults.tsx      # Analysis results
│   │   ├── CompanyDetail.tsx   # Company deep dive
│   │   ├── Admin.tsx           # Admin panel (5 tabs)
│   │   └── NotFound.tsx        # 404 page
│   └── data/
│       ├── DataContext.tsx     # Global state management
│       └── mockData.ts         # Sample data (~13k companies)
└── styles/
    ├── theme.css               # Tailwind v4 design tokens
    └── fonts.css               # Font imports
```

### Key Technical Details

**Routing:**
- Uses `react-router` (v7) in Data mode (NOT react-router-dom)
- Router configured in `/src/app/routes.ts`
- App.tsx uses `<RouterProvider router={router} />`

**Styling:**
- Tailwind CSS v4 (no tailwind.config.js)
- Design tokens in `/src/styles/theme.css`
- Utility classes for layout and typography

**State Management:**
- React Context API (`DataContext.tsx`)
- Mock data in `mockData.ts`
- Functions: getCompanies, getLists, updateProspect, etc.

**UI Components:**
- shadcn/ui + Radix UI primitives
- Located in `/src/app/components/ui/`
- Icons: Lucide React

### Design System Quick Reference

**Layout:**
- All pages: `max-w-5xl mx-auto px-8 py-8`
- Background: `bg-gray-50`
- Cards: `bg-white border border-gray-200 rounded-lg`

**Typography:**
- Page title (h1): `text-2xl font-semibold text-gray-900 mb-2`
- Section heading (h2): `text-base font-medium text-gray-900 mb-4`
- Body text: `text-sm text-gray-600`
- Caption: `text-xs text-gray-500`

**Spacing:**
- Section gaps: `mb-8`
- Card gaps: `gap-6`
- List item gaps: `gap-3`
- Card padding: `p-6` or `p-5`

**Buttons:**
- Small: `h-8 text-sm`
- Default: `h-9 text-sm`
- Large: `h-10 text-base`

**Colors:**
- Primary: `#3b82f6` (blue-500)
- Background: `#f9fafb` (gray-50)
- Surface: `#ffffff` (white)
- Border: `#e5e7eb` (gray-200)
- Text primary: `#111827` (gray-900)
- Text secondary: `#6b7280` (gray-600)

### Common Modifications

**To add a new page:**
1. Create file in `/src/app/pages/NewPage.tsx`
2. Add route in `/src/app/routes.ts`
3. Add nav item in `/src/app/components/Sidebar.tsx` (if needed)
4. Use consistent layout: `max-w-5xl mx-auto px-8 py-8` wrapper
5. Use consistent header structure (see SCREENS.md)

**To add a new component:**
1. If shadcn/ui component: Use existing from `/src/app/components/ui/`
2. If custom component: Create in `/src/app/components/` or inline in page
3. Follow design tokens from design-tokens.json
4. Use consistent prop naming (className, children, onClick, etc.)

**To update styling:**
1. Check `/src/styles/theme.css` for design tokens
2. Use Tailwind utility classes (prefer utilities over custom CSS)
3. Maintain consistency with existing pages

**To add data/state:**
1. Update DataContext (`/src/app/data/DataContext.tsx`)
2. Add types in same file or separate `.types.ts`
3. Update mockData.ts if needed for sample data

### Testing Checklist

- [ ] All routes accessible via sidebar
- [ ] Responsive on mobile, tablet, desktop
- [ ] Keyboard navigation works
- [ ] Modals close with ESC key
- [ ] Forms validate before submit
- [ ] Toast notifications appear on actions
- [ ] Loading states show during async operations
- [ ] Empty states display when no data
- [ ] Error states handle failures gracefully
- [ ] Back buttons navigate correctly
- [ ] External links open in new tab

### Browser Support

Target browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile Safari (iOS 15+)

---

## Implementation Prompts for Cursor

### Prompt 1: Understand the Project
```
Read /figma-export/PROJECT_DESCRIPTION.md and summarize:
1. What does this application do?
2. Who are the users?
3. What are the main workflows?
4. What is the current tech stack?
```

### Prompt 2: Review Design System
```
Read /figma-export/design-tokens.json and /figma-export/COMPONENT_INVENTORY.md.
List all available UI components and their variants.
```

### Prompt 3: Implement a New Feature
```
Read /figma-export/SCREENS.md for the [Screen Name] screen.
Implement this screen following the exact specifications:
- Use the layout structure described
- Apply the correct design tokens
- Implement all interactions listed
- Handle all edge cases and empty states
```

### Prompt 4: Update Existing Screen
```
I need to update the [Screen Name] screen. 
Read /figma-export/SCREENS.md section for [Screen Name].
Current implementation is in /src/app/pages/[FileName].tsx.
Update to match the spec exactly, maintaining consistency with design-tokens.json.
```

### Prompt 5: Fix Inconsistencies
```
Review all files in /src/app/pages/ and check for:
1. Inconsistent max-width (should be max-w-5xl)
2. Inconsistent typography (see design-tokens.json)
3. Inconsistent spacing (section: mb-8, cards: gap-6)
4. Inconsistent button sizes (small: h-8, default: h-9)
Fix any issues to match the design system.
```

### Prompt 6: Add User Flow
```
Read /figma-export/NAVIGATION.md section on "[Flow Name]".
Implement this complete user flow from start to finish:
- Ensure all navigation links work
- Add all necessary modals/dialogs
- Implement all state changes
- Add toast notifications for user feedback
```

### Prompt 7: Create Component
```
I need a new [ComponentName] component.
Based on /figma-export/COMPONENT_INVENTORY.md and design-tokens.json:
1. Create the component file
2. Implement all variants listed
3. Add proper TypeScript types
4. Follow the design system exactly
5. Make it responsive
```

### Prompt 8: Debug Issue
```
There's an issue with [feature/page/component].
Expected behavior: [describe]
Current behavior: [describe]
Relevant specs: /figma-export/SCREENS.md section [X]
Fix the issue while maintaining design consistency.
```

---

## Design Decision Rationale

### Why max-w-5xl?
- Optimal reading width for data-dense content
- Generous margins create breathing room
- Centered layout feels premium and focused
- Matches reference design aesthetic

### Why Tailwind v4?
- Modern, performant
- No config file needed
- CSS-first approach
- Better DX for design tokens

### Why React Router v7 (Data mode)?
- Server-ready architecture (future SSR/SSG)
- Better data loading patterns
- Type-safe routing
- Modern React Router pattern

### Why shadcn/ui?
- Copy-paste components (full control)
- Built on Radix UI (accessibility)
- Consistent with design system
- Easy to customize

### Why Context API (not Redux/Zustand)?
- Simple state needs
- Small team, straightforward data flow
- No complex async or middleware needed
- Easy to understand and maintain

### Why mock data?
- Phase 1 & 2 implementation focus on UX
- Real API integration comes later
- Faster iteration during design phase
- Easy to test edge cases

---

## Maintenance & Updates

### When to update this export:

1. **Design changes**: Update design-tokens.json and affected SCREENS.md sections
2. **New screens**: Add to SCREENS.md and NAVIGATION.md
3. **New components**: Update COMPONENT_INVENTORY.md
4. **New flows**: Update NAVIGATION.md
5. **Tech stack changes**: Update PROJECT_DESCRIPTION.md

### Version control:

- Tag exports with version/date: `figma-export-v1-2026-02-17`
- Keep previous versions for reference
- Document changes in changelog

### Handoff to developers:

1. Share `/figma-export/` folder
2. Point to PROJECT_DESCRIPTION.md as starting point
3. Ensure they have access to Figma file (if applicable)
4. Provide example prompts for Cursor AI
5. Schedule walkthrough call if needed

---

## Questions & Troubleshooting

### "I can't find component X"
- Check COMPONENT_INVENTORY.md for location
- May be inline in a page file (not extracted yet)
- Could be a shadcn/ui component in /components/ui/

### "Design token doesn't match implementation"
- Implementation is source of truth (it's working)
- Update design-tokens.json to reflect current code
- This export documents existing implementation

### "Screen spec differs from current code"
- Code is source of truth if it's working
- Update SCREENS.md to match implementation
- Note: This export reflects Phase 1 & 2A completion

### "Missing information in specs"
- Refer to actual code implementation
- Use design-tokens.json for visual design details
- Check NAVIGATION.md for interaction patterns

### "Need to add new feature"
- Follow existing patterns in SCREENS.md
- Use design tokens from design-tokens.json
- Add to NAVIGATION.md if it's a new flow
- Update COMPONENT_INVENTORY.md if new components

---

## Success Criteria

Implementation is successful when:
- ✅ All 12 screens match SCREENS.md specs
- ✅ Design system consistency across all pages
- ✅ All user flows in NAVIGATION.md work end-to-end
- ✅ Responsive on mobile, tablet, desktop
- ✅ Keyboard accessible throughout
- ✅ Empty states and error states handled
- ✅ Loading states smooth and informative
- ✅ Toast notifications confirm user actions
- ✅ No console errors or warnings
- ✅ Fast performance (< 2s initial load)

---

## Contact & Support

For questions about this export:
- Reference the source code in `/src/app/`
- Check design-tokens.json for design details
- Review SCREENS.md for specific screen questions
- See NAVIGATION.md for user flow questions

This export is a **documentation snapshot** of the working implementation as of Phase 2A completion (2026-02-17).

# Nivo Group Investment Platform - Figma Export

**Export Date:** February 17, 2026  
**Project Phase:** Phase 2A Complete (AI Analysis MVP)  
**Export Type:** Documentation of existing implementation

---

## 📁 What's in This Export

```
figma-export/
├── README.md                    ← You are here
├── PROJECT_DESCRIPTION.md       ← Start here: Complete project overview
├── IMPLEMENTATION_GUIDE.md      ← For Cursor AI: How to use this export
├── design-tokens.json           ← All design system tokens
├── COMPONENT_INVENTORY.md       ← Every UI component documented
├── SCREENS.md                   ← 12 detailed screen specifications
├── NAVIGATION.md                ← User flows and navigation patterns
├── BACKEND_INTEGRATION.md       ← **NEW: Complete backend API integration guide**
└── assets/
    └── README.md                ← Asset requirements (icons, logos)
```

---

## 🚀 Quick Start for Developers

### 1️⃣ Read the Project Description
Start with **[PROJECT_DESCRIPTION.md](./PROJECT_DESCRIPTION.md)** to understand:
- What the app does (investment platform for screening companies)
- Tech stack (React, TypeScript, Tailwind v4, React Router v7)
- Current implementation status (Phase 1 & 2A complete)
- File structure and architecture

### 2️⃣ Review the Design System
Check **[design-tokens.json](./design-tokens.json)** for:
- Colors (primary, gray scale, status colors)
- Typography (sizes, weights, line heights)
- Spacing scale (4px base unit)
- Border radius, shadows, breakpoints

### 3️⃣ Explore Components
See **[COMPONENT_INVENTORY.md](./COMPONENT_INVENTORY.md)** for:
- All UI components (Button, Card, Input, Select, etc.)
- Component variants and states
- Props and file locations
- Custom application components

### 4️⃣ Study Screen Specs
Read **[SCREENS.md](./SCREENS.md)** for detailed specs on all 12 screens:
- Dashboard - Work overview
- Universe - Browse/filter 13k companies
- Lists - List management
- Prospects - Pipeline tracking
- AI Lab - AI-powered analysis
- Admin - System configuration
- And 6 more...

### 5️⃣ Understand User Flows
Review **[NAVIGATION.md](./NAVIGATION.md)** for:
- Primary user workflows
- Navigation patterns
- Modal/dialog flows
- Error and empty states
- Keyboard shortcuts

### 6️⃣ Implement with Cursor
Use **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** for:
- Cursor AI prompts and examples
- Common modification patterns
- Testing checklist
- Troubleshooting tips

### 7️⃣ Connect to Backend (CRITICAL)
Read **[BACKEND_INTEGRATION.md](./BACKEND_INTEGRATION.md)** for:
- **Complete mapping of all mock data locations**
- Exact API endpoint specifications (35+ endpoints documented)
- Step-by-step replacement strategy
- TypeScript types for all entities
- React Query integration guide
- Test checklist for backend APIs

---

## 🎯 Project Summary

**Nivo Group Investment Platform** is an internal tool for a 3-person team to:
1. **Screen** 13,421 companies with advanced filters
2. **Shortlist** companies into working lists (private or team)
3. **Research** companies manually with collaborative notes
4. **Analyze** using AI-powered prompt templates (OpenAI)
5. **Track** prospects through acquisition pipeline
6. **Manage** team, API config, and system settings

**Key Features:**
- ✅ Advanced filtering with nested AND/OR logic
- ✅ List management (private/team, by stage)
- ✅ AI analysis with 3 predefined templates
- ✅ Prospect pipeline with status tracking
- ✅ Collaborative notes on prospects
- ✅ Admin panel with 5 tabs
- ✅ Responsive design (desktop, tablet, mobile)
- ✅ Keyboard accessible throughout

**Tech Highlights:**
- React 18 + TypeScript
- Tailwind CSS v4 (no config file)
- React Router v7 (Data mode)
- shadcn/ui + Radix UI components
- Lucide React icons
- Context API for state

---

## 📐 Design System at a Glance

### Layout
- **Max Width:** 1024px (max-w-5xl)
- **Page Padding:** 32px (px-8 py-8)
- **Background:** Gray-50 (#f9fafb)
- **Cards:** White, border-gray-200, rounded-lg

### Typography
- **Page Title (h1):** 24px semibold, gray-900
- **Section Heading (h2):** 16px medium, gray-900
- **Body Text:** 14px normal, gray-600
- **Caption:** 12px normal, gray-500

### Colors
- **Primary:** Blue-500 (#3b82f6)
- **Success:** Green-500 (#10b981)
- **Warning:** Yellow-500 (#f59e0b)
- **Error:** Red-500 (#ef4444)
- **Gray Scale:** 50-900

### Spacing
- **Base Unit:** 4px
- **Section Gap:** 32px (mb-8)
- **Card Gap:** 24px (gap-6)
- **Card Padding:** 24px (p-6)

### Components
- **Button:** 3 sizes (h-8, h-9, h-10), 5 variants
- **Card:** With header, content, footer sub-components
- **Input:** Text, number, search, password types
- **Select:** Dropdown with trigger and options
- **Badge:** Status indicators with color coding
- **Dialog:** Modal with overlay and content
- **Table:** Responsive with hover states
- **Tabs:** Horizontal with active state
- And 15+ more...

---

## 📱 Screens Overview

| # | Screen | Route | Purpose |
|---|--------|-------|---------|
| 1 | Dashboard | `/` | Work overview, quick stats |
| 2 | Universe | `/universe` | Browse/filter 13k companies |
| 3 | Company Detail | `/companies/:id` | Single company deep dive |
| 4 | My Lists | `/lists` | Manage working lists |
| 5 | List Detail | `/lists/:id` | View companies in list |
| 6 | Prospects | `/prospects` | Pipeline management |
| 7 | AI Lab | `/ai-lab` | AI analysis hub |
| 8 | Create Run | `/ai-lab/create-run` | New AI analysis form |
| 9 | Run Detail | `/ai-lab/runs/:id` | Progress tracking |
| 10 | Run Results | `/ai-lab/runs/:id/results` | Analysis results viewer |
| 11 | Admin Panel | `/admin` | System configuration (5 tabs) |
| 12 | Not Found | `*` | 404 error page |

---

## 🔄 Primary User Flows

### Flow 1: Discovery → List
Universe → Apply Filters → Create List → View List

### Flow 2: Research
Lists → Select List → Review Companies → Add Notes

### Flow 3: AI Analysis
List Detail → Run AI Analysis → Select Template → Start Run → Review Results → Approve/Reject

### Flow 4: Pipeline
Prospects → Update Status → Add Notes → Track Progress

### Flow 5: Dashboard
Dashboard → Quick Overview → Navigate to Lists/Prospects

### Flow 6: Admin
Admin → Configure Team/API/Settings → View Audit Log

---

## 🛠️ For Cursor AI / Codex

### Example Prompt 1: New Feature
```
Read /figma-export/SCREENS.md section for [Screen Name].
Implement this screen following the exact specifications.
Use design tokens from /figma-export/design-tokens.json.
```

### Example Prompt 2: Update Styling
```
Review /figma-export/design-tokens.json and update all pages in /src/app/pages/
to use consistent:
- max-w-5xl layout
- text-2xl page titles
- text-base section headings
- mb-8 section spacing
```

### Example Prompt 3: Add User Flow
```
Read /figma-export/NAVIGATION.md section "Flow 3: AI Analysis".
Implement this complete flow with all navigation, modals, and state changes.
```

See [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) for more prompts and patterns.

---

## 📦 What's NOT in This Export

This export documents the **existing implementation**, not a Figma design file. Therefore:

- ❌ No Figma file URL (code-first project)
- ❌ No exported PNG screenshots (see live app)
- ❌ No custom image assets (using Lucide icons only)
- ❌ No logo files yet (placeholder in sidebar)
- ❌ No Figma node IDs (not from Figma)

**This is a specification export of working code**, not a design-to-code handoff.

---

## ✅ Implementation Status

### Completed (Phase 1 & 2A)
- [x] All 12 screens implemented
- [x] Complete navigation with sidebar
- [x] Advanced filtering (AND/OR, include/exclude)
- [x] List management (private/team)
- [x] Prospects pipeline with notes
- [x] AI Lab with 3 templates
- [x] Run creation and progress tracking
- [x] Results viewer with approve/reject
- [x] Admin panel (5 tabs)
- [x] Responsive design
- [x] Design system consistency (Phase 2B update)

### Future Enhancements (Not in Scope)
- [ ] Real backend API integration
- [ ] Real-time collaboration
- [ ] Advanced charting/visualizations
- [ ] Email notifications
- [ ] Document upload
- [ ] CRM integration

---

## 📞 Support & Questions

### Where to find information:
- **Project overview:** [PROJECT_DESCRIPTION.md](./PROJECT_DESCRIPTION.md)
- **Design system:** [design-tokens.json](./design-tokens.json)
- **Components:** [COMPONENT_INVENTORY.md](./COMPONENT_INVENTORY.md)
- **Screen specs:** [SCREENS.md](./SCREENS.md)
- **User flows:** [NAVIGATION.md](./NAVIGATION.md)
- **Implementation help:** [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)

### Can't find what you need?
- Check the actual code in `/src/app/`
- Design tokens file: `/src/styles/theme.css`
- Mock data: `/src/app/data/mockData.ts`
- Component library: `/src/app/components/ui/`

---

## 📄 Document Versions

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-17 | Initial export after Phase 2A completion |
| 1.1 | 2026-02-17 | Added consistent design system (max-w-5xl, typography) |

---

## 🎓 Learning Resources

**React Router v7 (Data Mode):**
- https://reactrouter.com/

**Tailwind CSS v4:**
- https://tailwindcss.com/

**shadcn/ui Components:**
- https://ui.shadcn.com/

**Radix UI Primitives:**
- https://www.radix-ui.com/

**Lucide Icons:**
- https://lucide.dev/

---

**Made with ❤️ for the Nivo Group investment team**

Last updated: February 17, 2026
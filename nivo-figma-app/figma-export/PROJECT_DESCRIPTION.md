# Nivo Group Investment Platform - Project Description

## Overview
An internal investment platform for a 3-person team at Nivo Group to screen, shortlist, and acquire small/medium businesses from a universe of ~13,000 companies with 4-year financials.

## Tech Stack
- **Frontend**: React 18 + TypeScript
- **Routing**: React Router v7 (Data mode)
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui + Radix UI primitives
- **Icons**: Lucide React
- **State Management**: React Context (DataContext)
- **Build Tool**: Vite

## Core Functionality

### 1. Universe Management
- Browse and filter 13k+ companies
- Complex filtering with nested logic (AND/OR groups)
- Include/exclude rules across financial KPIs
- Real-time filter results

### 2. List Management
- Create working lists of prospects
- Personal (private) and team (shared) workspaces
- Lists organized by stage: research, ai_analysis, finalists
- Manual company research workflow

### 3. Prospects Pipeline
- Track companies through sales funnel
- Status tracking: new → contacted → in discussion → interested
- Team collaboration with notes
- Status management and progress tracking

### 4. AI Analysis Lab
- AI-powered company analysis via OpenAI API
- 3 predefined prompt templates:
  - Strategic Fit Analysis
  - Financial Health Assessment  
  - Acquisition Opportunity Score
- Run creation and progress tracking
- Results viewer with approve/reject functionality
- AI insights integration across all pages

### 5. Admin Panel
- System overview and metrics
- Team management
- API configuration (OpenAI)
- System settings
- Audit logging

## User Personas
- **Sarah Chen** - Team Lead, primary user
- **Mike Rodriguez** - Analyst
- **Lisa Park** - Research Specialist

## Key Workflows

### Primary Flow: Company Discovery to Acquisition
1. **Universe** → Filter companies by criteria
2. **Lists** → Create working list from filtered results
3. **Research** → Manual research, add notes
4. **AI Lab** → Run AI analysis on shortlist
5. **Prospects** → Move approved companies to pipeline
6. **Track** → Monitor deal progress to close

### Supporting Flows
- **Dashboard** → Overview of all work in progress
- **Company Detail** → Deep dive on single company
- **Admin** → System configuration and monitoring

## Data Model

### Company
- Basic info: name, website, location, industry
- Financial metrics: revenue, ebitda, employees, growth rates
- Coverage status for each data field
- Year-over-year data (4 years)

### List
- Metadata: name, description, owner, scope (private/team), stage
- Company IDs array
- Timestamps: created, updated

### Prospect
- Company reference
- Status: new, researching, contacted, in_discussion, meeting_scheduled, interested, not_interested, passed, deal_in_progress
- Notes array (user, text, timestamp)
- Assignment: owner, priority, next_action

### AI Run
- Prompt template reference
- Target company IDs
- Status: draft, pending, running, completed, failed
- Results: per-company analysis, scores, recommendations
- User actions: approved/rejected companies

## Design Principles
1. **Clean & Centered**: Max-width containers (5xl) with generous margins
2. **Consistent Typography**: Clear hierarchy (h1: 2xl, h2: base, body: sm)
3. **Data Density**: Show key metrics without overwhelming
4. **Progressive Disclosure**: Expand for details, collapse for overview
5. **Status Clarity**: Clear visual indicators for progress/state
6. **Fast Filtering**: Real-time filter results, no page reload
7. **Keyboard Friendly**: Support power users with shortcuts
8. **Mobile Responsive**: Works on laptop, tablet, phone

## Navigation Structure
```
Dashboard (Home)
├── Prospects (sub-item)
Universe (Browse & Filter)
Lists (My Lists)
AI Lab (AI Analysis)
Admin Panel
```

## Current Implementation Status

### ✅ Completed (Phase 1 & 2A)
- Complete navigation with sidebar
- Dashboard with work overview
- Universe page with advanced filtering
- List creation and management
- Prospects page with status tracking
- AI Lab with 3 templates
- Run creation and progress tracking
- Results viewer with approve/reject
- Company detail pages
- Admin panel (5 tabs)
- AI Insights integration
- Complete note management

### 🎯 Design Goals
- Maintain consistent max-w-5xl centered layout
- Use gray-50 background for all pages
- Standardized spacing (mb-8 sections, gap-6 cards)
- Consistent button sizing (h-8 small, h-9 default)
- Clean card design (bg-white, border-gray-200, rounded-lg)

## File Structure
```
src/
├── app/
│   ├── App.tsx                 # Router provider
│   ├── routes.ts               # Route configuration
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── Sidebar.tsx         # Main navigation
│   │   ├── FilterBuilder.tsx   # Complex filter UI
│   │   └── TemplateDialog.tsx  # AI template picker
│   ├── pages/
│   │   ├── Root.tsx            # Layout wrapper
│   │   ├── WorkDashboard.tsx   # Dashboard
│   │   ├── Universe.tsx        # Browse companies
│   │   ├── MyLists.tsx         # List management
│   │   ├── ListDetail.tsx      # Single list view
│   │   ├── Prospects.tsx       # Pipeline management
│   │   ├── AILab.tsx           # AI analysis hub
│   │   ├── CreateRun.tsx       # New AI run
│   │   ├── RunDetail.tsx       # Run progress
│   │   ├── RunResults.tsx      # Analysis results
│   │   ├── CompanyDetail.tsx   # Company deep dive
│   │   └── Admin.tsx           # Admin panel
│   └── data/
│       ├── DataContext.tsx     # Global state
│       └── mockData.ts         # Sample data
└── styles/
    ├── theme.css               # Design tokens
    └── fonts.css               # Font imports
```

## API Integration Points (Mock for now)
- `GET /api/companies` - Fetch universe
- `GET /api/companies/:id` - Single company
- `POST /api/lists` - Create list
- `PUT /api/lists/:id` - Update list
- `POST /api/prospects` - Create prospect
- `PUT /api/prospects/:id` - Update prospect status
- `POST /api/ai/runs` - Create AI analysis run
- `GET /api/ai/runs/:id` - Get run status/results
- `POST /api/ai/runs/:id/approve` - Approve company
- `POST /api/ai/runs/:id/reject` - Reject company

## Browser Support
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile Safari (iOS 15+)

## Performance Targets
- Initial page load: < 2s
- Filter results: < 200ms
- List operations: < 100ms
- Smooth 60fps animations

## Accessibility Requirements
- WCAG 2.1 AA compliance
- Keyboard navigation throughout
- Screen reader support
- Focus management in modals/dialogs
- Color contrast ratios meet standards

## Future Enhancements (Not in Scope)
- Real-time collaboration
- Advanced charting/visualizations
- Email notifications
- Document upload/attachment
- Deal room integration
- CRM integration

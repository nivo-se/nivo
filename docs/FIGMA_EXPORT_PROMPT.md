# Figma Export Prompt for Codex Implementation

**Copy the prompt below into Figma (AI features, plugins, or manual export instructions) to prepare a developer-ready export.**

---

## PROMPT FOR FIGMA

```
I need to export this Figma design project for a developer (Cursor/Codex) to implement in code. Please prepare the following so the export is fully understandable:

### 1. Design tokens (export as JSON or markdown)
Create a single file `design-tokens.json` (or `DESIGN_TOKENS.md`) containing:
- **Colors**: hex values, semantic names (e.g. primary, secondary, background, text, muted)
- **Typography**: font families, sizes (px), weights, line heights for each text style
- **Spacing**: base unit (e.g. 4px, 8px), scale (4, 8, 12, 16, 24, 32, 48, 64)
- **Border radius**: values used (e.g. sm: 4px, md: 8px, full: 9999px)
- **Shadows**: elevation levels if used
- **Breakpoints** (if responsive): mobile, tablet, desktop widths

### 2. Component inventory (markdown)
Create `COMPONENT_INVENTORY.md` listing:
- Every reusable component (Button, Card, Input, etc.)
- Variants (e.g. Button: primary, secondary, ghost)
- Key props/states (disabled, loading, error)
- Which Figma frame/node ID maps to each component

### 3. Screen-by-screen spec (markdown)
Create `SCREENS.md` with one section per screen/page:
- **Screen name** (e.g. Login, Dashboard, Universe)
- **Route/path** (e.g. /app/universe, /auth)
- **Layout**: header, sidebar, main area structure
- **Components used**: list in order
- **Interactions**: what happens on click, hover, submit
- **Responsive behavior**: what changes at mobile/tablet/desktop
- **Figma node ID** for this screen (e.g. node-id=123:456)
- **Notes**: any special logic, empty states, error states

### 4. Asset export
- **Icons**: Export as SVG (single icons, not entire frames). Name by use (e.g. `icon-search.svg`, `icon-user.svg`)
- **Images**: Export as PNG or WebP. Name descriptively (e.g. `hero-bg.png`, `logo.svg`)
- **Illustrations**: Same as images
- Place all in an `assets/` folder with subfolders: `icons/`, `images/`

### 5. Master export structure
Organize the export so the folder structure looks like:

```
figma-export/
├── design-tokens.json (or DESIGN_TOKENS.md)
├── COMPONENT_INVENTORY.md
├── SCREENS.md
├── assets/
│   ├── icons/
│   ├── images/
│   └── illustrations/
└── screens/           (optional: PNG exports of each key screen for reference)
    ├── login.png
    ├── dashboard.png
    └── ...
```

### 6. Figma URLs
In SCREENS.md, include the full Figma URL for each screen, e.g.:
`https://figma.com/design/FILE_KEY/FileName?node-id=123-456`
This allows the developer to inspect specifics in Figma if needed.

### 7. Copy / naming conventions
- Use descriptive names (not "Frame 47")
- For buttons/inputs: include the default placeholder or label text
- For lists/tables: note the number of sample rows and column headers

### 8. Flows and navigation
Add a `NAVIGATION.md` or section in SCREENS.md describing:
- App shell: sidebar items, top bar items
- Main user flows (e.g. Login → Dashboard → Universe → Company detail)
- Modal/drawer flows
- Back/cancel behavior
```

---

## AFTER EXPORT: Where to put files

1. Create a branch: `git checkout -b figma-ux-implementation`
2. Copy the `figma-export/` folder into the project root (or `docs/figma-export/`)
3. In Cursor, tell the AI: *"I've added a Figma export in `figma-export/`. Read DESIGN_TOKENS.md, COMPONENT_INVENTORY.md, and SCREENS.md, then implement the new UX. Our stack is React, Tailwind, shadcn/ui. Replace the existing [Universe / Dashboard / etc.] with the new design."*

---

## MCP alternative (simpler, but per-screen)

If you use **Figma MCP** in Cursor instead:
- Share **one Figma URL per screen** you want implemented
- I can fetch design context and generate code directly
- Limitation: I work screen-by-screen; you need to share each URL

**Best of both**: Use the export for the full spec + MCP for live inspection when something is ambiguous.

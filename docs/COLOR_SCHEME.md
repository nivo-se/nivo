# Nivo color scheme

**Single source of truth:** `frontend/src/styles/design-tokens.css`

All colors are defined as CSS variables. Components use semantic Tailwind classes that reference these variables.

## How it works

1. **design-tokens.css** — Defines `:root` (light) and `.dark` (dark mode)
2. **tailwind.config.ts** — Maps variables to utilities (`bg-background`, `text-foreground`, etc.)
3. **ThemeProvider** — Uses `attribute="class"` to toggle `.dark` on the root for dark mode

## Light theme

- Page background: #F7F7F4 (warm off-white)
- Cards: #F2F1ED
- Primary buttons: #A6B7E9 with white text
- Borders: #CBCAC6
- Primary text: darker gray (50 6% 26%) for readability

## Dark theme

- Page background: #14120C (warm near-black)
- Cards: #242320
- Primary: #3662E3 (blue)
- Charts: blue (#3662E3) + cyan (#92BBCA) lines

## Token reference

| Token | Use |
|-------|-----|
| `--background`, `--foreground` | Page/content base |
| `--card`, `--card-foreground` | Cards, dialogs |
| `--primary`, `--primary-foreground` | Primary buttons, links |
| `--secondary`, `--secondary-foreground` | Secondary actions |
| `--muted`, `--muted-foreground` | Labels, secondary text |
| `--accent`, `--accent-foreground` | Hover states |
| `--border`, `--input`, `--ring` | Borders, inputs, focus |
| `--chart-1`, `--chart-2`, `--chart-3` | Chart series colors |
| `--page-bg` | Main content area background |
| `--sidebar-*` | Sidebar nav (bg, border, active, inactive, hover) |

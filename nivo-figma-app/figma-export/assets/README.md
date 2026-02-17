# Asset Directory

This folder should contain all exported assets from Figma. Since this is a code-first project (not a Figma import), assets are minimal.

## Icons

All icons use **Lucide React** package (installed via npm).

**Package:** `lucide-react`

**Usage:**
```tsx
import { LayoutDashboard, Globe, List, Brain, Settings } from 'lucide-react';

<LayoutDashboard className="w-5 h-5" />
```

**Icons Used:**
- LayoutDashboard (Dashboard nav)
- Globe (Universe nav)
- List (Lists nav)
- Brain (AI Lab nav)
- Settings (Admin nav)
- Plus (Add actions)
- Trash2 (Delete actions)
- Pencil (Edit actions)
- Check (Confirm actions)
- X (Close/Cancel)
- ExternalLink (External links)
- ArrowRight (Navigation)
- Filter (Filter toggle)
- Search (Search input)
- Download (Export)
- Upload (Import)
- RefreshCw (Refresh)
- TrendingUp (Growth positive)
- TrendingDown (Growth negative)
- AlertCircle (Warning/Error)
- CheckCircle (Success)
- XCircle (Error)
- Clock (Pending)
- Zap (Quick action)
- ChevronDown (Dropdowns)
- ChevronRight (Expand)
- MoreHorizontal (More actions)
- Info (Information)
- Eye (View)
- EyeOff (Hide)

## Images

No custom images currently used. All visual content is:
- Text-based
- Icon-based
- Chart/graph-based (future: use Recharts library)

## Illustrations

No custom illustrations currently used.

## Logos

**Nivo Group Logo:**
- Location: Sidebar top (not yet implemented)
- Format: SVG or PNG
- Size: 140x32px (or scalable)
- Background: Transparent
- Colors: Brand colors

**If logo file exists:**
```
/assets/images/logo.svg
/assets/images/logo.png
/assets/images/logo@2x.png (retina)
```

**Usage in code:**
```tsx
import logo from './assets/images/logo.svg';

<img src={logo} alt="Nivo Group" className="h-8" />
```

## Favicons

**Files needed:**
- favicon.ico (16x16, 32x32, 48x48)
- favicon-16x16.png
- favicon-32x32.png
- apple-touch-icon.png (180x180)
- android-chrome-192x192.png
- android-chrome-512x512.png

**Location:** `/public/` folder

## Font Files

Currently using system fonts. No custom font files needed.

**Font stack:** `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

**If custom fonts needed:**
- Place in `/src/styles/fonts/`
- Add @font-face rules in `/src/styles/fonts.css`
- Update design-tokens.json with font family name

## Color Swatches

See `design-tokens.json` for complete color palette.

No separate swatch files needed - all colors defined in Tailwind/CSS.

## Export Checklist

- [x] Design tokens documented
- [x] Component inventory complete
- [x] Screen specs complete
- [x] Navigation flows documented
- [ ] Logo file exported (if exists)
- [ ] Favicons generated (if custom)
- [x] Icons documented (using Lucide)
- [ ] Custom images exported (none needed)
- [ ] Custom illustrations exported (none needed)

## Future Assets

**If/when needed:**
- Empty state illustrations
- Hero images
- Background patterns
- Company placeholder logos
- User avatar placeholders
- Chart/graph templates
- Email templates
- PDF report templates

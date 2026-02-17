# Images Directory

Currently no custom images in the project.

## Future Image Assets

If/when custom images are needed:

### Logo
- `logo.svg` - Main Nivo Group logo (scalable)
- `logo.png` - PNG fallback
- `logo@2x.png` - Retina version
- Size: ~140x32px (or maintain aspect ratio)

### Favicons
Place in `/public/` folder (not here):
- `favicon.ico`
- `favicon-16x16.png`
- `favicon-32x32.png`
- `apple-touch-icon.png` (180x180)
- `android-chrome-192x192.png`
- `android-chrome-512x512.png`

### Empty State Illustrations
- `empty-lists.svg` - For empty lists view
- `empty-prospects.svg` - For empty prospects view
- `empty-results.svg` - For empty filter results
- Style: Simple line drawings, brand colors

### Hero Images
- `dashboard-hero.jpg` - Optional dashboard hero
- Optimized for web (WebP format preferred)
- Max width: 1200px

## Naming Convention

- Use kebab-case: `my-image-name.png`
- Descriptive names: `hero-dashboard.jpg` not `image-1.jpg`
- Include size suffix if multiple sizes: `logo-32.png`, `logo-64.png`

## Optimization

- Use WebP for photos (better compression)
- Use SVG for icons and logos (scalable)
- Use PNG for screenshots or images needing transparency
- Compress before commit (TinyPNG, ImageOptim, etc.)

## Usage in Code

```tsx
// SVG (as component)
import { ReactComponent as Logo } from './assets/images/logo.svg';
<Logo className="h-8" />

// Image file
import logo from './assets/images/logo.png';
<img src={logo} alt="Nivo Group" className="h-8" />

// Or use ImageWithFallback component
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
<ImageWithFallback src={logo} alt="Nivo Group" className="h-8" />
```

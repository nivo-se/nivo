# Investor Pitch Deck — 16:9 Slide System

## Overview

The investor deck is a scrollable sequence of **16:9 slides**. Each slide is wrapped in a `SlideFrame` component so the experience feels like a pitch deck, not a long article.

## SlideFrame

**Purpose:** Enforces a strict 16:9 aspect-ratio canvas per slide and scales responsively.

**How it works:**

- **Outer container:** `aspect-ratio: 16/9`, `max-width: min(100%, 1280px)`, centered with `mx-auto`. Background is either `bg-deck-surface` (white) or `bg-deck-bg` (page grey) via the `variant` prop.
- **Inner area:** Absolutely fills the frame. Padding uses CSS variables so it scales with viewport:
  - `--deck-slide-padding-x`, `--deck-slide-padding-y` (clamp for small → large screens)
  - Extra right padding reserves space for the slide-number badge.
- **Badge:** Slide number and optional section label are positioned in the top-right corner.

**Usage:** In `FullPresentation.tsx`, each slide component is wrapped as:

```tsx
<SlideFrame sectionLabel={section.name} slideNum={slide.num} variant="surface" | "bg">
  <SlideComponent />
</SlideFrame>
```

Slides do **not** render their own outer wrapper; they only render the content that goes inside the frame.

## Creating a new slide

1. **Create a component** in `slides/` (e.g. `Slide22.tsx`) that returns a single root element.
2. **Root element:** Use `h-full flex flex-col min-h-0 overflow-hidden` and `gap-[var(--deck-slide-gap)]` so the slide fills the frame and uses the deck spacing token.
3. **Structure:**
   - **Title row:** `flex-shrink-0` with a heading and optional subtitle.
   - **Content:** `flex-1 min-h-0` so it takes remaining space. Use `overflow-auto` only if you have a single scrollable block (e.g. a table); otherwise keep content fitting.
   - **Footer/callout:** `flex-shrink-0` so it stays at the bottom.
4. **Typography:** Use deck tokens and responsive sizes, e.g. `text-lg sm:text-xl md:text-2xl` for titles, `text-xs sm:text-sm` for body, so mobile stays readable (effective ~14–16px body).
5. **Register the slide** in `FullPresentation.tsx`: add it to the appropriate section in the `sections` array and import the component.

## Keeping content within 16:9

- **No slide should exceed the 16:9 canvas.** Content is clipped to the frame.
- If a slide feels crowded:
  - Shorten copy (bullets, labels).
  - Reduce columns on small screens (`grid-cols-1 sm:grid-cols-2`).
  - Use smaller type or tighter spacing (`gap-2`, `p-2`).
  - Prefer KPI chips or condensed tables over long paragraphs.
- Use internal scrolling only when necessary (e.g. one scrollable table); prefer reflow and simplification.

## Deck theme tokens

Defined in `src/styles/theme.css` and Tailwind `deck` palette:

- **Colors:** `deck-fg`, `deck-accent`, `deck-bg`, `deck-surface`, `deck-border`, `deck-accent-border`, `deck-accent-foreground`, `deck-quote-foreground`, etc.
- **Slide layout:** `--deck-slide-padding-x`, `--deck-slide-padding-y`, `--deck-slide-gap`, `--deck-shadow-slide`, `--deck-shadow-card`.

Typography and spacing use Tailwind’s scale; deck-specific spacing uses the variables above for consistency across breakpoints.

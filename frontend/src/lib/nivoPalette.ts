/**
 * Nivo color palette: core (3) + neutrals, washes, and inks — same structure as Option A/B/C.
 * Core: Jet Black, Gray Olive, Platinum.
 */

/** Core Nivo — brand anchors (3) */
export const NIVO_CORE = {
  jetBlack: "#2E2A2B",
  grayOlive: "#596152",
  platinum: "#E6E6E6",
} as const;

/** UI neutrals (3) — backgrounds and borders */
export const NIVO_NEUTRALS = {
  warmWhite: "#FAFAF7",
  coolSurface: "#EEF1F4",
  border: "#D0D6CC",
} as const;

/** Washes / pastel tints (5) — cards, sections, gradients (a bit more punch) */
export const NIVO_WASHES = {
  oliveMuted: "#DEE4D8",
  sageMuted: "#D8E8DC",
  softSky: "#D4E6F8",
  softPeach: "#F5E6D8",
  softLilac: "#E2DAED",
} as const;

/** Inks / accents (2) — links, CTAs, charts */
export const NIVO_INKS = {
  deepTeal: "#0F6B63",
  forest: "#1E4D3C",
} as const;

/** Suggested gradient pairs (from → to) for cards/sections */
export const NIVO_GRADIENTS = [
  { name: "Olive muted → Soft peach", from: NIVO_WASHES.oliveMuted, to: NIVO_WASHES.softPeach },
  { name: "Soft sky → Soft peach", from: NIVO_WASHES.softSky, to: NIVO_WASHES.softPeach },
  { name: "Forest → Platinum", from: NIVO_INKS.forest, to: NIVO_CORE.platinum },
] as const;

/** All complementing colors (neutrals + washes + inks) */
export const NIVO_COMPLEMENTS = {
  ...NIVO_NEUTRALS,
  ...NIVO_WASHES,
  ...NIVO_INKS,
} as const;

/** Full Nivo palette — core + complements */
export const NIVO_PALETTE = {
  ...NIVO_CORE,
  ...NIVO_COMPLEMENTS,
} as const;

/** Text/ink color (Jet Black) */
export const NIVO_TEXT = NIVO_CORE.jetBlack;

/** Bento card gradient color sets — uses all Nivo washes + neutrals for variety */
export const NIVO_BENTO_COLORS = {
  text: NIVO_TEXT,
  bg: NIVO_NEUTRALS.warmWhite,
  card1: [NIVO_WASHES.oliveMuted, NIVO_WASHES.sageMuted, NIVO_WASHES.softSky],
  card2: [NIVO_WASHES.sageMuted, NIVO_NEUTRALS.border, NIVO_WASHES.oliveMuted],
  card3: [NIVO_WASHES.softPeach, NIVO_WASHES.oliveMuted, NIVO_WASHES.softLilac],
  card4: [NIVO_WASHES.oliveMuted, NIVO_WASHES.softSky, NIVO_WASHES.sageMuted],
  card5: [NIVO_WASHES.sageMuted, NIVO_WASHES.softPeach, NIVO_WASHES.softLilac],
} as const;

/** Aurora gradient — green-focused with forest & deep teal (2 greens swapped for inks) */
export const NIVO_AURORA_COLORS = [
  "#B0C8A8", // olive green — solid
  NIVO_INKS.forest, // #1E4D3C
  "#A0D8C0", // sage/mint — solid
  NIVO_INKS.deepTeal, // #0F6B63
  "#C0D8B0", // soft green — solid
] as const;

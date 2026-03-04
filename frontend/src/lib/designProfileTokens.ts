/**
 * Shared Nivo design profile tokens — used by DesignProfile (template) and Investor2 (real data).
 * Update here when the design system changes so both pages stay in sync.
 */

import {
  NIVO_CORE,
  NIVO_NEUTRALS,
  NIVO_WASHES,
  NIVO_INKS,
} from "@/lib/nivoPalette";

export const gradients = {
  box: `linear-gradient(145deg, ${NIVO_WASHES.oliveMuted} 0%, ${NIVO_NEUTRALS.warmWhite} 100%)`,
  soft: `linear-gradient(180deg, ${NIVO_WASHES.sageMuted} 0%, ${NIVO_WASHES.oliveMuted} 100%)`,
  warm: `linear-gradient(135deg, ${NIVO_WASHES.softPeach} 0%, ${NIVO_WASHES.oliveMuted} 100%)`,
  cool: `linear-gradient(180deg, ${NIVO_WASHES.softSky} 0%, ${NIVO_NEUTRALS.coolSurface} 100%)`,
  callout: `linear-gradient(90deg, ${NIVO_WASHES.sageMuted} 0%, ${NIVO_NEUTRALS.warmWhite} 100%)`,
  progress: `linear-gradient(90deg, ${NIVO_INKS.forest} 0%, ${NIVO_INKS.deepTeal} 100%)`,
  greenPlatinum: `linear-gradient(135deg, ${NIVO_INKS.forest} 0%, ${NIVO_CORE.platinum} 100%)`,
} as const;

export const tokens = {
  text: NIVO_CORE.jetBlack,
  textMuted: NIVO_CORE.grayOlive,
  bg: NIVO_NEUTRALS.warmWhite,
  bgAlt: NIVO_NEUTRALS.coolSurface,
  border: NIVO_NEUTRALS.border,
  accent: NIVO_INKS.forest,
  accentSecondary: NIVO_INKS.deepTeal,
  wash: NIVO_WASHES.oliveMuted,
  washSage: NIVO_WASHES.sageMuted,
  primaryBtn: NIVO_CORE.jetBlack,
  gradients,
} as const;

export const SECTION_CLASS = "max-w-4xl mx-auto px-5 sm:px-6 py-10 sm:py-14";

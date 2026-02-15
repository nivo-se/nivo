/**
 * Font configuration for the Nivo brand refresh.
 *
 * The project currently runs on Vite + React. Until we migrate to Next.js and can
 * leverage `next/font`, we provide a lightweight utility that mirrors the
 * variable-based API described in the brand brief. The `applyFontVariables`
 * helper injects the correct font stacks on the <html> element so that Tailwind
 * utility classes such as `font-heading` and `font-sans` resolve to the new
 * typography.
 */

const zapfFontStack = "'Zapf Humanist 601 Demi BT', 'Poppins', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Arial'";
const poppinsFontStack = "'Poppins', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Arial'";

export const zapfHumanist = {
  variable: '--font-zapf',
  fontFamily: zapfFontStack,
  weights: ['400', '700'],
} as const;

export const poppins = {
  variable: '--font-poppins',
  fontFamily: poppinsFontStack,
  weights: ['300', '400', '500', '600', '700'],
} as const;

export const applyFontVariables = () => {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;

  html.style.setProperty(zapfHumanist.variable, zapfHumanist.fontFamily);
  html.style.setProperty(poppins.variable, poppins.fontFamily);
};

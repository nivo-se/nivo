# Nivo Brand Refresh Migration Notes

## Designöversikt
- Kroppstexten använder Poppins med Platinum (#E6E6E6) som basbakgrund och Jet Black (#2E2A2B) som primär textfärg.
- Rubriker nyttjar Zapf Humanist 601 Demi BT (temporär fallback till Poppins) och färgas Jet Black för maximal kontrast.
- Primära interaktioner (knappar, ikoner) använder Gray Olive (#596152) och arbetar mot vita eller Platinum-ytor för tydlig hierarki.
- Kort och paneler använder vit bakgrund med mjuka skuggor på Platinum-bakgrunden för att skapa djup.

## Typsnittsladdning
- `frontend/src/styles/fonts.ts` ställer in variablerna `--font-zapf` och `--font-poppins` och applicerar dem på `<html>` via `applyFontVariables()` i `src/main.tsx`.
- Poppins hämtas via Google Fonts (`@import` i `src/index.css`).
- Zapf Humanist 601 Demi BT saknar licensfil i repo – placeholders ligger i `frontend/public/fonts/zapf/PLACEHOLDER.txt`. **TODO:** ersätt filerna med licensierade `.woff2` och uppdatera `@font-face` i `index.css` när licensen är klar.

## Aktivera dark mode
- Tailwind är konfigurerat med `darkMode: "class"`. Lägg till klassen `dark` på `<html>` för att aktivera mörkt tema.
- Dark mode-variabler finns i `src/index.css` och justerar bakgrund, text samt komponentytor för bibehållen kontrast.

## Kontrast-checklista
- ✅ Vit text på Gray Olive (primär knapp) uppfyller AA.
- ✅ Jet Black text på Platinum bakgrund uppfyller AA.
- ✅ Gray Olive text på vit bakgrund uppfyller AA för 16px+ text.
- ⚠️ Undvik Jet Black/70% på Platinum under 14px – använd full opacitet vid små storlekar.

## Styleguide
- Se `/styleguide`-sidan (implementerad i `frontend/src/pages/StyleGuide.tsx`) för exempel på typografi, knappar, kort och formulärkontroller i den nya designen.

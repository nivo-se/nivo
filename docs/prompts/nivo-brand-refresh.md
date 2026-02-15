Toppen — här är en Next.js + Tailwind-anpassad Codex-prompt du kan klistra in direkt. Den inkluderar typsnitt och färgkoder, och instruerar Codex exakt var och hur det ska uppdateras.

⸻

✅ Codex-prompt: Nivo brand refresh (Next.js 14 + Tailwind)

Uppdrag:
Gå igenom hela Nivo-webbplatsens frontend (Next.js 14 / App Router) och uppdatera UI så att det följer Nivo Brand Guidelines v1 (2025-10-07). Implementera nedan definierad typografi, färgpalett och logoregler. Leverera ändringar som kompletta filuppdateringar.

Designparametrar (att implementera)

Typsnitt
•Primär rubrikfont: Zapf Humanist 601 Demi BT Regular (lägg in lokalt via next/font/local, med licensfil om sådan finns; skapa robust fallback)
•Sekundär/brödtext: Poppins (via next/font/google), med systemfallbacks

Färger
•Gray Olive (primär): #596152
•Jet Black (sekundär text/bakgrund): #2E2A2B
•Platinum (ljus bakgrund/accent): #E6E6E6

Tekniska uppgifter (steg för steg)
1.Typsnittsintegrering

•Lägg Zapf-filer i public/fonts/zapf/ (placera placeholders om filer saknas).
•Skapa src/styles/fonts.ts som exporterar:
•zapfHumanist = localFont({ src: [...], display: 'swap', weight: '400 700', variable: '--font-zapf' })
•poppins = Poppins({ subsets: ['latin'], display: 'swap', weight: ['300','400','500','600','700'], variable: '--font-poppins' })
•I src/app/layout.tsx: importera och applicera className={${zapfHumanist.variable} ${poppins.variable}} på <html> och sätt bas-fonten på <body> via Tailwind-klasser.

2.Tailwind-konfiguration

•I tailwind.config.ts:
•Lägg till darkMode: 'class'.
•Utöka theme.colors med:

colors: {
  transparent: 'transparent',
  current: 'currentColor',
  grayOlive: '#596152',
  jetBlack: '#2E2A2B',
  platinum: '#E6E6E6',
}


•Utöka fontFamily:

fontFamily: {
  heading: ['var(--font-zapf)', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Arial'],
  sans: ['var(--font-poppins)', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Arial'],
}


3.Global CSS

•I src/app/globals.css:
•Sätt typografi-tokens:

:root {
  --nivo-c-primary: #596152;   /* Gray Olive */
  --nivo-c-text: #2E2A2B;      /* Jet Black */
  --nivo-c-bg: #E6E6E6;        /* Platinum */
}
body { @apply font-sans text-[color:var(--nivo-c-text)] bg-[color:var(--nivo-c-bg)]; }
h1,h2,h3,h4 { @apply font-heading; }


•Lägg in utility-klasser för knappar (primär/sekundär), länkar, kort och grid-gap med konsekvent spacing.

4.Komponentuppdateringar

•Uppdatera alla rubrikkomponenter (Hero, SectionHeading, PageTitle) att använda font-heading.
•Justera textfärger för rubriker och brödtext till text-jetBlack.
•Knappar:
•Primär: bg-grayOlive text-white hover:opacity-90 focus:ring-2 focus:ring-grayOlive/40
•Sekundär (outline): border border-grayOlive text-grayOlive hover:bg-grayOlive/10
•Ytor:
•Standardytor/kort: bg-white på platinum bakgrund, eller bg-platinum på white bakgrund, med tillräcklig kontrast.
•Navigations-/footerfärger: hög kontrast mot text, undvik låg kontrast mellan grayOlive och platinum för text.

5.Logo-regler (spacing & varianter)

•Respektera minsta frizon runt logotyp motsvarande 50% av logomärkets höjd på alla sidor.
•Använd ljus/dark variant för bästa kontrast beroende på bakgrund. Ingen distortion, skuggor eller overlay-effekter.

6.Tillgänglighet

•Säkerställ WCAG AA på alla primära texter/knappar.
•Kör en snabb kontrastpass: vit text på grayOlive är OK; undvik grå text på platinum under 16px.

7.Refaktor & sök/ersätt

•Ersätt gamla färgklasser/hex med de nya.
•Byt rubrikfont till font-heading; brödtext/komponenter till font-sans.
•Rensa inline-stilar som duplikat av Tailwind-klasser.

8.Responsivitet & dark mode

•Säkerställ att komponenter skalar snyggt (sm/md/lg/xl) och att dark-mode fungerar genom class-toggling på <html> eller <body>.

Leveranskrav (output från dig, Codex)
•Lista alla ändrade filer (t.ex. tailwind.config.ts, src/styles/fonts.ts, src/app/layout.tsx, src/app/globals.css, src/components/*).
•Visa den fulla uppdaterade koden per fil.
•Lägg till en MIGRATION_NOTES.md med:
•Översikt över designbeslut
•Hur typsnitt laddas
•Hur man aktiverar dark mode
•Kontrast-checklist
•Kör en snabb visuell audit i Storybook/Preview-sida om tillgängligt (annars skapa src/app/styleguide/page.tsx med exempel på knappar, rubriker, kort och formulärfält i nya stilen).

Antaganden & fallbacks
•Om Zapf Humanist 601-filer saknas: skapa temporär local-font med tom src och fallbacka till Poppins för rubriker tills filer finns. Lämna TODO i MIGRATION_NOTES.md.

⸻

Tips: Spara prompten i repo under docs/prompts/nivo-brand-refresh.md så finns den kvar nästa gång.

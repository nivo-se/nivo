/**
 * Design profile — Nivo palette asset template only.
 * Refactored: shared Section + tokens; assets only, no real data.
 *
 * Assets: Hero, Cards, Boxes, Buttons, Chart, Table, Form & list,
 *         Metrics, Quote, Image placeholder, Progress, Alert, Links, Tabs, Icon row.
 */

"use client";

import React from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { AnimatedGradient } from "@/components/ui/animated-gradient-with-svg";
import { Target, TrendingUp, BarChart3 } from "lucide-react";
import {
  NIVO_CORE,
  NIVO_NEUTRALS,
  NIVO_WASHES,
  NIVO_INKS,
  NIVO_GRADIENTS,
  NIVO_BENTO_COLORS,
  NIVO_AURORA_COLORS,
} from "@/lib/nivoPalette";
import { tokens, SECTION_CLASS } from "@/lib/designProfileTokens";

// ─── Palette data for Color palettes section ─────────────────────────────
const PALETTE_CORE = [
  { name: "Jet Black", hex: NIVO_CORE.jetBlack, role: "Core" },
  { name: "Gray Olive", hex: NIVO_CORE.grayOlive, role: "Core" },
  { name: "Platinum", hex: NIVO_CORE.platinum, role: "Core" },
] as const;
const PALETTE_NEUTRALS = [
  { name: "Warm white", hex: NIVO_NEUTRALS.warmWhite },
  { name: "Cool surface", hex: NIVO_NEUTRALS.coolSurface },
  { name: "Border", hex: NIVO_NEUTRALS.border },
] as const;
const PALETTE_WASHES = [
  { name: "Olive muted", hex: NIVO_WASHES.oliveMuted },
  { name: "Sage muted", hex: NIVO_WASHES.sageMuted },
  { name: "Soft sky", hex: NIVO_WASHES.softSky },
  { name: "Soft peach", hex: NIVO_WASHES.softPeach },
  { name: "Soft lilac", hex: NIVO_WASHES.softLilac },
] as const;
const PALETTE_INKS = [
  { name: "Deep teal", hex: NIVO_INKS.deepTeal },
  { name: "Forest", hex: NIVO_INKS.forest },
] as const;

// ─── Section wrapper (consistent layout + heading) ──────────────────────
function Section({
  title,
  bg = "bg",
  children,
}: {
  title: string;
  bg?: "bg" | "bgAlt";
  children: React.ReactNode;
}) {
  return (
    <section
      className={SECTION_CLASS}
      style={{ backgroundColor: bg === "bgAlt" ? tokens.bgAlt : tokens.bg }}
    >
      <h2 className="text-xl font-semibold mb-6" style={{ color: tokens.text }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

// ─── Hero (Aurora-style) ─────────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="relative">
      <AuroraBackground
        auroraColors={[...NIVO_AURORA_COLORS]}
        showRadialGradient
        className="!min-h-[85vh]"
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="relative flex flex-col gap-4 items-center justify-center px-4 text-center"
        >
          <h1 className="text-3xl md:text-6xl font-bold" style={{ color: tokens.text }}>
            Design profile
          </h1>
          <p className="font-extralight text-base md:text-2xl py-2 opacity-90" style={{ color: tokens.textMuted }}>
            Nivo palette — all design assets
          </p>
          <button
            type="button"
            className="rounded-md w-fit px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: tokens.primaryBtn }}
          >
            Primary button
          </button>
        </motion.div>
      </AuroraBackground>
    </section>
  );
}

// ─── Color palettes (Nivo swatches + gradient pairs) ──────────────────────
function PaletteSwatch({ name, hex, role }: { name: string; hex: string; role?: string }) {
  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden flex-shrink-0"
      style={{ border: `1px solid ${tokens.border}` }}
    >
      <div className="h-16 w-full min-w-[90px]" style={{ backgroundColor: hex }} title={`${name} ${hex}`} />
      <div className="p-2 border-t" style={{ borderColor: tokens.border, backgroundColor: tokens.bg }}>
        <p className="font-medium text-sm" style={{ color: tokens.text }}>{name}</p>
        <p className="font-mono text-xs mt-0.5" style={{ color: tokens.textMuted }}>{hex}</p>
        {role && <p className="text-xs mt-0.5 opacity-80" style={{ color: tokens.textMuted }}>{role}</p>}
      </div>
    </div>
  );
}

function PaletteGradientSwatch({ name, from, to }: { name: string; from: string; to: string }) {
  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden flex-shrink-0"
      style={{ border: `1px solid ${tokens.border}` }}
    >
      <div
        className="h-16 w-full min-w-[120px]"
        style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
        title={name}
      />
      <div className="p-2 border-t" style={{ borderColor: tokens.border, backgroundColor: tokens.bg }}>
        <p className="font-medium text-sm" style={{ color: tokens.text }}>{name}</p>
        <p className="font-mono text-xs mt-0.5" style={{ color: tokens.textMuted }}>{from} → {to}</p>
      </div>
    </div>
  );
}

function AssetColorPalettes() {
  return (
    <Section title="Color palettes">
      <div className="space-y-8">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: tokens.textMuted }}>Core</h3>
          <div className="flex flex-wrap gap-3">
            {PALETTE_CORE.map((c) => (
              <PaletteSwatch key={c.name} name={c.name} hex={c.hex} role={c.role} />
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: tokens.textMuted }}>Neutrals</h3>
          <div className="flex flex-wrap gap-3">
            {PALETTE_NEUTRALS.map((c) => (
              <PaletteSwatch key={c.name} name={c.name} hex={c.hex} />
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: tokens.textMuted }}>Washes</h3>
          <div className="flex flex-wrap gap-3">
            {PALETTE_WASHES.map((c) => (
              <PaletteSwatch key={c.name} name={c.name} hex={c.hex} />
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: tokens.textMuted }}>Inks</h3>
          <div className="flex flex-wrap gap-3">
            {PALETTE_INKS.map((c) => (
              <PaletteSwatch key={c.name} name={c.name} hex={c.hex} />
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: tokens.textMuted }}>Gradient pairs</h3>
          <div className="flex flex-wrap gap-3">
            {NIVO_GRADIENTS.map((g) => (
              <PaletteGradientSwatch key={g.name} name={g.name} from={g.from} to={g.to} />
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Gradient card (Bento-style, reusable) ───────────────────────────────
function GradientCard({
  title,
  value,
  subtitle,
  colors,
  delay = 0,
}: {
  title: string;
  value: string;
  subtitle: string;
  colors: readonly string[];
  delay?: number;
}) {
  return (
    <motion.div
      className="relative overflow-hidden min-h-[140px] rounded-xl border border-white/30 shadow-sm"
      style={{ backgroundColor: "rgba(255,255,255,0.6)" }}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ delay }}
    >
      <AnimatedGradient colors={[...colors]} speed={0.05} blur="medium" />
      <div className="relative z-10 p-5 backdrop-blur-sm" style={{ color: tokens.text }}>
        <p className="text-sm font-medium opacity-90" style={{ color: tokens.text }}>{title}</p>
        <p className="text-2xl font-semibold mt-1" style={{ color: tokens.text }}>{value}</p>
        <p className="text-sm opacity-80 mt-1" style={{ color: tokens.text }}>{subtitle}</p>
      </div>
    </motion.div>
  );
}

function AssetCards() {
  const cards = [
    { title: "Card title", value: "Value", subtitle: "Subtitle or description", colors: NIVO_BENTO_COLORS.card1 },
    { title: "Card title", value: "Value", subtitle: "Subtitle", colors: NIVO_BENTO_COLORS.card2 },
    { title: "Card title", value: "Value", subtitle: "Subtitle", colors: NIVO_BENTO_COLORS.card3 },
  ];
  return (
    <Section title="Cards">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((card, i) => (
          <GradientCard key={i} {...card} delay={i * 0.1} />
        ))}
      </div>
    </Section>
  );
}

// ─── Boxes ───────────────────────────────────────────────────────────────
function AssetBoxes() {
  return (
    <Section title="Boxes" bg="bgAlt">
      <div className="space-y-4">
        <div
          className="rounded-lg p-5"
          style={{ background: tokens.gradients.box, border: `1px solid ${tokens.border}` }}
        >
          <p className="text-sm font-medium opacity-80" style={{ color: tokens.text }}>Filled box</p>
          <p className="text-sm mt-1 opacity-70" style={{ color: tokens.textMuted }}>Gentle gradient + border</p>
        </div>
        <div
          className="rounded-lg p-5 bg-transparent"
          style={{ border: `2px solid ${tokens.border}` }}
        >
          <p className="text-sm font-medium opacity-80" style={{ color: tokens.text }}>Outline box</p>
          <p className="text-sm mt-1 opacity-70" style={{ color: tokens.textMuted }}>Border only</p>
        </div>
        <div
          className="rounded-r-lg py-3 pr-4 pl-4"
          style={{ borderLeft: `4px solid ${tokens.accent}`, background: tokens.gradients.callout }}
        >
          <p className="text-sm font-medium opacity-90" style={{ color: tokens.text }}>Callout / left-border</p>
          <p className="text-sm mt-1 opacity-75" style={{ color: tokens.textMuted }}>Accent border + gentle gradient</p>
        </div>
      </div>
    </Section>
  );
}

// ─── Buttons ─────────────────────────────────────────────────────────────
function AssetButtons() {
  return (
    <Section title="Buttons">
      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          className="rounded-md px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: tokens.primaryBtn }}
        >
          Primary
        </button>
        <button
          type="button"
          className="rounded-md px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: tokens.accent }}
        >
          Accent
        </button>
        <button
          type="button"
          className="rounded-md px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity border-2"
          style={{ borderColor: tokens.textMuted, color: tokens.textMuted, backgroundColor: "transparent" }}
        >
          Outline
        </button>
        <button
          type="button"
          className="rounded-md px-5 py-2.5 text-sm font-medium hover:opacity-80 transition-opacity"
          style={{ color: tokens.textMuted, backgroundColor: "transparent" }}
        >
          Ghost
        </button>
      </div>
    </Section>
  );
}

// ─── Chart ──────────────────────────────────────────────────────────────
const CHART_DATA = [
  { name: "A", value: 24 },
  { name: "B", value: 18 },
  { name: "C", value: 31 },
  { name: "D", value: 12 },
];

function AssetChart() {
  return (
    <Section title="Chart" bg="bgAlt">
      <div
        className="rounded-lg p-4 overflow-hidden"
        style={{ backgroundColor: tokens.bg, border: `1px solid ${tokens.border}` }}
      >
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={CHART_DATA} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.border} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: tokens.textMuted }} stroke={tokens.border} />
              <YAxis tick={{ fontSize: 12, fill: tokens.textMuted }} stroke={tokens.border} width={32} />
              <Bar dataKey="value" fill={tokens.accent} radius={[4, 4, 0, 0]} name="Value" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Section>
  );
}

// ─── Table ──────────────────────────────────────────────────────────────
const TABLE_ROWS = [
  { a: "Row 1", b: "Data", c: "—" },
  { a: "Row 2", b: "Data", c: "—" },
  { a: "Row 3", b: "Data", c: "—" },
];

function AssetTable() {
  return (
    <Section title="Table">
      <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${tokens.border}` }}>
        <table className="w-full text-sm">
          <thead style={{ background: tokens.gradients.soft }}>
            <tr>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: tokens.text }}>Column A</th>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: tokens.text }}>Column B</th>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: tokens.text }}>Column C</th>
            </tr>
          </thead>
          <tbody>
            {TABLE_ROWS.map((row, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${tokens.border}` }}>
                <td className="px-4 py-3" style={{ color: tokens.textMuted }}>{row.a}</td>
                <td className="px-4 py-3" style={{ color: tokens.textMuted }}>{row.b}</td>
                <td className="px-4 py-3" style={{ color: tokens.textMuted }}>{row.c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ─── Form & list ────────────────────────────────────────────────────────
const LIST_ITEMS = ["List item one", "List item two", "List item three"];

function AssetFormAndList() {
  return (
    <Section title="Form & list" bg="bgAlt">
      <div className="space-y-6 max-w-md">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: tokens.text }}>Input</label>
          <input
            type="text"
            placeholder="Placeholder"
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: tokens.border, color: tokens.text, backgroundColor: tokens.bg }}
            readOnly
            aria-hidden
          />
        </div>
        <div>
          <span
            className="inline-block px-3 py-1 rounded-full text-xs font-medium"
            style={{ background: tokens.gradients.soft, color: tokens.textMuted }}
          >
            Badge
          </span>
        </div>
        <ul className="space-y-2">
          {LIST_ITEMS.map((text, i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: tokens.accent }}
                aria-hidden
              />
              <span style={{ color: tokens.textMuted }}>{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

// ─── Metrics (KPI blocks) ────────────────────────────────────────────────
function AssetMetrics() {
  const items = [
    { value: "1,000", label: "Metric label" },
    { value: "20%", label: "Metric label" },
    { value: "4x", label: "Metric label" },
  ];
  return (
    <Section title="Metrics / KPI">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {items.map((item, i) => (
          <div
            key={i}
            className="rounded-lg p-5 text-center"
            style={{ background: tokens.gradients.soft, border: `1px solid ${tokens.border}` }}
          >
            <p className="text-2xl sm:text-3xl font-semibold tabular-nums" style={{ color: tokens.accent }}>{item.value}</p>
            <p className="text-sm mt-1" style={{ color: tokens.textMuted }}>{item.label}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── Quote ──────────────────────────────────────────────────────────────
function AssetQuote() {
  return (
    <Section title="Quote" bg="bgAlt">
      <blockquote
        className="pl-4 border-l-4 py-3 pr-4 rounded-r-lg text-lg font-medium italic"
        style={{ borderColor: tokens.accent, color: tokens.text, backgroundColor: tokens.bg }}
      >
        Quote or testimonial text. No real content — design asset only.
      </blockquote>
      <p className="text-sm mt-2" style={{ color: tokens.textMuted }}>— Attribution (optional)</p>
    </Section>
  );
}

// ─── Image placeholder ──────────────────────────────────────────────────
function AssetImagePlaceholder() {
  return (
    <Section title="Image placeholder">
      <div className="space-y-2">
        <div
          className="rounded-lg overflow-hidden flex items-center justify-center aspect-[21/9]"
          style={{ background: tokens.gradients.soft }}
        >
          <span className="text-sm font-medium opacity-60" style={{ color: tokens.textMuted }}>Image or screenshot</span>
        </div>
        <p className="text-sm" style={{ color: tokens.textMuted }}>Caption (optional)</p>
      </div>
    </Section>
  );
}

// ─── Progress bar ───────────────────────────────────────────────────────
function AssetProgress() {
  return (
    <Section title="Progress" bg="bgAlt">
      <div className="space-y-4 max-w-md">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span style={{ color: tokens.text }}>Label</span>
            <span style={{ color: tokens.textMuted }}>70%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: tokens.border }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: "70%", background: tokens.gradients.progress }}
            />
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Alert / notice ──────────────────────────────────────────────────────
function AssetAlert() {
  return (
    <Section title="Alert / notice">
      <div
        className="rounded-lg p-4"
        style={{ background: tokens.gradients.warm, border: `1px solid ${tokens.border}` }}
      >
        <p className="text-sm font-medium" style={{ color: tokens.text }}>Notice or info message.</p>
        <p className="text-sm mt-1 opacity-90" style={{ color: tokens.textMuted }}>Supporting detail — design asset only.</p>
      </div>
    </Section>
  );
}

// ─── Links ───────────────────────────────────────────────────────────────
function AssetLinks() {
  return (
    <Section title="Links" bg="bgAlt">
      <div className="flex flex-wrap gap-6">
        <a href="#" className="text-sm font-medium underline hover:opacity-80" style={{ color: tokens.text }}>Default link</a>
        <a href="#" className="text-sm font-medium underline hover:opacity-80" style={{ color: tokens.textMuted }}>Muted link</a>
        <a href="#" className="text-sm font-medium underline hover:opacity-80" style={{ color: tokens.accent }}>Accent link</a>
      </div>
    </Section>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────
function AssetTabs() {
  return (
    <Section title="Tabs">
      <div className="flex gap-1 border-b" style={{ borderColor: tokens.border }}>
        {["Tab one", "Tab two", "Tab three"].map((label, i) => (
          <button
            key={i}
            type="button"
            className="px-4 py-2.5 text-sm font-medium -mb-px"
            style={{
              color: i === 0 ? tokens.text : tokens.textMuted,
              borderBottom: i === 0 ? `2px solid ${tokens.text}` : "2px solid transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-lg p-4" style={{ background: tokens.gradients.box }}>
        <p className="text-sm" style={{ color: tokens.textMuted }}>Tab panel content — design asset only.</p>
      </div>
    </Section>
  );
}

// ─── Icon row (icon + title + description) ──────────────────────────────
function AssetIconRow() {
  const items = [
    { icon: Target, title: "Title", description: "Short description or label." },
    { icon: TrendingUp, title: "Title", description: "Short description or label." },
    { icon: BarChart3, title: "Title", description: "Short description or label." },
  ];
  return (
    <Section title="Icon row" bg="bgAlt">
      <div className="space-y-6">
        {items.map((item, i) => (
          <div key={i} className="flex gap-4">
            <div
              className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: tokens.gradients.soft, color: tokens.accent }}
            >
              <item.icon className="w-5 h-5" aria-hidden />
            </div>
            <div>
              <p className="font-semibold" style={{ color: tokens.text }}>{item.title}</p>
              <p className="text-sm mt-0.5" style={{ color: tokens.textMuted }}>{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────
function AssetDivider() {
  return (
    <Section title="Divider">
      <div className="space-y-6">
        <div className="h-px" style={{ backgroundColor: tokens.border }} aria-hidden />
        <p className="text-sm" style={{ color: tokens.textMuted }}>Section or content separator.</p>
      </div>
    </Section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────
export default function DesignProfile() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: tokens.bg }}>
      <header
        className="border-b px-4 sm:px-6 py-4 flex items-center justify-between"
        style={{ borderColor: tokens.border, backgroundColor: tokens.bg }}
      >
        <h1 className="text-lg font-semibold" style={{ color: tokens.text }}>Design profile</h1>
        <nav className="flex items-center gap-4 text-sm">
          <a href="/colors" className="underline hover:opacity-80" style={{ color: tokens.textMuted }}>Palettes</a>
          <a href="/colors/demos" className="underline hover:opacity-80" style={{ color: tokens.textMuted }}>Bento</a>
          <a href="/colors/aurora" className="underline hover:opacity-80" style={{ color: tokens.textMuted }}>Aurora</a>
        </nav>
      </header>

      <HeroSection />
      <AssetColorPalettes />
      <AssetCards />
      <AssetBoxes />
      <AssetButtons />
      <AssetChart />
      <AssetTable />
      <AssetFormAndList />
      <AssetMetrics />
      <AssetQuote />
      <AssetImagePlaceholder />
      <AssetProgress />
      <AssetAlert />
      <AssetLinks />
      <AssetTabs />
      <AssetIconRow />
      <AssetDivider />

      <footer
        className={SECTION_CLASS + " border-t text-center text-sm"}
        style={{ borderColor: tokens.border, color: tokens.textMuted }}
      >
        Nivo palette — design assets only. No content data.
      </footer>
    </div>
  );
}

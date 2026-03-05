/**
 * Color palette options for Nivo 2026 refresh.
 * Nivo palette (core + neutrals + washes + inks) + Option A, B, C.
 */

import {
  NIVO_CORE,
  NIVO_NEUTRALS,
  NIVO_WASHES,
  NIVO_INKS,
  NIVO_GRADIENTS,
} from "@/lib/nivoPalette";

const CORE = [
  { name: "Jet Black", hex: NIVO_CORE.jetBlack, role: "Core" },
  { name: "Gray Olive", hex: NIVO_CORE.grayOlive, role: "Core" },
  { name: "Platinum", hex: NIVO_CORE.platinum, role: "Core" },
] as const;

const NIVO_NEUTRALS_DISPLAY = [
  { name: "Warm white", hex: NIVO_NEUTRALS.warmWhite },
  { name: "Cool surface", hex: NIVO_NEUTRALS.coolSurface },
  { name: "Border", hex: NIVO_NEUTRALS.border },
] as const;

const NIVO_WASHES_DISPLAY = [
  { name: "Olive muted", hex: NIVO_WASHES.oliveMuted },
  { name: "Sage muted", hex: NIVO_WASHES.sageMuted },
  { name: "Soft sky", hex: NIVO_WASHES.softSky },
  { name: "Soft peach", hex: NIVO_WASHES.softPeach },
  { name: "Soft lilac", hex: NIVO_WASHES.softLilac },
] as const;

const NIVO_INKS_DISPLAY = [
  { name: "Deep teal", hex: NIVO_INKS.deepTeal },
  { name: "Forest", hex: NIVO_INKS.forest },
] as const;

const OPTION_A = {
  title: "Option A — Soft Pastel Gradients",
  subtitle: "Closest to pastel-card / screenshot vibe",
  neutrals: [
    { name: "Warm white", hex: "#FAFAF7" },
    { name: "Cool surface", hex: "#F3F5F7" },
    { name: "Hairline border", hex: "#D9DEE3" },
  ],
  washes: [
    { name: "Sky", hex: "#DCEBFF" },
    { name: "Mint", hex: "#DDF7EE" },
    { name: "Peach", hex: "#FFE7D6" },
    { name: "Lilac", hex: "#EEE3FF" },
    { name: "Blush", hex: "#FFD6E6" },
  ],
  inks: [
    { name: "Deep teal ink", hex: "#0F6B63" },
    { name: "Indigo ink", hex: "#2F3CDE" },
  ],
  gradients: [
    { name: "Sky → Mint", from: "#DCEBFF", to: "#DDF7EE" },
    { name: "Peach → Lilac", from: "#FFE7D6", to: "#EEE3FF" },
    { name: "Blush → Sky", from: "#FFD6E6", to: "#DCEBFF" },
  ],
};

const OPTION_B = {
  title: "Option B — Nordic Tech",
  subtitle: "Cooler, more premium, still soft",
  neutrals: [
    { name: "Off-white", hex: "#F7F8FA" },
    { name: "Cool gray", hex: "#EEF1F5" },
    { name: "Border", hex: "#D6DCE5" },
  ],
  tints: [
    { name: "Ice blue", hex: "#D8ECFF" },
    { name: "Fog cyan", hex: "#D8F7F3" },
    { name: "Soft periwinkle", hex: "#E1E3FF" },
  ],
  accents: [
    { name: "Cobalt", hex: "#2E4DFF" },
    { name: "Teal", hex: "#00A7A0" },
  ],
  signal: [{ name: "Neon lime (sparingly)", hex: "#B9FF5A" }],
};

const OPTION_C = {
  title: "Option C — Warm Editorial",
  subtitle: "Human + modern, pairs well with olive",
  neutrals: [
    { name: "Paper", hex: "#FBFAF6" },
    { name: "Sand", hex: "#F1EDE3" },
    { name: "Border", hex: "#E1DBCF" },
  ],
  pastels: [
    { name: "Butter", hex: "#FFF1C9" },
    { name: "Apricot", hex: "#FFE1CF" },
    { name: "Rose", hex: "#FFD6DE" },
    { name: "Sage tint", hex: "#DDE6DA" },
  ],
  accents: [
    { name: "Burgundy", hex: "#7A1F3D" },
    { name: "Forest ink", hex: "#1E4D3C" },
  ],
};

function Swatch({ name, hex, role }: { name: string; hex: string; role?: string }) {
  return (
    <div className="flex flex-col rounded-lg overflow-hidden border border-gray-200/80 shadow-sm">
      <div
        className="h-20 w-full min-w-[100px]"
        style={{ backgroundColor: hex }}
        title={`${name} ${hex}`}
      />
      <div className="p-2 bg-white border-t border-gray-100">
        <p className="font-medium text-sm text-gray-900">{name}</p>
        <p className="font-mono text-xs text-gray-500">{hex}</p>
        {role && <p className="text-xs text-gray-400 mt-0.5">{role}</p>}
      </div>
    </div>
  );
}

function GradientSwatch({ name, from, to }: { name: string; from: string; to: string }) {
  return (
    <div className="flex flex-col rounded-lg overflow-hidden border border-gray-200/80 shadow-sm">
      <div
        className="h-20 w-full min-w-[140px]"
        style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
        title={name}
      />
      <div className="p-2 bg-white border-t border-gray-100">
        <p className="font-medium text-sm text-gray-900">{name}</p>
        <p className="font-mono text-xs text-gray-500">{from} → {to}</p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">
        {title}
      </h3>
      <div className="flex flex-wrap gap-4">{children}</div>
    </section>
  );
}

function OptionCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm ${className}`}
    >
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500 mt-1 mb-6">{subtitle}</p>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

export default function Colors() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white px-6 py-6">
        <h1 className="text-2xl font-bold text-gray-900">Nivo color palettes</h1>
        <p className="text-gray-600 mt-1">
          Core palette + three expansion options for a fresh 2026 look. Core stays small;
          add tints/washes for backgrounds and 1–2 inks for CTAs/links.
        </p>
        <div className="flex flex-wrap gap-4 mt-3">
          <a
            href="/colors/demos"
            className="text-sm text-gray-500 hover:text-gray-900 underline"
          >
            Pastel bento demos →
          </a>
          <a
            href="/colors/aurora"
            className="text-sm text-gray-500 hover:text-gray-900 underline"
          >
            Aurora demos →
          </a>
          <a
            href="/design-profile"
            className="text-sm text-gray-500 hover:text-gray-900 underline"
          >
            Design profile (Investor template) →
          </a>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Fonts used</p>
          <p className="text-sm text-gray-700">
            <span className="font-heading font-semibold">Heading:</span> Zapf Humanist 601 Demi BT
            <span className="mx-2 text-gray-400">·</span>
            <span className="font-sans">Body:</span> Poppins (300–700)
            <span className="mx-2 text-gray-400">·</span>
            <span className="font-mono text-xs">Hex codes:</span> system monospace
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-10">
        {/* Nivo palette — same structure as A/B/C */}
        <OptionCard
          title="Nivo palette"
          subtitle="Core (3) + neutrals (3) + washes (5) + inks (2) — as many colors as Option A/B/C."
        >
          <Section title="Core">
            {CORE.map((c) => (
              <Swatch key={c.hex} name={c.name} hex={c.hex} role={c.role} />
            ))}
          </Section>
          <Section title="UI neutrals">
            {NIVO_NEUTRALS_DISPLAY.map((n) => (
              <Swatch key={n.hex} name={n.name} hex={n.hex} />
            ))}
          </Section>
          <Section title="Washes (cards/sections)">
            {NIVO_WASHES_DISPLAY.map((w) => (
              <Swatch key={w.hex} name={w.name} hex={w.hex} />
            ))}
          </Section>
          <Section title="Ink accents (links/CTAs)">
            {NIVO_INKS_DISPLAY.map((i) => (
              <Swatch key={i.hex} name={i.name} hex={i.hex} />
            ))}
          </Section>
          <Section title="Suggested gradient pairs">
            {NIVO_GRADIENTS.map((g) => (
              <GradientSwatch
                key={g.name}
                name={g.name}
                from={g.from}
                to={g.to}
              />
            ))}
          </Section>
        </OptionCard>

        {/* Option A */}
        <OptionCard title={OPTION_A.title} subtitle={OPTION_A.subtitle}>
          <Section title="UI neutrals">
            {OPTION_A.neutrals.map((n) => (
              <Swatch key={n.hex} name={n.name} hex={n.hex} />
            ))}
          </Section>
          <Section title="Pastel washes (cards/sections)">
            {OPTION_A.washes.map((w) => (
              <Swatch key={w.hex} name={w.name} hex={w.hex} />
            ))}
          </Section>
          <Section title="Ink accents (links/CTAs)">
            {OPTION_A.inks.map((i) => (
              <Swatch key={i.hex} name={i.name} hex={i.hex} />
            ))}
          </Section>
          <Section title="Suggested gradient pairs">
            {OPTION_A.gradients.map((g) => (
              <GradientSwatch
                key={g.name}
                name={g.name}
                from={g.from}
                to={g.to}
              />
            ))}
          </Section>
        </OptionCard>

        {/* Option B */}
        <OptionCard title={OPTION_B.title} subtitle={OPTION_B.subtitle}>
          <Section title="UI neutrals">
            {OPTION_B.neutrals.map((n) => (
              <Swatch key={n.hex} name={n.name} hex={n.hex} />
            ))}
          </Section>
          <Section title="Cool tints">
            {OPTION_B.tints.map((t) => (
              <Swatch key={t.hex} name={t.name} hex={t.hex} />
            ))}
          </Section>
          <Section title="Premium accents">
            {OPTION_B.accents.map((a) => (
              <Swatch key={a.hex} name={a.name} hex={a.hex} />
            ))}
          </Section>
          <Section title="Signal accent (sparingly)">
            {OPTION_B.signal.map((s) => (
              <Swatch key={s.hex} name={s.name} hex={s.hex} />
            ))}
          </Section>
        </OptionCard>

        {/* Option C */}
        <OptionCard title={OPTION_C.title} subtitle={OPTION_C.subtitle}>
          <Section title="Warm neutrals">
            {OPTION_C.neutrals.map((n) => (
              <Swatch key={n.hex} name={n.name} hex={n.hex} />
            ))}
          </Section>
          <Section title="Warm pastels">
            {OPTION_C.pastels.map((p) => (
              <Swatch key={p.hex} name={p.name} hex={p.hex} />
            ))}
          </Section>
          <Section title="Editorial accents">
            {OPTION_C.accents.map((a) => (
              <Swatch key={a.hex} name={a.name} hex={a.hex} />
            ))}
          </Section>
        </OptionCard>
      </main>
    </div>
  );
}

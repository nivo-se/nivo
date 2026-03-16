import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Database, Filter, Search, Target, User, TrendingUp, BarChart3, Clock, Building2, Globe, Workflow, Shield, Check } from "lucide-react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { SECTION_CLASS as SECTION_CLASS_TOKEN, tokens } from "@/lib/designProfileTokens";
import { NIVO_AURORA_COLORS } from "@/lib/nivoPalette";

// ─── Projection data: 7-year horizon, target IRR 20–25% / MOIC 4–5x; reinvestment and 20% ROIC at portfolio level drive MoM growth ─────────
const ENTRY_EQUITY = 100;
const YEARS = 7;

const PROJ: { year: number; label: string; equityValue: number; debt: number; ev: number; return: number; reinvestment: number; roic: string; mom: string }[] = [
  { year: 0, label: "Year 0", equityValue: 100, debt: 30, ev: 130, return: 0, reinvestment: 0, roic: "—", mom: "—" },
  { year: 1, label: "Year 1", equityValue: 120, debt: 36, ev: 155, return: 20, reinvestment: 25, roic: "20%", mom: "1.20x" },
  { year: 2, label: "Year 2", equityValue: 143, debt: 43, ev: 186, return: 23, reinvestment: 30, roic: "20%", mom: "1.43x" },
  { year: 3, label: "Year 3", equityValue: 171, debt: 51, ev: 222, return: 28, reinvestment: 36, roic: "20%", mom: "1.71x" },
  { year: 4, label: "Year 4", equityValue: 204, debt: 61, ev: 265, return: 33, reinvestment: 43, roic: "20%", mom: "2.04x" },
  { year: 5, label: "Year 5", equityValue: 244, debt: 73, ev: 317, return: 40, reinvestment: 52, roic: "20%", mom: "2.44x" },
  { year: 6, label: "Year 6", equityValue: 291, debt: 87, ev: 379, return: 48, reinvestment: 62, roic: "20%", mom: "2.91x" },
  { year: 7, label: "Year 7", equityValue: 348, debt: 104, ev: 452, return: 57, reinvestment: 74, roic: "20%", mom: "3.48x" },
];

const EXIT_EQUITY = PROJ[PROJ.length - 1].equityValue;
const GROSS_MOIC = (EXIT_EQUITY / ENTRY_EQUITY).toFixed(2);
const GROSS_IRR = ((Math.pow(EXIT_EQUITY / ENTRY_EQUITY, 1 / YEARS) - 1) * 100).toFixed(1);

const SECTION_CLASS = SECTION_CLASS_TOKEN;
/** Tighter section padding and top divider for deck. */
const DECK_SECTION_CLASS = "max-w-4xl mx-auto px-5 sm:px-6 py-6 sm:py-10";
const SECTION_TOP_CLASS = "border-t pt-4 sm:pt-6";
const PROSE_CLASS = "w-full text-profile-fg leading-relaxed text-[16px] sm:text-[18px]";
const PUNCH_CLASS = "text-center text-xl sm:text-2xl font-semibold text-profile-fg py-6";

// Heading hierarchy — Nivo design profile
const H1_CLASS = "font-heading font-semibold text-profile-fg tracking-tight text-3xl sm:text-4xl md:text-5xl leading-[1.15] mb-6";
const H2_CLASS = "font-heading font-semibold text-profile-fg tracking-tight text-2xl sm:text-3xl mb-4";
const H3_CLASS = "font-heading font-semibold text-profile-fg text-lg sm:text-xl mb-3";
const SECTION_SUBTITLE_CLASS = "text-profile-accent font-medium uppercase tracking-widest text-sm mb-6";
const LABEL_CLASS = "text-sm font-semibold text-profile-fg mb-2";
const LABEL_OLIVE_CLASS = "text-sm font-semibold text-profile-accent uppercase tracking-wider mb-2";

/** Long-form investor memo with Nivo design profile (profile-*). Used at /investor. */
export function Investor2LongFormNivo() {
  return (
    <div className="text-profile-fg antialiased min-h-screen overflow-x-hidden [padding-left:env(safe-area-inset-left)] [padding-right:env(safe-area-inset-right)] [padding-bottom:env(safe-area-inset-bottom)]" style={{ backgroundColor: tokens.bg }}>
      {/* ─── Hero (Aurora + design profile tokens — same as investor short form) ─── */}
      <section className="relative">
        <AuroraBackground auroraColors={[...NIVO_AURORA_COLORS]} showRadialGradient className="!min-h-[75vh]">
          <div className="relative z-10 flex flex-col justify-center px-5 sm:px-6 pt-10 sm:pt-12 pb-24 min-h-[75vh] overflow-visible">
            <div className="max-w-3xl mx-auto text-center overflow-visible" style={{ color: tokens.text }}>
              <div className="flex justify-center py-5 px-8 sm:py-6 sm:px-10 mb-5 sm:mb-6 overflow-visible min-h-[100px] sm:min-h-[120px] items-center">
                <img src="/nivo-n-logo-black.svg" alt="Nivo" className="h-28 sm:h-36 w-auto max-w-none object-contain" />
              </div>
              <p className="text-2xl sm:text-3xl max-w-2xl mx-auto leading-relaxed" style={{ color: tokens.text }}>
                We acquire profitable Nordic SMEs with <span className="font-semibold" style={{ color: tokens.accent }}>strong products</span>, <span className="font-semibold" style={{ color: tokens.accent }}>loyal customers</span> and <span className="font-semibold" style={{ color: tokens.accent }}>proven business models</span> — but where <span className="font-semibold" style={{ color: tokens.accent }}>operational potential</span> remains untapped.
              </p>
              <p className="mt-6 text-xl sm:text-2xl max-w-2xl mx-auto leading-relaxed" style={{ color: tokens.text }}>
                Many of these companies operate with manual workflows, fragmented systems and limited operational visibility. The businesses themselves are sound; execution can be significantly improved.
              </p>
              <p className="mt-6 text-xl sm:text-2xl max-w-2xl mx-auto leading-relaxed" style={{ color: tokens.text }}>
                Nivo combines <span className="font-semibold" style={{ color: tokens.accent }}>hands-on ownership</span> with a proprietary <span className="font-semibold" style={{ color: tokens.accent }}>AI-enabled platform</span> used for sourcing, analysis and operational upgrades. This allows us to identify opportunities faster, analyse companies systematically and implement improvements more effectively.
              </p>
              <blockquote className="mt-12 text-lg sm:text-xl font-bold max-w-xl mx-auto" style={{ color: tokens.text }}>
                Our focus is operational improvement rather than technology risk.
              </blockquote>
              <div className="mt-10 max-w-2xl mx-auto pt-6 border-t text-left" style={{ borderColor: tokens.border }}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm sm:text-base">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5" style={{ color: tokens.text }}><Building2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />Investment Company</span>
                    <Check className="w-4 h-4 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5" style={{ color: tokens.text }}><Shield className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />Management Fee</span>
                    <span className="font-semibold tabular-nums" style={{ color: tokens.text }}>0%</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5" style={{ color: tokens.text }}><Target className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />Target Acquisition Capital</span>
                    <span className="font-semibold tabular-nums" style={{ color: tokens.text }}>SEK 1,000m</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5" style={{ color: tokens.text }}><TrendingUp className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />Target gross IRR</span>
                    <span className="font-semibold tabular-nums" style={{ color: tokens.text }}>20–25%</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5" style={{ color: tokens.text }}><BarChart3 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />Target gross MOIC</span>
                    <span className="font-semibold tabular-nums" style={{ color: tokens.text }}>4–5x</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5" style={{ color: tokens.text }}><Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />Base case hold</span>
                    <span className="font-semibold tabular-nums" style={{ color: tokens.text }}>5–10 years</span>
                  </div>
                </div>
              </div>
              <p className="mt-6 sm:mt-8 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto font-bold" style={{ color: tokens.text }}>
                Value creation is driven primarily by operational improvement — including revenue optimisation, margin expansion and digital upgrades — with only modest reliance on multiple expansion.
              </p>
            </div>
          </div>
        </AuroraBackground>
      </section>

      {/* ─── The Opportunity ────────────────────────────────────────────── */}
      <section className="w-full" id="opportunity" style={{ backgroundColor: tokens.bg }}>
        <div className={DECK_SECTION_CLASS}>
        <div className={SECTION_TOP_CLASS} style={{ borderColor: tokens.border }}>
          <h2 className={H2_CLASS}>The Opportunity</h2>
          <p className={SECTION_SUBTITLE_CLASS}>Why Nordic SMEs, why now</p>

          <p className={PROSE_CLASS + " mb-8"}>
            A large share of Nordic SMEs were built before modern digital tools became widely adopted. Many remain profitable but operationally under-digitised. At the same time, practical AI and modern SaaS infrastructure now allow smaller companies to upgrade systems, pricing, reporting and operational workflows quickly and cost-effectively. This creates a narrow window where operational improvements can unlock disproportionate value.
          </p>

          {/* One-line thesis + key selling points — for investors who only read this section */}
          <div className="rounded-xl p-5 sm:p-6 mb-8 sm:mb-10 border shadow-sm" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
            <p className="text-lg sm:text-xl font-semibold text-profile-fg mb-4 leading-snug">
              We acquire profitable, under-digitised Nordic SMEs and compound value through operational improvement and digital modernisation — not technology risk.
            </p>
            <div className="flex flex-wrap gap-3 sm:gap-4">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border, color: tokens.text }}>
                <Globe className="w-4 h-4 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />
                15,000+ Nordic SMEs in target segment
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border, color: tokens.text }}>
                <Target className="w-4 h-4 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />
                20–25% target ROIC through operational improvement
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border, color: tokens.text }}>
                <Shield className="w-4 h-4 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />
                AI-enabled sourcing and operational upgrades
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border, color: tokens.text }}>
                <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />
                Operational upside — not technology risk
              </span>
            </div>
          </div>

          {/* Four pillars in a 2x2 grid — easy to scan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            <div className="rounded-xl p-5 sm:p-6 border flex flex-col shadow-sm" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center" style={{ backgroundColor: tokens.accent }}>
                  <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-white" aria-hidden />
                </div>
                <h3 className={H3_CLASS + " mb-0"}>The universe</h3>
              </div>
              <p className="text-[15px] sm:text-[16px] leading-relaxed text-profile-fg font-semibold mb-3">
                Nordic SMEs in our target band are profitable but structurally under-digitised, creating a large and underserved opportunity set.
              </p>
              <ul className="space-y-1.5 text-profile-fg text-sm sm:text-[15px] leading-relaxed flex-1 min-h-0">
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />~15,000 companies in our focus revenue band</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Primarily owner-managed B2B services and niche manufacturing</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Established business models with stable customer relationships</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Clear operational and systems gaps → strong improvement potential</li>
              </ul>
            </div>

            <div className="rounded-xl p-5 sm:p-6 border flex flex-col shadow-sm" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center" style={{ backgroundColor: tokens.accent }}>
                  <Workflow className="w-5 h-5 sm:w-6 sm:h-6 text-white" aria-hidden />
                </div>
                <h3 className={H3_CLASS + " mb-0"}>Operational gap</h3>
              </div>
              <p className="text-[15px] sm:text-[16px] leading-relaxed text-profile-fg font-semibold mb-3">
                Across the segment we observe the same operational inefficiencies. These businesses rarely need disruption — they need better execution and modern tools.
              </p>
              <ul className="space-y-1.5 text-profile-fg text-sm sm:text-[15px] leading-relaxed flex-1 min-h-0">
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Manual workflows, spreadsheets and ad-hoc processes</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Fragmented systems with limited data integration</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Limited operational visibility and slow reporting</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Cost-plus pricing and weak margin transparency</li>
              </ul>
            </div>

            <div className="rounded-xl p-5 sm:p-6 border flex flex-col shadow-sm" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center" style={{ backgroundColor: tokens.accent }}>
                  <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" aria-hidden />
                </div>
                <h3 className={H3_CLASS + " mb-0"}>Why Nordic</h3>
              </div>
              <p className="text-[15px] sm:text-[16px] leading-relaxed text-profile-fg font-semibold mb-3">
                The Nordic region offers a favourable environment for long-term operational value creation.
              </p>
              <ul className="space-y-1.5 text-profile-fg text-sm sm:text-[15px] leading-relaxed flex-1 min-h-0">
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Strong institutions and transparent markets</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Educated workforce and high digital adoption</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Generational transitions creating significant deal flow</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Limited dedicated buyout capital below SEK 200m</li>
              </ul>
            </div>

            <div className="rounded-xl p-5 sm:p-6 border flex flex-col shadow-sm" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center" style={{ backgroundColor: tokens.accent }}>
                  <Target className="w-5 h-5 sm:w-6 sm:h-6 text-white" aria-hidden />
                </div>
                <h3 className={H3_CLASS + " mb-0"}>Our take</h3>
              </div>
              <p className="text-[15px] sm:text-[16px] leading-relaxed text-profile-fg font-semibold mb-3">
                Nivo targets this opportunity through a disciplined, repeatable approach.
              </p>
              <ul className="space-y-1.5 text-profile-fg text-sm sm:text-[15px] leading-relaxed flex-1 min-h-0">
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Proprietary AI-enabled platform for sourcing, analysis and operational upgrades</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Identify opportunities faster and implement improvements more effectively</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Strengthen commercial execution, improve operational performance and modernise through digitalisation and selective use of AI</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />We buy operational improvement potential — not technology risk</li>
              </ul>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* ─── Investment overview ────────────────────────────────────────── */}
      <section className="w-full" id="overview" style={{ backgroundColor: tokens.bgAlt }}>
        <div className={DECK_SECTION_CLASS}>
        <div className={SECTION_TOP_CLASS} style={{ borderColor: tokens.border }}>
          <h2 className={H2_CLASS}>Investment Overview</h2>
          <p className={SECTION_SUBTITLE_CLASS}>A disciplined operational compounder</p>
          <div className="space-y-6">
            <p className={PROSE_CLASS}>
              We acquire profitable, under-digitised Nordic SMEs, typically with SEK 50–200m in revenue. Our model is simple: acquire strong businesses where operational execution can be improved, modernise operations through better processes and digital tools, and compound value through higher margins and stronger cash flow.
            </p>
            <p className={PROSE_CLASS}>
              Nivo combines hands-on ownership with a proprietary AI-enabled platform used for sourcing, analysis and operational upgrades. This allows us to identify opportunities systematically and implement improvements faster.
            </p>
            <p className={PROSE_CLASS}>
              Our edge is disciplined execution and systematic sourcing. Our focus is operational improvement and long-term compounding — not technology risk.
            </p>
          </div>
        </div>
        </div>
      </section>

      {/* Image break ────────────────────────────────────────────────────── */}
      <section className="w-full" style={{ backgroundColor: tokens.bg }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-4 sm:py-5">
        <div className="aspect-[21/9] rounded-lg overflow-hidden border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
          <img
            src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80"
            alt="Nordic industrial landscape"
            className="w-full h-full object-cover opacity-90"
          />
        </div>
        </div>
      </section>

      {/* ─── The Nordic Compounder Model ─────────────────────────────────── */}
      <section className="w-full" id="model" style={{ backgroundColor: tokens.bgAlt }}>
        <div className={DECK_SECTION_CLASS}>
        <div className={SECTION_TOP_CLASS} style={{ borderColor: tokens.border }}>
          <h2 className={H2_CLASS}>The Nordic Compounder Model</h2>
          <p className={SECTION_SUBTITLE_CLASS}>Investment thesis</p>
          <div className="w-full space-y-8">
            <div>
              <p className={LABEL_OLIVE_CLASS + " mb-4"}>Three pillars</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="pl-4 border-l-2 rounded-r-lg py-3 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
                  <p className="font-semibold text-base mb-1" style={{ color: tokens.text }}>Acquire right</p>
                  <p className="text-[15px] leading-relaxed" style={{ color: tokens.text }}>Disciplined entry with clear operational improvement potential.</p>
                </div>
                <div className="pl-4 border-l-2 rounded-r-lg py-3 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
                  <p className="font-semibold text-base mb-1" style={{ color: tokens.text }}>Execute relentlessly</p>
                  <p className="text-[15px] leading-relaxed" style={{ color: tokens.text }}>Pricing discipline, margin expansion and operational visibility.</p>
                </div>
                <div className="pl-4 border-l-2 rounded-r-lg py-3 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
                  <p className="font-semibold text-base mb-1" style={{ color: tokens.text }}>Compound with discipline</p>
                  <p className="text-[15px] leading-relaxed" style={{ color: tokens.text }}>Reinvest cash flow and maintain appropriate leverage.</p>
                </div>
              </div>
              <div className="rounded-lg py-3 px-4 w-full mt-6" style={{ backgroundColor: tokens.bg, border: `1px solid ${tokens.border}` }}>
                <p className="font-semibold text-base mb-1" style={{ color: tokens.text }}>Return drivers</p>
                <p className="text-[15px] leading-relaxed" style={{ color: tokens.text }}>
                  We use operational excellence and apply technology—including AI—where appropriate to accelerate revenue growth and margin expansion. Value is driven primarily by these levers; we assume only modest multiple expansion.
                </p>
              </div>
              <p className="text-base sm:text-lg text-profile-fg mt-6 leading-relaxed font-bold text-center w-full">
                Execution leads to margins, margins to cash flow, cash flow to equity.
              </p>
            </div>

            <div className="pt-4 border-t space-y-4" style={{ borderColor: tokens.border }}>
              <p className={LABEL_OLIVE_CLASS + " mb-4"}>Illustrative investment outcome</p>
              <div className="rounded-lg py-3 px-4 w-full" style={{ backgroundColor: tokens.bg, border: `1px solid ${tokens.border}` }}>
                <p className="text-[15px] leading-relaxed" style={{ color: tokens.text }}>
                  The following example illustrates how operational improvements and reinvestment can compound equity value over time. The chart and table below are based on the assumptions set out in this section: entry and exit multiples, revenue growth, margin progression, leverage and hold period. Outcomes are illustrative and do not represent a forecast.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 w-full rounded-lg overflow-hidden p-6 border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border, boxShadow: "var(--profile-shadow-soft)" }}>
            <p className="text-sm font-medium mb-4" style={{ color: tokens.text }}>Enterprise value build (illustrative, 7 years)</p>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={PROJ} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--profile-divider))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--profile-fg-muted))" }} stroke="hsl(var(--profile-divider))" />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--profile-fg-muted))" }} stroke="hsl(var(--profile-divider))" width={36} />
                  <Tooltip
                    cursor={false}
                    contentStyle={{ backgroundColor: "white", border: "1px solid hsl(var(--profile-divider))", borderRadius: 6, fontSize: 12 }}
                    formatter={(value: number, name: string) => [value.toFixed(1), name === "equityValue" ? "Equity" : "Debt"]}
                    labelFormatter={(l) => l}
                  />
                  <Bar dataKey="equityValue" stackId="a" fill="hsl(var(--profile-accent))" name="equityValue" radius={[0, 2, 0, 0]} />
                  <Bar dataKey="debt" stackId="a" fill="hsl(var(--profile-accent-secondary) / 0.35)" name="debt" radius={[0, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-6 w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="pl-4 border-l-2 rounded-r-lg py-3 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
              <p className={LABEL_CLASS}>Entry → Exit (illustrative)</p>
              <p className="text-xl sm:text-2xl font-semibold tabular-nums" style={{ color: tokens.accent }}>Equity {ENTRY_EQUITY} → {EXIT_EQUITY.toFixed(1)}</p>
            </div>
            <div className="pl-4 border-l-2 rounded-r-lg py-3 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
              <p className={LABEL_CLASS}>Gross MOIC</p>
              <p className="text-xl sm:text-2xl font-semibold tabular-nums" style={{ color: tokens.accent }}>{GROSS_MOIC}x</p>
            </div>
            <div className="pl-4 border-l-2 rounded-r-lg py-3 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
              <p className={LABEL_CLASS}>IRR</p>
              <p className="text-xl sm:text-2xl font-semibold tabular-nums" style={{ color: tokens.accent }}>{GROSS_IRR}%</p>
            </div>
          </div>

          <div className="mt-10 w-full">
            <p className={LABEL_OLIVE_CLASS + " mb-4"}>Assumptions</p>
            <div className="pl-4 border-l-2 rounded-r-lg py-3 pr-4 w-full" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
              <p className="text-[15px] text-profile-fg leading-relaxed">Illustrative scenario: target 20–25% IRR and 4–5x MOIC over the hold period; full reinvestment and ~30% leverage. Assumes operational improvement from hands-on work over the holding period. No exit multiple expansion assumed.</p>
            </div>
          </div>

          <div className="mt-10 w-full">
            <p className={LABEL_OLIVE_CLASS}>Projection detail (illustrative)</p>
            <p className="text-[13px] text-profile-fg mb-3">7-year investment horizon; target 20–25% IRR and 4–5x MOIC. Reinvestment of returns and 20% ROIC at portfolio level drive MoM growth.</p>
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: tokens.border }}>
              <table className="w-full text-sm min-w-[520px]">
                <thead style={{ backgroundColor: tokens.bg }}>
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold text-profile-fg">Year</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-profile-fg">Equity</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-profile-fg">Debt</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-profile-fg">EV</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-profile-fg">Return</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-profile-fg">Reinvestment</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-profile-fg">ROIC</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-profile-fg">MoM</th>
                  </tr>
                </thead>
                <tbody style={{ backgroundColor: tokens.bg }}>
                  {PROJ.map((row) => (
                    <tr key={row.year} className="border-t" style={{ borderColor: tokens.border }}>
                      <td className="px-3 py-2.5 text-profile-fg">{row.label}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-profile-accent">{row.equityValue}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-profile-fg">{row.debt}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-profile-fg">{row.ev}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-profile-fg">{row.return || "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-profile-fg">{row.reinvestment || "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-profile-fg">{row.roic}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-profile-fg">{row.mom}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* ─── Value Creation ─────────────────────────────────────────────── */}
      <section className="w-full" id="value-creation" style={{ backgroundColor: tokens.bg }}>
        <div className={DECK_SECTION_CLASS}>
        <div className={SECTION_TOP_CLASS} style={{ borderColor: tokens.border }}>
          <h2 className={H2_CLASS}>Value Creation</h2>
          <p className={SECTION_SUBTITLE_CLASS}>From acquisition to compounding</p>
          <p className={PROSE_CLASS + " mb-10"}>
            We acquire profitable Nordic SMEs and work closely with management to improve operational performance. When we acquire a business we invest time in understanding it thoroughly—the people, the operations, the numbers—so we can act from day one. We focus on what moves the needle: pricing, sales, back-office execution, and how data is used. We target a clear return on the capital we deploy, reinvest what the businesses generate, and use modest debt where it helps. Then we do it again. We apply the same approach every time; the more we do it, the sharper we get.
          </p>
          <div className="mb-4">
            <p className={LABEL_CLASS}>Where we focus when we're in the business</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10">
            <div className="pl-6 border-l-2 rounded-r-lg py-3 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
              <p className={LABEL_CLASS}>Revenue</p>
              <p className="text-[15px] leading-relaxed" style={{ color: tokens.text }}>Getting pricing right, keeping customers, and making sure the sales team is focused and accountable.</p>
            </div>
            <div className="pl-6 border-l-2 rounded-r-lg py-3 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
              <p className={LABEL_CLASS}>Margins</p>
              <p className="text-[15px] leading-relaxed" style={{ color: tokens.text }}>Trimming unnecessary cost, tightening how we buy and hold stock, and making sure we know where the money goes.</p>
            </div>
            <div className="pl-6 border-l-2 rounded-r-lg py-3 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
              <p className={LABEL_CLASS}>Digital & AI</p>
              <p className="text-[15px] leading-relaxed" style={{ color: tokens.text }}>Less manual work and spreadsheets, clearer numbers every month, and using data—and AI where it clearly helps—so decisions are based on fact, not gut.</p>
            </div>
          </div>
          <p className={PROSE_CLASS + " mt-10"}>
            We go in with a clear plan. Each company reinforces what works; we get faster at spotting and fixing the same issues, and we carry that into the next. Where it helps, we use data and tools so the team can do more without adding headcount.
          </p>

          <div className="mt-16 pt-10 border-t" style={{ borderColor: tokens.border }}>
            <h3 className={H3_CLASS}>AI enablement</h3>
            <p className={PROSE_CLASS + " mb-6"}>
              We use AI where it clearly saves time or improves decisions—for example, replacing manual scheduling and slow, spreadsheet-based reporting. Companies often produce reliable monthly reporting weeks faster and see margin by customer and product. We tighten how they price and discount so they stop leaving money on the table; in practice that often means a percentage or two of margin.
            </p>
            <p className={PROSE_CLASS}>
              We only use AI where we can see the impact—faster turnaround, better margin, clearer numbers. It supports how we work; it does not replace judgment or hands-on management.
            </p>
          </div>
        </div>
        </div>
      </section>

      {/* ─── Acquisition criteria ───────────────────────────────────────── */}
      <section className="w-full" id="acquisition-criteria" style={{ backgroundColor: tokens.bgAlt }}>
        <div className={DECK_SECTION_CLASS}>
        <div className={SECTION_TOP_CLASS} style={{ borderColor: tokens.border }}>
          <h2 className={H2_CLASS}>Acquisition Criteria</h2>
          <p className={SECTION_SUBTITLE_CLASS}>Valuation and capital structure discipline</p>
          <div className="space-y-8">
            <p className={PROSE_CLASS}>
              We apply strict valuation discipline: entry at EV/EBITDA in the 5–7x range, prioritising operational improvement potential over growth premium. Targets must demonstrate stable cash generation. Leverage is conservative—debt to capital below 30%, net debt to EBITDA below 2x—and supplements strategy rather than driving returns. Financial guardrails include a credible path to 20% ROIC, at least 12 months runway, and capital preservation as the first principle.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-3xl mx-auto">
              <div className="pl-4 border-l-2 rounded-r-lg py-3 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
                <p className={LABEL_CLASS + " mb-3"}>Target profile</p>
                <ul className="space-y-2 text-[15px] text-profile-fg">
                  <li className="flex items-start gap-2">
                    <BarChart3 className="w-4 h-4 text-profile-accent flex-shrink-0 mt-0.5" aria-hidden />
                    <span>Entry valuation: EV/EBITDA 5–7x</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-profile-accent flex-shrink-0 mt-0.5" aria-hidden />
                    <span>Leverage: Debt/Capital &lt;30%</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <TrendingUp className="w-4 h-4 text-profile-accent flex-shrink-0 mt-0.5" aria-hidden />
                    <span>Target ROIC: 20%</span>
                  </li>
                </ul>
              </div>
              <div className="pl-4 border-l-2 rounded-r-lg py-3 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
                <p className={LABEL_CLASS + " mb-3"}>Example</p>
                <ul className="space-y-2 text-[15px] text-profile-fg">
                  <li className="flex items-start gap-2">
                    <BarChart3 className="w-4 h-4 text-profile-accent flex-shrink-0 mt-0.5" aria-hidden />
                    <span>EBITDA 10 MSEK at 6x → EV 60 MSEK</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-profile-accent flex-shrink-0 mt-0.5" aria-hidden />
                    <span>Equity 45 / Debt 15</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-profile-accent flex-shrink-0 mt-0.5" aria-hidden />
                    <span>Conservative, scalable</span>
                  </li>
                </ul>
              </div>
            </div>
            <p className={PUNCH_CLASS}>
              We buy value creation potential, not leverage.
            </p>
          </div>
        </div>
        </div>
      </section>

      {/* ─── Sourcing Edge ───────────────────────────────────────────────── */}
      <section className="w-full" id="sourcing" style={{ backgroundColor: tokens.bg }}>
        <div className={DECK_SECTION_CLASS}>
        <div className={SECTION_TOP_CLASS} style={{ borderColor: tokens.border }}>
          <h2 className={H2_CLASS}>Sourcing Edge</h2>
          <p className={SECTION_SUBTITLE_CLASS}>Pipeline development</p>
          <p className={PROSE_CLASS + " mb-8"}>
            We use a proprietary AI sourcing engine built in-house to analyse the Swedish SME universe within the target size band. Our platform analyses Swedish SMEs in the SEK 50–200m revenue range, evaluating stable base economics, margin stagnation signals, and niche positioning. The engine outputs a ranked Target 100 shortlist and supports consistent, repeatable screening at scale.
          </p>
          <p className={PROSE_CLASS + " mb-10"}>
            Before engagement the same platform powers analysis of products and services, customer segments, go-to-market model, pricing structure, and operational signals. We arrive at dialogue with structured intelligence and disciplined entry criteria—all driven by our own technology stack.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 py-10 text-base sm:text-lg font-medium text-profile-fg">
            <span className="flex items-center gap-2 text-profile-accent">
              <Database className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" aria-hidden />
              Universe
            </span>
            <span className="text-profile-divider" aria-hidden>→</span>
            <span className="flex items-center gap-2 text-profile-accent">
              <Filter className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" aria-hidden />
              Filtering
            </span>
            <span className="text-profile-divider" aria-hidden>→</span>
            <span className="flex items-center gap-2 text-profile-accent">
              <Search className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" aria-hidden />
              Research
            </span>
            <span className="text-profile-divider" aria-hidden>→</span>
            <span className="flex items-center gap-2 text-profile-accent">
              <Target className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" aria-hidden />
              Targets
            </span>
          </div>
          <div className="mt-10 w-full">
            <p className={LABEL_OLIVE_CLASS + " text-center mb-2"}>Proprietary AI sourcing engine</p>
            <p className="text-center text-profile-fg text-[15px] sm:text-[16px] leading-relaxed mb-6 max-w-2xl mx-auto">
              We built an in-house proprietary sourcing engine that leverages AI as well as financial analysis. We can analyse any Swedish company.
            </p>
            <div className="rounded-lg overflow-hidden border relative" style={{ borderColor: tokens.border, boxShadow: "var(--profile-shadow-soft)" }}>
              <img
                src="/sourcing-ai-screenshot.png"
                alt="AI sourcing engine interface — company financial profile and analysis"
                className="w-full h-auto"
                style={{ maxHeight: "420px", objectFit: "cover" }}
              />
              <div
                className="absolute top-0 left-0 w-56 h-20 backdrop-blur-md pointer-events-none"
                aria-hidden
                title="Company name redacted"
              />
            </div>
            <div className="mt-6 rounded-lg overflow-hidden border relative" style={{ borderColor: tokens.border, boxShadow: "var(--profile-shadow-soft)" }}>
              <img
                src="/sourcing-ai-memo-screenshot.png"
                alt="AI Investment Score — investment memo and strategic fit"
                className="w-full h-auto"
                style={{ maxHeight: "420px", objectFit: "cover" }}
              />
              <div
                className="absolute top-0 left-0 right-0 h-14 backdrop-blur-md pointer-events-none"
                aria-hidden
                title="Company name redacted"
              />
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* ─── Investment process ──────────────────────────────────────────── */}
      <section className="w-full" id="process" style={{ backgroundColor: tokens.bgAlt }}>
        <div className={DECK_SECTION_CLASS}>
        <div className={SECTION_TOP_CLASS} style={{ borderColor: tokens.border }}>
          <h2 className={H2_CLASS}>Investment process</h2>
          <p className="text-profile-accent font-medium uppercase tracking-widest text-sm mb-8">Sourcing to value creation</p>
          <div className="space-y-8">
            <p className={PROSE_CLASS}>
              Sourcing combines direct outreach, broker relationships, and our own data-driven playbook. Due diligence focuses on quality of earnings, identification of operational improvement levers, and management assessment. Negotiation covers structure, management alignment, and risk provisions. Execution starts with a Day 1 plan, a structured first 100 days, and then value creation initiatives.
            </p>
            <div className="w-full">
              <p className={LABEL_OLIVE_CLASS + " text-center"}>Current pipeline status</p>
              <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mt-4">
                <div className="rounded-lg p-5 border text-center min-w-[140px]" style={{ backgroundColor: tokens.bg, borderColor: tokens.border, boxShadow: "var(--profile-shadow-soft)" }}>
                  <p className="text-2xl font-semibold tabular-nums" style={{ color: tokens.accent }}>12</p>
                  <p className="text-sm font-medium mt-1" style={{ color: tokens.text }}>Initial screen</p>
                  <p className="text-xs mt-0.5" style={{ color: tokens.text }}>Under review</p>
                </div>
                <div className="rounded-lg p-5 border text-center min-w-[140px]" style={{ backgroundColor: tokens.bg, borderColor: tokens.border, boxShadow: "var(--profile-shadow-soft)" }}>
                  <p className="text-2xl font-semibold tabular-nums" style={{ color: tokens.accent }}>2</p>
                  <p className="text-sm font-medium mt-1" style={{ color: tokens.text }}>Due diligence</p>
                  <p className="text-xs mt-0.5" style={{ color: tokens.text }}>Active</p>
                </div>
                <div className="rounded-lg p-5 border text-center min-w-[140px]" style={{ backgroundColor: tokens.bg, borderColor: tokens.border, boxShadow: "var(--profile-shadow-soft)" }}>
                  <p className="text-2xl font-semibold tabular-nums" style={{ color: tokens.accent }}>1</p>
                  <p className="text-sm font-medium mt-1" style={{ color: tokens.text }}>Negotiation</p>
                  <p className="text-xs mt-0.5" style={{ color: tokens.text }}>LOI+</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* Image break ────────────────────────────────────────────────────── */}
      <section className="w-full" style={{ backgroundColor: tokens.bgAlt }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-4 sm:py-5">
        <div className="aspect-[21/9] rounded-lg overflow-hidden border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
          <img
            src="https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1200&q=80"
            alt="Nordic nature"
            className="w-full h-full object-cover opacity-85"
          />
        </div>
        </div>
      </section>

      {/* ─── Pipeline ────────────────────────────────────────────────────── */}
      <section className="w-full" id="pipeline" style={{ backgroundColor: tokens.bg }}>
        <div className={DECK_SECTION_CLASS}>
        <div className={SECTION_TOP_CLASS} style={{ borderColor: tokens.border }}>
          <h2 className={H2_CLASS}>Pipeline</h2>
          <p className={SECTION_SUBTITLE_CLASS}>Target 100 by operational improvement potential</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
            {[
              { stage: "Active due diligence", count: "2" },
              { stage: "Advanced discussion", count: "5" },
              { stage: "Initial contact", count: "12" },
              { stage: "Identified", count: "81" },
            ].map((item) => (
              <div key={item.stage} className="rounded-lg p-4 sm:p-5 text-center border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border, boxShadow: "var(--profile-shadow-soft)" }}>
                <p className="text-2xl font-semibold tabular-nums" style={{ color: tokens.accent }}>{item.count}</p>
                <p className="text-sm mt-1" style={{ color: tokens.text }}>{item.stage}</p>
              </div>
            ))}
          </div>
          <p className="text-sm mb-8" style={{ color: tokens.text }}>Active targets (illustrative)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 overflow-x-auto pb-2">
            {[
              { name: "Company A", sector: "Industrial", revenue: "SEK 120m", status: "Due diligence" },
              { name: "Company B", sector: "Business services", revenue: "SEK 75m", status: "Advanced" },
              { name: "Company C", sector: "Distribution", revenue: "SEK 165m", status: "Due diligence" },
            ].map((c) => (
              <div key={c.name} className="min-w-[200px] rounded-lg p-5 border transition-colors" style={{ backgroundColor: tokens.bg, borderColor: tokens.border, boxShadow: "var(--profile-shadow-soft)" }}>
                <p className="font-semibold text-profile-fg">{c.name}</p>
                <p className="text-sm text-profile-fg mt-1">{c.sector} · {c.revenue}</p>
                <p className="text-sm text-profile-accent font-medium mt-3">{c.status}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-profile-fg mt-6">Company names anonymised. All fit established selection criteria.</p>
        </div>
        </div>
      </section>

      {/* ─── Case study (illustrative) ───────────────────────────────────── */}
      <section className="w-full" id="case-study" style={{ backgroundColor: tokens.bgAlt }}>
        <div className={DECK_SECTION_CLASS}>
        <div className={SECTION_TOP_CLASS} style={{ borderColor: tokens.border }}>
          <h2 className={H2_CLASS}>Case study (illustrative)</h2>
          <p className={SECTION_SUBTITLE_CLASS}>How operational improvements drive returns</p>
          <div className="space-y-8">
            <p className={PROSE_CLASS}>
              We focus on product companies that scale—not pure services. Services are stable but tend to scale less well. Example: a Nordic industrial products company. At entry: equity SEK 100m, debt SEK 30m (enterprise value SEK 130m). Revenue and margin had clear upside from pricing, operations and cost.
            </p>
            <div className="max-w-2xl space-y-4">
              <p className={LABEL_CLASS}>Value creation over 24 months</p>
              <div className="space-y-3">
                <div className="pl-4 border-l-2 rounded-r-lg py-2 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
                  <p className={LABEL_CLASS}>Pricing</p>
                  <p className="text-[15px]" style={{ color: tokens.text }}>Value-based pricing and clearer discount discipline. Impact: +150 bps margin.</p>
                </div>
                <div className="pl-4 border-l-2 rounded-r-lg py-2 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
                  <p className={LABEL_CLASS}>Operations</p>
                  <p className="text-[15px]" style={{ color: tokens.text }}>Digital workflows and better planning replacing manual processes. Impact: +100 bps.</p>
                </div>
                <div className="pl-4 border-l-2 rounded-r-lg py-2 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
                  <p className={LABEL_CLASS}>Cost</p>
                  <p className="text-[15px]" style={{ color: tokens.text }}>Consolidated functions and vendor renegotiation. Impact: +50 bps.</p>
                </div>
              </div>
            </div>
            <p className={PUNCH_CLASS}>
              Operational improvements compound into equity value and cash flow. We reinvest in the business and compound over time—we are compounders, not exit-driven.
            </p>
          </div>
        </div>
        </div>
      </section>

      {/* Image break ────────────────────────────────────────────────────── */}
      <section className="w-full" style={{ backgroundColor: tokens.bg }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-4 sm:py-5">
        <div className="aspect-[21/9] rounded-lg overflow-hidden border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
          <img
            src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80"
            alt="Minimal workspace"
            className="w-full h-full object-cover opacity-90"
          />
        </div>
        </div>
      </section>

      {/* ─── Team ───────────────────────────────────────────────────────── */}
      <section className="w-full" id="team" style={{ backgroundColor: tokens.bgAlt }}>
        <div className={DECK_SECTION_CLASS}>
        <div className={SECTION_TOP_CLASS} style={{ borderColor: tokens.border }}>
          <h2 className={H2_CLASS}>Team</h2>
          <p className={SECTION_SUBTITLE_CLASS}>Operational experience meets disciplined capital</p>
          <div className="space-y-10">
            <div>
              <h3 className={H3_CLASS}>Core team</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="flex flex-col items-center text-center">
                  <div className="w-full max-w-[200px] aspect-[4/3] rounded-lg border-2 flex items-center justify-center overflow-hidden" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
                    <User className="w-16 h-16 opacity-60" style={{ color: tokens.text }} aria-hidden />
                  </div>
                  <p className="font-semibold mt-4" style={{ color: tokens.text }}>Jesper Kreuger</p>
                  <p className="text-sm font-medium" style={{ color: tokens.accent }}>Founding Partner</p>
                  <p className="text-[15px] mt-2 leading-relaxed" style={{ color: tokens.text }}>15+ years in venture capital, capital raising and company building. Led investments and scaling across early and growth-stage Nordic companies.</p>
                  <a href="https://www.linkedin.com/in/jesper-kreuger-91b14/" target="_blank" rel="noopener noreferrer" className="text-profile-accent font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-profile-accent/30 rounded mt-2 inline-block">Read more →</a>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="w-full max-w-[200px] aspect-[4/3] rounded-lg border-2 flex items-center justify-center overflow-hidden" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
                    <User className="w-16 h-16 opacity-60" style={{ color: tokens.text }} aria-hidden />
                  </div>
                  <p className="font-semibold mt-4" style={{ color: tokens.text }}>Henrik Cavalli</p>
                  <p className="text-sm font-medium" style={{ color: tokens.accent }}>Founding Partner</p>
                  <p className="text-[15px] mt-2 leading-relaxed" style={{ color: tokens.text }}>15+ years of commercial leadership across startups and global companies. Scaled businesses from zero to €60m+ revenue and led growth across multiple markets.</p>
                  <a href="https://www.linkedin.com/in/henrikc1/" target="_blank" rel="noopener noreferrer" className="text-profile-accent font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-profile-accent/30 rounded mt-2 inline-block">Read more →</a>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="w-full max-w-[200px] aspect-[4/3] rounded-lg border-2 flex items-center justify-center overflow-hidden" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
                    <User className="w-16 h-16 opacity-60" style={{ color: tokens.text }} aria-hidden />
                  </div>
                  <p className="font-semibold mt-4" style={{ color: tokens.text }}>Sebastian Robson</p>
                  <p className="text-sm font-medium" style={{ color: tokens.accent }}>Founding Partner</p>
                  <p className="text-[15px] mt-2 leading-relaxed" style={{ color: tokens.text }}>15+ years in CFO and corporate finance roles with experience in acquisitions, capital markets and IPO preparation across technology and industrial sectors.</p>
                  <a href="https://www.linkedin.com/in/sebastian-robson-7418b82b2/" target="_blank" rel="noopener noreferrer" className="text-profile-accent font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-profile-accent/30 rounded mt-2 inline-block">Read more →</a>
                </div>
              </div>
            </div>
            <div>
              <h3 className={H3_CLASS}>Advisory board</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto justify-items-center">
                <div className="rounded-lg p-4 border w-full max-w-[260px]" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
                  <p className="font-semibold" style={{ color: tokens.text }}>Senior Advisor</p>
                  <p className="text-[15px] mt-1" style={{ color: tokens.text }}>Ex-CEO SEK 400m industrial. 25+ years operations.</p>
                </div>
                <div className="rounded-lg p-4 border w-full max-w-[260px]" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
                  <p className="font-semibold" style={{ color: tokens.text }}>Financial Advisor</p>
                  <p className="text-[15px] mt-1" style={{ color: tokens.text }}>Ex-CFO listed Nordic. Financial systems.</p>
                </div>
                <div className="rounded-lg p-4 border w-full max-w-[260px]" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
                  <p className="font-semibold" style={{ color: tokens.text }}>Advisor</p>
                  <p className="text-[15px] mt-1" style={{ color: tokens.text }}>Strategic and operational advisory.</p>
                </div>
              </div>
            </div>
            <p className={PROSE_CLASS}>
              Operators first, investors second. Hands-on execution guided by proven experience. We operate companies; we do not just own them.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl">
              <div className="pl-4 border-l-2 rounded-r-lg py-2 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
                <p className={LABEL_CLASS}>Operational</p>
                <p className="text-[15px]" style={{ color: tokens.text }}>20+ years ops leadership, scaling SMEs, P&L responsibility.</p>
              </div>
              <div className="pl-4 border-l-2 rounded-r-lg py-2 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
                <p className={LABEL_CLASS}>Capital</p>
                <p className="text-[15px]" style={{ color: tokens.text }}>Value-focused acquisitions, pricing and negotiation, long-term view.</p>
              </div>
              <div className="pl-4 border-l-2 rounded-r-lg py-2 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
                <p className={LABEL_CLASS}>Technical</p>
                <p className="text-[15px]" style={{ color: tokens.text }}>AI and automation, process optimisation, change management.</p>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* ─── Structure & Returns ─────────────────────────────────────────── */}
      <section className="w-full" id="structure" style={{ backgroundColor: tokens.bg }}>
        <div className={DECK_SECTION_CLASS}>
        <div className={SECTION_TOP_CLASS} style={{ borderColor: tokens.border }}>
          <h2 className={H2_CLASS}>Structure & returns</h2>
          <p className={SECTION_SUBTITLE_CLASS}>Capital model and governance</p>

          <div className="space-y-10 mb-12">
            <p className="w-full text-profile-fg leading-relaxed text-[14px] sm:text-[15px]">
              Nivo Group AB is the parent company (no separate management company)—a Swedish AB (aktiebolag) with an evergreen investment horizon with the ambition to become a listed entity within 10 years. Capital is deployed into Nordic SMEs and compounded over the long term. Founders and Founding Investors hold both Class A and Class B shares; new investors participate via Class B shares. All material investments are subject to investment committee approval; the committee includes independent members and meets for quarterly reviews. Reporting to shareholders includes quarterly updates, portfolio performance, and value-creation milestones.
            </p>

            <div className="pt-6 border-t border-profile-divider">
              <p className={LABEL_OLIVE_CLASS + " mb-2"}>Alignment of interest</p>
              <p className="text-[14px] sm:text-[15px] text-profile-fg leading-relaxed">We use a classic Swedish A/B share structure. A-shares (voting-strong) are held by Founders and Founding Investors and are entitled to 20% of dividends and excess returns; A-shares also have a catch-up on 20% of the B-shares’ return threshold. B-shares are entitled to 80% of dividends and excess returns and include a 1x liquidation preference and a 20% return threshold (adjusted for distributed capital). Shared incentives: focus on better deals, not on higher AUM.</p>
            </div>

            <div className="pt-6 border-t" style={{ borderColor: tokens.border }}>
              <h3 className={H3_CLASS}>Corporate and investment structure</h3>
              <p className="text-sm mb-4" style={{ color: tokens.text }}>Evergreen Swedish AB structure. Deal-by-deal financing.</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                {/* Left: Corporate structure diagram */}
                <div className="rounded-lg border p-6 sm:p-8" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
                  <div className="flex flex-col items-center gap-0">
                    {/* Above Parent: investors */}
                    <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-3">
                      <div className="text-center">
                        <div className="px-4 py-2.5 rounded-md border min-w-[140px]" style={{ borderColor: tokens.border, backgroundColor: tokens.bg }}>
                          <p className="text-sm font-medium" style={{ color: tokens.text }}>Founders & Founding Investors</p>
                          <p className="text-xs font-medium mt-1" style={{ color: tokens.accent }}>A- & B-shares</p>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="px-4 py-2.5 rounded-md border min-w-[140px]" style={{ borderColor: tokens.border, backgroundColor: tokens.bg }}>
                          <p className="text-sm font-medium" style={{ color: tokens.text }}>New Investors</p>
                          <p className="text-xs font-medium mt-1" style={{ color: tokens.accent }}>B-shares</p>
                        </div>
                      </div>
                    </div>
                    <div className="w-px h-4" style={{ backgroundColor: tokens.accent }} aria-hidden />
                    <div className="px-5 py-3 rounded-md border-2" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
                      <p className="text-sm font-semibold" style={{ color: tokens.text }}>Nivo Group AB (Parent Company)</p>
                    </div>
                    <div className="w-px h-4" style={{ backgroundColor: tokens.accent }} aria-hidden />
                    <div className="px-4 py-2.5 rounded-md border" style={{ borderColor: tokens.border, backgroundColor: tokens.bg }}>
                      <p className="text-sm" style={{ color: tokens.text }}>Nivo OpCo (operational holding function)</p>
                    </div>
                    <div className="w-px h-4" style={{ backgroundColor: tokens.border }} aria-hidden />
                    <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
                      {["BidCo 1", "BidCo 2", "BidCo 3"].map((label) => (
                        <div key={label} className="flex flex-col items-center">
                          <div className="px-3 py-2 rounded border text-center min-w-[90px]" style={{ borderColor: tokens.border, backgroundColor: tokens.bg }}>
                            <p className="text-xs font-medium" style={{ color: tokens.text }}>{label}</p>
                            <p className="text-[11px] mt-0.5" style={{ color: tokens.text }}>acquisition vehicle</p>
                          </div>
                          <div className="w-px h-3 my-0.5" style={{ backgroundColor: tokens.border }} aria-hidden />
                          <div className="px-2 py-1.5 rounded border text-center min-w-[70px]" style={{ borderColor: tokens.border, backgroundColor: tokens.bg }}>
                            <p className="text-[11px]" style={{ color: tokens.text }}>{label.replace("BidCo", "Target")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Right: Financing model text */}
                <div>
                  <p className={LABEL_OLIVE_CLASS + " mb-3"}>Financing model</p>
                  <p className="w-full text-profile-fg leading-relaxed text-[14px] sm:text-[15px]">
                    All acquisitions are consolidated under Nivo Group AB. New acquisitions are financed on a deal-by-deal basis through newly formed BidCos. Investors participate through share ownership in the Parent Company (A- and B-shares). There are no capital commitments; participation in future share issues is voluntary, with pre-emptive rights. Nivo’s strategy focuses on long-term ownership of stable Nordic SMEs within an evergreen structure. In the event of additional capital needs within a portfolio company, capital may be provided either through retained earnings at the Parent level or through new share issues. With each new acquisition, the portfolio NAV is revalued, allowing early investors to benefit from value uplift prior to new capital being introduced.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t" style={{ borderColor: tokens.border }}>
              <h3 className={H3_CLASS}>Share classes (classic Swedish A/B)</h3>
              <p className="w-full text-profile-fg leading-relaxed text-[14px] sm:text-[15px] mb-4">
                <strong className="text-profile-fg">A-shares</strong> are voting-strong shares held by Founders and Founding Investors, entitled to 20% of dividends and excess returns. A-shares have a catch-up on 20% of the B-shares’ return threshold. <strong className="text-profile-fg">B-shares</strong> are held by Founding Investors and other investors, entitled to 80% of dividends and excess returns. B-shares include a 1x liquidation preference (priority to recover invested capital) and a 20% return threshold, with adjustments for distributed capital (e.g. dividends). Each divestment or exit triggers a distribution according to these rights.
              </p>
            </div>

            <div className="pt-6 border-t" style={{ borderColor: tokens.border }}>
              <h3 className={H3_CLASS}>Financing and rewards for early capital</h3>
              <p className="w-full text-profile-fg leading-relaxed text-[14px] sm:text-[15px] mb-4">
                New acquisitions are financed on a <strong className="text-profile-fg">deal-by-deal</strong> basis. Investors commit only to their initial investment; participation in future new issues is welcomed (with pre-emptive rights) but not obligatory. In the event of additional capital needs in a portfolio company, funding is provided either from Nivo Group (e.g. dividends from other portfolio companies) or through new issues in which investors may voluntarily participate. With each new acquisition, the existing portfolio NAV is re-valued, providing value uplift for early investors before new capital is committed. This structure rewards early capital injection.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
              <div>
                <p className={LABEL_CLASS + " mb-4"}>Key terms</p>
                <div className="space-y-4 text-base sm:text-lg">
                  <div className="flex justify-between items-baseline border-b border-profile-divider pb-3">
                    <span className="text-profile-fg">Issuer</span>
                    <span className="font-semibold text-profile-fg text-lg sm:text-xl">Nivo Group AB</span>
                  </div>
                  <div className="flex justify-between items-baseline border-b border-profile-divider pb-3">
                    <span className="text-profile-fg">Target size</span>
                    <span className="font-semibold text-profile-fg text-lg sm:text-xl">SEK 1,000m</span>
                  </div>
                  <div className="flex justify-between items-baseline border-b border-profile-divider pb-3">
                    <span className="text-profile-fg">Minimum investment</span>
                    <span className="font-semibold text-profile-fg text-lg sm:text-xl">SEK 5m</span>
                  </div>
                  <div className="flex justify-between items-baseline border-b border-profile-divider pb-3">
                    <span className="text-profile-fg">Share classes</span>
                    <span className="font-semibold text-profile-fg text-lg sm:text-xl">A- and B-shares</span>
                  </div>
                  <div className="flex justify-between items-baseline pb-3">
                    <span className="text-profile-fg">Management fee</span>
                    <span className="font-semibold text-profile-fg text-lg sm:text-xl">0%</span>
                  </div>
                </div>
              </div>
              <div>
                <p className={LABEL_CLASS + " mb-4"}>Use of proceeds</p>
                <div className="space-y-2 text-base sm:text-lg">
                {[
                  { category: "Acquisitions (3–4 companies)", amount: "SEK 750m", pct: 75 },
                  { category: "Operational improvements", amount: "SEK 150m", pct: 15 },
                  { category: "Working capital & reserves", amount: "SEK 100m", pct: 10 },
                ].map((item) => (
                  <div key={item.category} className="flex justify-between items-center py-2.5 border-b border-profile-divider last:border-0">
                    <span className="text-profile-fg">{item.category}</span>
                    <span className="font-semibold text-profile-fg tabular-nums text-lg sm:text-xl">{item.amount}</span>
                  </div>
                ))}
                </div>
                <div className="mt-4 h-2 rounded-full overflow-hidden flex" style={{ backgroundColor: tokens.border }}>
                  <div className="rounded-l" style={{ width: "75%", backgroundColor: tokens.accent }} />
                  <div style={{ width: "15%", backgroundColor: tokens.accentSecondary }} />
                  <div className="rounded-r" style={{ width: "10%", backgroundColor: tokens.accentSecondary, opacity: 0.5 }} />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t" style={{ borderColor: tokens.border }}>
              <h3 className={H3_CLASS}>Governance — portfolio companies</h3>
              <p className="w-full text-profile-fg leading-relaxed text-[14px] sm:text-[15px] mb-6">
                We typically take majority control (51–100%) with operational oversight at board level and incentives tied to ROIC and cash flow. Decision rights are clear: the board retains strategy, capital allocation, and M&A; management runs day-to-day operations and hiring within defined thresholds. Reporting is monthly (financials, KPI, cash flow), quarterly (board, strategy, investor updates), and annual (audit, valuations, planning). Shareholders receive transparent updates and annual meetings. Documentation follows sound corporate practice with an independent administrator and auditor. Disciplined governance protects capital and alignment.
              </p>
            </div>

            <p className="w-full text-profile-fg leading-relaxed text-[14px] sm:text-[15px]">
              Target close is Q2 2026. We are seeking 2–3 anchor investors. The pipeline is strong and the team is committed. Deployment is expected over 18–24 months; hold per company 5–7 years. Target gross IRR 20–25% and MOIC 4–5x through disciplined reinvestment and operational compounding; base-case underwriting assumes margin expansion and debt paydown with flat-to-modest exit multiples.
            </p>
          </div>

          <div className="pt-8 border-t" style={{ borderColor: tokens.border }}>
            <h3 className={H3_CLASS}>Exit strategy and value drivers</h3>
            <p className="w-full text-profile-fg leading-relaxed text-[14px] sm:text-[15px] mb-6">
              Primary exit route is strategic sale to trade or corporate buyers. Secondary buyout to larger PE or growth equity is a viable alternative. Recapitalisation (dividend recap while retaining control) may be used where appropriate. Value creation follows a clear timeline: in years 1–2 we focus on margin expansion of 200–300 bps; years 3–4 on cash conversion and debt reduction; years 5–6 on sustaining ROIC at 20%+ and strategic positioning; year 7+ on exit or recap depending on market and portfolio readiness.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-6">
              {[
                { label: "Gross IRR", value: "20–25%" },
                { label: "Net IRR", value: "15–20%" },
                { label: "Target MOIC", value: "4–5x" },
                { label: "Base case hold", value: "5–10 years" },
              ].map((item) => (
                <div key={item.label} className="text-center py-4 px-4 rounded-lg border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border, boxShadow: "var(--profile-shadow-soft)" }}>
                  <p className="text-xl font-semibold" style={{ color: tokens.accent }}>{item.value}</p>
                  <p className="text-sm mt-1" style={{ color: tokens.text }}>{item.label}</p>
                </div>
              ))}
            </div>
            <p className="text-[15px] text-profile-fg max-w-2xl">
              Return drivers: margin expansion ~45%, revenue growth ~35%, debt paydown and cash conversion ~20%. Returns from operations, cash conversion, and disciplined structure.
            </p>
          </div>
        </div>
        </div>
      </section>

      {/* ─── Risk factors & mitigation ───────────────────────────────────── */}
      <section className="w-full" id="risks" style={{ backgroundColor: tokens.bgAlt }}>
        <div className={DECK_SECTION_CLASS}>
        <div className={SECTION_TOP_CLASS} style={{ borderColor: tokens.border }}>
          <h2 className={H2_CLASS}>Risk Factors and Mitigation</h2>
          <p className={SECTION_SUBTITLE_CLASS}>Transparent assessment, disciplined mitigation</p>
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="pl-4 border-l-2 rounded-r-lg py-3 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
                <p className={LABEL_CLASS}>Execution risk</p>
                <p className="text-[15px] text-profile-fg mb-2">Initiatives may take longer or cost more than planned.</p>
                <p className={LABEL_OLIVE_CLASS}>Mitigation</p>
                <p className="text-[15px] text-profile-fg">Proven playbook, stress scenarios, experienced advisors.</p>
              </div>
              <div className="pl-4 border-l-2 rounded-r-lg py-3 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
                <p className={LABEL_CLASS}>Market risk</p>
                <p className="text-[15px] text-profile-fg mb-2">Downturn or sector-specific challenges.</p>
                <p className={LABEL_OLIVE_CLASS}>Mitigation</p>
                <p className="text-[15px] text-profile-fg">Defensive sectors, 3–4 company diversification, leverage below 2x.</p>
              </div>
              <div className="pl-4 border-l-2 rounded-r-lg py-3 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
                <p className={LABEL_CLASS}>Key person risk</p>
                <p className="text-[15px] text-profile-fg mb-2">Founder dependence and transition risk.</p>
                <p className={LABEL_OLIVE_CLASS}>Mitigation</p>
                <p className="text-[15px] text-profile-fg">Retain management, 12–24 month transition, process documentation.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl">
              <div className="rounded-lg p-4 border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
                <p className={LABEL_CLASS}>Concentration</p>
                <p className="text-[15px]" style={{ color: tokens.text }}>3–4 companies implies meaningful impact per holding. Mitigated by screening, sector diversity, and deep operational involvement.</p>
              </div>
              <div className="rounded-lg p-4 border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
                <p className={LABEL_CLASS}>Liquidity</p>
                <p className="text-[15px]" style={{ color: tokens.text }}>SME exits can be illiquid. We build for strategic buyers, maintain flexibility on timing, and focus on ROIC to justify valuation.</p>
              </div>
            </div>
            <p className={PUNCH_CLASS}>
              Risks are managed through discipline, transparency, and operational excellence.
            </p>
          </div>
        </div>
        </div>
      </section>

      {/* ─── Closing ─────────────────────────────────────────────────────── */}
      <section className="w-full" id="closing" style={{ backgroundColor: tokens.bg }}>
        <div className={DECK_SECTION_CLASS}>
        <div className={SECTION_TOP_CLASS} style={{ borderColor: tokens.border }}>
          <h2 className={H2_CLASS}>Contact</h2>
          <p className={PROSE_CLASS + " mb-6"}>
            We welcome discussions with investors who value operational discipline, long-term compounding, and sustainable value creation over financial engineering.
          </p>
          <p className={PUNCH_CLASS}>
            Nivo focuses on operational improvement potential in profitable Nordic SMEs.
          </p>
          <p className="text-profile-fg font-medium mb-2">Contact the investment team</p>
          <a href="mailto:invest@nivogroup.se" className="text-profile-accent font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-profile-accent/30 rounded">
            invest@nivogroup.se
          </a>
          <p className="text-sm mt-12 pt-8 border-t" style={{ color: tokens.text, borderColor: tokens.border }}>
            © 2026 Nivo Group. All rights reserved. This document is confidential and intended solely for prospective investors.
          </p>
        </div>
        </div>
      </section>
    </div>
  );
}

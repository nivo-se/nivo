import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Database, Filter, Search, Target, User, TrendingUp, BarChart3, Clock, Building2, Globe, Workflow, Shield, Check, ChevronDown, Handshake, FileCheck, ArrowRight } from "lucide-react";
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
          <div className="relative z-10 flex flex-col justify-center px-5 sm:px-6 pt-10 sm:pt-12 pb-10 sm:pb-12 min-h-[75vh] overflow-visible">
            <div className="max-w-3xl mx-auto text-center overflow-visible" style={{ color: tokens.text }}>
              <div className="w-full py-5 px-8 sm:py-6 sm:px-10 mb-5 sm:mb-6 overflow-visible min-h-[100px] sm:min-h-[120px] flex items-center justify-center">
                <div className="h-28 w-28 sm:h-36 sm:w-36 flex items-center justify-center">
                  <img src="/nivo-n-logo-black.svg" alt="Nivo" className="max-h-full max-w-full w-auto h-auto object-contain" style={{ objectPosition: "49% center" }} />
                </div>
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
              <p className="mt-10 text-sm font-semibold uppercase tracking-wider max-w-2xl mx-auto text-left" style={{ color: tokens.accent }}>Key terms</p>
              <div className="mt-3 max-w-2xl mx-auto pt-6 pb-6 border-t border-b text-left" style={{ borderColor: tokens.border }}>
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
              <div className="mt-8 sm:mt-10 max-w-2xl mx-auto text-left">
                <p className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: tokens.accent }}>Why invest with Nivo</p>
                <ul className="space-y-3 text-[15px] sm:text-base leading-relaxed" style={{ color: tokens.text }}>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tokens.accent }} aria-hidden />
                    <span><strong>Why now:</strong> Practical AI and modern SaaS now allow smaller companies to upgrade systems, pricing and operations cost-effectively. We bring that capability to portfolio businesses — operational improvement, not technology speculation.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tokens.accent }} aria-hidden />
                    <span><strong>Platform:</strong> Proprietary AI sourcing engine that systematically analyses the Swedish SME universe and delivers pre-built intelligence — an edge most PE firms lack.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tokens.accent }} aria-hidden />
                    <span><strong>Team:</strong> Institutional investment expertise across corporate finance, venture capital and capital markets — valuation, structuring, capital raising and exit strategy — combined with hands-on operational leadership in digitalisation, ecommerce and revenue optimisation. We bring financial discipline and governance from listed companies, plus an entrepreneurial perspective on founder-led businesses. Full lifecycle coverage from sourcing to exit.</span>
                  </li>
                </ul>
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
              We acquire profitable, under-digitised Nordic SMEs and compound value through operational improvement and digital modernisation — not technology risk. We typically target SEK 50–200m revenue; our edge is disciplined execution and systematic sourcing.
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
              </ul>
            </div>
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
                  The following example illustrates how operational improvements and reinvestment can compound equity value over time.
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

          <p className="text-[13px] text-profile-fg mt-6">7-year horizon; target 20–25% IRR, 4–5x MOIC.</p>
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
            We acquire profitable Nordic SMEs and work closely with management. We focus on pricing, sales, back-office execution, and data. We reinvest what the businesses generate and use modest debt where it helps.
          </p>
          <div className="mb-4">
            <p className={LABEL_CLASS}>Where we focus when we're in the business</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10">
            <div className="pl-6 border-l-2 rounded-r-lg py-3 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
              <p className={LABEL_CLASS}>Revenue</p>
              <ul className="space-y-1.5 text-profile-fg text-[15px] leading-relaxed mt-2">
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Getting pricing right</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Keeping customers</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Making sure the sales team is focused and accountable</li>
              </ul>
            </div>
            <div className="pl-6 border-l-2 rounded-r-lg py-3 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
              <p className={LABEL_CLASS}>Margins</p>
              <ul className="space-y-1.5 text-profile-fg text-[15px] leading-relaxed mt-2">
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Trimming unnecessary cost</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Tightening how we buy and hold stock</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Making sure we know where the money goes</li>
              </ul>
            </div>
            <div className="pl-6 border-l-2 rounded-r-lg py-3 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
              <p className={LABEL_CLASS}>Digital & AI</p>
              <ul className="space-y-1.5 text-profile-fg text-[15px] leading-relaxed mt-2">
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Less manual work and spreadsheets, clearer numbers every month</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Using data—and AI where it clearly helps—so decisions are based on fact, not gut</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />AI for faster reporting and margin visibility; supports judgment rather than replacing it</li>
              </ul>
            </div>
          </div>
          <p className={PROSE_CLASS + " mt-10"}>
            We enter each acquisition with a structured plan and systematically apply proven practices across the portfolio.
          </p>
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
                    <span>EBITDA 22 MSEK at 6x → EV 130 MSEK</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-profile-accent flex-shrink-0 mt-0.5" aria-hidden />
                    <span>Equity 100 / Debt 30</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-profile-accent flex-shrink-0 mt-0.5" aria-hidden />
                    <span>Conservative, scalable</span>
                  </li>
                </ul>
              </div>
            </div>
            <p className={PUNCH_CLASS}>
              We invest in operational upside where we can add disproportionate value.
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
          <p className={PROSE_CLASS + " mb-10"}>
            We use a proprietary AI sourcing engine built in-house to analyse the Swedish SME universe (SEK 50–200m revenue). It evaluates stable base economics, margin stagnation signals, and niche positioning, outputs a ranked Target 100 shortlist, and powers pre-engagement analysis of products, customer segments, pricing, and operational signals. We arrive at dialogue with structured intelligence and disciplined entry criteria.
          </p>
          <p className={PROSE_CLASS + " text-center mb-10 font-semibold"}>
            Most PE firms depend on broker flow and relationships; we systematically cover the universe and arrive at targets with pre-built intelligence most competitors lack.
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

      {/* ─── Investment Process & Pipeline ───────────────────────────────── */}
      <section className="w-full" id="process" style={{ backgroundColor: tokens.bgAlt }}>
        <div className={DECK_SECTION_CLASS}>
        <div className={SECTION_TOP_CLASS} style={{ borderColor: tokens.border }}>
          <h2 className={H2_CLASS}>Investment Process & Pipeline</h2>
          <p className={SECTION_SUBTITLE_CLASS}>Sourcing to value creation</p>
          <p className={PROSE_CLASS + " mb-10"}>
            Sourcing combines direct outreach, broker relationships, and our own data-driven playbook. Due diligence focuses on quality of earnings, operational improvement levers, and management assessment. Negotiation covers structure, alignment, and risk provisions. Execution starts with a Day 1 plan and value creation initiatives.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            {[
              { stage: "Identified", count: "81" },
              { stage: "Initial contact", count: "12" },
              { stage: "Advanced discussion", count: "5" },
              { stage: "Active due diligence", count: "2" },
            ].map((item) => (
              <div key={item.stage} className="rounded-lg p-4 sm:p-5 text-center border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border, boxShadow: "var(--profile-shadow-soft)" }}>
                <p className="text-2xl font-semibold tabular-nums" style={{ color: tokens.accent }}>{item.count}</p>
                <p className="text-sm mt-1" style={{ color: tokens.text }}>{item.stage}</p>
              </div>
            ))}
          </div>
          <p className="text-sm mb-6" style={{ color: tokens.text }}>Active targets (illustrative)</p>
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
              Example: a Nordic industrial products company. Entry: equity SEK 100m, debt SEK 30m (EV SEK 130m). Clear upside from pricing, operations and cost.
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
              Operational improvements compound into equity value; we reinvest and compound over time.
            </p>
          </div>
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

            <div className="pt-8 border-t" style={{ borderColor: tokens.border }}>
              <h3 className={H3_CLASS}>Why we can execute</h3>
              <p className="text-[15px] text-profile-fg leading-relaxed mb-6 max-w-2xl">
                We have done this before—at scale. The team combines institutional investment expertise with hands-on operational leadership across the full lifecycle: sourcing, transaction execution, value creation and exit.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { stat: "80+", label: "ECM transactions executed" },
                  { stat: "20+", label: "IPOs across Nordic markets" },
                  { stat: "€50m+", label: "Venture capital deployed" },
                  { stat: "iZettle & Readly", label: "PayPal exit; IPO listing" },
                  { stat: "€60m+", label: "D2C business built at Electrolux" },
                  { stat: "€30m", label: "Ecommerce channel from zero" },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg p-4 border text-center" style={{ backgroundColor: tokens.bg, borderColor: tokens.border, boxShadow: "var(--profile-shadow-soft)" }}>
                    <p className="text-xl font-semibold" style={{ color: tokens.accent }}>{item.stat}</p>
                    <p className="text-sm mt-1" style={{ color: tokens.text }}>{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-5 sm:p-6 rounded-lg" style={{ backgroundColor: tokens.washSage, borderLeft: `4px solid ${tokens.accent}` }}>
                <p className="text-[17px] sm:text-[19px] font-semibold leading-relaxed" style={{ color: tokens.text }}>
                  Nivo combines the capabilities of a traditional PE investor with the operational expertise required to unlock growth in founder-led businesses.
                </p>
              </div>

              <details className="mt-8 group rounded-lg border" style={{ borderColor: tokens.border, backgroundColor: tokens.bg }}>
                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none px-5 py-4 font-bold transition-all rounded-lg group-open:rounded-b-none group-open:rounded-t-lg hover:bg-black/5 [&::-webkit-details-marker]:hidden" style={{ color: tokens.text, backgroundColor: tokens.bg, border: `2px solid ${tokens.border}`, borderLeft: `4px solid ${tokens.accent}` }}>
                  <span className="flex items-center gap-3">
                    <ChevronDown className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-open:rotate-180" style={{ color: tokens.accent }} aria-hidden />
                    <span>Full team capability overview</span>
                  </span>
                  <span className="text-sm font-normal opacity-75">Click to expand</span>
                </summary>
                <div className="px-5 pb-6 pt-2 space-y-6 border-t" style={{ borderColor: tokens.border }}>
                  <div>
                    <p className={LABEL_CLASS + " mb-2"}>Deal sourcing and transaction execution</p>
                    <p className="text-[15px] text-profile-fg leading-relaxed">
                      The team has extensive experience in corporate finance and venture investing: <strong style={{ color: tokens.text }}>80+ equity capital markets transactions and 20+ IPOs</strong>, plus <strong style={{ color: tokens.text }}>€50m+ venture investments</strong> including early involvement in iZettle and Readly—iZettle later acquired by PayPal. Strong expertise in valuation, capital raising, transaction structuring and exit strategy.
                    </p>
                  </div>
                  <div>
                    <p className={LABEL_CLASS + " mb-2"}>Operational value creation</p>
                    <p className="text-[15px] text-profile-fg leading-relaxed">
                      Hands-on operational leadership: <strong style={{ color: tokens.text }}>€60m+ direct-to-consumer business built within Electrolux</strong>, growing the Nordic ecommerce channel from zero to <strong style={{ color: tokens.text }}>€30m revenue</strong>. Direct experience in digitalisation, ecommerce strategy, international expansion and revenue optimisation—highly relevant for Nivo’s target companies.
                    </p>
                  </div>
                  <div>
                    <p className={LABEL_CLASS + " mb-2"}>Financial leadership and governance</p>
                    <p className="text-[15px] text-profile-fg leading-relaxed">
                      Strong financial leadership from listed companies and international organisations: building finance functions, managing reporting, overseeing capital allocation. Nivo can implement institutional-grade financial discipline, governance and reporting across portfolio companies from day one.
                    </p>
                  </div>
                  <div>
                    <p className={LABEL_CLASS + " mb-2"}>Entrepreneurial and founder perspective</p>
                    <p className="text-[15px] text-profile-fg leading-relaxed">
                      Institutional experience combined with entrepreneurship—founded and invested in multiple companies, including fintech and digital infrastructure. Strong understanding of founder-led businesses and the operational realities faced by small and mid-sized companies.
                    </p>
                  </div>
                  <div>
                    <p className={LABEL_CLASS + " mb-4"}>Capability matrix</p>
                    <p className="text-[14px] text-profile-fg mb-4" style={{ color: tokens.text }}>Investment lifecycle → team experience</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { phase: "Deal sourcing", exp: "Investment banking, venture capital and private investing networks", icon: Handshake },
                        { phase: "Transaction execution", exp: "80+ ECM transactions and 20+ IPOs", icon: FileCheck },
                        { phase: "Capital markets", exp: "Valuation, equity raising and investor positioning", icon: BarChart3 },
                        { phase: "Operational scaling", exp: "€60m D2C business built within Electrolux", icon: TrendingUp },
                        { phase: "Digital transformation", exp: "Ecommerce platforms, international expansion and revenue optimisation", icon: Workflow },
                        { phase: "Financial governance", exp: "CFO leadership in listed companies and international organisations", icon: Shield },
                        { phase: "Exit strategy", exp: "IPOs, M&A transactions and venture exits", icon: ArrowRight },
                      ].map(({ phase, exp, icon: Icon }) => (
                        <div key={phase} className="flex gap-4 p-4 rounded-lg border" style={{ backgroundColor: tokens.washSage, borderColor: tokens.border }}>
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: tokens.bg, borderColor: tokens.accent, borderWidth: 1 }}>
                            <Icon className="w-5 h-5" style={{ color: tokens.accent }} aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[15px] mb-1" style={{ color: tokens.text }}>{phase}</p>
                            <p className="text-[14px] leading-relaxed" style={{ color: tokens.text }}>{exp}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
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
              Nivo Group AB is the parent company (no separate management company)—a Swedish AB (aktiebolag) with an evergreen investment horizon with the ambition to become a listed entity within 10 years. Capital is deployed into Nordic SMEs and compounded over the long term. Founders and Founding Investors hold both Class A and Class B shares; new investors participate via Class B shares. We work closely with our Founding investors alongside the board on investment decisions. Reporting to shareholders includes quarterly updates, portfolio performance, and value-creation milestones.
            </p>

            <div className="pt-6 border-t" style={{ borderColor: tokens.border }}>
              <h3 className={H3_CLASS}>Corporate and investment structure</h3>
              <p className="text-sm mb-4" style={{ color: tokens.text }}>Evergreen Swedish AB structure. Deal-by-deal financing.</p>
              <div className="grid grid-cols-1 gap-8">
                {/* Left: Corporate structure diagram */}
                <div className="rounded-lg border p-6 sm:p-8" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
                  <div className="flex flex-col items-center gap-0">
                    {/* Above Parent: investors */}
                    <div className="flex flex-nowrap justify-center gap-4 sm:gap-6 mb-3">
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
                  <p className={LABEL_OLIVE_CLASS + " mb-3"}>Financing model & share classes</p>
                  <p className="w-full text-profile-fg leading-relaxed text-[14px] sm:text-[15px]">
                    All funding flows through Nivo Group AB (the topco). Acquisitions are structured deal-by-deal via BidCos. There are no capital commitments—participation in future issues is voluntary, with pre-emptive rights.
                  </p>
                  <p className="w-full text-profile-fg leading-relaxed text-[14px] sm:text-[15px] mt-4">
                    A-shares (Founders & Founding Investors) carry strong voting rights and receive 20% of dividends and excess returns, plus catch-up on the B-shares threshold. B-shares receive 80% of dividends and excess returns, with 1x liquidation preference and a 20% return threshold. Each exit triggers distribution according to these rights. Portfolio NAV is revalued with each acquisition, rewarding early capital.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className={LABEL_CLASS + " mb-4"}>Key terms</p>
              <div className="grid grid-cols-2 gap-x-8 sm:gap-x-12 gap-y-4 text-base sm:text-lg">
                <div className="flex justify-between items-baseline border-b border-profile-divider pb-3">
                  <span className="text-profile-fg">Issuer</span>
                  <span className="font-semibold text-profile-fg text-lg sm:text-xl">Nivo Group AB</span>
                </div>
                <div className="flex justify-between items-baseline border-b border-profile-divider pb-3">
                  <span className="text-profile-fg">Target capital</span>
                  <span className="font-semibold text-profile-fg text-lg sm:text-xl">SEK 1,000m</span>
                </div>
                <div className="flex justify-between items-baseline border-b border-profile-divider pb-3">
                  <span className="text-profile-fg">Share classes</span>
                  <span className="font-semibold text-profile-fg text-lg sm:text-xl">A- and B-shares</span>
                </div>
                <div className="flex justify-between items-baseline border-b border-profile-divider pb-3">
                  <span className="text-profile-fg">Management fee</span>
                  <span className="font-semibold text-profile-fg text-lg sm:text-xl">0%</span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t" style={{ borderColor: tokens.border }}>
              <h3 className={H3_CLASS}>Governance</h3>
              <p className="w-full text-profile-fg leading-relaxed text-[14px] sm:text-[15px] mb-6">
                Majority control (51–100%) with board oversight; incentives tied to ROIC and cash flow. Board retains strategy, capital allocation, M&A; management runs operations within thresholds. Monthly financials, quarterly investor updates, annual audit. Independent administrator and auditor.
              </p>
            </div>

            <p className="w-full text-profile-fg leading-relaxed text-[14px] sm:text-[15px]">
              Target close is Q2 2026. We are seeking 2–3 anchor investors. The pipeline is strong and the team is committed. Deployment is expected over 18–24 months; hold per company 5–7 years. Target gross IRR 20–25% and MOIC 4–5x through disciplined reinvestment and operational compounding; base-case underwriting assumes margin expansion and debt paydown with flat-to-modest exit multiples.
            </p>
          </div>

          <div className="pt-8 border-t" style={{ borderColor: tokens.border }}>
            <h3 className={H3_CLASS}>Exit strategy</h3>
            <p className="w-full text-profile-fg leading-relaxed text-[14px] sm:text-[15px] mb-6">
              Primary exit: strategic sale to trade or corporate buyers. Secondary buyout or recap where appropriate. Years 1–2: margin expansion; 3–4: cash conversion and debt reduction; 5–6: ROIC 20%+ and strategic positioning; 7+: exit or recap.
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
            <p className="text-[15px] text-profile-fg max-w-2xl">
              Concentration (3–4 companies) and liquidity (SME exits can be illiquid) are mitigated by screening, sector diversity, operational involvement, and building for strategic buyers with timing flexibility.
            </p>
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

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Database, Filter, Search, Target, User, TrendingUp, BarChart3, Clock, Building2, Globe, Workflow, Shield, Check } from "lucide-react";

// ─── Projection data: 7-year horizon, ~15% yearly return, reinvestment → ROIC 20%, MoM growth ─────────
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

const SECTION_CLASS = "max-w-4xl mx-auto px-5 sm:px-6 py-10 sm:py-14";
const PROSE_CLASS = "w-full text-inv2-fg-muted leading-relaxed text-[16px] sm:text-[18px]";
const PUNCH_CLASS = "text-center text-xl sm:text-2xl font-semibold text-inv2-fg py-6";

// Heading hierarchy (refactoring design UX)
const H1_CLASS = "font-heading font-semibold text-inv2-fg tracking-tight text-3xl sm:text-4xl md:text-5xl leading-[1.15] mb-6";
const H2_CLASS = "font-heading font-semibold text-inv2-fg tracking-tight text-2xl sm:text-3xl mb-4";
const H3_CLASS = "font-heading font-semibold text-inv2-fg text-lg sm:text-xl mb-3";
const SECTION_SUBTITLE_CLASS = "text-inv2-olive font-medium uppercase tracking-widest text-sm mb-6";
const LABEL_CLASS = "text-sm font-semibold text-inv2-fg mb-2";
const LABEL_OLIVE_CLASS = "text-sm font-semibold text-inv2-olive uppercase tracking-wider mb-2";

export function Investor2LongForm() {
  return (
    <div className="bg-white text-inv2-fg antialiased min-h-screen overflow-x-hidden [padding-left:env(safe-area-inset-left)] [padding-right:env(safe-area-inset-right)] [padding-bottom:env(safe-area-inset-bottom)]">
      {/* ─── Hero (video background, white text) ──────────────────────────── */}
      <section className="relative min-h-[70vh] flex flex-col justify-center px-5 sm:px-6 pt-20 pb-24 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <video
            className="h-full w-full object-cover object-center"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden
          >
            <source src="/uploads/nivo-hero-video.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
          <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto text-center text-white">
          <img src="/nivo-logo-white.svg" alt="Nivo" className="h-20 sm:h-24 w-auto mx-auto mb-8 sm:mb-10" />
          <h1 className="font-heading font-semibold tracking-tight text-3xl sm:text-4xl md:text-5xl leading-[1.15] mb-6 text-white">
            Nordic Operational Compounder
          </h1>
          <p className="text-xl sm:text-2xl text-white/90 max-w-2xl mx-auto leading-relaxed">
            We acquire profitable, under-digitised Nordic SMEs and build value through pricing discipline, operating rigor, and structured reinvestment.
          </p>
          <blockquote className="mt-12 text-lg sm:text-xl text-white font-bold max-w-xl mx-auto">
            We do not buy technology risk.
            <br />
            We buy execution upside.
          </blockquote>
          <div className="mt-14 max-w-2xl mx-auto pt-8 border-t border-white/30">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-base sm:text-[17px]">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-white/80"><Building2 className="w-4 h-4 text-white/90 flex-shrink-0" aria-hidden />Investment Company</span>
                <Check className="w-5 h-5 text-white flex-shrink-0" aria-hidden />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-white/80"><Shield className="w-4 h-4 text-white/90 flex-shrink-0" aria-hidden />Management Fee</span>
                <span className="font-semibold tabular-nums text-white">0%</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-white/80"><Target className="w-4 h-4 text-white/90 flex-shrink-0" aria-hidden />Target size</span>
                <span className="font-semibold tabular-nums text-white">SEK 1,000m</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-white/80"><TrendingUp className="w-4 h-4 text-white/90 flex-shrink-0" aria-hidden />Target gross IRR</span>
                <span className="font-semibold tabular-nums text-white">20–25%</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-white/80"><BarChart3 className="w-4 h-4 text-white/90 flex-shrink-0" aria-hidden />Target gross MOIC</span>
                <span className="font-semibold tabular-nums text-white">4x–5x</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-white/80"><Clock className="w-4 h-4 text-white/90 flex-shrink-0" aria-hidden />Base case hold</span>
                <span className="font-semibold tabular-nums text-white">5–10 years</span>
              </div>
            </div>
          </div>
          <p className="mt-8 sm:mt-10 text-lg sm:text-xl text-white/90 leading-relaxed max-w-2xl mx-auto font-bold">
            Operational excellence will add value driven by added revenue growth, EBITDA expansion and only modest multiple expansion.
          </p>
        </div>
      </section>

      {/* ─── The Opportunity ────────────────────────────────────────────── */}
      <section className={SECTION_CLASS} id="opportunity">
        <div className="border-t border-inv2-divider pt-10 sm:pt-14">
          <h2 className={H2_CLASS}>The Opportunity</h2>
          <p className={SECTION_SUBTITLE_CLASS}>Market context</p>

          <div className="space-y-10">
            <div className="flex gap-4 sm:gap-5">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-inv2-olive/10 border border-inv2-divider/60 flex items-center justify-center">
                <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-inv2-olive" aria-hidden />
              </div>
              <div>
                <h3 className={H3_CLASS}>The universe</h3>
                <p className={PROSE_CLASS + " mb-3"}>
                  Nordic SMEs in our target band are often profitable but structurally under-digitised. The opportunity set is large and underserved.
                </p>
                <ul className="space-y-1.5 text-inv2-fg-muted text-[15px] sm:text-[17px] leading-relaxed">
                  <li className="flex items-start gap-2"><span className="text-inv2-olive mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" aria-hidden />Roughly 15,000 companies in the revenue band we focus on</li>
                  <li className="flex items-start gap-2"><span className="text-inv2-olive mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" aria-hidden />Owner-managed, traditional structures; stable B2B services and manufacturing</li>
                  <li className="flex items-start gap-2"><span className="text-inv2-olive mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" aria-hidden />Pronounced process and systems gap — room for operational improvement</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-4 sm:gap-5">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-inv2-olive/10 border border-inv2-divider/60 flex items-center justify-center">
                <Workflow className="w-5 h-5 sm:w-6 sm:h-6 text-inv2-olive" aria-hidden />
              </div>
              <div>
                <h3 className={H3_CLASS}>The gap</h3>
                <p className={PROSE_CLASS + " mb-3"}>
                  Many of these businesses share the same inefficiencies. They do not need technological disruption — they need operational elevation.
                </p>
                <ul className="space-y-1.5 text-inv2-fg-muted text-[15px] sm:text-[17px] leading-relaxed">
                  <li className="flex items-start gap-2"><span className="text-inv2-olive mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" aria-hidden />Manual workflows: heavy use of spreadsheets, email, ad-hoc processes</li>
                  <li className="flex items-start gap-2"><span className="text-inv2-olive mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" aria-hidden />Limited integration: fragmented systems, little data flow between tools</li>
                  <li className="flex items-start gap-2"><span className="text-inv2-olive mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" aria-hidden />Pricing: cost-plus or legacy pricing, inconsistent value capture</li>
                  <li className="flex items-start gap-2"><span className="text-inv2-olive mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" aria-hidden />Low transparency: limited visibility into margins, customer profitability, and KPIs</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-4 sm:gap-5">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-inv2-olive/10 border border-inv2-divider/60 flex items-center justify-center">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-inv2-olive" aria-hidden />
              </div>
              <div>
                <h3 className={H3_CLASS}>Why Nordic</h3>
                <p className={PROSE_CLASS + " mb-3"}>
                  The region is a favourable environment for long-term, operational value creation.
                </p>
                <ul className="space-y-1.5 text-inv2-fg-muted text-[15px] sm:text-[17px] leading-relaxed">
                  <li className="flex items-start gap-2"><span className="text-inv2-olive mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" aria-hidden />Rule of law, transparency, educated workforce</li>
                  <li className="flex items-start gap-2"><span className="text-inv2-olive mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" aria-hidden />Generational transitions creating deal flow</li>
                  <li className="flex items-start gap-2"><span className="text-inv2-olive mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" aria-hidden />Dedicated PE capital below SEK 200m remains limited</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-4 sm:gap-5">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-inv2-olive/10 border border-inv2-divider/60 flex items-center justify-center">
                <Target className="w-5 h-5 sm:w-6 sm:h-6 text-inv2-olive" aria-hidden />
              </div>
              <div>
                <h3 className={H3_CLASS}>Our take</h3>
                <p className={PROSE_CLASS}>
                  Nivo targets this improvement gap with a disciplined, repeatable approach. We buy operational improvement potential, not technology risk.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Investment overview ────────────────────────────────────────── */}
      <section className={"bg-inv2-bg-subtle " + SECTION_CLASS} id="overview">
        <div className="border-t border-inv2-divider pt-10 sm:pt-14">
          <h2 className={H2_CLASS}>Investment overview</h2>
          <p className={SECTION_SUBTITLE_CLASS}>A disciplined approach to Nordic compounding SMEs</p>
          <div className="space-y-6">
            <p className={PROSE_CLASS}>
              We acquire profitable, under-digitised SMEs in the Nordic region, typically in the SEK 50–200m revenue range. The model is an operational compounder: we use a proprietary segmentation engine to identify targets and create value through structured execution and selective use of data and automation. Our edge is systematic sourcing and outside-in intelligence; our value proposition is operational improvement and long-term compounding, not technology risk.
            </p>
            <p className={PROSE_CLASS}>
              We target a normalised ROIC of 20% at portfolio companies. Reinvestment discipline is central: we reinvest 100% of operational cash flow plus approximately 30% leverage where appropriate. Nivo buys operational improvement potential, not technology risk.
            </p>
          </div>
        </div>
      </section>

      {/* Image break ────────────────────────────────────────────────────── */}
      <section className="w-full max-w-5xl mx-auto px-5 sm:px-6 py-4 sm:py-5">
        <div className="aspect-[21/9] rounded-lg overflow-hidden bg-inv2-sage-muted/50">
          <img
            src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80"
            alt="Nordic industrial landscape"
            className="w-full h-full object-cover opacity-90"
          />
        </div>
      </section>

      {/* ─── The Nordic Compounder Model ─────────────────────────────────── */}
      <section className={"bg-inv2-bg-subtle " + SECTION_CLASS} id="model">
        <div className="border-t border-inv2-divider pt-10 sm:pt-14">
          <h2 className={H2_CLASS}>The Nordic Compounder Model</h2>
          <p className={SECTION_SUBTITLE_CLASS}>Investment thesis</p>
          <div className="w-full space-y-8">
            <div>
              <p className={LABEL_OLIVE_CLASS + " mb-4"}>Three pillars</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="pl-4 border-l-2 border-inv2-olive/60 bg-white/60 rounded-r-lg py-3 pr-4">
                  <p className="font-semibold text-inv2-fg text-base mb-1">Acquire right</p>
                  <p className="text-[15px] text-inv2-fg-muted leading-relaxed">Disciplined entry, clear improvement headroom.</p>
                </div>
                <div className="pl-4 border-l-2 border-inv2-olive/60 bg-white/60 rounded-r-lg py-3 pr-4">
                  <p className="font-semibold text-inv2-fg text-base mb-1">Execute relentlessly</p>
                  <p className="text-[15px] text-inv2-fg-muted leading-relaxed">Pricing discipline, margin expansion, reporting.</p>
                </div>
                <div className="pl-4 border-l-2 border-inv2-olive/60 bg-white/60 rounded-r-lg py-3 pr-4">
                  <p className="font-semibold text-inv2-fg text-base mb-1">Compound with discipline</p>
                  <p className="text-[15px] text-inv2-fg-muted leading-relaxed">Reinvest cash flow, keep appropriate debt levels, build equity.</p>
                </div>
              </div>
              <div className="bg-white/60 rounded-lg py-3 px-4 w-full mt-6">
                <p className="font-semibold text-inv2-fg text-base mb-1">Return drivers</p>
                <p className="text-[15px] text-inv2-fg-muted leading-relaxed">
                  We use operational excellence and apply technology—including AI—where appropriate to accelerate revenue growth and margin expansion. Value is driven primarily by these levers; we assume only modest multiple expansion.
                </p>
              </div>
              <p className="text-base sm:text-lg text-inv2-fg-muted mt-6 leading-relaxed font-bold text-center w-full">
                Execution leads to margins, margins to cash flow, cash flow to equity.
              </p>
            </div>

            <div className="pt-4 border-t border-inv2-divider/60 space-y-4">
              <p className={LABEL_OLIVE_CLASS + " mb-4"}>Illustrative investment outcome</p>
              <div className="bg-white/60 rounded-lg py-3 px-4 w-full">
                <p className="text-[15px] text-inv2-fg-muted leading-relaxed">
                  The chart and table below are based on the assumptions set out in this section: entry and exit multiples, revenue growth, margin progression, leverage and hold period. Outcomes are illustrative and do not represent a forecast.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 w-full rounded-lg overflow-hidden bg-white shadow-[var(--inv2-shadow-soft)] p-6">
            <p className="text-sm font-medium text-inv2-fg-muted mb-4">Enterprise value build (illustrative, 7 years)</p>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={PROJ} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--inv2-divider))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--inv2-fg-muted))" }} stroke="hsl(var(--inv2-divider))" />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--inv2-fg-muted))" }} stroke="hsl(var(--inv2-divider))" width={36} />
                  <Tooltip
                    cursor={false}
                    contentStyle={{ backgroundColor: "white", border: "1px solid hsl(var(--inv2-divider))", borderRadius: 6, fontSize: 12 }}
                    formatter={(value: number, name: string) => [value.toFixed(1), name === "equityValue" ? "Equity" : "Debt"]}
                    labelFormatter={(l) => l}
                  />
                  <Bar dataKey="equityValue" stackId="a" fill="hsl(var(--inv2-olive))" name="equityValue" radius={[0, 2, 0, 0]} />
                  <Bar dataKey="debt" stackId="a" fill="hsl(var(--inv2-sage) / 0.35)" name="debt" radius={[0, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-6 w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="pl-4 border-l-2 border-inv2-olive/60 bg-white/60 rounded-r-lg py-3 pr-4">
              <p className={LABEL_CLASS}>Entry → Exit (illustrative)</p>
              <p className="text-xl sm:text-2xl font-semibold text-inv2-olive tabular-nums">Equity {ENTRY_EQUITY} → {EXIT_EQUITY.toFixed(1)}</p>
            </div>
            <div className="pl-4 border-l-2 border-inv2-olive/60 bg-white/60 rounded-r-lg py-3 pr-4">
              <p className={LABEL_CLASS}>Gross MOIC</p>
              <p className="text-xl sm:text-2xl font-semibold text-inv2-olive tabular-nums">{GROSS_MOIC}x</p>
            </div>
            <div className="pl-4 border-l-2 border-inv2-olive/60 bg-white/60 rounded-r-lg py-3 pr-4">
              <p className={LABEL_CLASS}>IRR</p>
              <p className="text-xl sm:text-2xl font-semibold text-inv2-olive tabular-nums">{GROSS_IRR}%</p>
            </div>
          </div>

          <div className="mt-10 w-full">
            <p className={LABEL_OLIVE_CLASS + " mb-4"}>Assumptions</p>
            <div className="pl-4 border-l-2 border-inv2-olive/60 bg-white/60 rounded-r-lg py-3 pr-4 w-full">
              <p className="text-[15px] text-inv2-fg-muted leading-relaxed">Yearly returns of 15% over a cycle, full reinvestments and 30% leverage. No exit multiple expansion assumed.</p>
            </div>
          </div>

          <div className="mt-10 w-full">
            <p className={LABEL_OLIVE_CLASS}>Projection detail (illustrative)</p>
            <p className="text-[13px] text-inv2-fg-muted mb-3">7-year investment horizon with ~15% yearly return. Reinvestment of returns drives ROIC and MoM multiples.</p>
            <div className="overflow-x-auto rounded-lg border border-inv2-divider/60">
              <table className="w-full text-sm min-w-[520px]">
                <thead className="bg-inv2-bg-subtle">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold text-inv2-fg">Year</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-inv2-fg">Equity</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-inv2-fg">Debt</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-inv2-fg">EV</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-inv2-fg">Return</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-inv2-fg">Reinvestment</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-inv2-fg">ROIC</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-inv2-fg">MoM</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {PROJ.map((row) => (
                    <tr key={row.year} className="border-t border-inv2-divider/60">
                      <td className="px-3 py-2.5 text-inv2-fg-muted">{row.label}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-inv2-olive">{row.equityValue}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-inv2-fg">{row.debt}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-inv2-fg">{row.ev}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-inv2-fg">{row.return || "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-inv2-fg">{row.reinvestment || "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-inv2-fg">{row.roic}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-inv2-fg">{row.mom}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Value Creation ─────────────────────────────────────────────── */}
      <section className={"bg-inv2-bg-subtle " + SECTION_CLASS} id="value-creation">
        <div className="border-t border-inv2-divider pt-10 sm:pt-14">
          <h2 className={H2_CLASS}>Value creation</h2>
          <p className={SECTION_SUBTITLE_CLASS}>From acquisition to compounding</p>
          <p className={PROSE_CLASS + " mb-10"}>
            We run a repeatable five-step process. We acquire profitable, under-digitised SMEs with stable cash flows (control). We improve through pricing, sales discipline, cost structure, and reporting (margin). We optimise ROIC toward a normalised 15% through operational excellence (ROIC). We reinvest 100% of operational cash flow plus approximately 30% leverage where appropriate (cash). We compound by repeating the cycle with increasing capability and scale (equity). Each acquisition increases data, benchmarks, and execution capability—the model strengthens with scale.
          </p>
          <div className="mb-4">
            <p className={LABEL_CLASS}>Value creation playbook — three operational pillars</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10">
            <div className="pl-6 border-l-2 border-inv2-divider">
              <p className={LABEL_CLASS}>Revenue</p>
              <p className="text-[15px] text-inv2-fg-muted leading-relaxed">Pricing discipline, sales governance, retention, product mix.</p>
            </div>
            <div className="pl-6 border-l-2 border-inv2-divider">
              <p className={LABEL_CLASS}>Margins</p>
              <p className="text-[15px] text-inv2-fg-muted leading-relaxed">Overhead optimisation, working capital, procurement, cost allocation.</p>
            </div>
            <div className="pl-6 border-l-2 border-inv2-divider">
              <p className={LABEL_CLASS}>Digital & AI</p>
              <p className="text-[15px] text-inv2-fg-muted leading-relaxed">Workflow automation, reporting, data-led decisions, AI capacity.</p>
            </div>
          </div>
          <p className={PROSE_CLASS + " mt-10"}>
            Each acquisition adds operational data and benchmarks for future deals; those benchmarks refine value-creation approaches from portfolio performance; expertise deepens and implementation becomes faster. The system becomes more effective with every investment. AI increases capacity; disciplined execution drives margins.
          </p>

          <div className="mt-16 pt-10 border-t border-inv2-divider">
            <h3 className={H3_CLASS}>AI enablement</h3>
            <p className={PROSE_CLASS + " mb-6"}>
              We apply AI to execution bottlenecks, not speculative bets. Workflow digitisation replaces manual scheduling and reporting with digital workflows; typical impact is cycle-time reduction of 15–25%. Reporting is standardised into monthly KPI packs and margin by customer and product line, reducing close time by 2–4 weeks. Commercial control is strengthened through price corridors, win/loss tracking, and discount gates, typically adding 100–200 bps to gross margin.
            </p>
            <p className={PROSE_CLASS}>
              AI is deployed only where outcomes are measurable—throughput, margin, speed. It acts as a capacity multiplier inside a disciplined system. AI supports execution; it does not replace discipline.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Acquisition criteria ───────────────────────────────────────── */}
      <section className={SECTION_CLASS} id="acquisition-criteria">
        <div className="border-t border-inv2-divider pt-10 sm:pt-14">
          <h2 className={H2_CLASS}>Acquisition criteria</h2>
          <p className={SECTION_SUBTITLE_CLASS}>Valuation and capital structure discipline</p>
          <div className="space-y-8">
            <p className={PROSE_CLASS}>
              We apply strict valuation discipline: entry at EV/EBITDA in the 5–7x range, prioritising operational improvement potential over growth premium. Targets must demonstrate stable cash generation. Leverage is conservative—debt to capital below 30%, net debt to EBITDA below 2x—and supplements strategy rather than driving returns. Financial guardrails include a credible path to 15% ROIC, at least 12 months runway, and capital preservation as the first principle.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-3xl mx-auto">
              <div className="pl-4 border-l-2 border-inv2-divider">
                <p className={LABEL_CLASS + " mb-3"}>Target profile</p>
                <ul className="space-y-2 text-[15px] text-inv2-fg-muted">
                  <li className="flex items-start gap-2">
                    <BarChart3 className="w-4 h-4 text-inv2-olive flex-shrink-0 mt-0.5" aria-hidden />
                    <span>EV/EBITDA 5–7x</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-inv2-olive flex-shrink-0 mt-0.5" aria-hidden />
                    <span>Debt/Cap &lt;30%</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <TrendingUp className="w-4 h-4 text-inv2-olive flex-shrink-0 mt-0.5" aria-hidden />
                    <span>ROIC target 15%</span>
                  </li>
                </ul>
              </div>
              <div className="pl-4 border-l-2 border-inv2-divider">
                <p className={LABEL_CLASS + " mb-3"}>Example</p>
                <ul className="space-y-2 text-[15px] text-inv2-fg-muted">
                  <li className="flex items-start gap-2">
                    <BarChart3 className="w-4 h-4 text-inv2-olive flex-shrink-0 mt-0.5" aria-hidden />
                    <span>EBITDA 10 MSEK at 6x → EV 60 MSEK</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-inv2-olive flex-shrink-0 mt-0.5" aria-hidden />
                    <span>Equity 45 / Debt 15</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-inv2-olive flex-shrink-0 mt-0.5" aria-hidden />
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
      </section>

      {/* ─── Sourcing Edge ───────────────────────────────────────────────── */}
      <section className={SECTION_CLASS} id="sourcing">
        <div className="border-t border-inv2-divider pt-10 sm:pt-14">
          <h2 className={H2_CLASS}>Sourcing edge</h2>
          <p className={SECTION_SUBTITLE_CLASS}>Pipeline development</p>
          <p className={PROSE_CLASS + " mb-8"}>
            We use a proprietary AI sourcing engine built in-house to analyse the Swedish SME universe within the target size band. Our backend ingests and segments companies by revenue SEK 50–200m, stable base economics, margin stagnation signals, and niche positioning. The engine outputs a ranked Target 100 shortlist and supports consistent, repeatable screening at scale.
          </p>
          <p className={PROSE_CLASS + " mb-10"}>
            Before engagement the same platform powers analysis of products and services, customer segments, go-to-market model, pricing structure, and operational signals. We arrive at dialogue with structured intelligence and disciplined entry criteria—all driven by our own technology stack.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 py-10 text-base sm:text-lg font-medium text-inv2-fg-muted">
            <span className="flex items-center gap-2 text-inv2-olive">
              <Database className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" aria-hidden />
              Universe
            </span>
            <span className="text-inv2-divider" aria-hidden>→</span>
            <span className="flex items-center gap-2 text-inv2-olive">
              <Filter className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" aria-hidden />
              Filtering
            </span>
            <span className="text-inv2-divider" aria-hidden>→</span>
            <span className="flex items-center gap-2 text-inv2-olive">
              <Search className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" aria-hidden />
              Research
            </span>
            <span className="text-inv2-divider" aria-hidden>→</span>
            <span className="flex items-center gap-2 text-inv2-olive">
              <Target className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" aria-hidden />
              Targets
            </span>
          </div>
          <div className="mt-10 w-full">
            <p className={LABEL_OLIVE_CLASS + " text-center mb-2"}>Proprietary AI sourcing engine</p>
            <p className="text-center text-inv2-fg-muted text-[15px] sm:text-[16px] leading-relaxed mb-6 max-w-2xl mx-auto">
              We built an in-house proprietary sourcing engine that leverages AI as well as financial analysis. We can analyse any Swedish company.
            </p>
            <div className="rounded-lg overflow-hidden border border-inv2-divider/60 shadow-[var(--inv2-shadow-soft)] relative">
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
            <div className="mt-6 rounded-lg overflow-hidden border border-inv2-divider/60 shadow-[var(--inv2-shadow-soft)] relative">
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
      </section>

      {/* ─── Investment process ──────────────────────────────────────────── */}
      <section className={"bg-inv2-bg-subtle " + SECTION_CLASS} id="process">
        <div className="border-t border-inv2-divider pt-10 sm:pt-14">
          <h2 className={H2_CLASS}>Investment process</h2>
          <p className="text-inv2-olive font-medium uppercase tracking-widest text-sm mb-8">Sourcing to value creation</p>
          <div className="space-y-8">
            <p className={PROSE_CLASS}>
              Sourcing combines direct outreach, broker relationships, and our own data-driven playbook. Due diligence focuses on quality of earnings, identification of operational improvement levers, and management assessment. Negotiation covers structure, management alignment, and risk provisions. Execution starts with a Day 1 plan, a structured first 100 days, and then value creation initiatives.
            </p>
            <div className="w-full">
              <p className={LABEL_OLIVE_CLASS + " text-center"}>Current pipeline status</p>
              <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mt-4">
                <div className="bg-white rounded-lg p-5 shadow-[var(--inv2-shadow-soft)] border border-inv2-divider/60 text-center min-w-[140px]">
                  <p className="text-2xl font-semibold text-inv2-olive tabular-nums">12</p>
                  <p className="text-sm font-medium text-inv2-fg mt-1">Initial screen</p>
                  <p className="text-xs text-inv2-fg-muted mt-0.5">Under review</p>
                </div>
                <div className="bg-white rounded-lg p-5 shadow-[var(--inv2-shadow-soft)] border border-inv2-divider/60 text-center min-w-[140px]">
                  <p className="text-2xl font-semibold text-inv2-olive tabular-nums">2</p>
                  <p className="text-sm font-medium text-inv2-fg mt-1">Due diligence</p>
                  <p className="text-xs text-inv2-fg-muted mt-0.5">Active</p>
                </div>
                <div className="bg-white rounded-lg p-5 shadow-[var(--inv2-shadow-soft)] border border-inv2-divider/60 text-center min-w-[140px]">
                  <p className="text-2xl font-semibold text-inv2-olive tabular-nums">1</p>
                  <p className="text-sm font-medium text-inv2-fg mt-1">Negotiation</p>
                  <p className="text-xs text-inv2-fg-muted mt-0.5">LOI+</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Image break ────────────────────────────────────────────────────── */}
      <section className="w-full max-w-5xl mx-auto px-5 sm:px-6 py-4 sm:py-5">
        <div className="aspect-[21/9] rounded-lg overflow-hidden bg-inv2-olive-muted/30">
          <img
            src="https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1200&q=80"
            alt="Nordic nature"
            className="w-full h-full object-cover opacity-85"
          />
        </div>
      </section>

      {/* ─── Pipeline ────────────────────────────────────────────────────── */}
      <section className={SECTION_CLASS} id="pipeline">
        <div className="border-t border-inv2-divider pt-10 sm:pt-14">
          <h2 className={H2_CLASS}>Pipeline</h2>
          <p className={SECTION_SUBTITLE_CLASS}>Target 100 by operational improvement potential</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
            {[
              { stage: "Active due diligence", count: "2" },
              { stage: "Advanced discussion", count: "5" },
              { stage: "Initial contact", count: "12" },
              { stage: "Identified", count: "81" },
            ].map((item) => (
              <div key={item.stage} className="bg-inv2-bg-subtle rounded-lg p-4 sm:p-5 text-center shadow-[var(--inv2-shadow-soft)]">
                <p className="text-2xl font-semibold text-inv2-olive tabular-nums">{item.count}</p>
                <p className="text-sm text-inv2-fg-muted mt-1">{item.stage}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-inv2-fg-muted mb-8">Active targets (illustrative)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 overflow-x-auto pb-2">
            {[
              { name: "Company A", sector: "Industrial", revenue: "SEK 120m", status: "Due diligence" },
              { name: "Company B", sector: "Business services", revenue: "SEK 75m", status: "Advanced" },
              { name: "Company C", sector: "Distribution", revenue: "SEK 165m", status: "Due diligence" },
            ].map((c) => (
              <div key={c.name} className="min-w-[200px] bg-white rounded-lg p-5 shadow-[var(--inv2-shadow-soft)] border border-inv2-divider/60 hover:border-inv2-divider transition-colors">
                <p className="font-semibold text-inv2-fg">{c.name}</p>
                <p className="text-sm text-inv2-fg-muted mt-1">{c.sector} · {c.revenue}</p>
                <p className="text-sm text-inv2-olive font-medium mt-3">{c.status}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-inv2-fg-muted mt-6">Company names anonymised. All fit established selection criteria.</p>
        </div>
      </section>

      {/* ─── Case study (illustrative) ───────────────────────────────────── */}
      <section className={"bg-inv2-bg-subtle " + SECTION_CLASS} id="case-study">
        <div className="border-t border-inv2-divider pt-10 sm:pt-14">
          <h2 className={H2_CLASS}>Case study (illustrative)</h2>
          <p className={SECTION_SUBTITLE_CLASS}>How operational improvements drive returns</p>
          <div className="space-y-8">
            <p className={PROSE_CLASS}>
              Nordic Industrial Services AB operates in facility maintenance. At entry: revenue SEK 45m, EBITDA SEK 4.5m (10% margin). Enterprise value SEK 27m (6.0x); capital structure equity 20.2m / debt 6.8m.
            </p>
            <div className="max-w-2xl space-y-4">
              <p className={LABEL_CLASS}>Value creation over 24 months</p>
              <div className="space-y-3">
                <div className="pl-4 border-l-2 border-inv2-divider">
                  <p className={LABEL_CLASS}>Pricing</p>
                  <p className="text-[15px] text-inv2-fg-muted">Introduction of value-based pricing across 40% of contracts. Impact: +150 bps margin.</p>
                </div>
                <div className="pl-4 border-l-2 border-inv2-divider">
                  <p className={LABEL_CLASS}>Operations</p>
                  <p className="text-[15px] text-inv2-fg-muted">Digital workflow and dispatch replacing manual, paper-based processes. Impact: +100 bps.</p>
                </div>
                <div className="pl-4 border-l-2 border-inv2-divider">
                  <p className={LABEL_CLASS}>Cost</p>
                  <p className="text-[15px] text-inv2-fg-muted">Consolidated functions and vendor renegotiation. Impact: +50 bps.</p>
                </div>
              </div>
            </div>
            <p className={PUNCH_CLASS}>
              Operational improvements compound into equity value. Exit via strategic sale or secondary.
            </p>
          </div>
        </div>
      </section>

      {/* Image break ────────────────────────────────────────────────────── */}
      <section className="w-full max-w-5xl mx-auto px-5 sm:px-6 py-4 sm:py-5">
        <div className="aspect-[21/9] rounded-lg overflow-hidden bg-inv2-sage-muted/40">
          <img
            src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80"
            alt="Minimal workspace"
            className="w-full h-full object-cover opacity-90"
          />
        </div>
      </section>

      {/* ─── Team ───────────────────────────────────────────────────────── */}
      <section className={SECTION_CLASS} id="team">
        <div className="border-t border-inv2-divider pt-10 sm:pt-14">
          <h2 className={H2_CLASS}>Team</h2>
          <p className={SECTION_SUBTITLE_CLASS}>Operational experience meets disciplined capital</p>
          <div className="space-y-10">
            <div>
              <h3 className={H3_CLASS}>Core team</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="flex flex-col items-center text-center">
                  <div className="w-full max-w-[200px] aspect-[4/3] rounded-lg bg-inv2-bg-subtle border-2 border-inv2-divider flex items-center justify-center overflow-hidden">
                    <User className="w-16 h-16 text-inv2-fg-muted/60" aria-hidden />
                  </div>
                  <p className="font-semibold text-inv2-fg mt-4">Jesper Kreuger</p>
                  <p className="text-sm text-inv2-olive font-medium">Founding Partner</p>
                  <p className="text-[15px] text-inv2-fg-muted mt-2 leading-relaxed">15+ years Nordic SME operations, 8+ transformations, M.Sc. Industrial Engineering.</p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="w-full max-w-[200px] aspect-[4/3] rounded-lg bg-inv2-bg-subtle border-2 border-inv2-divider flex items-center justify-center overflow-hidden">
                    <User className="w-16 h-16 text-inv2-fg-muted/60" aria-hidden />
                  </div>
                  <p className="font-semibold text-inv2-fg mt-4">Henrik Cavalli</p>
                  <p className="text-sm text-inv2-olive font-medium">Founding Partner</p>
                  <p className="text-[15px] text-inv2-fg-muted mt-2 leading-relaxed">12+ years PE and growth investing, 20+ Nordic companies, MBA SSE.</p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="w-full max-w-[200px] aspect-[4/3] rounded-lg bg-inv2-bg-subtle border-2 border-inv2-divider flex items-center justify-center overflow-hidden">
                    <User className="w-16 h-16 text-inv2-fg-muted/60" aria-hidden />
                  </div>
                  <p className="font-semibold text-inv2-fg mt-4">Sebastian Robson</p>
                  <p className="text-sm text-inv2-olive font-medium">Founding Partner</p>
                  <p className="text-[15px] text-inv2-fg-muted mt-2 leading-relaxed">10+ years M&A, tech and industrials, M.Sc. Economics.</p>
                </div>
              </div>
            </div>
            <div>
              <h3 className={H3_CLASS}>Advisory board</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto justify-items-center">
                <div className="bg-inv2-bg-subtle rounded-lg p-4 border border-inv2-divider/60 w-full max-w-[260px]">
                  <p className="font-semibold text-inv2-fg">Senior Advisor</p>
                  <p className="text-[15px] text-inv2-fg-muted mt-1">Ex-CEO SEK 400m industrial. 25+ years operations.</p>
                </div>
                <div className="bg-inv2-bg-subtle rounded-lg p-4 border border-inv2-divider/60 w-full max-w-[260px]">
                  <p className="font-semibold text-inv2-fg">Financial Advisor</p>
                  <p className="text-[15px] text-inv2-fg-muted mt-1">Ex-CFO listed Nordic. Financial systems.</p>
                </div>
                <div className="bg-inv2-bg-subtle rounded-lg p-4 border border-inv2-divider/60 w-full max-w-[260px]">
                  <p className="font-semibold text-inv2-fg">Advisor</p>
                  <p className="text-[15px] text-inv2-fg-muted mt-1">Strategic and operational advisory.</p>
                </div>
              </div>
            </div>
            <p className={PROSE_CLASS}>
              Operators first, investors second. Hands-on execution guided by proven experience. We operate companies; we do not just own them.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl">
              <div className="pl-4 border-l-2 border-inv2-divider">
                <p className={LABEL_CLASS}>Operational</p>
                <p className="text-[15px] text-inv2-fg-muted">20+ years ops leadership, scaling SMEs, P&L responsibility.</p>
              </div>
              <div className="pl-4 border-l-2 border-inv2-divider">
                <p className={LABEL_CLASS}>Capital</p>
                <p className="text-[15px] text-inv2-fg-muted">Value-focused acquisitions, pricing and negotiation, long-term view.</p>
              </div>
              <div className="pl-4 border-l-2 border-inv2-divider">
                <p className={LABEL_CLASS}>Technical</p>
                <p className="text-[15px] text-inv2-fg-muted">AI and automation, process optimisation, change management.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Structure & Returns ─────────────────────────────────────────── */}
      <section className={"bg-inv2-bg-subtle " + SECTION_CLASS} id="structure">
        <div className="border-t border-inv2-divider pt-10 sm:pt-14">
          <h2 className={H2_CLASS}>Structure & returns</h2>
          <p className={SECTION_SUBTITLE_CLASS}>Capital model and governance</p>

          <div className="space-y-10 mb-12">
            <p className="w-full text-inv2-fg-muted leading-relaxed text-[14px] sm:text-[15px]">
              Nivo Group AB is the parent company (no separate management company)—a Swedish AB (aktiebolag) with an evergreen investment horizon and the aim to become a listed entity within 10 years. Capital is deployed into Nordic SMEs and compounded over the long term. Founders and Founding Investors hold both Class A and Class B shares; new investors participate via Class B shares. All material investments are subject to investment committee approval; the committee includes independent members and meets for quarterly reviews. Reporting to shareholders includes quarterly updates, portfolio performance, and value-creation milestones.
            </p>

            <div className="pt-6 border-t border-inv2-divider">
              <p className={LABEL_OLIVE_CLASS + " mb-2"}>Alignment of interest</p>
              <p className="text-[14px] sm:text-[15px] text-inv2-fg-muted leading-relaxed">We use a classic Swedish A/B share structure. A-shares (voting-strong) are held by Founders and Founding Investors and are entitled to 20% of dividends and excess returns; A-shares also have a catch-up on 20% of the B-shares’ return threshold. B-shares are entitled to 80% of dividends and excess returns and include a 1x liquidation preference and a 20% return threshold (adjusted for distributed capital). Shared incentives: focus on better deals, not on higher AUM.</p>
            </div>

            <div className="pt-6 border-t border-inv2-divider">
              <h3 className={H3_CLASS}>Corporate and investment structure</h3>
              <p className="text-sm text-inv2-fg-muted mb-4">Evergreen Swedish AB structure. Deal-by-deal financing.</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                {/* Left: Corporate structure diagram */}
                <div className="bg-white rounded-lg border border-inv2-divider/60 p-6 sm:p-8">
                  <div className="flex flex-col items-center gap-0">
                    {/* Above Parent: investors */}
                    <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-3">
                      <div className="text-center">
                        <div className="px-4 py-2.5 rounded-md border border-inv2-divider/80 bg-inv2-bg-subtle/50 min-w-[140px]">
                          <p className="text-sm font-medium text-inv2-fg">Founders & Founding Investors</p>
                          <p className="text-xs text-inv2-olive font-medium mt-1">A- & B-shares</p>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="px-4 py-2.5 rounded-md border border-inv2-divider/80 bg-inv2-bg-subtle/50 min-w-[140px]">
                          <p className="text-sm font-medium text-inv2-fg">New Investors</p>
                          <p className="text-xs text-inv2-olive font-medium mt-1">B-shares</p>
                        </div>
                      </div>
                    </div>
                    <div className="w-px h-4 bg-inv2-olive/50" aria-hidden />
                    <div className="px-5 py-3 rounded-md border-2 border-inv2-olive/50 bg-inv2-bg-subtle/80">
                      <p className="text-sm font-semibold text-inv2-fg">Nivo Group AB (Parent Company)</p>
                    </div>
                    <div className="w-px h-4 bg-inv2-olive/50" aria-hidden />
                    <div className="px-4 py-2.5 rounded-md border border-inv2-divider/80 bg-white">
                      <p className="text-sm text-inv2-fg-muted">Nivo OpCo (operational holding function)</p>
                    </div>
                    <div className="w-px h-4 bg-inv2-divider/80" aria-hidden />
                    <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
                      {["BidCo 1", "BidCo 2", "BidCo 3"].map((label) => (
                        <div key={label} className="flex flex-col items-center">
                          <div className="px-3 py-2 rounded border border-inv2-divider/80 bg-inv2-bg-subtle/50 text-center min-w-[90px]">
                            <p className="text-xs font-medium text-inv2-fg">{label}</p>
                            <p className="text-[11px] text-inv2-fg-muted mt-0.5">acquisition vehicle</p>
                          </div>
                          <div className="w-px h-3 bg-inv2-divider/60 my-0.5" aria-hidden />
                          <div className="px-2 py-1.5 rounded border border-inv2-divider/60 bg-white text-center min-w-[70px]">
                            <p className="text-[11px] text-inv2-fg-muted">{label.replace("BidCo", "Target")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Right: Financing model text */}
                <div>
                  <p className={LABEL_OLIVE_CLASS + " mb-3"}>Financing model</p>
                  <p className="w-full text-inv2-fg-muted leading-relaxed text-[14px] sm:text-[15px]">
                    All acquisitions are consolidated under Nivo Group AB. New acquisitions are financed on a deal-by-deal basis through newly formed BidCos. Investors participate through share ownership in the Parent Company (A- and B-shares). There are no capital commitments; participation in future share issues is voluntary, with pre-emptive rights. Nivo’s strategy focuses on long-term ownership of stable Nordic SMEs within an evergreen structure. In the event of additional capital needs within a portfolio company, capital may be provided either through retained earnings at the Parent level or through new share issues. With each new acquisition, the portfolio NAV is revalued, allowing early investors to benefit from value uplift prior to new capital being introduced.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-inv2-divider">
              <h3 className={H3_CLASS}>Share classes (classic Swedish A/B)</h3>
              <p className="w-full text-inv2-fg-muted leading-relaxed text-[14px] sm:text-[15px] mb-4">
                <strong className="text-inv2-fg">A-shares</strong> are voting-strong shares held by Founders and Founding Investors, entitled to 20% of dividends and excess returns. A-shares have a catch-up on 20% of the B-shares’ return threshold. <strong className="text-inv2-fg">B-shares</strong> are held by Founding Investors and other investors, entitled to 80% of dividends and excess returns. B-shares include a 1x liquidation preference (priority to recover invested capital) and a 20% return threshold, with adjustments for distributed capital (e.g. dividends). Each divestment or exit triggers a distribution according to these rights.
              </p>
            </div>

            <div className="pt-6 border-t border-inv2-divider">
              <h3 className={H3_CLASS}>Financing and rewards for early capital</h3>
              <p className="w-full text-inv2-fg-muted leading-relaxed text-[14px] sm:text-[15px] mb-4">
                New acquisitions are financed on a <strong className="text-inv2-fg">deal-by-deal</strong> basis. Investors commit only to their initial investment; participation in future new issues is welcomed (with pre-emptive rights) but not obligatory. In the event of additional capital needs in a portfolio company, funding is provided either from Nivo Group (e.g. dividends from other portfolio companies) or through new issues in which investors may voluntarily participate. With each new acquisition, the existing portfolio NAV is re-valued, providing value uplift for early investors before new capital is committed. This structure rewards early capital injection.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
              <div>
                <p className={LABEL_CLASS + " mb-4"}>Key terms</p>
                <div className="space-y-4 text-base sm:text-lg">
                  <div className="flex justify-between items-baseline border-b border-inv2-divider pb-3">
                    <span className="text-inv2-fg-muted">Issuer</span>
                    <span className="font-semibold text-inv2-fg text-lg sm:text-xl">Nivo Group AB</span>
                  </div>
                  <div className="flex justify-between items-baseline border-b border-inv2-divider pb-3">
                    <span className="text-inv2-fg-muted">Target size</span>
                    <span className="font-semibold text-inv2-fg text-lg sm:text-xl">SEK 1,000m</span>
                  </div>
                  <div className="flex justify-between items-baseline border-b border-inv2-divider pb-3">
                    <span className="text-inv2-fg-muted">Minimum investment</span>
                    <span className="font-semibold text-inv2-fg text-lg sm:text-xl">SEK 5m</span>
                  </div>
                  <div className="flex justify-between items-baseline border-b border-inv2-divider pb-3">
                    <span className="text-inv2-fg-muted">Share classes</span>
                    <span className="font-semibold text-inv2-fg text-lg sm:text-xl">A- and B-shares</span>
                  </div>
                  <div className="flex justify-between items-baseline pb-3">
                    <span className="text-inv2-fg-muted">Management fee</span>
                    <span className="font-semibold text-inv2-fg text-lg sm:text-xl">2.0%</span>
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
                  <div key={item.category} className="flex justify-between items-center py-2.5 border-b border-inv2-divider last:border-0">
                    <span className="text-inv2-fg-muted">{item.category}</span>
                    <span className="font-semibold text-inv2-fg tabular-nums text-lg sm:text-xl">{item.amount}</span>
                  </div>
                ))}
                </div>
                <div className="mt-4 h-2 rounded-full overflow-hidden bg-inv2-divider/60 flex">
                  <div className="bg-inv2-olive rounded-l" style={{ width: "75%" }} />
                  <div className="bg-inv2-sage/50" style={{ width: "15%" }} />
                  <div className="bg-inv2-sage/30 rounded-r" style={{ width: "10%" }} />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-inv2-divider">
              <h3 className={H3_CLASS}>Governance — portfolio companies</h3>
              <p className="w-full text-inv2-fg-muted leading-relaxed text-[14px] sm:text-[15px] mb-6">
                We typically take majority control (51–100%) with operational oversight at board level and incentives tied to ROIC and cash flow. Decision rights are clear: the board retains strategy, capital allocation, and M&A; management runs day-to-day operations and hiring within defined thresholds. Reporting is monthly (financials, KPI, cash flow), quarterly (board, strategy, investor updates), and annual (audit, valuations, planning). Shareholders receive transparent updates and annual meetings. Documentation follows sound corporate practice with an independent administrator and auditor. Disciplined governance protects capital and alignment.
              </p>
            </div>

            <p className="w-full text-inv2-fg-muted leading-relaxed text-[14px] sm:text-[15px]">
              Target close is Q2 2026. We are seeking 2–3 anchor investors. The pipeline is strong and the team is committed. Deployment is expected over 18–24 months; hold per company 5–7 years. Target gross IRR 19–23% through disciplined reinvestment and operational compounding; base-case underwriting assumes margin expansion and debt paydown with flat-to-modest exit multiples.
            </p>
          </div>

          <div className="pt-8 border-t border-inv2-divider">
            <h3 className={H3_CLASS}>Exit strategy and value drivers</h3>
            <p className="w-full text-inv2-fg-muted leading-relaxed text-[14px] sm:text-[15px] mb-6">
              Primary exit route is strategic sale to trade or corporate buyers. Secondary buyout to larger PE or growth equity is a viable alternative. Recapitalisation (dividend recap while retaining control) may be used where appropriate. Value creation follows a clear timeline: in years 1–2 we focus on margin expansion of 200–300 bps; years 3–4 on cash conversion and debt reduction; years 5–6 on sustaining ROIC at 15%+ and strategic positioning; year 7+ on exit or recap depending on market and portfolio readiness.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-6">
              {[
                { label: "Gross IRR", value: "19–23%" },
                { label: "Net IRR", value: "15–18%" },
                { label: "Target MOIC", value: "2.2–2.8x" },
                { label: "Base case hold", value: "5–10 years" },
              ].map((item) => (
                <div key={item.label} className="text-center py-4 px-4 bg-white rounded-lg shadow-[var(--inv2-shadow-soft)] border border-inv2-divider/60">
                  <p className="text-xl font-semibold text-inv2-olive">{item.value}</p>
                  <p className="text-sm text-inv2-fg-muted mt-1">{item.label}</p>
                </div>
              ))}
            </div>
            <p className="text-[15px] text-inv2-fg-muted max-w-2xl">
              Return drivers: margin expansion ~45%, revenue growth ~35%, debt paydown and cash conversion ~20%. Returns from operations, cash conversion, and disciplined structure.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Risk factors & mitigation ───────────────────────────────────── */}
      <section className={SECTION_CLASS} id="risks">
        <div className="border-t border-inv2-divider pt-10 sm:pt-14">
          <h2 className={H2_CLASS}>Risk factors and mitigation</h2>
          <p className={SECTION_SUBTITLE_CLASS}>Transparent assessment, disciplined mitigation</p>
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="pl-4 border-l-2 border-inv2-divider">
                <p className={LABEL_CLASS}>Execution</p>
                <p className="text-[15px] text-inv2-fg-muted mb-2">Initiatives may take longer or cost more than planned.</p>
                <p className={LABEL_OLIVE_CLASS}>Mitigation</p>
                <p className="text-[15px] text-inv2-fg-muted">Proven playbook, stress scenarios, experienced advisors.</p>
              </div>
              <div className="pl-4 border-l-2 border-inv2-divider">
                <p className={LABEL_CLASS}>Market</p>
                <p className="text-[15px] text-inv2-fg-muted mb-2">Downturn or sector-specific challenges.</p>
                <p className={LABEL_OLIVE_CLASS}>Mitigation</p>
                <p className="text-[15px] text-inv2-fg-muted">Defensive sectors, 3–4 company diversification, leverage below 2x.</p>
              </div>
              <div className="pl-4 border-l-2 border-inv2-divider">
                <p className={LABEL_CLASS}>Key person</p>
                <p className="text-[15px] text-inv2-fg-muted mb-2">Founder dependence and transition risk.</p>
                <p className={LABEL_OLIVE_CLASS}>Mitigation</p>
                <p className="text-[15px] text-inv2-fg-muted">Retain management, 12–24 month transition, process documentation.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl">
              <div className="bg-inv2-bg-subtle rounded-lg p-4 border border-inv2-divider/60">
                <p className={LABEL_CLASS}>Concentration</p>
                <p className="text-[15px] text-inv2-fg-muted">3–4 companies implies meaningful impact per holding. Mitigated by screening, sector diversity, and deep operational involvement.</p>
              </div>
              <div className="bg-inv2-bg-subtle rounded-lg p-4 border border-inv2-divider/60">
                <p className={LABEL_CLASS}>Liquidity</p>
                <p className="text-[15px] text-inv2-fg-muted">SME exits can be illiquid. We build for strategic buyers, maintain flexibility on timing, and focus on ROIC to justify valuation.</p>
              </div>
            </div>
            <p className={PUNCH_CLASS}>
              Risks are managed through discipline, transparency, and operational excellence.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Closing ─────────────────────────────────────────────────────── */}
      <section className={SECTION_CLASS} id="closing">
        <div className="border-t border-inv2-divider pt-10 sm:pt-14">
          <h2 className={H2_CLASS}>Contact</h2>
          <p className={PROSE_CLASS + " mb-6"}>
            We welcome discussions with investors who value operational discipline, long-term compounding, and sustainable value creation over financial engineering.
          </p>
          <p className={PUNCH_CLASS}>
            Nivo does not buy technology risk; Nivo buys operational improvement potential.
          </p>
          <p className="text-inv2-fg font-medium mb-2">Contact the investment team</p>
          <a href="mailto:invest@nivogroup.se" className="text-inv2-olive font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-inv2-olive/30 rounded">
            invest@nivogroup.se
          </a>
          <p className="text-sm text-inv2-fg-muted mt-12 pt-8 border-t border-inv2-divider">
            © 2026 Nivo Group. All rights reserved. This document is confidential and intended solely for prospective investors.
          </p>
        </div>
      </section>
    </div>
  );
}

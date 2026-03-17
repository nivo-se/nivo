/**
 * Investor page (design profile / profile-*). Route: /investor.
 * Gate + short form (summary) or long form (Investor2LongFormNivo). Shared unlock key.
 * - Short form: Aurora hero + sections + CTA. "Open long-form version" sets showLongForm=true (no navigation).
 * - Long form: Investor2LongFormNivo (profile-*), toggled via showLongForm. "Summary" sets showLongForm=false.
 * No <Link>, navigate(), or href="/investor" in this flow.
 */

"use client";

import React, { useState, useEffect } from "react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { Input } from "@/components/ui/input";
import { Lock, Building2, Target, TrendingUp, BarChart3, Clock, Globe, User, Shield, Check, Workflow } from "lucide-react";
import { NIVO_AURORA_COLORS } from "@/lib/nivoPalette";
import { tokens, SECTION_CLASS } from "@/lib/designProfileTokens";
// Direct import from Nivo long-form file only (do not use Investor2LongForm / inv2)
import { Investor2LongFormNivo } from "./investor-deck/Investor2LongFormNivo";

const INVESTOR_STORAGE_KEY = "nivo_investor_unlocked";
const INVESTOR_PASSWORD = "nivo2020";

// ─── Data (condensed for short form) ─────────────────────────────────────
const PIPELINE_ITEMS = [
  { stage: "Active due diligence", count: "2" },
  { stage: "Advanced discussion", count: "5" },
  { stage: "Initial contact", count: "12" },
  { stage: "Identified", count: "81" },
];

const TEAM = [
  { name: "Jesper Kreuger", role: "Founding Partner", bio: "15+ years in venture capital, capital raising and company building. Led investments and scaling across early and growth-stage Nordic companies.", linkedin: "https://www.linkedin.com/in/jesper-kreuger-91b14/" },
  { name: "Henrik Cavalli", role: "Founding Partner", bio: "15+ years of commercial leadership across startups and global companies. Scaled businesses from zero to €60m+ revenue and led growth across multiple markets.", linkedin: "https://www.linkedin.com/in/henrikc1/" },
  { name: "Sebastian Robson", role: "Founding Partner", bio: "15+ years in CFO and corporate finance roles with experience in acquisitions, capital markets and IPO preparation across technology and industrial sectors.", linkedin: "https://www.linkedin.com/in/sebastian-robson-7418b82b2/" },
];

// ─── Section wrapper (design profile) — background full width, content constrained ───
function Section({ title, bg = "bg", id, children }: { title: string; bg?: "bg" | "bgAlt"; id?: string; children: React.ReactNode }) {
  return (
    <section className={"w-full" + (id ? " scroll-mt-[100px]" : "")} id={id} style={{ backgroundColor: bg === "bgAlt" ? tokens.bgAlt : tokens.bg }}>
      <div className={SECTION_CLASS}>
        <h2 className="text-2xl font-semibold mb-4" style={{ color: tokens.text }}>{title}</h2>
        {children}
      </div>
    </section>
  );
}

// ─── Gate ─────────────────────────────────────────────────────────────────
function InvestorGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password === INVESTOR_PASSWORD) {
      sessionStorage.setItem(INVESTOR_STORAGE_KEY, "1");
      onUnlock();
    } else {
      setError("Fel lösenord. Försök igen.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6" style={{ backgroundColor: tokens.bgAlt }}>
      <div
        className="w-full max-w-md rounded-xl p-6 sm:p-8 border"
        style={{ backgroundColor: tokens.bg, borderColor: tokens.border, boxShadow: "var(--profile-shadow-soft, 0 2px 12px rgba(0,0,0,0.06))" }}
      >
        <div className="text-center mb-6">
          <img src="/nivo-logo-green.svg" alt="Nivo" className="h-14 sm:h-16 w-auto mx-auto mb-4" />
          <span className="inline-block px-3 py-1.5 rounded-full text-sm font-medium uppercase tracking-wider" style={{ backgroundColor: tokens.bg, color: tokens.accent }}>Investor</span>
          <h1 className="text-xl sm:text-2xl font-bold mt-4 mb-2" style={{ color: tokens.text }}>Investor Access</h1>
          <p className="text-base" style={{ color: tokens.text }}>Ange lösenord för att komma åt materialet.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="investor-pw" className="block text-sm font-medium mb-2" style={{ color: tokens.text }}>Lösenord</label>
            <Input
              id="investor-pw"
              type="password"
              placeholder="Lösenord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg min-h-[48px] px-4"
              style={{ borderColor: tokens.border, color: tokens.text, backgroundColor: tokens.bg }}
              autoComplete="off"
            />
          </div>
          {error && (
            <div className="rounded-lg p-3 bg-destructive/10 border border-destructive/30">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          <button
            type="submit"
            className="w-full min-h-[48px] rounded-lg text-white text-base font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: tokens.primaryBtn }}
          >
            <Lock className="h-4 w-4" />
            Öppna
          </button>
        </form>
      </div>
    </div>
  );
}

// Header height for fixed header
const INVESTOR_HEADER_HEIGHT = 68;

// ─── Shared header (short vs long form) — fixed ───
const ANCHOR_LINKS = [
  { href: "#why-invest", label: "Why Invest" },
  { href: "#why-now", label: "Why Now" },
  { href: "#approach", label: "Approach" },
  { href: "#value-creation", label: "Value Creation" },
  { href: "#team", label: "Team" },
  { href: "#returns", label: "Structure" },
];

function InvestorHeader({ onSignOut }: { onSignOut: () => void }) {
  return (
    <header
      className="border-b fixed top-0 left-0 right-0 z-20 bg-white dark:bg-zinc-50"
      style={{ borderColor: "var(--profile-border, #e4e4e7)", height: INVESTOR_HEADER_HEIGHT }}
    >
      <div className="max-w-5xl mx-auto px-5 sm:px-6 h-full flex items-center justify-between gap-4">
        <div className="flex items-center justify-start flex-shrink-0 min-w-0">
          <img src="/Nivo%20-%20Wordmark%20-%20black.svg" alt="Nivo" className="h-5 sm:h-6 w-auto object-contain" />
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto flex-wrap justify-center min-w-0 flex-1">
          {ANCHOR_LINKS.map(({ href, label }) => (
            <a key={href} href={href} className="px-2 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-950 whitespace-nowrap">
              {label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-zinc-700 dark:text-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-200 text-sm font-medium transition-colors shrink-0"
        >
          <Lock className="h-4 w-4" />
          Lås sidan
        </button>
      </div>
    </header>
  );
}

// ─── Short-form content (design profile UX) ────────────────────────────────
function InvestorShortForm({ onSignOut, onOpenLongForm }: { onSignOut: () => void; onOpenLongForm: () => void }) {
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: tokens.bg }} data-design-profile="nivo">
      <InvestorHeader onSignOut={onSignOut} />
      <div style={{ paddingTop: INVESTOR_HEADER_HEIGHT }}>
        {/* Hero — Aurora background; one-liner, short version, what we don't do */}
        <section className="relative" id="overview">
        <AuroraBackground auroraColors={[...NIVO_AURORA_COLORS]} showRadialGradient className="!min-h-[75vh]">
          <div className="relative z-10 flex flex-col justify-center px-5 sm:px-6 pt-10 sm:pt-12 pb-24 min-h-[75vh] overflow-visible">
            <div className="max-w-3xl mx-auto text-center overflow-visible" style={{ color: tokens.text }}>
              <div className="w-full py-5 px-8 sm:py-6 sm:px-10 mb-4 overflow-visible min-h-[100px] sm:min-h-[120px] flex items-center justify-center">
                <div className="h-28 w-28 sm:h-36 sm:w-36 flex items-center justify-center">
                  <img src="/nivo-n-logo-black.svg" alt="Nivo" className="max-h-full max-w-full w-auto h-auto object-contain" style={{ objectPosition: "49% center" }} />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-semibold max-w-2xl mx-auto leading-snug" style={{ color: tokens.text }}>
                We acquire profitable Nordic SMEs and compound value through pricing, cost control and digital workflows — not financial engineering.
              </p>
              <div id="why-invest" className="mt-8 max-w-2xl mx-auto text-left rounded-lg p-5 border scroll-mt-[100px]" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
                <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: tokens.accent }}>Short version</p>
                <p className="text-[15px] leading-relaxed mb-4" style={{ color: tokens.text }}>
                  Nivo is an investment company focused on long-term ownership of Nordic SMEs. We target SEK 50–200m revenue companies with strong products and loyal customers but operational upside. We improve margins through pricing discipline, cost control, reporting and workflows — not leverage or multiple expansion.
                </p>
                <ul className="space-y-1.5 text-sm mb-4" style={{ color: tokens.text }}>
                  <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tokens.accent }} aria-hidden />~15,000 Nordic SMEs in target segment; targeting 20–25% ROIC</li>
                  <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tokens.accent }} aria-hidden />Target 20–25% IRR, 4–5x MOIC; 5–10 year hold</li>
                  <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tokens.accent }} aria-hidden />Team: extensive capital markets and venture experience; scaled a direct-to-consumer business from zero</li>
                </ul>
                <p className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: tokens.accent }}>What we don&apos;t do</p>
                <p className="text-[14px] leading-relaxed" style={{ color: tokens.text }}>
                  No turnarounds. No technology risk. No aggressive leverage. No reliance on multiple expansion.
                </p>
              </div>
              <p className="mt-8 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: tokens.text }}>
                These companies often have <span className="font-semibold" style={{ color: tokens.accent }}>strong products</span>, <span className="font-semibold" style={{ color: tokens.accent }}>loyal customers</span> and <span className="font-semibold" style={{ color: tokens.accent }}>proven business models</span> — but <span className="font-semibold" style={{ color: tokens.accent }}>operational potential</span> remains untapped.
              </p>
              <p className="mt-4 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed" style={{ color: tokens.text }}>
                Many operate with manual workflows; fragmented systems; limited visibility. The businesses are sound; execution can be improved.
              </p>
              <p className="mt-4 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed" style={{ color: tokens.text }}>
                We use a proprietary <span className="font-semibold" style={{ color: tokens.accent }}>sourcing engine</span> that analyses the Swedish SME universe and delivers pre-ranked targets with financial and operational signals — allowing us to approach companies with structured intelligence most PE firms lack.
              </p>
              <blockquote className="mt-10 text-base sm:text-lg font-bold max-w-xl mx-auto" style={{ color: tokens.text }}>
                Focus: operational improvement over technology risk.
              </blockquote>
              <p className="mt-10 text-sm font-semibold uppercase tracking-wider max-w-2xl mx-auto text-left" style={{ color: tokens.accent }}>Key terms</p>
              <div id="structure" className="mt-3 max-w-2xl mx-auto pt-6 pb-6 border-t border-b text-left scroll-mt-[100px]" style={{ borderColor: tokens.border }}>
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
                    <span className="flex items-center gap-1.5" style={{ color: tokens.text }}><TrendingUp className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />Target IRR</span>
                    <span className="font-semibold tabular-nums" style={{ color: tokens.text }}>20–25%</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5" style={{ color: tokens.text }}><BarChart3 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />Target MOIC</span>
                    <span className="font-semibold tabular-nums" style={{ color: tokens.text }}>4–5x</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5" style={{ color: tokens.text }}><Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />Investment horizon</span>
                    <span className="font-semibold tabular-nums" style={{ color: tokens.text }}>5–10 years</span>
                  </div>
                </div>
              </div>
              <p className="mt-6 text-sm font-semibold uppercase tracking-wider max-w-2xl mx-auto text-left" style={{ color: tokens.accent }}>Team capabilities</p>
              <ul className="mt-3 max-w-2xl mx-auto space-y-2 text-left">
                {[
                  "Corporate finance and capital markets — valuation, structuring and execution expertise",
                  "Venture and growth investing — sourcing, due diligence and exit experience",
                  "Operational scaling and digital transformation — hands-on business building",
                  "Institutional investment and operational leadership — full lifecycle coverage",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[15px] sm:text-base" style={{ color: tokens.text }}>
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tokens.accent }} aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div id="why-now" className="mt-8 max-w-2xl mx-auto text-left scroll-mt-[100px]">
                <h2 className="text-xl font-semibold mb-3" style={{ color: tokens.text }}>Why Now</h2>
                <p className="text-[15px] sm:text-base leading-relaxed" style={{ color: tokens.text }}>
                  Practical AI and modern SaaS now allow smaller companies to upgrade systems, pricing and operations cost-effectively. We bring that capability to portfolio businesses — operational improvement, not technology speculation.
                </p>
              </div>
              <p className="mt-6 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto font-semibold" style={{ color: tokens.text }}>
                Value creation: pricing, cost control, reporting and digital workflows.
              </p>
            </div>
          </div>
        </AuroraBackground>
      </section>

      {/* Opportunity — full section with cards (same as long form) */}
      <Section title="The Opportunity" bg="bgAlt" id="approach">
        <p className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: tokens.accent }}>Why Nordic SMEs, why now</p>
        <p className="leading-relaxed mb-8" style={{ color: tokens.text }}>
          Many Nordic SMEs were built before modern digital tools. They remain profitable but under-digitised. Practical AI and SaaS now allow smaller companies to upgrade systems, pricing and workflows cost-effectively—creating a window where operational improvements can unlock disproportionate value.
        </p>

        <div className="rounded-xl p-5 sm:p-6 mb-8 sm:mb-10 border shadow-sm" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
          <p className="text-lg sm:text-xl font-semibold mb-4 leading-snug" style={{ color: tokens.text }}>
            We acquire profitable, under-digitised Nordic SMEs and compound value through operational improvement and digital upgrades — not technology risk. We typically target SEK 50–200m revenue; our edge is disciplined execution and systematic sourcing.
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
              Data-driven sourcing; digital workflows in portfolio
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border, color: tokens.text }}>
              <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />
              Operational upside — not technology risk
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          <div className="rounded-xl p-5 sm:p-6 border flex flex-col shadow-sm" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center" style={{ backgroundColor: tokens.accent }}>
                <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-white" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold mb-0" style={{ color: tokens.text }}>The universe</h3>
            </div>
            <p className="text-[15px] sm:text-[16px] leading-relaxed font-semibold mb-3" style={{ color: tokens.text }}>
              Nordic SMEs in our target band are profitable but structurally under-digitised, creating a large and underserved opportunity set.
            </p>
            <ul className="space-y-1.5 text-sm sm:text-[15px] leading-relaxed flex-1 min-h-0" style={{ color: tokens.text }}>
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
              <h3 className="text-lg font-semibold mb-0" style={{ color: tokens.text }}>Operational gap</h3>
            </div>
            <p className="text-[15px] sm:text-[16px] leading-relaxed font-semibold mb-3" style={{ color: tokens.text }}>
              Across the segment we observe the same operational inefficiencies. These businesses rarely need disruption — they need better execution and modern tools.
            </p>
            <ul className="space-y-1.5 text-sm sm:text-[15px] leading-relaxed flex-1 min-h-0" style={{ color: tokens.text }}>
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
              <h3 className="text-lg font-semibold mb-0" style={{ color: tokens.text }}>Why Nordic</h3>
            </div>
            <p className="text-[15px] sm:text-[16px] leading-relaxed font-semibold mb-3" style={{ color: tokens.text }}>
              The Nordic region offers a favourable environment for long-term operational value creation.
            </p>
            <ul className="space-y-1.5 text-sm sm:text-[15px] leading-relaxed flex-1 min-h-0" style={{ color: tokens.text }}>
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
              <h3 className="text-lg font-semibold mb-0" style={{ color: tokens.text }}>Our take</h3>
            </div>
            <p className="text-[15px] sm:text-[16px] leading-relaxed font-semibold mb-3" style={{ color: tokens.text }}>
              Nivo targets this opportunity through a disciplined, repeatable approach.
            </p>
            <ul className="space-y-1.5 text-sm sm:text-[15px] leading-relaxed flex-1 min-h-0" style={{ color: tokens.text }}>
              <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Sourcing engine screens universe, ranks targets, delivers pre-engagement memos</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Pricing, cost control, reporting and digital workflows in portfolio</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />Operational execution over financial engineering</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* Pipeline */}
      <Section title="Pipeline" id="returns">
        <p className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: tokens.accent }}>Target pipeline: 100 companies ranked by operational improvement potential</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {PIPELINE_ITEMS.map((item) => (
            <div key={item.stage} className="rounded-lg p-5 text-center border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
              <p className="text-2xl font-semibold tabular-nums" style={{ color: tokens.accent }}>{item.count}</p>
              <p className="text-sm mt-1" style={{ color: tokens.text }}>{item.stage}</p>
            </div>
          ))}
        </div>
        <p className="text-sm mb-4" style={{ color: tokens.text }}>Active targets (illustrative)</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { name: "Company A", sector: "Industrial", revenue: "SEK 120m", status: "Due diligence" },
            { name: "Company B", sector: "Business services", revenue: "SEK 75m", status: "Advanced" },
            { name: "Company C", sector: "Distribution", revenue: "SEK 165m", status: "Due diligence" },
          ].map((c) => (
            <div key={c.name} className="rounded-lg p-5 border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
              <p className="font-semibold" style={{ color: tokens.text }}>{c.name}</p>
              <p className="text-sm mt-1" style={{ color: tokens.text }}>{c.sector} · {c.revenue}</p>
              <p className="text-sm font-medium mt-3" style={{ color: tokens.accent }}>Status: {c.status}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Value creation + Case — brief */}
      <Section title="Value Creation" id="value-creation">
        <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: tokens.accent }}>Value Creation Focus</p>
        <p className="leading-relaxed mb-4" style={{ color: tokens.text }}>
          Pricing discipline, margin expansion, cost control, reporting and digital workflows. We reinvest cash flow; modest leverage where it helps.
        </p>
        <div id="case" className="scroll-mt-[100px]">
          <p className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: tokens.accent }}>Illustrative Case</p>
          <p className="text-sm leading-relaxed" style={{ color: tokens.text }}>
            Nordic industrial: entry SEK 100m equity, SEK 30m debt. Pricing +150 bps, operations +100 bps, cost +50 bps over 24 months. Operational improvements compound into equity value.
          </p>
        </div>
      </Section>

      {/* Team */}
      <Section title="Team" bg="bgAlt" id="team">
        <p className="text-sm font-semibold uppercase tracking-wider mb-6" style={{ color: tokens.accent }}>Operational experience meets disciplined capital</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TEAM.map((member) => (
            <div key={member.name} className="flex flex-col items-center text-center">
              <div className="w-full max-w-[200px] aspect-[4/3] rounded-lg flex items-center justify-center overflow-hidden border-2" style={{ backgroundColor: tokens.bgAlt, borderColor: tokens.border }}>
                <User className="w-14 h-14" style={{ color: tokens.text }} />
              </div>
              <p className="font-semibold mt-4" style={{ color: tokens.text }}>{member.name}</p>
              <p className="text-sm font-medium mt-1" style={{ color: tokens.accent }}>{member.role}</p>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: tokens.text }}>{member.bio}</p>
              {member.linkedin && (
                <a href={member.linkedin} target="_blank" rel="noopener noreferrer" className="text-profile-accent font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-profile-accent/30 rounded mt-2 inline-block">Read more →</a>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Risks — brief */}
      <Section title="Risks" id="risks">
        <p className="text-sm leading-relaxed" style={{ color: tokens.text }}>
          Execution risk, market risk and key person risk. Mitigated by proven playbook, sector diversification, conservative leverage and retention of management.
        </p>
      </Section>

      {/* CTA — reveal full long-form on same page */}
      <section id="contact" className="w-full scroll-mt-[100px]" style={{ backgroundColor: tokens.bg, borderTop: `1px solid ${tokens.border}` }}>
        <div className={SECTION_CLASS}>
        <p className="text-center mb-4" style={{ color: tokens.text }}>Full long-form memo with structure, sourcing, value creation and case study.</p>
        <div className="flex justify-center gap-4">
          <button
            type="button"
            onClick={onOpenLongForm}
            className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-md text-white text-base font-semibold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: tokens.primaryBtn }}
          >
            Open long-form version
          </button>
        </div>
        </div>
      </section>
      </div>
    </div>
  );
}

export default function Investor() {
  const [unlocked, setUnlocked] = useState(false);
  const [showLongForm, setShowLongForm] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(INVESTOR_STORAGE_KEY) === "1") setUnlocked(true);
  }, []);

  const handleSignOut = () => {
    sessionStorage.removeItem(INVESTOR_STORAGE_KEY);
    setUnlocked(false);
  };

  if (!unlocked) {
    return <InvestorGate onUnlock={() => setUnlocked(true)} />;
  }

  if (showLongForm) {
    return (
      <div className="min-h-screen overflow-x-hidden" data-design-profile="nivo" data-investor-view="long-form-nivo">
        <InvestorHeader onSignOut={handleSignOut} />
        <div style={{ paddingTop: INVESTOR_HEADER_HEIGHT }}>
          <Investor2LongFormNivo key="nivo-long-form" />
        </div>
      </div>
    );
  }

  return <InvestorShortForm onSignOut={handleSignOut} onOpenLongForm={() => setShowLongForm(true)} />;
}

/**
 * Investor page (design profile / profile-*). Route: /investor.
 * Gate + short form (summary) or long form (Investor2LongFormNivo). Shared unlock key.
 * - Short form: Aurora hero + sections + CTA. "Open long-form version" sets showLongForm=true (no navigation).
 * - Long form: Investor2LongFormNivo (profile-*), toggled via showLongForm. "Summary" sets showLongForm=false.
 * No <Link>, navigate(), or href="/investor" in this flow.
 */

"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Lock, Building2, Target, TrendingUp, BarChart3, Clock, Globe, User, Shield, Check, Workflow, Search, DollarSign, RefreshCw } from "lucide-react";
import { tokens, SECTION_CLASS } from "@/lib/designProfileTokens";
// Direct import from Nivo long-form file only (do not use Investor2LongForm / inv2)
import { Investor2LongFormNivo } from "./investor-deck/Investor2LongFormNivo";
import { investorTranslations, type InvestorLang } from "./investor-deck/investorTranslations";

const INVESTOR_STORAGE_KEY = "nivo_investor_unlocked";
const INVESTOR_PASSWORD = "nivo2020";

// ─── Data (condensed for short form) ─────────────────────────────────────
const PIPELINE_ITEMS = [
  { stageKey: "pipelineActiveDD" as const, count: "2" },
  { stageKey: "pipelineAdvanced" as const, count: "5" },
  { stageKey: "pipelineContact" as const, count: "12" },
  { stageKey: "pipelineIdentified" as const, count: "81" },
];

const TEAM = [
  { name: "Jesper Kreuger", bioKey: "teamJesperBio" as const, linkedin: "https://www.linkedin.com/in/jesper-kreuger-91b14/" },
  { name: "Henrik Cavalli", bioKey: "teamHenrikBio" as const, linkedin: "https://www.linkedin.com/in/henrikc1/" },
  { name: "Sebastian Robson", bioKey: "teamSebastianBio" as const, linkedin: "https://www.linkedin.com/in/sebastian-robson-7418b82b2/" },
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
  { href: "#why-invest", labelKey: "navWhyInvest" as const },
  { href: "#why-now", labelKey: "navWhyNow" as const },
  { href: "#investment-process", labelKey: "navInvestmentProcess" as const },
  { href: "#approach", labelKey: "navApproach" as const },
  { href: "#value-creation", labelKey: "navValueCreation" as const },
  { href: "#pipeline", labelKey: "navPipeline" as const },
  { href: "#team", labelKey: "navTeam" as const },
  { href: "#structure", labelKey: "navStructure" as const },
];

function InvestorHeader({
  onSignOut,
  lang,
  onLangChange,
}: {
  onSignOut: () => void;
  lang: InvestorLang;
  onLangChange: (l: InvestorLang) => void;
}) {
  const t = investorTranslations[lang];
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
          {ANCHOR_LINKS.map(({ href, labelKey }) => (
            <a key={href} href={href} className="px-2 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-950 whitespace-nowrap">
              {t[labelKey]}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onLangChange("en")}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${lang === "en" ? "bg-zinc-200 dark:bg-zinc-300 text-zinc-900" : "text-zinc-600 dark:text-zinc-800 hover:text-zinc-900"}`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => onLangChange("sv")}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${lang === "sv" ? "bg-zinc-200 dark:bg-zinc-300 text-zinc-900" : "text-zinc-600 dark:text-zinc-800 hover:text-zinc-900"}`}
          >
            SV
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-zinc-700 dark:text-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-200 text-sm font-medium transition-colors"
          >
            <Lock className="h-4 w-4" />
            {t.lockPage}
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── Short-form content (design profile UX) ────────────────────────────────
function InvestorShortForm({
  onSignOut,
  onOpenLongForm,
  lang,
  onLangChange,
}: {
  onSignOut: () => void;
  onOpenLongForm: () => void;
  lang: InvestorLang;
  onLangChange: (l: InvestorLang) => void;
}) {
  const t = investorTranslations[lang];
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: tokens.bg }} data-design-profile="nivo">
      <InvestorHeader onSignOut={onSignOut} lang={lang} onLangChange={onLangChange} />
      <div style={{ paddingTop: INVESTOR_HEADER_HEIGHT }}>
        {/* Hero — video background, white text (like Sellers) */}
        <section className="relative flex min-h-[75vh] w-full overflow-hidden" id="overview">
          <div className="pointer-events-none absolute inset-0">
            <video
              className="h-full w-full object-cover object-[50%_30%] sm:object-center"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-label="Background video for hero section"
            >
              <source src="/uploads/nivo-hero-video.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent" />
          </div>
          <div className="relative z-10 flex flex-col justify-center px-5 sm:px-6 pt-10 sm:pt-12 pb-24 min-h-[75vh] overflow-visible w-full">
            <div className="max-w-3xl mx-auto text-center overflow-visible text-white">
              <div className="w-full py-5 px-8 sm:py-6 sm:px-10 mb-4 overflow-visible min-h-[100px] sm:min-h-[120px] flex items-center justify-center">
                <img
                  src="/nivo-logo-white.svg"
                  alt="Nivo"
                  className="h-20 sm:h-24 w-auto object-contain"
                />
              </div>
              <p className="text-xl sm:text-2xl font-semibold max-w-2xl mx-auto leading-snug text-white">
                {t.oneLiner}
              </p>
              <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed text-white/95 mt-4">
                {t.heroTagline}
              </p>
              <div
                id="why-invest"
                className="mt-6 w-full max-w-[720px] mx-auto text-left rounded-xl border scroll-mt-[100px] backdrop-blur-[12px] p-6 sm:p-8 md:px-10 md:py-9"
                style={{ backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.12)" }}
              >
                <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.14em] mb-8 text-white/55">{t.shortVersion}</p>
                <div className="space-y-10">
                  <div className="space-y-3">
                    <p className="text-lg sm:text-xl leading-[1.65] text-white/88">{t.execSummaryWhatPara1}</p>
                    <p className="text-base sm:text-lg leading-[1.65] text-white/72">{t.execSummaryWhatParaPartners}</p>
                    <p className="text-base sm:text-lg leading-[1.65] text-white/72">{t.execSummaryWhatPara2}</p>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-white/68">{t.execSummaryValueLabel}</p>
                    <p className="text-base sm:text-lg leading-[1.65] text-white/72">{t.execSummaryValueFlow}</p>
                    <p className="text-base sm:text-lg leading-[1.65] text-white/72">{t.execSummaryValueEdge}</p>
                    <p className="text-base sm:text-lg leading-[1.65] text-white/55 italic font-normal">{t.philosophyTagline}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-white/68">{t.execSummaryReturnsLabel}</p>
                    <ul className="space-y-1.5 text-base sm:text-lg pl-3 text-white/78 leading-[1.65]">
                      <li className="flex items-start gap-1.5"><span className="mt-[0.65em] w-1.5 h-1.5 rounded-full flex-shrink-0 bg-white/45" aria-hidden />{t.shortVersionBullet1}</li>
                      <li className="flex items-start gap-1.5"><span className="mt-[0.65em] w-1.5 h-1.5 rounded-full flex-shrink-0 bg-white/45" aria-hidden />{t.shortVersionBullet2}</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-white/68">{t.execSummaryTeamLabel}</p>
                    <p className="text-base sm:text-lg leading-[1.65] text-white/72">{t.execSummaryTeamPara1}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Overview — Part 2 (restructured: What, Model, Why, Edge, Returns, Team) */}
        <Section title={t.overviewSection} id="executive-summary">
          <p className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: tokens.accent }}>{t.execSummaryWhatLabel}</p>
          <p className="text-lg sm:text-xl leading-relaxed mb-4" style={{ color: tokens.text }}>
            {t.companiesIntro}
          </p>
          <p className="text-lg sm:text-xl leading-relaxed mb-4 font-semibold" style={{ color: tokens.text }}>
            {t.companiesIntroFollowUp}
          </p>
          <p className="text-base leading-relaxed mb-6" style={{ color: tokens.text }}>
            {t.overviewWhatWeDoClosing}
          </p>
          <p className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: tokens.accent }}>{t.execSummaryModelLabel}</p>
          <p className="text-base leading-relaxed mb-3" style={{ color: tokens.text }}>
            {t.execSummaryModelSentence}
          </p>
          <p className="text-base leading-relaxed mb-3" style={{ color: tokens.text }}>
            {t.execSummaryModelFounders}
          </p>
          <p className="text-base leading-relaxed mb-6 font-medium" style={{ color: tokens.text }}>
            {t.execSummaryModelClosing}
          </p>
          <p className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: tokens.accent }}>{t.execSummaryWhyLabel}</p>
          <p className="text-base sm:text-lg leading-relaxed mb-4" style={{ color: tokens.text }}>
            {t.manyOperate}
          </p>
          <div id="why-now" className="mb-6 scroll-mt-[100px]">
            <h2 className="text-xl font-semibold mb-3" style={{ color: tokens.text }}>{t.whyNow}</h2>
            <div className="space-y-4 text-base sm:text-lg leading-relaxed" style={{ color: tokens.text }}>
              {t.whyNowText.split("\n\n").map((para, i, arr) => (
                <p key={i} className={i === arr.length - 1 ? "font-semibold" : undefined}>{para}</p>
              ))}
            </div>
          </div>
          <p className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: tokens.accent }}>{t.execSummaryEdgeLabel}</p>
          <div className="space-y-3 text-base sm:text-lg leading-relaxed mb-6" style={{ color: tokens.text }}>
            <p>{t.sourcingEdgeOverview1}</p>
            <p>{t.sourcingEdgeOverview2}</p>
            <p>{t.sourcingEdgeOverview3}</p>
            <p className="font-medium">{t.sourcingEdgeOverviewClosing}</p>
          </div>
          <p className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: tokens.accent }}>{t.keyTerms}</p>
          <div id="structure" className="pt-6 pb-6 border-t border-b mb-6 scroll-mt-[100px]" style={{ borderColor: tokens.border }}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-base sm:text-lg">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5" style={{ color: tokens.text }}><Building2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />{t.investmentCompany}</span>
                <Check className="w-4 h-4 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5" style={{ color: tokens.text }}><Shield className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />{t.managementFee}</span>
                <span className="font-semibold tabular-nums" style={{ color: tokens.text }}>0%</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5" style={{ color: tokens.text }}><Target className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />{t.targetAcquisitionCapital}</span>
                <span className="font-semibold tabular-nums" style={{ color: tokens.text }}>SEK 1,000m</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5" style={{ color: tokens.text }}><TrendingUp className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />{t.targetIRR}</span>
                <span className="font-semibold tabular-nums" style={{ color: tokens.text }}>20–25%</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5" style={{ color: tokens.text }}><BarChart3 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />{t.targetMOIC}</span>
                <span className="font-semibold tabular-nums" style={{ color: tokens.text }}>4–5x</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5" style={{ color: tokens.text }}><Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />{t.investmentHorizon}</span>
                <span className="font-semibold tabular-nums" style={{ color: tokens.text }}>Evergreen</span>
              </div>
              <p className="col-span-2 text-sm sm:text-base leading-relaxed pt-1" style={{ color: tokens.text }}>{t.investmentHorizonNote}</p>
            </div>
          </div>
          <p className="text-base sm:text-lg leading-relaxed mt-4" style={{ color: tokens.text }}>{t.structureEvergreenIntro}</p>
          <p className="text-base sm:text-lg leading-relaxed mt-2" style={{ color: tokens.text }}>{t.structureIpoClarification}</p>
          <p className="text-base sm:text-lg leading-relaxed mt-2" style={{ color: tokens.text }}>{t.structureCapitalNote}</p>
          <br />
          <p className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: tokens.accent }}>{t.teamCapabilities}</p>
          <ul className="space-y-2 pl-3">
            {[t.capability1, t.capability2, t.capability3, t.capability4, t.capability5].map((item) => (
              <li key={item} className="flex items-start gap-1.5 text-base sm:text-lg" style={{ color: tokens.text }}>
                <span className="mt-[0.65em] w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tokens.accent }} aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>

      {/* Investment Process — timeline with boxes */}
      <Section title={t.investmentProcess} bg="bgAlt" id="investment-process">
        <p className="text-sm font-semibold uppercase tracking-wider mb-8" style={{ color: tokens.accent }}>{t.investmentEngineIntro}</p>
        <div className="relative">
          {/* Timeline: vertical on mobile, horizontal on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
            {[
              { icon: Search, titleKey: "investmentStep1Title" as const, textKey: "investmentStep1Text" as const },
              { icon: TrendingUp, titleKey: "investmentStep2Title" as const, textKey: "investmentStep2Text" as const },
              { icon: DollarSign, titleKey: "investmentStep3Title" as const, textKey: "investmentStep3Text" as const },
              { icon: RefreshCw, titleKey: "investmentStep4Title" as const, textKey: "investmentStep4Text" as const },
            ].map(({ icon: Icon, titleKey, textKey }) => (
              <div
                key={titleKey}
                className="relative flex flex-col rounded-xl p-5 sm:p-6 border shadow-sm"
                style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}
              >
                <div className="flex items-center justify-center mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: tokens.accent }}>
                    <Icon className="w-5 h-5 text-white" aria-hidden />
                  </div>
                </div>
                <p className="font-semibold mb-2 text-base sm:text-lg leading-snug" style={{ color: tokens.text }}>{t[titleKey]}</p>
                <p className="text-base sm:text-lg leading-relaxed flex-1" style={{ color: tokens.text }}>{t[textKey]}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 rounded-xl p-6 border-2" style={{ backgroundColor: tokens.bg, borderColor: tokens.accent }}>
          <p className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: tokens.accent }}>{t.investmentResultLabel}</p>
          <p className="text-base sm:text-lg leading-relaxed font-medium" style={{ color: tokens.text }}>{t.investmentResult}</p>
        </div>
      </Section>

      <Section title={t.ourEdgeTitle} id="our-edge" bg="bgAlt">
        <ul className="space-y-2 pl-3 max-w-2xl">
          {[t.ourEdge1, t.ourEdge2, t.ourEdge3, t.ourEdge4, t.ourEdge5, t.ourEdge6].map((item) => (
            <li key={item} className="flex items-start gap-1.5 text-base sm:text-lg" style={{ color: tokens.text }}>
              <span className="mt-[0.65em] w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tokens.accent }} aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Opportunity — full section with cards (same as long form) */}
      <Section title={t.theOpportunity} id="approach">
        <div className="rounded-xl p-5 sm:p-6 mb-8 sm:mb-10 border shadow-sm" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
          <p className="text-lg sm:text-xl font-semibold mb-4 leading-snug" style={{ color: tokens.text }}>
            {t.opportunityThesis}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border, color: tokens.text }}>
              <Globe className="w-4 h-4 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />
              {t.badge1}
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border, color: tokens.text }}>
              <Target className="w-4 h-4 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />
              {t.badge2}
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border, color: tokens.text }}>
              <Shield className="w-4 h-4 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />
              {t.badge3}
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border, color: tokens.text }}>
              <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />
              {t.badge4}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          <div className="rounded-xl p-5 sm:p-6 border flex flex-col shadow-sm" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center" style={{ backgroundColor: tokens.accent }}>
                <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-white" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold mb-0" style={{ color: tokens.text }}>{t.theUniverse}</h3>
            </div>
            <p className="text-base sm:text-lg leading-relaxed font-semibold mb-3" style={{ color: tokens.text }}>
              {t.universeText}
            </p>
            <ul className="space-y-1.5 text-base sm:text-lg leading-relaxed flex-1 min-h-0 pl-3" style={{ color: tokens.text }}>
              <li className="flex items-start gap-1.5"><span className="mt-[0.65em] w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />{t.universeBullet1}</li>
              <li className="flex items-start gap-1.5"><span className="mt-[0.65em] w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />{t.universeBullet2}</li>
              <li className="flex items-start gap-1.5"><span className="mt-[0.65em] w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />{t.universeBullet3}</li>
            </ul>
          </div>

          <div className="rounded-xl p-5 sm:p-6 border flex flex-col shadow-sm" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center" style={{ backgroundColor: tokens.accent }}>
                <Workflow className="w-5 h-5 sm:w-6 sm:h-6 text-white" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold mb-0" style={{ color: tokens.text }}>{t.operationalGap}</h3>
            </div>
            <p className="text-base sm:text-lg leading-relaxed font-semibold mb-3" style={{ color: tokens.text }}>
              {t.gapText}
            </p>
            <ul className="space-y-1.5 text-base sm:text-lg leading-relaxed flex-1 min-h-0 pl-3" style={{ color: tokens.text }}>
              <li className="flex items-start gap-1.5"><span className="mt-[0.65em] w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />{t.gapBullet1}</li>
              <li className="flex items-start gap-1.5"><span className="mt-[0.65em] w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />{t.gapBullet2}</li>
              <li className="flex items-start gap-1.5"><span className="mt-[0.65em] w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />{t.gapBullet3}</li>
            </ul>
          </div>

          <div className="rounded-xl p-5 sm:p-6 border flex flex-col shadow-sm" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center" style={{ backgroundColor: tokens.accent }}>
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold mb-0" style={{ color: tokens.text }}>{t.whyNordic}</h3>
            </div>
            <p className="text-base sm:text-lg leading-relaxed font-semibold mb-3" style={{ color: tokens.text }}>
              {t.whyNordicText}
            </p>
            <ul className="space-y-1.5 text-base sm:text-lg leading-relaxed flex-1 min-h-0 pl-3" style={{ color: tokens.text }}>
              <li className="flex items-start gap-1.5"><span className="mt-[0.65em] w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />{t.whyNordicBullet1}</li>
              <li className="flex items-start gap-1.5"><span className="mt-[0.65em] w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />{t.whyNordicBullet2}</li>
              <li className="flex items-start gap-1.5"><span className="mt-[0.65em] w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />{t.whyNordicBullet3}</li>
            </ul>
          </div>

          <div className="rounded-xl p-5 sm:p-6 border flex flex-col shadow-sm" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center" style={{ backgroundColor: tokens.accent }}>
                <Target className="w-5 h-5 sm:w-6 sm:h-6 text-white" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold mb-0" style={{ color: tokens.text }}>{t.ourTake}</h3>
            </div>
            <p className="text-base sm:text-lg leading-relaxed font-semibold mb-3" style={{ color: tokens.text }}>
              {t.ourTakeText}
            </p>
            <p className="text-base sm:text-lg leading-relaxed mb-3" style={{ color: tokens.text }}>
              {t.ourTakeBullet1}
            </p>
            <ul className="space-y-1.5 text-base sm:text-lg leading-relaxed pl-3" style={{ color: tokens.text }}>
              <li className="flex items-start gap-1.5"><span className="mt-[0.65em] w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />{t.ourTakeBullet2}</li>
              <li className="flex items-start gap-1.5"><span className="mt-[0.65em] w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" style={{ color: tokens.accent }} aria-hidden />{t.ourTakeBullet3}</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* Pipeline — distinct background to separate from approach and value-creation */}
      <Section title={t.pipeline} id="pipeline" bg="bgAlt">
        <p className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: tokens.accent }}>{t.pipelineLabel}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {PIPELINE_ITEMS.map((item) => (
            <div key={item.stageKey} className="rounded-lg p-5 text-center border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
              <p className="text-2xl font-semibold tabular-nums" style={{ color: tokens.accent }}>{item.count}</p>
              <p className="text-sm mt-1" style={{ color: tokens.text }}>{t[item.stageKey]}</p>
            </div>
          ))}
        </div>
        <p className="text-sm mb-4" style={{ color: tokens.text }}>{t.activeTargets}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { name: "Company A", sectorKey: "sectorIndustrial" as const, revenue: "SEK 120m", statusKey: "dueDiligence" as const },
            { name: "Company B", sectorKey: "sectorBusinessServices" as const, revenue: "SEK 75m", statusKey: "advanced" as const },
            { name: "Company C", sectorKey: "sectorDistribution" as const, revenue: "SEK 165m", statusKey: "dueDiligence" as const },
          ].map((c) => (
            <div key={c.name} className="rounded-lg p-5 border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
              <p className="font-semibold" style={{ color: tokens.text }}>{c.name}</p>
              <p className="text-sm mt-1" style={{ color: tokens.text }}>{t[c.sectorKey]} · {c.revenue}</p>
              <p className="text-sm font-medium mt-3" style={{ color: tokens.accent }}>{t.status}: {t[c.statusKey]}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Value creation — Operating toolkit */}
      <Section title={t.valueCreation} id="value-creation">
        <p className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: tokens.accent }}>{t.operatingToolkitTitle}</p>
        <div className="space-y-4 mb-6">
          {(
            [
              { titleKey: "operatingToolkit1Title" as const, textKey: "operatingToolkit1Text" as const },
              { titleKey: "operatingToolkit2Title" as const, textKey: "operatingToolkit2Text" as const },
              { titleKey: "operatingToolkit3Title" as const, textKey: "operatingToolkit3Text" as const },
              { titleKey: "operatingToolkit4Title" as const, textKey: "operatingToolkit4Text" as const },
              { titleKey: "operatingToolkit5Title" as const, textKey: "operatingToolkit5Text" as const, extraKey: "operatingToolkitExecutionExtra" as const },
              { titleKey: "operatingToolkit6Title" as const, textKey: "operatingToolkit6Text" as const },
            ] as const
          ).map((row) => (
            <div key={row.titleKey} className="pl-4 border-l-2 rounded-r-lg py-2 pr-4" style={{ borderColor: tokens.accent, backgroundColor: tokens.washSage }}>
              <p className="font-semibold text-base mb-1" style={{ color: tokens.text }}>{t[row.titleKey]}</p>
              <p className="text-sm leading-relaxed" style={{ color: tokens.text }}>{t[row.textKey]}</p>
              {"extraKey" in row ? (
                <p className="text-sm leading-relaxed mt-2 opacity-95" style={{ color: tokens.text }}>{t[row.extraKey]}</p>
              ) : null}
            </div>
          ))}
        </div>
        <p className="text-base leading-relaxed font-medium" style={{ color: tokens.text }}>
          {t.operatingToolkitClosing}
        </p>
      </Section>

      {/* Team */}
      <Section title={t.team} bg="bgAlt" id="team">
        <p className="text-sm font-semibold uppercase tracking-wider mb-6" style={{ color: tokens.accent }}>{t.teamSubtitle}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TEAM.map((member) => (
            <div key={member.name} className="flex flex-col items-center text-center">
              <div className="w-full max-w-[200px] aspect-[4/3] rounded-lg flex items-center justify-center overflow-hidden border-2" style={{ backgroundColor: tokens.bgAlt, borderColor: tokens.border }}>
                <User className="w-14 h-14" style={{ color: tokens.text }} />
              </div>
              <p className="font-semibold mt-4" style={{ color: tokens.text }}>{member.name}</p>
              <p className="text-sm font-medium mt-1" style={{ color: tokens.accent }}>{t.foundingPartner}</p>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: tokens.text }}>{t[member.bioKey]}</p>
              {member.linkedin && (
                <a href={member.linkedin} target="_blank" rel="noopener noreferrer" className="text-profile-accent font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-profile-accent/30 rounded mt-2 inline-block">{t.readMore}</a>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* CTA — reveal full long-form on same page */}
      <section id="contact" className="w-full scroll-mt-[100px]" style={{ backgroundColor: tokens.bg, borderTop: `1px solid ${tokens.border}` }}>
        <div className={SECTION_CLASS}>
        <p className="text-center mb-4" style={{ color: tokens.text }}>{t.ctaText}</p>
        <div className="flex justify-center gap-4">
          <button
            type="button"
            onClick={onOpenLongForm}
            className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-md text-white text-base font-semibold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: tokens.primaryBtn }}
          >
            {t.openLongForm}
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
  const [lang, setLang] = useState<InvestorLang>("en");

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
        <InvestorHeader onSignOut={handleSignOut} lang={lang} onLangChange={setLang} />
        <div style={{ paddingTop: INVESTOR_HEADER_HEIGHT }}>
          <Investor2LongFormNivo key="nivo-long-form" lang={lang} />
        </div>
      </div>
    );
  }

  return (
    <InvestorShortForm
      onSignOut={handleSignOut}
      onOpenLongForm={() => setShowLongForm(true)}
      lang={lang}
      onLangChange={setLang}
    />
  );
}

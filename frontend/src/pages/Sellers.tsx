/**
 * Sellers page (target company owners). Route: /intro.
 * Password-gated page for potential acquisition targets.
 * Swedish only. Partnerskap, delägarskap, långsiktig utveckling — inte klassisk PE.
 */

"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import {
  Lock,
  User,
  ChevronDown,
  Shield,
  Clock,
  Building2,
  Handshake,
  FileCheck,
  BarChart3,
  TrendingUp,
  Workflow,
  ArrowRight,
  RefreshCw,
  Zap,
  UserCheck,
  Hammer,
  Network,
} from "lucide-react";
import { tokens, SECTION_CLASS } from "@/lib/designProfileTokens";
import { sellersTranslations } from "./sellers-deck/sellersTranslations";

const SELLERS_STORAGE_KEY = "nivo_sellers_unlocked";
const SELLERS_PASSWORD = "nivo2020";

const TEAM = [
  {
    name: "Jesper Kreuger",
    bioKey: "teamJesperBio" as const,
    linkedin: "https://www.linkedin.com/in/jesper-kreuger-91b14/",
  },
  {
    name: "Henrik Cavalli",
    bioKey: "teamHenrikBio" as const,
    linkedin: "https://www.linkedin.com/in/henrikc1/",
  },
  {
    name: "Sebastian Robson",
    bioKey: "teamSebastianBio" as const,
    linkedin: "https://www.linkedin.com/in/sebastian-robson-7418b82b2/",
  },
];

const TRACK_RECORD = [
  { stat: "80+", labelKey: "statEcm" as const },
  { stat: "20+", labelKey: "statIpos" as const },
  { stat: "€50m+", labelKey: "statVenture" as const },
  { stat: "iZettle & Readly", labelKey: "statIzettle" as const },
  { stat: "€60m+", labelKey: "statD2c" as const },
  { stat: "€30m", labelKey: "statEcommerce" as const },
];

const CONTACT_CTA = [
  { name: "Jesper Kreuger", email: "jesper@nivogroup.se", phone: "070-855 53 35" },
  { name: "Henrik Cavalli", email: "henrik@nivogroup.se", phone: "070-918 78 45" },
  { name: "Sebastian Robson", email: "sebastian@nivogroup.se", phone: "070-441 84 48" },
] as const;

const CAPABILITY_MATRIX = [
  { phaseKey: "phaseDealSourcing" as const, expKey: "phaseDealSourcingExp" as const, icon: Handshake },
  { phaseKey: "phaseTransaction" as const, expKey: "phaseTransactionExp" as const, icon: FileCheck },
  { phaseKey: "phaseCapital" as const, expKey: "phaseCapitalExp" as const, icon: BarChart3 },
  { phaseKey: "phaseScaling" as const, expKey: "phaseScalingExp" as const, icon: TrendingUp },
  { phaseKey: "phaseDigital" as const, expKey: "phaseDigitalExp" as const, icon: Workflow },
  { phaseKey: "phaseGovernance" as const, expKey: "phaseGovernanceExp" as const, icon: Shield },
  { phaseKey: "phaseExit" as const, expKey: "phaseExitExp" as const, icon: ArrowRight },
];

function Section({
  title,
  bg = "bg",
  id,
  children,
}: {
  title: string;
  bg?: "bg" | "bgAlt";
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={"w-full" + (id ? " scroll-mt-[100px]" : "")}
      id={id}
      style={{ backgroundColor: bg === "bgAlt" ? tokens.bgAlt : tokens.bg }}
    >
      <div className={SECTION_CLASS}>
        <h2 className="text-2xl font-semibold mb-4" style={{ color: tokens.text }}>
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function SellersGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const t = sellersTranslations;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password === SELLERS_PASSWORD) {
      sessionStorage.setItem(SELLERS_STORAGE_KEY, "1");
      onUnlock();
    } else {
      setError(t.gateError);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6" style={{ backgroundColor: tokens.bgAlt }}>
      <div
        className="w-full max-w-md rounded-xl p-6 sm:p-8 border"
        style={{
          backgroundColor: tokens.bg,
          borderColor: tokens.border,
          boxShadow: "var(--profile-shadow-soft, 0 2px 12px rgba(0,0,0,0.06))",
        }}
      >
        <div className="text-center mb-6">
          <img src="/nivo-logo-green.svg" alt="Nivo" className="h-14 sm:h-16 w-auto mx-auto mb-4" />
          <span
            className="inline-block px-3 py-1.5 rounded-full text-sm font-medium uppercase tracking-wider"
            style={{ backgroundColor: tokens.bg, color: tokens.accent }}
          >
            {t.gateBadge}
          </span>
          <h1 className="text-xl sm:text-2xl font-bold mt-4 mb-2" style={{ color: tokens.text }}>
            {t.gateTitle}
          </h1>
          <p className="text-base" style={{ color: tokens.text }}>
            {t.gateSubtitle}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="sellers-pw" className="block text-sm font-medium mb-2" style={{ color: tokens.text }}>
              {t.gateLabel}
            </label>
            <Input
              id="sellers-pw"
              type="password"
              placeholder={t.gatePlaceholder}
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
            {t.gateButton}
          </button>
        </form>
      </div>
    </div>
  );
}

const SELLERS_HEADER_HEIGHT = 68;

const ANCHOR_LINKS = [
  { href: "#sammanfattning", labelKey: "navSammanfattning" as const },
  { href: "#samarbete", labelKey: "navHurViArbetar" as const },
  { href: "#vad-vi-letar-efter", labelKey: "navVadViLetarEfter" as const },
  { href: "#varfor-annorlunda", labelKey: "navVarförAnnorlunda" as const },
  { href: "#var-process", labelKey: "navVarProcess" as const },
  { href: "#efter-affaren", labelKey: "navEfterAffaren" as const },
  { href: "#vem-bakom-oss", labelKey: "navVemBakomOss" as const },
  { href: "#team", labelKey: "navTeam" as const },
  { href: "#kontakt", labelKey: "navKontakt" as const },
];

function SellersHeader({ onSignOut }: { onSignOut: () => void }) {
  const t = sellersTranslations;
  return (
    <header
      className="border-b fixed top-0 left-0 right-0 z-20 bg-white dark:bg-zinc-50"
      style={{ borderColor: "var(--profile-border, #e4e4e7)", height: SELLERS_HEADER_HEIGHT }}
    >
      <div className="max-w-5xl mx-auto px-5 sm:px-6 h-full flex items-center justify-between gap-4">
        <div className="flex items-center justify-start flex-shrink-0 min-w-0">
          <img src="/Nivo%20-%20Wordmark%20-%20black.svg" alt="Nivo" className="h-5 sm:h-6 w-auto object-contain" />
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto flex-wrap justify-center min-w-0 flex-1">
          {ANCHOR_LINKS.map(({ href, labelKey }) => (
            <a
              key={href}
              href={href}
              className="px-2 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-950 whitespace-nowrap"
            >
              {t[labelKey]}
            </a>
          ))}
        </nav>
        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-zinc-700 dark:text-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-200 text-sm font-medium transition-colors shrink-0"
        >
          <Lock className="h-4 w-4" />
          {t.lockPage}
        </button>
      </div>
    </header>
  );
}

const TRACKABLE_SECTION_IDS = [
  "overview",
  "sammanfattning",
  "samarbete",
  "vad-vi-letar-efter",
  "varfor-annorlunda",
  "var-process",
  "efter-affaren",
  "vem-bakom-oss",
  "team",
  "kontakt",
];

function SellersContent({ onSignOut }: { onSignOut: () => void }) {
  const t = sellersTranslations;
  const [searchParams] = useSearchParams();
  const tid = searchParams.get("tid");
  const sectionSentRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!tid) return;
    // Page view: fire once when content is shown
    fetch(`/track/page/${tid}`, { credentials: "omit" }).catch(() => {});
  }, [tid]);

  useEffect(() => {
    if (!tid) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const id = e.target.id;
          if (!id || !TRACKABLE_SECTION_IDS.includes(id)) continue;
          if (sectionSentRef.current.has(id)) continue;
          sectionSentRef.current.add(id);
          fetch(`/track/section/${tid}?section=${encodeURIComponent(id)}`, { credentials: "omit" }).catch(() => {});
        }
      },
      { threshold: 0.2, rootMargin: "0px" }
    );
    const els = TRACKABLE_SECTION_IDS.map((id) => document.getElementById(id)).filter(Boolean);
    els.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [tid]);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: tokens.bg }} data-design-profile="nivo">
      <SellersHeader onSignOut={onSignOut} />
      <div style={{ paddingTop: SELLERS_HEADER_HEIGHT }}>
        {/* Hero — video background, white text */}
        <section className="relative flex min-h-[75vh] w-full overflow-hidden" id="overview">
          <div className="pointer-events-none absolute inset-0">
            <video
              className="h-full w-full object-cover object-[50%_30%] sm:object-center"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-label="Bakgrundsvideo för hjältesektionen"
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
              <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold max-w-3xl mx-auto leading-snug text-white mb-5">
                {t.heroTitle}
              </h1>
              <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed text-white/95">
                {t.heroSubtitle}
              </p>
            </div>
          </div>
        </section>

        {/* Sammanfattning */}
        <Section title={t.sammanfattningTitle} id="sammanfattning">
          <div className="rounded-lg p-5 border mb-6" style={{ backgroundColor: tokens.bgAlt, borderColor: tokens.border }}>
            <p className="text-[15px] leading-relaxed mb-4" style={{ color: tokens.text }}>
              {t.sammanfattningIntro}
            </p>
            <p className="text-[15px] leading-relaxed mb-4" style={{ color: tokens.text }}>
              {t.sammanfattningText}
            </p>
            <p className="text-[15px] leading-relaxed mb-4" style={{ color: tokens.text }}>
              {t.sammanfattningText2}
            </p>
            <ul className="space-y-1.5 text-sm mb-4 pl-6" style={{ color: tokens.text }}>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tokens.accent }} aria-hidden />
                <span className="flex-1">{t.sammanfattningBullet1}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tokens.accent }} aria-hidden />
                <span className="flex-1">{t.sammanfattningBullet2}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tokens.accent }} aria-hidden />
                <span className="flex-1">{t.sammanfattningBullet3}</span>
              </li>
            </ul>
          </div>
        </Section>

        {/* Hur vi arbetar som ägare */}
        <Section title={t.samarbeteTitle} bg="bgAlt" id="samarbete">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { icon: Handshake, titleKey: "samarbetePartnerskapTitle" as const, textKey: "samarbetePartnerskapText" as const },
              { icon: Zap, titleKey: "samarbeteSnabbBeslut" as const, textKey: "samarbeteSnabbBeslutText" as const },
              { icon: UserCheck, titleKey: "samarbeteNärvarandeMenIntePåträngande" as const, textKey: "samarbeteNärvarandeMenIntePåträngandeText" as const },
            ].map(({ icon: Icon, titleKey, textKey }) => (
              <div
                key={titleKey}
                className="rounded-lg p-5 border"
                style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                  style={{ backgroundColor: tokens.washSage, borderColor: tokens.accent, borderWidth: 1 }}
                >
                  <Icon className="w-5 h-5" style={{ color: tokens.accent }} aria-hidden />
                </div>
                <h3 className="font-semibold mb-2 text-base" style={{ color: tokens.text }}>
                  {t[titleKey]}
                </h3>
                <p className="text-[14px] leading-relaxed" style={{ color: tokens.text }}>
                  {t[textKey]}
                </p>
              </div>
            ))}
            <div
              className="rounded-lg p-5 border md:col-span-2"
              style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                style={{ backgroundColor: tokens.washSage, borderColor: tokens.accent, borderWidth: 1 }}
              >
                <Hammer className="w-5 h-5" style={{ color: tokens.accent }} aria-hidden />
              </div>
              <h3 className="font-semibold mb-2 text-base" style={{ color: tokens.text }}>
                {t.samarbeteByggaInteRapportera}
              </h3>
              <p className="text-[14px] leading-relaxed mb-3" style={{ color: tokens.text }}>
                {t.samarbeteByggaInteRapporteraText}
              </p>
              <ul className="space-y-1 pl-5 list-disc text-[14px] leading-relaxed" style={{ color: tokens.text }}>
                <li>{t.samarbeteOperativBullet1}</li>
                <li>{t.samarbeteOperativBullet2}</li>
                <li>{t.samarbeteOperativBullet3}</li>
                <li>{t.samarbeteOperativBullet4}</li>
              </ul>
            </div>
            {[
              { icon: Workflow, titleKey: "samarbeteDigitalTitle" as const, textKey: "samarbeteDigitalText" as const },
              { icon: Network, titleKey: "samarbeteNatverkTitle" as const, textKey: "samarbeteNatverkText" as const },
            ].map(({ icon: Icon, titleKey, textKey }) => (
              <div
                key={titleKey}
                className="rounded-lg p-5 border"
                style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                  style={{ backgroundColor: tokens.washSage, borderColor: tokens.accent, borderWidth: 1 }}
                >
                  <Icon className="w-5 h-5" style={{ color: tokens.accent }} aria-hidden />
                </div>
                <h3 className="font-semibold mb-2 text-base" style={{ color: tokens.text }}>
                  {t[titleKey]}
                </h3>
                <p className="text-[14px] leading-relaxed" style={{ color: tokens.text }}>
                  {t[textKey]}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* Vad vi letar efter */}
        <Section title={t.vadViLetarEfter} id="vad-vi-letar-efter">
          <p className="text-[15px] leading-relaxed mb-6" style={{ color: tokens.text }}>
            {t.vadViLetarEfterIntro}
          </p>
          <ul className="space-y-3 mb-6 pl-6" style={{ color: tokens.text }}>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tokens.accent }} aria-hidden />
              <span className="flex-1 text-[15px] leading-relaxed">{t.vadViLetarEfterItem1}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tokens.accent }} aria-hidden />
              <span className="flex-1 text-[15px] leading-relaxed">{t.vadViLetarEfterItem2}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tokens.accent }} aria-hidden />
              <span className="flex-1 text-[15px] leading-relaxed">{t.vadViLetarEfterItem3}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tokens.accent }} aria-hidden />
              <span className="flex-1 text-[15px] leading-relaxed">{t.vadViLetarEfterItem4}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tokens.accent }} aria-hidden />
              <span className="flex-1 text-[15px] leading-relaxed">{t.vadViLetarEfterItem5}</span>
            </li>
          </ul>
          <div
            className="rounded-lg p-5 border-l-4"
            style={{ backgroundColor: tokens.washSage, borderLeftColor: tokens.accent }}
          >
            <p className="text-[15px] font-medium leading-relaxed" style={{ color: tokens.text }}>
              {t.vadViLetarEfterAvslutning}
            </p>
          </div>
        </Section>

        {/* Varför Nivo är annorlunda */}
        <Section title={t.varforAnnorlundaTitle} bg="bgAlt" id="varfor-annorlunda">
          <h3 className="text-lg font-semibold mb-3" style={{ color: tokens.text }}>
            {t.varforAnnorlundaRubrik}
          </h3>
          <p className="leading-relaxed mb-3 text-[15px]" style={{ color: tokens.text }}>
            {t.varforAnnorlundaText}
          </p>
          <p className="leading-relaxed mb-4 text-[15px]" style={{ color: tokens.text }}>
            {t.varforAnnorlundaText2}
          </p>
          <p className="font-semibold mb-2 text-[15px]" style={{ color: tokens.text }}>
            {t.varforAnnorlundaViIntro}
          </p>
          <ul className="space-y-1.5 mb-8 pl-6 list-disc text-[15px] leading-relaxed" style={{ color: tokens.text }}>
            <li>{t.varforAnnorlundaVi1}</li>
            <li>{t.varforAnnorlundaVi2}</li>
            <li>{t.varforAnnorlundaVi3}</li>
          </ul>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
            {[
              { icon: Building2, text: t.varforAnnorlundaBullet1 },
              { icon: Shield, text: t.varforAnnorlundaBullet2 },
              { icon: Clock, text: t.varforAnnorlundaBullet3 },
              { icon: RefreshCw, text: t.varforAnnorlundaBullet4 },
              { icon: TrendingUp, text: t.varforAnnorlundaBullet5 },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-3 px-5 py-4 sm:px-6 sm:py-5 rounded-xl text-sm sm:text-base font-medium border"
                style={{ backgroundColor: tokens.bg, borderColor: tokens.border, color: tokens.text }}
              >
                <Icon className="w-5 h-5 flex-shrink-0" style={{ color: tokens.accent }} aria-hidden />
                {text}
              </div>
            ))}
          </div>
          <div
            className="rounded-lg p-5 border-l-4 text-[15px] leading-relaxed"
            style={{ backgroundColor: tokens.washSage, borderLeftColor: tokens.accent, color: tokens.text }}
          >
            {t.vadViInteGorText}
          </div>
        </Section>

        {/* Vår process */}
        <Section title={t.varProcessTitle} id="var-process">
          <p className="text-[15px] leading-relaxed mb-8" style={{ color: tokens.text }}>
            {t.varProcessIntro}
          </p>
          <div className="space-y-6 mb-8">
            {[
              { titleKey: "varProcessStep1Title" as const, textKey: "varProcessStep1Text" as const },
              { titleKey: "varProcessStep2Title" as const, textKey: "varProcessStep2Text" as const },
              { titleKey: "varProcessStep3Title" as const, textKey: "varProcessStep3Text" as const },
              { titleKey: "varProcessStep4Title" as const, textKey: "varProcessStep4Text" as const },
            ].map(({ titleKey, textKey }, i) => (
              <div
                key={titleKey}
                className="flex gap-4 pl-1 border-l-4 rounded-r-lg py-1"
                style={{ borderLeftColor: tokens.accent }}
              >
                <span
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                  style={{ backgroundColor: tokens.washSage, color: tokens.accent }}
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: tokens.text }}>
                    {t[titleKey]}
                  </h3>
                  <p className="text-[15px] leading-relaxed" style={{ color: tokens.text }}>
                    {t[textKey]}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[15px] font-medium leading-relaxed" style={{ color: tokens.text }}>
            {t.varProcessAvslut}
          </p>
        </Section>

        {/* Efter affären */}
        <Section title={t.efterAffarenTitle} bg="bgAlt" id="efter-affaren">
          <p className="text-[15px] leading-relaxed mb-3" style={{ color: tokens.text }}>
            {t.efterAffarenP1}
          </p>
          <p className="text-[15px] leading-relaxed mb-3" style={{ color: tokens.text }}>
            {t.efterAffarenP2}
          </p>
          <p className="text-[15px] leading-relaxed mb-3" style={{ color: tokens.text }}>
            {t.efterAffarenP3}
          </p>
          <p className="text-[15px] leading-relaxed font-medium" style={{ color: tokens.text }}>
            {t.efterAffarenP4}
          </p>
        </Section>

        {/* Vem som står bakom oss */}
        <Section title={t.vemBakomOssTitle} id="vem-bakom-oss">
          <h3 className="text-lg font-semibold mb-3" style={{ color: tokens.text }}>
            {t.vemBakomOssRubrik}
          </h3>
          <p className="leading-relaxed mb-4" style={{ color: tokens.text }}>
            {t.vemBakomOssText}
          </p>
          <div
            className="rounded-lg p-5 border-l-4"
            style={{ backgroundColor: tokens.washSage, borderLeftColor: tokens.accent }}
          >
            <p className="text-[15px] sm:text-base font-medium leading-relaxed" style={{ color: tokens.text }}>
              {t.vemBakomOssAlignment}
            </p>
          </div>
        </Section>

        {/* Team */}
        <Section title={t.teamTitle} bg="bgAlt" id="team">
          <p className="text-sm font-semibold uppercase tracking-wider mb-6" style={{ color: tokens.accent }}>
            {t.teamSubtitle}
          </p>

          <h3 className="text-lg font-semibold mb-4" style={{ color: tokens.text }}>
            {t.teamCoreTitle}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
            {TEAM.map((member) => (
              <div key={member.name} className="flex flex-col items-center text-center">
                <div
                  className="w-full max-w-[200px] aspect-[4/3] rounded-lg flex items-center justify-center overflow-hidden border-2"
                  style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}
                >
                  <User className="w-14 h-14" style={{ color: tokens.text }} />
                </div>
                <p className="font-semibold mt-4" style={{ color: tokens.text }}>
                  {member.name}
                </p>
                <p className="text-sm font-medium mt-1" style={{ color: tokens.accent }}>
                  {t.foundingPartner}
                </p>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: tokens.text }}>
                  {t[member.bioKey]}
                </p>
                {member.linkedin && (
                  <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-profile-accent font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-profile-accent/30 rounded mt-2 inline-block"
                  >
                    {t.readMore}
                  </a>
                )}
              </div>
            ))}
          </div>

          <h3 className="text-lg font-semibold mb-4" style={{ color: tokens.text }}>
            {t.advisoryTitle}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
            <div className="rounded-lg p-4 border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
              <p className="font-semibold" style={{ color: tokens.text }}>
                {t.advisorySenior}
              </p>
              <p className="text-[15px] mt-1" style={{ color: tokens.text }}>
                {t.advisorySeniorDesc}
              </p>
            </div>
            <div className="rounded-lg p-4 border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
              <p className="font-semibold" style={{ color: tokens.text }}>
                {t.advisoryFinancial}
              </p>
              <p className="text-[15px] mt-1" style={{ color: tokens.text }}>
                {t.advisoryFinancialDesc}
              </p>
            </div>
            <div className="rounded-lg p-4 border" style={{ backgroundColor: tokens.bg, borderColor: tokens.border }}>
              <p className="font-semibold" style={{ color: tokens.text }}>
                {t.advisoryAdvisor}
              </p>
              <p className="text-[15px] mt-1" style={{ color: tokens.text }}>
                {t.advisoryAdvisorDesc}
              </p>
            </div>
          </div>

          <h3 className="text-lg font-semibold mb-3" style={{ color: tokens.text }}>
            {t.trackRecordTitle}
          </h3>
          <p className="text-[15px] leading-relaxed mb-6 max-w-2xl" style={{ color: tokens.text }}>
            {t.trackRecordText}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            {TRACK_RECORD.map((item) => (
              <div
                key={item.labelKey}
                className="rounded-lg p-4 border text-center"
                style={{ backgroundColor: tokens.bg, borderColor: tokens.border, boxShadow: "var(--profile-shadow-soft)" }}
              >
                <p className="text-xl font-semibold" style={{ color: tokens.accent }}>
                  {item.stat}
                </p>
                <p className="text-sm mt-1" style={{ color: tokens.text }}>
                  {t[item.labelKey]}
                </p>
              </div>
            ))}
          </div>

          <div
            className="rounded-lg p-5 sm:p-6 mb-8"
            style={{ backgroundColor: tokens.washSage, borderLeft: `4px solid ${tokens.accent}` }}
          >
            <p className="text-[17px] sm:text-[19px] font-semibold leading-relaxed" style={{ color: tokens.text }}>
              {t.teamPunchLine}
            </p>
          </div>

          <details
            className="group rounded-lg border"
            style={{ borderColor: tokens.border, backgroundColor: tokens.bg }}
          >
            <summary
              className="flex items-center justify-between gap-3 cursor-pointer list-none px-5 py-4 font-bold transition-all rounded-lg group-open:rounded-b-none group-open:rounded-t-lg hover:bg-black/5 [&::-webkit-details-marker]:hidden"
              style={{
                color: tokens.text,
                backgroundColor: tokens.bg,
                border: `2px solid ${tokens.border}`,
                borderLeft: `4px solid ${tokens.accent}`,
              }}
            >
              <span className="flex items-center gap-3">
                <ChevronDown
                  className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-open:rotate-180"
                  style={{ color: tokens.accent }}
                  aria-hidden
                />
                <span>{t.capabilityExpandTitle}</span>
              </span>
              <span className="text-sm font-normal opacity-75">{t.capabilityExpandHint}</span>
            </summary>
            <div className="px-5 pb-6 pt-2 space-y-6 border-t" style={{ borderColor: tokens.border }}>
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: tokens.text }}>
                  {t.capabilityDealSourcing}
                </p>
                <p className="text-[15px] leading-relaxed" style={{ color: tokens.text }}>
                  {t.capabilityDealSourcingExp}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: tokens.text }}>
                  {t.capabilityOperational}
                </p>
                <p className="text-[15px] leading-relaxed" style={{ color: tokens.text }}>
                  {t.capabilityOperationalExp}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: tokens.text }}>
                  {t.capabilityFinancial}
                </p>
                <p className="text-[15px] leading-relaxed" style={{ color: tokens.text }}>
                  {t.capabilityFinancialExp}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: tokens.text }}>
                  {t.capabilityFounder}
                </p>
                <p className="text-[15px] leading-relaxed" style={{ color: tokens.text }}>
                  {t.capabilityFounderExp}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold mb-4" style={{ color: tokens.text }}>
                  {t.capabilityMatrixTitle}
                </p>
                <p className="text-[14px] mb-4" style={{ color: tokens.text }}>
                  {t.capabilityMatrixSubtitle}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {CAPABILITY_MATRIX.map(({ phaseKey, expKey, icon: Icon }) => (
                    <div
                      key={phaseKey}
                      className="flex gap-4 p-4 rounded-lg border"
                      style={{ backgroundColor: tokens.washSage, borderColor: tokens.border }}
                    >
                      <div
                        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: tokens.bg, borderColor: tokens.accent, borderWidth: 1 }}
                      >
                        <Icon className="w-5 h-5" style={{ color: tokens.accent }} aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[15px] mb-1" style={{ color: tokens.text }}>
                          {t[phaseKey]}
                        </p>
                        <p className="text-[14px] leading-relaxed" style={{ color: tokens.text }}>
                          {t[expKey]}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </details>
        </Section>

        {/* Kontakt */}
        <Section title={t.kontaktSectionTitle} id="kontakt">
          <p className="text-[15px] leading-relaxed mb-6 max-w-2xl" style={{ color: tokens.text }}>
            {t.kontaktBody}
          </p>
          <p className="text-sm font-semibold mb-4" style={{ color: tokens.text }}>
            {t.kontaktDuKan}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            {CONTACT_CTA.map((c) => (
              <div
                key={c.email}
                className="rounded-lg p-5 border"
                style={{ backgroundColor: tokens.bgAlt, borderColor: tokens.border }}
              >
                <p className="font-semibold mb-3" style={{ color: tokens.text }}>
                  {c.name}
                </p>
                <a
                  href={`mailto:${c.email}`}
                  className="text-[15px] block text-profile-accent hover:underline focus:outline-none focus:ring-2 focus:ring-profile-accent/30 rounded"
                >
                  {c.email}
                </a>
                <a
                  href={`tel:${c.phone.replace(/\s|-/g, "")}`}
                  className="text-[15px] block mt-2 text-profile-accent hover:underline focus:outline-none focus:ring-2 focus:ring-profile-accent/30 rounded"
                >
                  {c.phone}
                </a>
              </div>
            ))}
          </div>
          <p className="text-[15px] leading-relaxed" style={{ color: tokens.text }}>
            {t.kontaktFooter}
          </p>
        </Section>
      </div>
    </div>
  );
}

export default function Sellers() {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SELLERS_STORAGE_KEY) === "1") setUnlocked(true);
  }, []);

  const handleSignOut = () => {
    sessionStorage.removeItem(SELLERS_STORAGE_KEY);
    setUnlocked(false);
  };

  if (!unlocked) {
    return <SellersGate onUnlock={() => setUnlocked(true)} />;
  }

  return <SellersContent onSignOut={handleSignOut} />;
}

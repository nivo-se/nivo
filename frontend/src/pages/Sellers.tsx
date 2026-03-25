/**
 * Sellers page (target company owners). Route: /intro.
 * Password-gated page for potential acquisition targets.
 * Swedish only.
 */

"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";
import { tokens, SECTION_CLASS } from "@/lib/designProfileTokens";
import { sellersTranslations } from "./sellers-deck/sellersTranslations";

const SELLERS_STORAGE_KEY = "nivo_sellers_unlocked";
const SELLERS_PASSWORD = "nivo2020";

const CONTACT_CTA = [
  { name: "Jesper Kreuger", email: "jesper@nivogroup.se", phone: "070-855 53 35" },
  { name: "Henrik Cavalli", email: "henrik@nivogroup.se", phone: "070-918 78 45" },
  { name: "Sebastian Robson", email: "sebastian@nivogroup.se", phone: "070-441 84 48" },
] as const;

const SELLERS_HEADER_HEIGHT = 68;

const ANCHOR_LINKS = [
  { href: "#hur-vi-arbetar", labelKey: "navHurViArbetar" as const },
  { href: "#vad-vi-letar-efter", labelKey: "navVadViLetarEfter" as const },
  { href: "#varfor-annorlunda", labelKey: "navVarförAnnorlunda" as const },
  { href: "#var-process", labelKey: "navVarProcess" as const },
  { href: "#efter-affaren", labelKey: "navEfterAffaren" as const },
  { href: "#kontakt", labelKey: "navKontakt" as const },
];

const TRACKABLE_SECTION_IDS = [
  "overview",
  "hur-vi-arbetar",
  "vad-vi-letar-efter",
  "varfor-annorlunda",
  "var-process",
  "efter-affaren",
  "kontakt",
];

/** Scroll reveal for section H2 + eyebrow; IO only when motion is OK; CSS motion-reduce: also forces visible state. */
function useSectionTitleReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncReduced = () => {
      if (mq.matches) setVisible(true);
    };
    syncReduced();
    mq.addEventListener("change", syncReduced);

    if (mq.matches) {
      return () => mq.removeEventListener("change", syncReduced);
    }

    const el = ref.current;
    if (!el) {
      return () => mq.removeEventListener("change", syncReduced);
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setVisible(true);
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    obs.observe(el);
    return () => {
      mq.removeEventListener("change", syncReduced);
      obs.disconnect();
    };
  }, []);

  return { ref, visible };
}

function SectionShell({
  title,
  bg = "bg",
  id,
  sectionIndex,
  children,
}: {
  title: string;
  bg?: "bg" | "bgAlt";
  id?: string;
  /** 1–6 = shows “01”…“06” eyebrow above the H2 for scan rhythm. */
  sectionIndex?: number;
  children: React.ReactNode;
}) {
  const label = sectionIndex != null ? String(sectionIndex).padStart(2, "0") : null;
  const { ref: titleBlockRef, visible: titleVisible } = useSectionTitleReveal();

  return (
    <section
      className={"w-full" + (id ? " scroll-mt-[100px]" : "")}
      id={id}
      style={{ backgroundColor: bg === "bgAlt" ? tokens.bgAlt : tokens.bg }}
    >
      <div className={SECTION_CLASS}>
        <div
          ref={titleBlockRef}
          className={
            "mb-10 transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none " +
            (titleVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2") +
            " motion-reduce:opacity-100 motion-reduce:translate-y-0"
          }
        >
          {label ? (
            <p
              className="text-xs font-semibold tracking-[0.28em] tabular-nums mb-3"
              style={{ color: tokens.accent }}
              aria-hidden
            >
              {label}
            </p>
          ) : null}
          <h2
            className="text-2xl sm:text-3xl font-semibold tracking-tight leading-snug"
            style={{ color: tokens.text }}
          >
            {title}
          </h2>
        </div>
        {children}
      </div>
    </section>
  );
}

/** Bullet vertically centered on the first text line when wrapping (`1lh` box). */
function BulletTextRows({
  lines,
  size = "14",
}: {
  lines: readonly string[];
  size?: "14" | "15";
}) {
  const cls = size === "14" ? "text-[14px] leading-relaxed" : "text-[15px] leading-relaxed";
  return (
    <ul className="space-y-2">
      {lines.map((line) => (
        <li key={line} className={`flex gap-3 ${cls}`} style={{ color: tokens.text }}>
          <span className={`flex h-[1lh] w-1.5 flex-shrink-0 items-center justify-center ${cls}`} aria-hidden>
            <span className="block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tokens.accent }} />
          </span>
          <span className="min-w-0 flex-1">{line}</span>
        </li>
      ))}
    </ul>
  );
}

/** Narrative subsection (H3 + one or more short paragraphs). */
function NarrativeBlock({
  title,
  body,
  paragraphs,
}: {
  title: string;
  body?: string;
  paragraphs?: readonly string[];
}) {
  const parts = paragraphs ?? (body != null ? [body] : []);
  return (
    <div className="border-l-4 pl-4 sm:pl-5 py-1 pr-1 max-w-2xl" style={{ borderLeftColor: tokens.accent }}>
      <h3 className="text-base sm:text-lg font-semibold tracking-tight mb-3" style={{ color: tokens.text }}>
        {title}
      </h3>
      <div className="space-y-3">
        {parts.map((text, i) => (
          <p key={i} className="text-[15px] sm:text-base leading-relaxed" style={{ color: tokens.text }}>
            {text}
          </p>
        ))}
      </div>
    </div>
  );
}

/** Same rail as NarrativeBlock; children = short paragraphs + optional lists. */
function RailSubsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-l-4 pl-4 sm:pl-5 py-1 pr-1 max-w-2xl" style={{ borderLeftColor: tokens.accent }}>
      <h3 className="text-base sm:text-lg font-semibold tracking-tight mb-3" style={{ color: tokens.text }}>
        {title}
      </h3>
      <div className="space-y-3 text-[15px] sm:text-base leading-relaxed" style={{ color: tokens.text }}>
        {children}
      </div>
    </div>
  );
}

/** Left accent rail, no card chrome. */
function BulletRailSection({
  title,
  bullets,
}: {
  title: string;
  bullets: readonly [string, string, string];
}) {
  return (
    <div className="h-full border-l-4 pl-4 sm:pl-5 py-1 pr-1 max-w-xl" style={{ borderLeftColor: tokens.accent }}>
      <h3 className="text-base sm:text-lg font-semibold tracking-tight mb-3" style={{ color: tokens.text }}>
        {title}
      </h3>
      <BulletTextRows lines={bullets} size="14" />
    </div>
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

function SellersContent({ onSignOut }: { onSignOut: () => void }) {
  const t = sellersTranslations;
  const [searchParams] = useSearchParams();
  const tid = searchParams.get("tid");
  const sectionSentRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!tid) return;
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
        {/* Hero */}
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
          <div className="relative z-10 flex flex-col justify-center px-5 sm:px-6 pt-10 sm:pt-12 pb-16 min-h-[75vh] overflow-visible w-full">
            <div className="max-w-4xl mx-auto px-5 sm:px-6 text-center overflow-visible text-white">
              <div className="w-full py-5 px-8 sm:py-6 sm:px-10 mb-4 overflow-visible min-h-[100px] sm:min-h-[120px] flex items-center justify-center">
                <img src="/nivo-logo-white.svg" alt="Nivo" className="h-20 sm:h-24 w-auto object-contain" />
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold max-w-3xl mx-auto leading-snug text-white mb-6">
                {t.heroTitle}
              </h1>
              <div className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed text-white/95 space-y-3">
                <p>{t.heroLead1}</p>
                <p>{t.heroLead2}</p>
                <p>{t.heroLead3}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Citat — P3: full-bleed sage gradient band; typographic pull quote (no card chrome) */}
        <section className="w-full" style={{ background: tokens.gradients.soft }}>
          <div className={SECTION_CLASS}>
            <figure className="max-w-3xl mx-auto py-2 sm:py-4">
              <blockquote
                className="border-l-[3px] pl-6 sm:pl-8 text-left text-lg sm:text-xl md:text-[1.65rem] font-medium leading-snug tracking-tight"
                style={{ borderLeftColor: tokens.accent, color: tokens.text }}
              >
                {t.quoteMain}
              </blockquote>
              <figcaption
                className="mt-5 pl-6 sm:pl-8 text-left text-sm sm:text-[15px] leading-relaxed"
                style={{ color: tokens.textMuted }}
              >
                {t.quoteSub}
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Intro */}
        <section className="w-full" style={{ backgroundColor: tokens.bg }}>
          <div className={SECTION_CLASS}>
            <div className="max-w-2xl mx-auto text-[15px] sm:text-base leading-relaxed space-y-3 sm:space-y-4" style={{ color: tokens.text }}>
              <p>{t.introP1}</p>
              <p>{t.introP1b}</p>
              <p>{t.introP2}</p>
              <p>{t.introP3}</p>
            </div>
          </div>
        </section>

        {/* 1. Hur vi arbetar */}
        <SectionShell title={t.hurViArbetarTitle} bg="bgAlt" id="hur-vi-arbetar" sectionIndex={1}>
          <div className="max-w-2xl space-y-3 mb-10 sm:mb-12" style={{ color: tokens.text }}>
            <p className="text-[15px] sm:text-base leading-relaxed">{t.hurViArbetarIngressP1}</p>
            <p className="text-[15px] sm:text-base leading-relaxed">{t.hurViArbetarIngressP2}</p>
            <p className="text-[15px] sm:text-base leading-relaxed">{t.hurViArbetarIngressP3}</p>
          </div>
          <div className="space-y-8 sm:space-y-10">
            <NarrativeBlock title={t.hvNarrative1Title} body={t.hvNarrative1Body} />
            <NarrativeBlock title={t.hvNarrative2Title} body={t.hvNarrative2Body} />
            <NarrativeBlock title={t.hvNarrative3Title} body={t.hvNarrative3Body} />
            <NarrativeBlock title={t.hvNarrative4Title} paragraphs={[t.hvNarrative4P1, t.hvNarrative4P2]} />
            <NarrativeBlock title={t.hvNarrative5Title} body={t.hvNarrative5Body} />
          </div>
          <div className="mt-10 sm:mt-12 max-w-2xl space-y-4">
            <p className="text-[15px] sm:text-base leading-relaxed font-medium" style={{ color: tokens.text }}>
              {t.hurViArbetarClosing}
            </p>
            <p className="text-[15px] sm:text-base leading-relaxed font-medium" style={{ color: tokens.text }}>
              {t.hurViArbetarTagline}
            </p>
          </div>
        </SectionShell>

        {/* 2. Vad vi letar efter */}
        <SectionShell title={t.vadViLetarEfterTitle} id="vad-vi-letar-efter" sectionIndex={2}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-12 max-w-4xl">
            <BulletRailSection title={t.vadBlock1Title} bullets={[t.vadB1, t.vadB2, t.vadB3]} />
            <BulletRailSection title={t.vadBlock2Title} bullets={[t.vadB4, t.vadB5, t.vadB6]} />
          </div>
        </SectionShell>

        {/* 3. Varför vi är annorlunda */}
        <SectionShell title={t.varforAnnorlundaTitle} bg="bgAlt" id="varfor-annorlunda" sectionIndex={3}>
          <div className="space-y-10 sm:space-y-11">
            <RailSubsection title={t.vaArbetssattTitle}>
              <p>{t.vaArbetssattP1}</p>
              <p>{t.vaArbetssattP2}</p>
            </RailSubsection>
            <RailSubsection title={t.vaDigitalTitle}>
              <p>{t.vaDigitalP1}</p>
              <p className="font-medium text-[15px] sm:text-base">{t.vaDigitalBulletLead}</p>
              <div className="pt-0.5">
                <BulletTextRows lines={[t.vaDigitalB1, t.vaDigitalB2, t.vaDigitalB3]} size="15" />
              </div>
              <p className="pt-1">{t.vaDigitalP2}</p>
            </RailSubsection>
            <RailSubsection title={t.vaNatverkTitle}>
              <p>{t.vaNatverkP1}</p>
              <p>{t.vaNatverkP2}</p>
              <p>{t.vaNatverkP3}</p>
            </RailSubsection>
            <RailSubsection title={t.vaErfarenhetTitle}>
              <p>{t.vaErfarenhetP1}</p>
              <p>{t.vaErfarenhetP2}</p>
            </RailSubsection>
          </div>
        </SectionShell>

        {/* 4. Vår process */}
        <SectionShell title={t.varProcessTitle} id="var-process" sectionIndex={4}>
          <ol className="space-y-5 mb-8 max-w-2xl">
            {[t.vp1, t.vp2, t.vp3, t.vp4].map((step, i) => (
              <li
                key={step}
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
                <span className="text-[15px] sm:text-base leading-relaxed pt-0.5" style={{ color: tokens.text }}>
                  {step}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-[15px] sm:text-base leading-relaxed font-medium max-w-2xl" style={{ color: tokens.text }}>
            {t.varProcessClosing}
          </p>
        </SectionShell>

        {/* 5. Efter affären */}
        <SectionShell title={t.efterAffarenTitle} bg="bgAlt" id="efter-affaren" sectionIndex={5}>
          <div className="max-w-2xl">
            <div className="space-y-3 mb-10 sm:mb-12" style={{ color: tokens.text }}>
              <p className="text-[15px] sm:text-base leading-relaxed">{t.efterAffarenIngressP1}</p>
              <p className="text-[15px] sm:text-base leading-relaxed">{t.efterAffarenIngressP2}</p>
              <p className="text-[15px] sm:text-base leading-relaxed">{t.efterAffarenIngressP3}</p>
            </div>
            <div className="space-y-8 sm:space-y-10">
              <NarrativeBlock title={t.eaNarrative1Title} body={t.eaNarrative1Body} />
              <NarrativeBlock title={t.eaNarrative2Title} body={t.eaNarrative2Body} />
              <NarrativeBlock title={t.eaNarrative3Title} body={t.eaNarrative3Body} />
              <NarrativeBlock title={t.eaNarrative4Title} body={t.eaNarrative4Body} />
            </div>
            <p className="mt-10 sm:mt-12 text-[15px] sm:text-base leading-relaxed font-medium" style={{ color: tokens.text }}>
              {t.efterAffarenClosing}
            </p>
          </div>
        </SectionShell>

        {/* 6. Kontakt */}
        <SectionShell title={t.kontaktSectionTitle} id="kontakt" sectionIndex={6}>
          <p className="text-[15px] sm:text-base leading-relaxed mb-6 max-w-2xl" style={{ color: tokens.text }}>
            {t.kontaktBody}
          </p>
          <p className="text-sm font-semibold mb-4" style={{ color: tokens.text }}>
            {t.kontaktDuKan}
          </p>
          <div
            className="mb-8 flex flex-col md:grid md:grid-cols-3 md:gap-6"
            style={{ ["--kontakt-card-bg"]: tokens.bgAlt } as React.CSSProperties}
          >
            {CONTACT_CTA.map((c) => (
              <div
                key={c.email}
                className="py-5 max-md:border-b max-md:last:border-b-0 md:border md:rounded-xl md:p-6 md:[background-color:var(--kontakt-card-bg)]"
                style={{ borderColor: tokens.border }}
              >
                <p className="font-semibold mb-2 md:mb-3 text-[15px]" style={{ color: tokens.text }}>
                  {c.name}
                </p>
                <div className="flex flex-col gap-1.5 text-[15px] leading-relaxed">
                  <a
                    href={`mailto:${c.email}`}
                    className="text-profile-accent hover:underline focus:outline-none focus:ring-2 focus:ring-profile-accent/30 rounded w-fit"
                  >
                    {c.email}
                  </a>
                  <a
                    href={`tel:${c.phone.replace(/\s|-/g, "")}`}
                    className="text-profile-accent hover:underline focus:outline-none focus:ring-2 focus:ring-profile-accent/30 rounded w-fit"
                  >
                    {c.phone}
                  </a>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[15px] leading-relaxed" style={{ color: tokens.text }}>
            {t.kontaktFooter}
          </p>
        </SectionShell>
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

/**
 * Aurora demos: Nivo palette + Option A, B, C (with a bit more color punch).
 */

"use client";

import { motion } from "framer-motion";
import React from "react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { Sparkles } from "lucide-react";
import { NIVO_AURORA_COLORS, NIVO_CORE } from "@/lib/nivoPalette";

/** Option A — Soft Pastel, a bit more punch */
const AURORA_A = ["#C5DAFF", "#B8EDDC", "#FFD4B5", "#DCC8FF", "#FFC0D4"];

/** Option B — Nordic Tech, a bit more punch */
const AURORA_B = ["#B5DCFF", "#A8F0E6", "#C8CAFF", "#1D4ED8", "#078F88"];

/** Option C — Warm Editorial, a bit more punch */
const AURORA_C = ["#FFE59E", "#FFCCA8", "#FFB8C4", "#C5D9C0"];

interface AuroraSectionProps {
  sectionId: string;
  title: string;
  subtitle: string;
  auroraColors: readonly string[];
}

function AuroraSection({ sectionId, title, subtitle, auroraColors }: AuroraSectionProps) {
  return (
    <section id={sectionId} className="relative">
      <AuroraBackground
        auroraColors={[...auroraColors]}
        showRadialGradient
        className="!min-h-[85vh]"
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
          className="relative flex flex-col gap-4 items-center justify-center px-4 text-center"
        >
          <div
            className="text-3xl md:text-6xl font-bold dark:text-white"
            style={{ color: NIVO_CORE.jetBlack }}
          >
            {title}
          </div>
          <div className="font-extralight text-base md:text-2xl py-2 dark:text-neutral-200 opacity-90">
            {subtitle}
          </div>
          <button
            type="button"
            className="rounded-md w-fit px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: NIVO_CORE.jetBlack }}
          >
            Debug now
          </button>
        </motion.div>
      </AuroraBackground>
    </section>
  );
}

const AURORA_SECTIONS: AuroraSectionProps[] = [
  {
    sectionId: "nivo",
    title: "Nivo — current palette",
    subtitle: "Jet Black, Gray Olive, Platinum + olive-muted, sage-muted, warm paper, cool surface, deep teal.",
    auroraColors: NIVO_AURORA_COLORS,
  },
  {
    sectionId: "option-a",
    title: "Option A — Soft Pastel",
    subtitle: "Sky, Mint, Peach, Lilac, Blush — a bit more punch.",
    auroraColors: AURORA_A,
  },
  {
    sectionId: "option-b",
    title: "Option B — Nordic Tech",
    subtitle: "Ice blue, Fog cyan, Periwinkle, Cobalt, Teal — a bit more punch.",
    auroraColors: AURORA_B,
  },
  {
    sectionId: "option-c",
    title: "Option C — Warm Editorial",
    subtitle: "Butter, Apricot, Rose, Sage — a bit more punch.",
    auroraColors: AURORA_C,
  },
];

export default function ColorAuroraDemos() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur-sm px-4 sm:px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">
          Aurora demos — Nivo + A, B, C
        </h1>
        <nav className="flex items-center gap-2 text-sm">
          <a href="/colors" className="text-gray-500 hover:text-gray-900 underline">
            Palettes
          </a>
          <span className="text-gray-300">|</span>
          <a href="/colors/demos" className="text-gray-500 hover:text-gray-900 underline">
            Bento
          </a>
          <span className="text-gray-300">|</span>
          <a href="#nivo" className="text-gray-600 hover:text-gray-900">Nivo</a>
          <a href="#option-a" className="text-gray-600 hover:text-gray-900">A</a>
          <a href="#option-b" className="text-gray-600 hover:text-gray-900">B</a>
          <a href="#option-c" className="text-gray-600 hover:text-gray-900">C</a>
        </nav>
      </header>

      {AURORA_SECTIONS.map((s) => (
        <AuroraSection
          key={s.sectionId}
          sectionId={s.sectionId}
          title={s.title}
          subtitle={s.subtitle}
          auroraColors={s.auroraColors}
        />
      ))}

      <footer className="border-t border-gray-200 bg-gray-50 dark:bg-gray-900 px-4 py-6 text-center text-sm text-gray-500">
        <Sparkles className="inline-block w-4 h-4 mr-1 -mt-0.5" aria-hidden />
        Nivo color options — Aurora background demos
      </footer>
    </div>
  );
}

/**
 * Animated gradient bento demos: Nivo palette + Option A, B, C (with a bit more color punch).
 */

import React from "react";
import { motion } from "framer-motion";
import { AnimatedGradient } from "@/components/ui/animated-gradient-with-svg";
import { NIVO_BENTO_COLORS, NIVO_CORE } from "@/lib/nivoPalette";

/** Option A — Soft Pastel, a bit more punch */
const OPTION_A = {
  text: NIVO_CORE.jetBlack,
  bg: "#FAFAF7",
  card1: ["#C5DAFF", "#B8EDDC", "#DCC8FF"],
  card2: ["#B8EDDC", "#C5DAFF", "#FFC0D4"],
  card3: ["#FFD4B5", "#DCC8FF", "#FFC0D4"],
  card4: ["#C5DAFF", "#DCC8FF", "#FFC0D4"],
  card5: ["#FFC0D4", "#FFD4B5", "#C5DAFF"],
};

/** Option B — Nordic Tech, a bit more punch */
const OPTION_B = {
  text: NIVO_CORE.jetBlack,
  bg: "#F5F7FA",
  card1: ["#B5DCFF", "#A8F0E6", "#C8CAFF"],
  card2: ["#A8F0E6", "#B5DCFF", "#C8CAFF"],
  card3: ["#C8CAFF", "#B5DCFF", "#A8F0E6"],
  card4: ["#B5DCFF", "#C8CAFF", "#A8F0E6"],
  card5: ["#1D4ED8", "#078F88", "#B5DCFF"],
};

/** Option C — Warm Editorial, a bit more punch */
const OPTION_C = {
  text: NIVO_CORE.jetBlack,
  bg: "#FBF9F4",
  card1: ["#FFE59E", "#FFCCA8", "#C5D9C0"],
  card2: ["#FFCCA8", "#FFB8C4", "#C5D9C0"],
  card3: ["#FFB8C4", "#FFE59E", "#FFCCA8"],
  card4: ["#C5D9C0", "#FFE59E", "#FFCCA8"],
  card5: ["#FFB8C4", "#C5D9C0", "#FFE59E"],
};

type PaletteSet = {
  text: string;
  bg: string;
  card1: readonly string[];
  card2: readonly string[];
  card3: readonly string[];
  card4: readonly string[];
  card5: readonly string[];
};

interface BentoCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  colors: readonly string[];
  delay: number;
  textColor?: string;
}

const BentoCard: React.FC<BentoCardProps> = ({
  title,
  value,
  subtitle,
  colors,
  delay,
  textColor = NIVO_CORE.jetBlack,
}) => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: delay + 0.3,
      },
    },
  };

  const item = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.5 } },
  };

  return (
    <motion.div
      className="relative overflow-hidden h-full min-h-[140px] rounded-xl border border-white/20 shadow-sm"
      style={{ backgroundColor: "rgba(255,255,255,0.5)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay }}
    >
      <AnimatedGradient colors={[...colors]} speed={0.05} blur="medium" />
      <motion.div
        className="relative z-10 p-3 sm:p-5 md:p-8 backdrop-blur-sm"
        style={{ color: textColor }}
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.h3
          className="text-sm sm:text-base md:text-lg font-medium opacity-90"
          variants={item}
        >
          {title}
        </motion.h3>
        <motion.p
          className="text-2xl sm:text-4xl md:text-5xl font-semibold mb-1 mt-1"
          variants={item}
        >
          {value}
        </motion.p>
        {subtitle && (
          <motion.p className="text-sm opacity-80" variants={item}>
            {subtitle}
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  );
};

const bentoCards = [
  { title: "Total Revenue", value: "$1,234,567", subtitle: "15% increase from last month", key: "card1" },
  { title: "New Users", value: 1234, subtitle: "Daily signups", key: "card2" },
  { title: "Conversion Rate", value: "3.45%", subtitle: "0.5% increase from last week", key: "card3" },
  { title: "Active Projects", value: 42, subtitle: "8 completed this month", key: "card4" },
  { title: "Customer Satisfaction", value: "4.8/5", subtitle: "Based on 1,000+ reviews from verified customers across all product categories", key: "card5" },
];

function BentoGrid({ palette, baseDelay = 0 }: { palette: PaletteSet; baseDelay?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 grow">
      <div className="md:col-span-2">
        <BentoCard title={bentoCards[0].title} value={bentoCards[0].value} subtitle={bentoCards[0].subtitle} colors={palette.card1} delay={baseDelay + 0.2} textColor={palette.text} />
      </div>
      <BentoCard title={bentoCards[1].title} value={bentoCards[1].value} subtitle={bentoCards[1].subtitle} colors={palette.card2} delay={baseDelay + 0.4} textColor={palette.text} />
      <BentoCard title={bentoCards[2].title} value={bentoCards[2].value} subtitle={bentoCards[2].subtitle} colors={palette.card3} delay={baseDelay + 0.6} textColor={palette.text} />
      <div className="md:col-span-2">
        <BentoCard title={bentoCards[3].title} value={bentoCards[3].value} subtitle={bentoCards[3].subtitle} colors={palette.card4} delay={baseDelay + 0.8} textColor={palette.text} />
      </div>
      <div className="md:col-span-3">
        <BentoCard title={bentoCards[4].title} value={bentoCards[4].value} subtitle={bentoCards[4].subtitle} colors={palette.card5} delay={baseDelay + 1} textColor={palette.text} />
      </div>
    </div>
  );
}

const SECTIONS: { id: string; title: string; subtitle: string; palette: PaletteSet }[] = [
  { id: "nivo", title: "Nivo", subtitle: "Core + complementing washes (olive-muted, sage-muted, warm paper, cool surface).", palette: NIVO_BENTO_COLORS },
  { id: "option-a", title: "Option A — Soft Pastel", subtitle: "Sky, Mint, Peach, Lilac, Blush — a bit more punch.", palette: OPTION_A },
  { id: "option-b", title: "Option B — Nordic Tech", subtitle: "Ice blue, Fog cyan, Periwinkle, Cobalt, Teal — a bit more punch.", palette: OPTION_B },
  { id: "option-c", title: "Option C — Warm Editorial", subtitle: "Butter, Apricot, Rose, Sage — a bit more punch.", palette: OPTION_C },
];

export default function ColorDemos() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="border-b border-gray-200 bg-white px-4 sm:px-6 py-6">
        <h1 className="text-2xl font-bold text-gray-900">Nivo color demos — pastel bento</h1>
        <p className="text-gray-600 mt-1">
          Nivo palette + Option A, B, C. Options use slightly punchier tints.
        </p>
        <a href="/colors" className="inline-block mt-3 text-sm text-gray-500 hover:text-gray-900 underline">
          ← Back to color palettes
        </a>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-14">
        {SECTIONS.map((section, i) => (
          <section key={section.id} id={section.id}>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">{section.title}</h2>
            <p className="text-sm text-gray-600 mb-4">{section.subtitle}</p>
            <div
              className="rounded-2xl p-4 sm:p-6 min-h-[480px]"
              style={{ backgroundColor: section.palette.bg }}
            >
              <BentoGrid palette={section.palette} baseDelay={i * 0.1} />
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

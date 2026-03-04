"use client";

import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
  /** Custom colors for the aurora gradient (e.g. Nivo Option A/B/C palette). When set, overrides default blue/indigo/violet. */
  auroraColors?: string[];
}

const defaultAuroraGradient =
  "repeating-linear-gradient(100deg,#3b82f6_10%,#818cf8_15%,#93c5fd_20%,#c4b5fd_25%,#60a5fa_30%)";

function buildAuroraGradient(colors: string[]): string {
  if (colors.length === 0) return defaultAuroraGradient;
  const stops = colors
    .map((c, i) => {
      const pct = 10 + (i * 80) / Math.max(1, colors.length - 1);
      return `${c} ${Math.round(pct)}%`;
    })
    .join(",");
  return `repeating-linear-gradient(100deg,${stops})`;
}

export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  auroraColors,
  style,
  ...props
}: AuroraBackgroundProps) => {
  const auroraGradient = auroraColors
    ? buildAuroraGradient(auroraColors)
    : defaultAuroraGradient;

  return (
    <main>
      <div
        className={cn(
          "relative flex flex-col h-full min-h-[100vh] items-center justify-center bg-zinc-50 dark:bg-zinc-900 text-slate-950 dark:text-slate-50 transition-bg",
          className
        )}
        style={style}
        {...props}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div
            className={cn(
              `
            [--white-gradient:repeating-linear-gradient(100deg,var(--white)_0%,var(--white)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--white)_16%)]
            dark:[--dark-gradient:repeating-linear-gradient(100deg,var(--black)_0%,var(--black)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--black)_16%)]
            [background-image:var(--white-gradient),var(--aurora)]
            dark:[background-image:var(--dark-gradient),var(--aurora)]
            [background-size:300%,_200%]
            [background-position:50%_50%,50%_50%]
            filter blur-[10px] invert dark:invert-0
            after:content-[""] after:absolute after:inset-0 after:[background-image:var(--white-gradient),var(--aurora)]
            after:dark:[background-image:var(--dark-gradient),var(--aurora)]
            after:[background-size:200%,_100%]
            after:animate-aurora after:[background-attachment:fixed] after:mix-blend-difference
            pointer-events-none
            absolute -inset-[10px] opacity-50 will-change-transform
            `,
              showRadialGradient &&
                "[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,var(--transparent)_70%)]"
            )}
            style={
              {
                "--aurora": auroraGradient,
                "--white": "#fff",
                "--black": "#000",
                "--transparent": "transparent",
              } as React.CSSProperties
            }
          />
        </div>
        {children}
      </div>
    </main>
  );
};

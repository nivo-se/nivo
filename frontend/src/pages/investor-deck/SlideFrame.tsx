import React from "react";

export interface SlideFrameProps {
  children: React.ReactNode;
  /** Section name for optional label (e.g. "Introduction") */
  sectionLabel?: string;
  /** Slide number shown in corner */
  slideNum: number;
  /** Background: "surface" (white) or "bg" (page grey) */
  variant?: "surface" | "bg";
  /** Optional extra class for the outer 16:9 container */
  className?: string;
}

/**
 * SlideFrame enforces a strict 16:9 aspect-ratio canvas for each pitch deck slide.
 * Content is placed in an inner padded area that scales with viewport (clamp).
 * Use this wrapper for every slide so the deck feels like a sequence of frames, not a long page.
 *
 * - Desktop: slides are centered with max-width, 16:9 preserved.
 * - Mobile: full width with safe padding, still 16:9.
 * - Content must fit inside the frame; avoid overflow (simplify layout or copy if needed).
 */
export function SlideFrame({
  children,
  sectionLabel,
  slideNum,
  variant = "surface",
  className = "",
}: SlideFrameProps) {
  const bgClass = variant === "surface" ? "bg-deck-surface" : "bg-deck-bg";

  return (
    <div
      className={`w-full max-w-[min(100%,1280px)] mx-auto aspect-[16/9] rounded-lg border border-deck-border overflow-hidden shadow-[var(--deck-shadow-slide)] ${bgClass} ${className}`}
      style={{
        // Ensure aspect-ratio is enforced when used inside flex/grid
        minHeight: 0,
      }}
    >
      <div className="relative w-full h-full flex flex-col min-h-0">
        {/* Inner padded area: padding scales via CSS variables; extra right padding for badge */}
        <div
          className="flex-1 flex flex-col min-h-0 overflow-hidden [&>*]:flex-1 [&>*]:min-h-0"
          style={{
            padding: "var(--deck-slide-padding-y) var(--deck-slide-padding-x)",
            paddingRight: "calc(var(--deck-slide-padding-x) + 4rem)",
            gap: "var(--deck-slide-gap)",
          }}
        >
          {children}
        </div>

        {/* Slide number + optional section label */}
        <div
          className="absolute top-[var(--deck-slide-padding-y)] right-[var(--deck-slide-padding-x)] flex items-center gap-2 pointer-events-none"
          style={{ padding: 0 }}
        >
          {sectionLabel && (
            <span className="text-xs font-medium text-deck-accent/80 uppercase tracking-wider hidden sm:inline">
              {sectionLabel}
            </span>
          )}
          <span className="text-sm font-semibold text-deck-accent bg-deck-accent/10 border border-deck-accent-border rounded px-2.5 py-1 tabular-nums">
            {slideNum}
          </span>
        </div>
      </div>
    </div>
  );
}

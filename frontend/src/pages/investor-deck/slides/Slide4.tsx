import { Filter, Database, Target, Search } from "lucide-react";

export function Slide4() {
  const segPoints = ["Revenue SEK 50–200m", "Stable economics", "Margin stagnation", "Niche positioning"];
  const intelPoints = ["Products & services", "Customer segments", "Go-to-market", "Pricing", "Operational signals"];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-[var(--deck-slide-gap)]">
      <div className="flex-shrink-0 space-y-0.5">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-deck-fg">
          Sourcing Engine
        </h1>
        <p className="text-xs sm:text-sm text-deck-accent leading-snug">
          Disciplined pipeline through data-driven analysis
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 flex-1 min-h-0">
        <div className="bg-deck-surface border border-deck-border rounded-lg p-2.5 sm:p-3 shadow-[var(--deck-shadow-card)] flex flex-col min-h-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-deck-accent/10 border border-deck-accent-border flex items-center justify-center flex-shrink-0">
              <Filter className="w-4 h-4 text-deck-accent" />
            </div>
            <h3 className="text-xs sm:text-sm font-semibold text-deck-fg">Systematic Segmentation</h3>
          </div>
          <p className="text-[10px] sm:text-xs text-deck-fg mt-1.5 leading-snug">Swedish SME universe, target size band.</p>
          <ul className="space-y-1 mt-2">
            {segPoints.map((p) => (
              <li key={p} className="flex items-center gap-2 text-[10px] sm:text-xs text-deck-fg/80">
                <span className="w-1 h-1 rounded-full bg-deck-accent flex-shrink-0" />
                {p}
              </li>
            ))}
          </ul>
          <div className="pt-2 mt-auto border-t border-deck-border flex items-center gap-1.5">
            <Target className="w-4 h-4 text-deck-accent flex-shrink-0" />
            <span className="text-[10px] sm:text-xs font-semibold text-deck-accent">Output: Ranked Target 100</span>
          </div>
        </div>
        <div className="bg-deck-surface border border-deck-border rounded-lg p-2.5 sm:p-3 shadow-[var(--deck-shadow-card)] flex flex-col min-h-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-deck-accent/10 border border-deck-accent-border flex items-center justify-center flex-shrink-0">
              <Search className="w-4 h-4 text-deck-accent" />
            </div>
            <h3 className="text-xs sm:text-sm font-semibold text-deck-fg">Outside-In Intelligence</h3>
          </div>
          <p className="text-[10px] sm:text-xs text-deck-fg mt-1.5 leading-snug">Before engagement we analyse:</p>
          <ul className="space-y-1 mt-2">
            {intelPoints.map((p) => (
              <li key={p} className="flex items-center gap-2 text-[10px] sm:text-xs text-deck-fg/80">
                <span className="w-1 h-1 rounded-full bg-deck-accent flex-shrink-0" />
                {p}
              </li>
            ))}
          </ul>
          <p className="text-[10px] sm:text-xs text-deck-accent font-semibold mt-auto pt-2 leading-snug">
            Informed dialogue and disciplined entry.
          </p>
        </div>
      </div>
      <div className="flex-shrink-0 bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2 sm:p-2.5 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5">
            <Database className="w-4 h-4 text-deck-accent flex-shrink-0" />
            <span className="text-xs text-deck-fg font-medium">Universe</span>
          </div>
          <span className="text-deck-accent">→</span>
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-deck-accent flex-shrink-0" />
            <span className="text-xs text-deck-fg font-medium">Filtering</span>
          </div>
          <span className="text-deck-accent">→</span>
          <div className="flex items-center gap-1.5">
            <Search className="w-4 h-4 text-deck-accent flex-shrink-0" />
            <span className="text-xs text-deck-fg font-medium">Research</span>
          </div>
          <span className="text-deck-accent">→</span>
          <div className="flex items-center gap-1.5">
            <Target className="w-4 h-4 text-deck-accent flex-shrink-0" />
            <span className="text-xs text-deck-fg font-medium">Targets</span>
          </div>
        </div>
      </div>
    </div>
  );
}

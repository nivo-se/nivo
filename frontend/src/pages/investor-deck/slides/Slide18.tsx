import { TrendingUp } from "lucide-react";

export function Slide18() {
  const caseStudy = {
    company: "Nordic Industrial Services AB",
    sector: "Facility Maintenance",
    revenue: "SEK 45m",
    ebitda: "SEK 4.5m (10%)",
    ev: "SEK 27m (6.0x)",
    structure: "Equity 20.2m / Debt 6.8m",
  };
  const improvements = [
    { area: "Pricing", action: "Value-based pricing 40% contracts", impact: "+150 bps" },
    { area: "Operations", action: "Digital workflow, dispatch", impact: "+100 bps" },
    { area: "Cost", action: "Consolidated functions, vendors", impact: "+50 bps" },
  ];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-[var(--deck-slide-gap)]">
      <div className="flex-shrink-0 space-y-0.5">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-deck-fg">Case Study (Illustrative)</h1>
        <p className="text-xs sm:text-sm text-deck-accent leading-snug">How operational improvements drive returns</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0">
        <div className="bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2">
          <p className="text-[10px] font-semibold text-deck-accent uppercase">Company</p>
          <p className="text-xs font-bold text-deck-fg leading-tight">{caseStudy.company}</p>
          <p className="text-[10px] text-deck-fg/70">{caseStudy.sector}</p>
        </div>
        <div className="bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2">
          <p className="text-[10px] font-semibold text-deck-accent uppercase">Entry</p>
          <p className="text-xs text-deck-fg">Rev {caseStudy.revenue}</p>
          <p className="text-xs text-deck-fg">EBITDA {caseStudy.ebitda}</p>
        </div>
        <div className="bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2 sm:col-span-2">
          <p className="text-[10px] font-semibold text-deck-accent uppercase">Valuation</p>
          <p className="text-xs font-bold text-deck-fg">{caseStudy.ev}</p>
          <p className="text-[10px] text-deck-fg/70">{caseStudy.structure}</p>
        </div>
      </div>
      <div className="flex-1 min-h-0 bg-deck-surface border border-deck-border rounded-lg p-2 sm:p-2.5 shadow-[var(--deck-shadow-card)] overflow-auto">
        <h3 className="text-xs font-semibold text-deck-fg mb-1.5">Value Creation (24 mo)</h3>
        <div className="space-y-2">
          {improvements.map((imp, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 py-1.5 border-b border-deck-border last:border-0 text-[10px] sm:text-xs">
              <span className="font-semibold text-deck-accent">{imp.area}</span>
              <span className="text-deck-fg/80 sm:col-span-2">{imp.action}</span>
              <span className="font-bold text-deck-accent">{imp.impact}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-shrink-0 bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-deck-accent flex-shrink-0" />
        <p className="text-[10px] sm:text-xs text-deck-fg leading-snug">Operational improvements compound into equity value. Exit via strategic sale or secondary.</p>
      </div>
    </div>
  );
}

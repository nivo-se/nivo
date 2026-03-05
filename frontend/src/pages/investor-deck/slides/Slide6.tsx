import { Building2, CheckCircle2, Eye } from "lucide-react";

export function Slide6() {
  const pipeline = [
    { stage: "Active DD", count: 2, color: "bg-deck-accent" },
    { stage: "Advanced Discussion", count: 5, color: "bg-deck-accent/70" },
    { stage: "Initial Contact", count: 12, color: "bg-deck-accent/40" },
    { stage: "Identified", count: 81, color: "bg-deck-fg/30" },
  ];
  const targets = [
    { name: "Company A", sector: "Industrial", revenue: "SEK 120m", status: "Due Diligence" },
    { name: "Company B", sector: "Business Services", revenue: "SEK 75m", status: "Advanced" },
    { name: "Company C", sector: "Distribution", revenue: "SEK 165m", status: "Due Diligence" },
  ];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-[var(--deck-slide-gap)]">
      <div className="flex-shrink-0 space-y-0.5">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-deck-fg">Pipeline</h1>
        <p className="text-xs sm:text-sm text-deck-accent leading-snug">Target 100 by operational improvement potential</p>
      </div>
      <div className="grid grid-cols-4 gap-2 flex-shrink-0">
        {pipeline.map((item, i) => (
          <div key={i} className="bg-deck-surface border border-deck-border rounded-lg p-2 shadow-[var(--deck-shadow-card)]">
            <div className="flex items-center justify-between">
              <div className={`w-2 h-2 rounded-full ${item.color}`} />
              <span className="text-lg font-bold text-deck-fg tabular-nums">{item.count}</span>
            </div>
            <p className="text-[10px] sm:text-xs text-deck-accent mt-0.5 leading-tight">{item.stage}</p>
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Eye className="w-4 h-4 text-deck-accent" />
          <h2 className="text-xs sm:text-sm font-semibold text-deck-fg">Active Targets (Illustrative)</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 min-h-0">
          {targets.map((c, i) => (
            <div key={i} className="bg-deck-surface border border-deck-border rounded-lg p-2 shadow-[var(--deck-shadow-card)] flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-deck-accent/10 border border-deck-accent-border flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-deck-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-deck-fg truncate">{c.name}</p>
                <p className="text-[10px] text-deck-accent/80">{c.sector} · {c.revenue}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-deck-accent flex-shrink-0" />
                  <span className="text-[10px] font-medium text-deck-accent">{c.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[10px] sm:text-xs text-deck-accent text-center flex-shrink-0">Names anonymized. All fit selection criteria.</p>
    </div>
  );
}

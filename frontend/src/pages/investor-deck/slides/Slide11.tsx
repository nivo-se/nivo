import { Cpu, Gauge, FileBarChart, Workflow } from "lucide-react";

export function Slide11() {
  const areas = [
    { icon: Workflow, title: "Workflow Digitization", detail: "Digital workflows replace manual scheduling/reporting.", impact: "Cycle times −15–25%" },
    { icon: FileBarChart, title: "Reporting", detail: "Monthly KPI packs, margin by customer/line.", impact: "Close −2–4 weeks" },
    { icon: Gauge, title: "Commercial Control", detail: "Price corridors, win/loss, discount gates.", impact: "Gross margin +100–200 bps" },
  ];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-[var(--deck-slide-gap)]">
      <div className="flex-shrink-0 space-y-0.5">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-deck-fg">AI Enablement</h1>
        <p className="text-xs sm:text-sm text-deck-accent leading-snug">Execution bottlenecks, not speculative bets</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 flex-1 min-h-0">
        {areas.map((a, i) => {
          const Icon = a.icon;
          return (
            <div key={i} className="bg-deck-surface border border-deck-border rounded-lg p-2 sm:p-2.5 shadow-[var(--deck-shadow-card)] flex flex-col">
              <div className="w-8 h-8 rounded-lg bg-deck-accent/10 border border-deck-accent-border flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-deck-accent" />
              </div>
              <h3 className="text-xs font-semibold text-deck-fg mt-1">{a.title}</h3>
              <p className="text-[10px] text-deck-fg/80 leading-snug mt-0.5">{a.detail}</p>
              <p className="text-[10px] font-semibold text-deck-accent mt-1 pt-1 border-t border-deck-border">{a.impact}</p>
            </div>
          );
        })}
      </div>
      <div className="flex-shrink-0 bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2 sm:p-2.5 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-deck-accent/20 border border-deck-accent-border flex items-center justify-center flex-shrink-0">
          <Cpu className="w-4 h-4 text-deck-accent" />
        </div>
        <p className="text-[10px] sm:text-xs text-deck-fg leading-snug">AI only where outcomes are measurable (throughput, margin, speed). Capacity multiplier inside a disciplined system.</p>
      </div>
      <p className="text-[10px] sm:text-xs text-deck-fg font-semibold text-center flex-shrink-0">AI supports execution; it does not replace discipline.</p>
    </div>
  );
}

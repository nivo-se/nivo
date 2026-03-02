import { Search, FileText, MessageSquare, CheckCircle } from "lucide-react";

export function Slide15() {
  const phases = [
    { icon: Search, title: "Sourcing", activities: ["Direct outreach", "Broker network", "Own playbook"] },
    { icon: FileText, title: "Due Diligence", activities: ["Quality of earnings", "Ops improvement ID", "Management assessment"] },
    { icon: MessageSquare, title: "Negotiation", activities: ["Structure", "Management alignment", "Risk provisions"] },
    { icon: CheckCircle, title: "Execution", activities: ["Day 1 plan", "First 100 days", "Value creation"] },
  ];
  const pipeline = [
    { label: "Initial Screen", count: "12", sub: "Under review" },
    { label: "Due Diligence", count: "2", sub: "Active" },
    { label: "Negotiation", count: "1", sub: "LOI+" },
  ];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-[var(--deck-slide-gap)]">
      <div className="flex-shrink-0 space-y-0.5">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-deck-fg">Investment Process</h1>
        <p className="text-xs sm:text-sm text-deck-accent leading-snug">Sourcing to value creation</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 min-h-0">
        {phases.map((p, i) => {
          const Icon = p.icon;
          return (
            <div key={i} className="bg-deck-surface border border-deck-border rounded-lg p-2 sm:p-2.5 shadow-[var(--deck-shadow-card)] flex flex-col">
              <div className="w-8 h-8 rounded-lg bg-deck-accent/10 border border-deck-accent-border flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-deck-accent" />
              </div>
              <h3 className="text-xs font-semibold text-deck-fg mt-1">{p.title}</h3>
              <ul className="mt-1 space-y-0.5">
                {p.activities.map((a, j) => (
                  <li key={j} className="text-[10px] text-deck-fg/80 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-deck-accent flex-shrink-0" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="flex-shrink-0 bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2 sm:p-2.5">
        <h3 className="text-xs font-semibold text-deck-fg mb-1.5">Pipeline Status</h3>
        <div className="grid grid-cols-3 gap-2">
          {pipeline.map((p) => (
            <div key={p.label} className="text-center">
              <p className="text-[10px] font-semibold text-deck-accent uppercase">{p.label}</p>
              <p className="text-lg font-bold text-deck-fg tabular-nums">{p.count}</p>
              <p className="text-[10px] text-deck-fg/70">{p.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

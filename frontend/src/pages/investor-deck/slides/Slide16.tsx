import { TrendingUp, Globe, Building2, Users } from "lucide-react";

export function Slide16() {
  const metrics = [
    { icon: Building2, metric: "~15,000", label: "SMEs in target band" },
    { icon: Users, metric: "Owner-managed", label: "Traditional structures" },
    { icon: TrendingUp, metric: "Under-digitised", label: "Process/systems gap" },
    { icon: Globe, metric: "Stable markets", label: "B2B services & manufacturing" },
  ];
  const advantage = ["Rule of law, transparency", "Educated workforce", "Generational transitions", "Limited PE &lt;200m"];
  const gap = ["Excel-based, no modern systems", "Inconsistent pricing", "Limited visibility"];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-[var(--deck-slide-gap)]">
      <div className="flex-shrink-0 space-y-0.5">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-deck-fg">Nordic Market Context</h1>
        <p className="text-xs sm:text-sm text-deck-accent leading-snug">Large, underserved opportunity</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={i} className="bg-deck-surface border border-deck-border rounded-lg p-2 shadow-[var(--deck-shadow-card)]">
              <div className="w-7 h-7 rounded-lg bg-deck-accent/10 border border-deck-accent-border flex items-center justify-center">
                <Icon className="w-4 h-4 text-deck-accent" />
              </div>
              <p className="text-sm font-bold text-deck-fg mt-1">{m.metric}</p>
              <p className="text-[10px] text-deck-accent">{m.label}</p>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1 min-h-0">
        <div className="bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2 sm:p-2.5">
          <h3 className="text-xs font-semibold text-deck-fg">Nordic Advantage</h3>
          <ul className="mt-1 space-y-0.5">
            {advantage.map((a, i) => (
              <li key={i} className="text-[10px] text-deck-fg/80 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-deck-accent flex-shrink-0" />
                {a}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-deck-surface border border-deck-border rounded-lg p-2 sm:p-2.5 shadow-[var(--deck-shadow-card)]">
          <h3 className="text-xs font-semibold text-deck-fg">Improvement Gap</h3>
          <ul className="mt-1 space-y-0.5">
            {gap.map((g, i) => (
              <li key={i} className="text-[10px] text-deck-fg/80 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-deck-accent flex-shrink-0" />
                {g}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

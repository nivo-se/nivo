import { Shield, Users, FileText, BarChart } from "lucide-react";

export function Slide13() {
  const governance = [
    { icon: Shield, title: "Legal", items: ["Swedish kommanditbolag", "10y + 2×1y ext.", "GP operational commitment"] },
    { icon: Users, title: "IC", items: ["All deals IC-approved", "Independent members", "Quarterly reviews"] },
    { icon: FileText, title: "Reporting", items: ["Quarterly investor reports", "Portfolio performance", "Value creation milestones"] },
    { icon: BarChart, title: "Alignment", items: ["GP 5% co-invest", "20% carry / 8% pref", "No fee on uncalled"] },
  ];
  const terms = [
    { label: "Target", value: "SEK 1,000m" },
    { label: "Min", value: "SEK 5m" },
    { label: "Mgmt fee", value: "2.0%" },
    { label: "Carry / Pref", value: "20% / 8%" },
  ];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-[var(--deck-slide-gap)]">
      <div className="flex-shrink-0 space-y-0.5">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-deck-fg">Fund Structure & Governance</h1>
        <p className="text-xs sm:text-sm text-deck-accent leading-snug">Institutional framework, LP-aligned</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 min-h-0">
        {governance.map((g, i) => {
          const Icon = g.icon;
          return (
            <div key={i} className="bg-deck-surface border border-deck-border rounded-lg p-2 sm:p-2.5 shadow-[var(--deck-shadow-card)] flex flex-col">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-lg bg-deck-accent/10 border border-deck-accent-border flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-deck-accent" />
                </div>
                <h3 className="text-xs font-semibold text-deck-fg">{g.title}</h3>
              </div>
              <ul className="mt-1 space-y-0.5">
                {g.items.map((item, j) => (
                  <li key={j} className="text-[10px] text-deck-fg/80 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-deck-accent flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="flex-shrink-0 bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2 sm:p-2.5">
        <h3 className="text-xs font-semibold text-deck-fg mb-1.5">Key Terms</h3>
        <div className="grid grid-cols-4 gap-2">
          {terms.map((t) => (
            <div key={t.label} className="text-center">
              <p className="text-[10px] font-semibold text-deck-accent uppercase">{t.label}</p>
              <p className="text-sm font-bold text-deck-fg">{t.value}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[10px] sm:text-xs text-deck-fg font-semibold text-center flex-shrink-0">Institutional-quality structure for long-term alignment.</p>
    </div>
  );
}

import { TrendingUp, DollarSign, Cpu } from "lucide-react";

export function Slide9() {
  const playbooks = [
    { icon: TrendingUp, title: "Revenue", items: ["Pricing discipline", "Sales governance", "Retention", "Product mix"] },
    { icon: DollarSign, title: "Margins", items: ["Overhead optimisation", "Working capital", "Procurement", "Cost allocation"] },
    { icon: Cpu, title: "Digital & AI", items: ["Workflow automation", "Reporting", "Data decisions", "AI capacity"] },
  ];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-[var(--deck-slide-gap)]">
      <div className="flex-shrink-0 space-y-0.5">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-deck-fg">Value Creation Playbook</h1>
        <p className="text-xs sm:text-sm text-deck-accent leading-snug">Three operational pillars</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 flex-1 min-h-0">
        {playbooks.map((p, i) => {
          const Icon = p.icon;
          return (
          <div key={i} className="bg-deck-surface border border-deck-border rounded-lg p-2.5 sm:p-3 shadow-[var(--deck-shadow-card)] flex flex-col">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-deck-accent/10 border border-deck-accent-border flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-deck-accent" />
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-deck-fg">{p.title}</h3>
            </div>
            <ul className="mt-2 space-y-0.5">
              {p.items.map((item, j) => (
                <li key={j} className="flex items-center gap-1.5 text-[10px] sm:text-xs text-deck-fg/80">
                  <span className="w-1 h-1 rounded-full bg-deck-accent flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          );
        })}
      </div>
      <div className="flex-shrink-0 bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2 sm:p-2.5 text-center">
        <p className="text-xs sm:text-sm text-deck-fg font-semibold leading-snug">AI increases capacity. Disciplined execution drives margins.</p>
      </div>
    </div>
  );
}

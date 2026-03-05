import { Building2, TrendingDown, Shield } from "lucide-react";

export function Slide8() {
  const criteria = [
    { icon: Building2, title: "Valuation Discipline", items: ["EV/EBITDA 5–7x", "Operational improvement over growth premium", "Stable cash generation"] },
    { icon: TrendingDown, title: "Conservative Leverage", items: ["Debt/Capital <30%", "Net Debt/EBITDA <2x", "Leverage supplements strategy"] },
    { icon: Shield, title: "Financial Guardrails", items: ["Path to 15% ROIC", "12+ months runway", "Capital preservation first"] },
  ];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-[var(--deck-slide-gap)]">
      <div className="flex-shrink-0 space-y-0.5">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-deck-fg">Acquisition Criteria</h1>
        <p className="text-xs sm:text-sm text-deck-accent leading-snug">Valuation and capital structure discipline</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 flex-1 min-h-0">
        {criteria.map((c, i) => (
          <div key={i} className="bg-deck-surface border border-deck-border rounded-lg p-2 sm:p-2.5 shadow-[var(--deck-shadow-card)] flex flex-col">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-deck-accent/10 border border-deck-accent-border flex items-center justify-center flex-shrink-0">
                <c.icon className="w-4 h-4 text-deck-accent" />
              </div>
              <h3 className="text-xs font-semibold text-deck-fg">{c.title}</h3>
            </div>
            <ul className="mt-1.5 space-y-0.5">
              {c.items.map((item, j) => (
                <li key={j} className="flex items-center gap-1.5 text-[10px] sm:text-xs text-deck-fg/80">
                  <span className="w-1 h-1 rounded-full bg-deck-accent flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 flex-shrink-0">
        <div className="bg-deck-surface border border-deck-border rounded-lg p-2 sm:p-2.5 shadow-[var(--deck-shadow-card)]">
          <h3 className="text-xs font-semibold text-deck-fg">Target Profile</h3>
          <div className="space-y-1 mt-1 text-[10px] sm:text-xs">
            <div className="flex justify-between"><span className="text-deck-accent">EV/EBITDA</span><span className="font-semibold text-deck-fg">5–7x</span></div>
            <div className="flex justify-between"><span className="text-deck-accent">Debt/Cap</span><span className="font-semibold text-deck-fg">&lt;30%</span></div>
            <div className="flex justify-between"><span className="text-deck-accent">ROIC</span><span className="font-semibold text-deck-accent">15%</span></div>
          </div>
        </div>
        <div className="bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2 sm:p-2.5">
          <h3 className="text-xs font-semibold text-deck-fg">Example</h3>
          <p className="text-[10px] sm:text-xs text-deck-fg/80 mt-1">EBITDA 10 MSEK → 6x → 60 MSEK. Equity 45 / Debt 15. Conservative, scalable.</p>
        </div>
      </div>
      <p className="text-[10px] sm:text-xs text-deck-fg font-semibold text-center flex-shrink-0">We buy value creation potential, not leverage.</p>
    </div>
  );
}

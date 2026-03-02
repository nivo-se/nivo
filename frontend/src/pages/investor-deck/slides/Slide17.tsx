import { AlertTriangle, TrendingDown, Shield } from "lucide-react";

export function Slide17() {
  const risks = [
    { icon: AlertTriangle, title: "Execution", desc: "Initiatives may take longer/cost more.", mit: ["Proven playbook", "Stress scenarios", "Advisors"] },
    { icon: TrendingDown, title: "Market", desc: "Downturn or sector challenges.", mit: ["Defensive sectors", "3–4 company diversification", "&lt;2x leverage"] },
    { icon: Shield, title: "Key Person", desc: "Founder dependence, transition risk.", mit: ["Retain management", "12–24mo transition", "Process documentation"] },
  ];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-[var(--deck-slide-gap)]">
      <div className="flex-shrink-0 space-y-0.5">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-deck-fg">Risk Factors & Mitigation</h1>
        <p className="text-xs sm:text-sm text-deck-accent leading-snug">Transparent assessment, disciplined mitigation</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 flex-1 min-h-0">
        {risks.map((r, i) => {
          const Icon = r.icon;
          return (
            <div key={i} className="bg-deck-surface border border-deck-border rounded-lg p-2 sm:p-2.5 shadow-[var(--deck-shadow-card)] flex flex-col">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-deck-accent/10 border border-deck-accent-border flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-deck-accent" />
                </div>
                <h3 className="text-xs font-semibold text-deck-fg">{r.title}</h3>
              </div>
              <p className="text-[10px] text-deck-fg/70 mt-1 leading-snug">{r.desc}</p>
              <p className="text-[10px] font-semibold text-deck-accent uppercase mt-1">Mitigation</p>
              <ul className="space-y-0.5 mt-0.5">
                {r.mit.map((m, j) => (
                  <li key={j} className="text-[10px] text-deck-fg/80 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-deck-accent flex-shrink-0" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="flex-shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2 sm:p-2.5">
          <h3 className="text-xs font-semibold text-deck-fg">Concentration</h3>
          <p className="text-[10px] text-deck-fg/80 mt-0.5">3–4 companies → individual impact. Mitigated by screening, diversity, deep involvement.</p>
        </div>
        <div className="bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2 sm:p-2.5">
          <h3 className="text-xs font-semibold text-deck-fg">Liquidity</h3>
          <p className="text-[10px] text-deck-fg/80 mt-0.5">SME exits can be illiquid. Build for strategics; flexibility on timing; ROIC justifies valuation.</p>
        </div>
      </div>
      <p className="text-[10px] sm:text-xs text-deck-fg font-semibold text-center flex-shrink-0">Risks managed through discipline, transparency, operational excellence.</p>
    </div>
  );
}

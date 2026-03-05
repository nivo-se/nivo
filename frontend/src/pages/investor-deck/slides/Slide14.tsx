import { Target, Clock, TrendingUp } from "lucide-react";

export function Slide14() {
  const useOfFunds = [
    { category: "Acquisitions (3–4)", amount: "SEK 750m", pct: 75 },
    { category: "Operational", amount: "SEK 150m", pct: 15 },
    { category: "Working capital", amount: "SEK 100m", pct: 10 },
  ];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-[var(--deck-slide-gap)]">
      <div className="flex-shrink-0 space-y-0.5">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-deck-fg">Capital Raise</h1>
        <p className="text-xs sm:text-sm text-deck-accent leading-snug">SEK 1,000m — compounding foundation</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 flex-1 min-h-0">
        <div className="space-y-2">
          <div className="bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2.5 sm:p-3">
            <p className="text-[10px] font-semibold text-deck-accent uppercase">Fund Size</p>
            <p className="text-lg font-bold text-deck-fg">SEK 1,000m</p>
            <div className="mt-2 pt-2 border-t border-deck-accent/20 space-y-1 text-[10px] sm:text-xs">
              <div className="flex justify-between"><span className="text-deck-accent">Min investment</span><span className="text-deck-fg font-semibold">SEK 5m</span></div>
              <div className="flex justify-between"><span className="text-deck-accent">Target close</span><span className="text-deck-fg font-semibold">Q2 2026</span></div>
            </div>
          </div>
          <div className="bg-deck-surface border border-deck-border rounded-lg p-2 sm:p-2.5 shadow-[var(--deck-shadow-card)] flex items-start gap-2">
            <Target className="w-4 h-4 text-deck-accent flex-shrink-0 mt-0.5" />
            <p className="text-[10px] sm:text-xs text-deck-fg leading-snug">Seeking 2–3 anchors. Strong pipeline. Team committed.</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="bg-deck-surface border border-deck-border rounded-lg p-2.5 sm:p-3 shadow-[var(--deck-shadow-card)]">
            <h3 className="text-xs font-semibold text-deck-fg">Use of Funds</h3>
            {useOfFunds.map((item, i) => (
              <div key={i} className="mt-1.5 flex justify-between items-center gap-2">
                <span className="text-[10px] sm:text-xs text-deck-fg">{item.category}</span>
                <span className="text-xs font-semibold text-deck-fg tabular-nums">{item.amount}</span>
              </div>
            ))}
            <div className="flex gap-1 mt-1.5 h-1.5 rounded-full overflow-hidden bg-deck-fg/10">
              {useOfFunds.map((item, i) => (
                <div key={i} className="h-full bg-deck-accent rounded-full" style={{ width: `${item.pct}%` }} />
              ))}
            </div>
          </div>
          <div className="bg-deck-surface border border-deck-border rounded-lg p-2 sm:p-2.5 shadow-[var(--deck-shadow-card)] flex items-start gap-2">
            <Clock className="w-4 h-4 text-deck-accent flex-shrink-0 mt-0.5" />
            <div className="text-[10px] sm:text-xs space-y-0.5">
              <div className="flex justify-between"><span className="text-deck-accent">Deploy</span><span className="text-deck-fg">18–24 mo</span></div>
              <div className="flex justify-between"><span className="text-deck-accent">Hold</span><span className="text-deck-fg">5–7 y</span></div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2 sm:p-2.5 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-deck-accent flex-shrink-0" />
        <p className="text-[10px] sm:text-xs text-deck-fg leading-snug">Target gross IRR <span className="font-semibold text-deck-accent">19–23%</span>. Margin expansion + debt paydown; flat-to-modest multiples.</p>
      </div>
    </div>
  );
}

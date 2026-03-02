import { TrendingUp, RefreshCw, DollarSign } from "lucide-react";

export function Slide21() {
  const exits = [
    { icon: TrendingUp, title: "Strategic Sale", desc: "Sale to strategic buyer", tag: "Primary" },
    { icon: RefreshCw, title: "Secondary", desc: "Larger PE or growth equity", tag: "Secondary" },
    { icon: DollarSign, title: "Recap", desc: "Dividend recap, retain control", tag: "Alternative" },
  ];
  const timeline = [
    { period: "Y1–2", text: "Margin expansion 200–300 bps" },
    { period: "Y3–4", text: "Cash conversion, debt reduction" },
    { period: "Y5–6", text: "ROIC 15%+, strategic position" },
    { period: "Y7+", text: "Exit or recap" },
  ];
  const returns = [
    { label: "Gross IRR", value: "19–23%" },
    { label: "Net IRR", value: "15–18%" },
    { label: "MOIC", value: "2.2–2.8x" },
  ];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-[var(--deck-slide-gap)]">
      <div className="flex-shrink-0 space-y-0.5">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-deck-fg">Exit Strategy & Returns</h1>
        <p className="text-xs sm:text-sm text-deck-accent leading-snug">Value realization through multiple pathways</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-shrink-0">
        {exits.map((e, i) => {
          const Icon = e.icon;
          return (
            <div key={i} className="bg-deck-surface border border-deck-border rounded-lg p-2 sm:p-2.5 shadow-[var(--deck-shadow-card)]">
              <div className="w-8 h-8 rounded-lg bg-deck-accent/10 border border-deck-accent-border flex items-center justify-center">
                <Icon className="w-4 h-4 text-deck-accent" />
              </div>
              <h3 className="text-xs font-semibold text-deck-fg mt-1">{e.title}</h3>
              <p className="text-[10px] text-deck-fg/70 leading-snug">{e.desc}</p>
              <p className="text-[10px] font-semibold text-deck-accent uppercase mt-1">{e.tag}</p>
            </div>
          );
        })}
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-2">
        <div className="bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2 sm:p-2.5">
          <h3 className="text-xs font-semibold text-deck-fg mb-1.5">Timeline</h3>
          {timeline.map((t) => (
            <div key={t.period} className="flex justify-between gap-2 py-0.5 text-[10px] sm:text-xs">
              <span className="font-semibold text-deck-accent">{t.period}</span>
              <span className="text-deck-fg/80">{t.text}</span>
            </div>
          ))}
        </div>
        <div className="bg-deck-surface border border-deck-border rounded-lg p-2 sm:p-2.5 shadow-[var(--deck-shadow-card)]">
          <h3 className="text-xs font-semibold text-deck-fg mb-1.5">Target Returns</h3>
          {returns.map((r) => (
            <div key={r.label} className="flex justify-between py-0.5 text-[10px] sm:text-xs">
              <span className="text-deck-accent">{r.label}</span>
              <span className="font-semibold text-deck-fg">{r.value}</span>
            </div>
          ))}
          <p className="text-[10px] text-deck-fg/70 mt-1.5 pt-1 border-t border-deck-border">Drivers: margin 45%, revenue 35%, debt paydown 20%</p>
        </div>
      </div>
      <p className="text-[10px] sm:text-xs text-deck-fg font-semibold text-center flex-shrink-0">Returns from operations, cash conversion, disciplined structure.</p>
    </div>
  );
}

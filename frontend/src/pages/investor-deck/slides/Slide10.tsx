import { TrendingUp, Database, Layers, Zap } from "lucide-react";

export function Slide10() {
  const advantages = [
    { icon: Database, title: "Data → Benchmarks", desc: "Each acquisition adds operational data and benchmarks for future deals." },
    { icon: Layers, title: "Benchmarks → Decisions", desc: "Value creation approaches refined from portfolio performance." },
    { icon: Zap, title: "Decisions → Execution", desc: "Expertise deepens; implementation becomes faster." },
  ];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-[var(--deck-slide-gap)]">
      <div className="flex-shrink-0 space-y-0.5">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-deck-fg">The Compounding Advantage</h1>
        <p className="text-xs sm:text-sm text-deck-accent leading-snug">Each acquisition strengthens the platform</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 flex-1 min-h-0">
        {advantages.map((a, i) => {
          const Icon = a.icon;
          return (
            <div key={i} className="bg-deck-surface border border-deck-border rounded-lg p-2.5 sm:p-3 shadow-[var(--deck-shadow-card)] flex flex-col">
              <div className="w-9 h-9 rounded-lg bg-deck-accent/10 border border-deck-accent-border flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-deck-accent" />
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-deck-fg mt-1.5">{a.title}</h3>
              <p className="text-[10px] sm:text-xs text-deck-fg/80 leading-snug mt-0.5">{a.desc}</p>
            </div>
          );
        })}
      </div>
      <div className="flex-shrink-0 bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-1"><Database className="w-4 h-4 text-deck-accent" /><span className="text-xs text-deck-fg">Data</span></div>
          <span className="text-deck-accent">→</span>
          <div className="flex items-center gap-1"><Layers className="w-4 h-4 text-deck-accent" /><span className="text-xs text-deck-fg">Benchmarks</span></div>
          <span className="text-deck-accent">→</span>
          <div className="flex items-center gap-1"><TrendingUp className="w-4 h-4 text-deck-accent" /><span className="text-xs text-deck-fg">Decisions</span></div>
          <span className="text-deck-accent">→</span>
          <div className="flex items-center gap-1"><Zap className="w-4 h-4 text-deck-accent" /><span className="text-xs text-deck-fg">Execution</span></div>
        </div>
      </div>
      <p className="text-[10px] sm:text-xs text-deck-fg font-semibold text-center flex-shrink-0">The system becomes more effective with every investment.</p>
    </div>
  );
}

import { TrendingUp, Database, Layers, Zap } from "lucide-react";

export function Slide10() {
  const advantages = [
    {
      icon: Database,
      title: "Data → Benchmarks",
      description: "Each acquisition generates operational data, financial benchmarks, and process insights that improve future acquisitions and value creation.",
    },
    {
      icon: Layers,
      title: "Benchmarks → Improved Decisions",
      description: "Value creation approaches are continuously refined based on actual performance data across portfolio companies.",
    },
    {
      icon: Zap,
      title: "Improved Decisions → Stronger Execution",
      description: "Team expertise deepens with each transaction. Operational patterns become clearer. Implementation becomes faster.",
    },
  ];

  return (
    <div className="h-full flex flex-col justify-center space-y-7">
      {/* Title */}
      <div className="space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-deck-fg">
          The Compounding Advantage
        </h1>
        <p className="text-sm text-deck-accent">
          Each acquisition strengthens the operating platform
        </p>
      </div>

      {/* Advantages Grid */}
      <div className="grid grid-cols-3 gap-6">
        {advantages.map((advantage, index) => (
          <div
            key={index}
            className="bg-deck-surface border border-deck-fg/10 rounded-lg p-8 space-y-6 shadow-sm hover:border-deck-accent/30 transition-colors"
          >
            <div className="w-14 h-14 rounded-lg bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center">
              <advantage.icon className="w-7 h-7 text-deck-accent" />
            </div>
            <h3 className="text-base font-semibold text-deck-fg">{advantage.title}</h3>
            <p className="text-deck-fg/70 leading-relaxed">{advantage.description}</p>
          </div>
        ))}
      </div>

      {/* System Feedback Loop */}
      <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-deck-accent" />
            <span className="text-deck-fg font-medium">Data</span>
          </div>
          <div className="text-deck-accent text-2xl">→</div>
          <div className="flex items-center gap-3">
            <Layers className="w-6 h-6 text-deck-accent" />
            <span className="text-deck-fg font-medium">Benchmarks</span>
          </div>
          <div className="text-deck-accent text-2xl">→</div>
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-deck-accent" />
            <span className="text-deck-fg font-medium">Improved Decisions</span>
          </div>
          <div className="text-deck-accent text-2xl">→</div>
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-deck-accent" />
            <span className="text-deck-fg font-medium">Stronger Execution</span>
          </div>
        </div>
      </div>

      {/* Key Message */}
      <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-6 text-center shadow-sm">
        <p className="text-base text-deck-fg font-semibold">
          The system becomes more effective with every investment.
        </p>
      </div>
    </div>
  );
}

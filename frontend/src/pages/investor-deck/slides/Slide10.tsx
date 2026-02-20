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
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#2E2A2B]">
          The Compounding Advantage
        </h1>
        <p className="text-sm text-[#596152]">
          Each acquisition strengthens the operating platform
        </p>
      </div>

      {/* Advantages Grid */}
      <div className="grid grid-cols-3 gap-6">
        {advantages.map((advantage, index) => (
          <div
            key={index}
            className="bg-white border border-[#2E2A2B]/10 rounded-lg p-8 space-y-6 shadow-sm hover:border-[#596152]/30 transition-colors"
          >
            <div className="w-14 h-14 rounded-lg bg-[#596152]/10 border border-[#596152]/30 flex items-center justify-center">
              <advantage.icon className="w-7 h-7 text-[#596152]" />
            </div>
            <h3 className="text-base font-semibold text-[#2E2A2B]">{advantage.title}</h3>
            <p className="text-[#2E2A2B]/70 leading-relaxed">{advantage.description}</p>
          </div>
        ))}
      </div>

      {/* System Feedback Loop */}
      <div className="bg-[#596152]/10 border border-[#596152]/30 rounded-lg p-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-[#596152]" />
            <span className="text-[#2E2A2B] font-medium">Data</span>
          </div>
          <div className="text-[#596152] text-2xl">→</div>
          <div className="flex items-center gap-3">
            <Layers className="w-6 h-6 text-[#596152]" />
            <span className="text-[#2E2A2B] font-medium">Benchmarks</span>
          </div>
          <div className="text-[#596152] text-2xl">→</div>
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-[#596152]" />
            <span className="text-[#2E2A2B] font-medium">Improved Decisions</span>
          </div>
          <div className="text-[#596152] text-2xl">→</div>
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-[#596152]" />
            <span className="text-[#2E2A2B] font-medium">Stronger Execution</span>
          </div>
        </div>
      </div>

      {/* Key Message */}
      <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-6 text-center shadow-sm">
        <p className="text-base text-[#2E2A2B] font-semibold">
          The system becomes more effective with every investment.
        </p>
      </div>
    </div>
  );
}

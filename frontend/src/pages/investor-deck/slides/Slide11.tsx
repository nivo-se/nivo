import { Cpu, Gauge, FileBarChart, Workflow } from "lucide-react";

export function Slide11() {
  const areas = [
    {
      icon: Workflow,
      title: "Workflow Digitization",
      detail: "Replace manual scheduling and reporting with standardized digital workflows.",
      impact: "Cycle times reduced by 15-25%",
    },
    {
      icon: FileBarChart,
      title: "Reporting Discipline",
      detail: "Monthly KPI packs and margin visibility by customer, service line, and location.",
      impact: "Monthly close accelerated by 2-4 weeks",
    },
    {
      icon: Gauge,
      title: "Commercial Control",
      detail: "Price corridor governance, win/loss analysis, and discount approval gates.",
      impact: "Gross margin uplift of 100-200 bps",
    },
  ];

  return (
    <div className="h-full flex flex-col justify-center space-y-7">
      <div className="space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-deck-fg">
          AI Enablement
        </h1>
        <p className="text-sm text-deck-accent">
          AI is applied to execution bottlenecks, not speculative product bets
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {areas.map((area, index) => (
          <div
            key={index}
            className="bg-deck-surface border border-deck-fg/10 rounded-lg p-8 space-y-5 shadow-sm"
          >
            <div className="w-12 h-12 rounded-lg bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center">
              <area.icon className="w-6 h-6 text-deck-accent" />
            </div>
            <h3 className="text-base font-semibold text-deck-fg">{area.title}</h3>
            <p className="text-deck-fg/80 text-sm leading-relaxed">{area.detail}</p>
            <div className="pt-3 border-t border-deck-fg/10">
              <p className="text-sm font-semibold text-deck-accent">{area.impact}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-8">
        <div className="flex items-start gap-5">
          <div className="w-12 h-12 rounded-lg bg-deck-accent/20 border border-deck-accent/50 flex items-center justify-center flex-shrink-0">
            <Cpu className="w-6 h-6 text-deck-accent" />
          </div>
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-deck-fg">Implementation Principle</h3>
            <p className="text-deck-fg leading-relaxed">
              We deploy AI only where outcomes can be measured on throughput, margin, or reporting speed.
              AI is a capacity multiplier inside a disciplined operating system.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-6 text-center shadow-sm">
        <p className="text-base text-deck-fg font-semibold">
          AI supports execution. It does not replace operating discipline.
        </p>
      </div>
    </div>
  );
}

import { ArrowRight, TrendingUp, BarChart3, RefreshCw, Target, Repeat } from "lucide-react";

/**
 * Slide 5: From Acquisition to Compounding
 * Redesign: Pipeline + Outputs — 5 steps with labels and outcome (Control, Margin, ROIC, Cash, Equity).
 * Fits 16:9 with title, subtitle, steps, and "strengthens with scale" callout.
 */
const steps = [
  { id: "01", title: "Acquire", output: "Control", icon: Target, desc: "Profitable, under-digitised company; stable cash flows." },
  { id: "02", title: "Improve", output: "Margin", icon: TrendingUp, desc: "Pricing, sales discipline, cost structure, reporting." },
  { id: "03", title: "Optimize ROIC", output: "ROIC", icon: BarChart3, desc: "Toward normalized 15% through operational excellence." },
  { id: "04", title: "Reinvest", output: "Cash", icon: RefreshCw, desc: "100% operational cash flow + ~30% leverage." },
  { id: "05", title: "Compound", output: "Equity", icon: Repeat, desc: "Repeat with increasing capability and scale." },
];

export function Slide5() {
  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-[var(--deck-slide-gap)]">
      {/* Title row */}
      <div className="flex-shrink-0 space-y-0.5">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-deck-fg">
          From Acquisition to Compounding
        </h1>
        <p className="text-xs sm:text-sm text-deck-accent leading-snug">
          A repeatable five-step process that strengthens with scale
        </p>
      </div>

      {/* Pipeline: 5 steps + arrows; then outputs row */}
      <div className="flex-1 min-h-0 flex flex-col gap-2 sm:gap-3">
        {/* Steps row */}
        <div className="flex flex-wrap items-stretch justify-center gap-1.5 sm:gap-2">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.id} className="flex items-center gap-0.5 sm:gap-1">
                <div className="bg-deck-surface border border-deck-border rounded-lg p-2 sm:p-2.5 shadow-[var(--deck-shadow-card)] min-w-0 flex-1 flex flex-col items-center text-center">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-deck-accent/10 border border-deck-accent-border flex items-center justify-center flex-shrink-0 mx-auto">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-deck-accent" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-deck-accent mt-1">{step.id}</span>
                  <span className="text-xs sm:text-sm font-semibold text-deck-fg leading-tight">{step.title}</span>
                  <span className="text-[10px] sm:text-xs text-deck-accent leading-tight mt-0.5 line-clamp-2">{step.desc}</span>
                  <span className="text-[10px] sm:text-xs font-medium text-deck-accent mt-1.5 pt-1 border-t border-deck-border w-full">
                    → {step.output}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden sm:flex items-center flex-shrink-0 text-deck-accent/50">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Outputs label */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
          {steps.map((step) => (
            <span
              key={step.id}
              className="text-[10px] sm:text-xs font-medium text-deck-fg/80 bg-deck-surface border border-deck-border rounded px-2 py-1"
            >
              {step.output}
            </span>
          ))}
        </div>
      </div>

      {/* Strengthens with scale callout */}
      <div className="flex-shrink-0 bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2.5 sm:p-3 text-center">
        <p className="text-xs sm:text-sm text-deck-fg font-semibold leading-snug">
          Each acquisition increases data, benchmarks and execution capability — the model strengthens with scale.
        </p>
      </div>
    </div>
  );
}

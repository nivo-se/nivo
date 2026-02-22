import { Building2, TrendingDown, Shield } from "lucide-react";

export function Slide8() {
  const criteria = [
    {
      icon: Building2,
      title: "Valuation Discipline",
      items: [
        "EV/EBITDA multiples: 5-7x range",
        "Prioritize operational improvement potential over growth premiums",
        "Target proven business models with stable cash generation",
        "No speculative bets—acquire normalised earnings power",
      ],
    },
    {
      icon: TrendingDown,
      title: "Conservative Leverage",
      items: [
        "Debt/Total Capital: <30% at acquisition",
        "Net Debt/EBITDA: <2x maximum",
        "Maintain capacity for operational flexibility",
        "Leverage supplements, never dictates, acquisition strategy",
      ],
    },
    {
      icon: Shield,
      title: "Financial Guardrails",
      items: [
        "Acquire only with clear path to 15% normalized ROIC",
        "Require 12+ months runway at acquisition close",
        "Stress-test downside scenarios before commitment",
        "Capital preservation > growth at any cost",
      ],
    },
  ];

  return (
    <div className="h-full flex flex-col justify-center space-y-7">
      {/* Title */}
      <div className="space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-deck-fg">
          Acquisition Criteria
        </h1>
        <p className="text-sm text-deck-accent">
          Disciplined approach to valuation and capital structure
        </p>
      </div>

      {/* Criteria Grid */}
      <div className="grid grid-cols-3 gap-6">
        {criteria.map((criterion, index) => (
          <div
            key={index}
            className="bg-deck-surface border border-deck-fg/10 rounded-lg p-8 space-y-6 shadow-sm hover:border-deck-accent/30 transition-colors"
          >
            <div className="flex flex-col items-start gap-4">
              <div className="w-14 h-14 rounded-lg bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center flex-shrink-0">
                <criterion.icon className="w-7 h-7 text-deck-accent" />
              </div>
              <h3 className="text-base font-semibold text-deck-fg">{criterion.title}</h3>
            </div>
            <ul className="space-y-3">
              {criterion.items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-deck-accent mt-2 flex-shrink-0"></div>
                  <span className="text-deck-fg/80 text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Financial Framework */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-deck-fg mb-4">Target Acquisition Profile</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-deck-fg/10">
              <span className="text-sm text-deck-accent">EV/EBITDA Multiple</span>
              <span className="text-lg font-bold text-deck-fg">5-7x</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-deck-fg/10">
              <span className="text-sm text-deck-accent">Debt/Total Capital</span>
              <span className="text-lg font-bold text-deck-fg">&lt;30%</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-deck-fg/10">
              <span className="text-sm text-deck-accent">Net Debt/EBITDA</span>
              <span className="text-lg font-bold text-deck-fg">&lt;2x</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-deck-accent">Target ROIC</span>
              <span className="text-lg font-bold text-deck-accent">15%</span>
            </div>
          </div>
        </div>

        <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-deck-fg mb-4">Example Acquisition Structure</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-deck-accent font-semibold">•</span>
              <span className="text-deck-fg/80">Company EBITDA: 10 MSEK</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-deck-accent font-semibold">•</span>
              <span className="text-deck-fg/80">Purchase price: 60 MSEK (6x EBITDA)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-deck-accent font-semibold">•</span>
              <span className="text-deck-fg/80">Equity contribution: 45 MSEK (75%)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-deck-accent font-semibold">•</span>
              <span className="text-deck-fg/80">Debt financing: 15 MSEK (25%)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-deck-accent font-semibold">•</span>
              <span className="text-deck-fg/80">Net Debt/EBITDA: 1.5x</span>
            </div>
            <div className="pt-2 mt-2 border-t border-deck-accent/20">
              <span className="text-deck-accent font-semibold text-base">Conservative, scalable structure</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Message */}
      <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-6 text-center">
        <p className="text-base text-deck-fg font-semibold">
          We buy value creation potential, not financial leverage.
        </p>
      </div>
    </div>
  );
}
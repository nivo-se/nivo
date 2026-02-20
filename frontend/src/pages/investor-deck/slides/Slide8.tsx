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
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#2E2A2B]">
          Acquisition Criteria
        </h1>
        <p className="text-sm text-[#596152]">
          Disciplined approach to valuation and capital structure
        </p>
      </div>

      {/* Criteria Grid */}
      <div className="grid grid-cols-3 gap-6">
        {criteria.map((criterion, index) => (
          <div
            key={index}
            className="bg-white border border-[#2E2A2B]/10 rounded-lg p-8 space-y-6 shadow-sm hover:border-[#596152]/30 transition-colors"
          >
            <div className="flex flex-col items-start gap-4">
              <div className="w-14 h-14 rounded-lg bg-[#596152]/10 border border-[#596152]/30 flex items-center justify-center flex-shrink-0">
                <criterion.icon className="w-7 h-7 text-[#596152]" />
              </div>
              <h3 className="text-base font-semibold text-[#2E2A2B]">{criterion.title}</h3>
            </div>
            <ul className="space-y-3">
              {criterion.items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#596152] mt-2 flex-shrink-0"></div>
                  <span className="text-[#2E2A2B]/80 text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Financial Framework */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-[#2E2A2B] mb-4">Target Acquisition Profile</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-[#2E2A2B]/10">
              <span className="text-sm text-[#596152]">EV/EBITDA Multiple</span>
              <span className="text-lg font-bold text-[#2E2A2B]">5-7x</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-[#2E2A2B]/10">
              <span className="text-sm text-[#596152]">Debt/Total Capital</span>
              <span className="text-lg font-bold text-[#2E2A2B]">&lt;30%</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-[#2E2A2B]/10">
              <span className="text-sm text-[#596152]">Net Debt/EBITDA</span>
              <span className="text-lg font-bold text-[#2E2A2B]">&lt;2x</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#596152]">Target ROIC</span>
              <span className="text-lg font-bold text-[#596152]">15%</span>
            </div>
          </div>
        </div>

        <div className="bg-[#596152]/10 border border-[#596152]/30 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-[#2E2A2B] mb-4">Example Acquisition Structure</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-[#596152] font-semibold">•</span>
              <span className="text-[#2E2A2B]/80">Company EBITDA: 10 MSEK</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#596152] font-semibold">•</span>
              <span className="text-[#2E2A2B]/80">Purchase price: 60 MSEK (6x EBITDA)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#596152] font-semibold">•</span>
              <span className="text-[#2E2A2B]/80">Equity contribution: 45 MSEK (75%)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#596152] font-semibold">•</span>
              <span className="text-[#2E2A2B]/80">Debt financing: 15 MSEK (25%)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#596152] font-semibold">•</span>
              <span className="text-[#2E2A2B]/80">Net Debt/EBITDA: 1.5x</span>
            </div>
            <div className="pt-2 mt-2 border-t border-[#596152]/20">
              <span className="text-[#596152] font-semibold text-base">Conservative, scalable structure</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Message */}
      <div className="bg-[#596152]/10 border border-[#596152]/30 rounded-lg p-6 text-center">
        <p className="text-base text-[#2E2A2B] font-semibold">
          We buy value creation potential, not financial leverage.
        </p>
      </div>
    </div>
  );
}
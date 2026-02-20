import { Target, Clock, TrendingUp } from "lucide-react";

export function Slide14() {
  const useOfFunds = [
    { category: "Acquisitions (3-4 companies)", amount: "SEK 150m", percentage: 75 },
    { category: "Operational improvements", amount: "SEK 30m", percentage: 15 },
    { category: "Working capital & reserves", amount: "SEK 20m", percentage: 10 },
  ];

  return (
    <div className="h-full flex flex-col justify-center space-y-7">
      {/* Title */}
      <div className="space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#2E2A2B]">
          Capital Raise
        </h1>
        <p className="text-sm text-[#596152]">
          SEK 200m to establish the compounding foundation
        </p>
      </div>

      {/* Raise Overview */}
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-[#596152]/10 border border-[#596152]/30 rounded-lg p-8 space-y-6">
            <div className="space-y-3">
              <div className="text-sm font-semibold text-[#596152] uppercase tracking-wider">Fund Size</div>
              <div className="text-2xl font-bold text-[#2E2A2B]">SEK 200m</div>
              <div className="text-[#596152]">Initial close target</div>
            </div>
            <div className="pt-4 border-t border-[#596152]/20 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[#596152]">Minimum investment</span>
                <span className="text-[#2E2A2B] font-semibold">SEK 5m</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#596152]">Target close</span>
                <span className="text-[#2E2A2B] font-semibold">Q2 2026</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#596152]">First deployment</span>
                <span className="text-[#2E2A2B] font-semibold">Q3 2026</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-[#596152]" />
              <h3 className="font-semibold text-[#2E2A2B]">Current Status</h3>
            </div>
            <p className="text-[#2E2A2B] text-sm leading-relaxed">
              Seeking 2-3 anchor investors to establish fund momentum. Strong pipeline in place. Management team committed and operational.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-8 space-y-6 shadow-sm">
            <h3 className="text-base font-semibold text-[#2E2A2B]">Use of Funds</h3>
            <div className="space-y-4">
              {useOfFunds.map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[#2E2A2B] text-sm">{item.category}</span>
                    <span className="text-[#2E2A2B] font-semibold">{item.amount}</span>
                  </div>
                  <div className="w-full h-2 bg-[#2E2A2B]/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#596152] rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-[#596152]" />
              <h3 className="font-semibold text-[#2E2A2B]">Investment Horizon</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-[#2E2A2B]/10">
                <span className="text-[#596152]">Deployment period</span>
                <span className="text-[#2E2A2B]">18-24 months</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#2E2A2B]/10">
                <span className="text-[#596152]">Hold period per company</span>
                <span className="text-[#2E2A2B]">5-7 years</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-[#596152]">Fund life</span>
                <span className="text-[#2E2A2B]">10 years + 2x1 ext.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expected Returns */}
      <div className="bg-[#596152]/10 border border-[#596152]/30 rounded-lg p-8">
        <div className="flex items-center gap-8">
          <div className="w-16 h-16 rounded-lg bg-[#596152]/20 border border-[#596152]/50 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-8 h-8 text-[#596152]" />
          </div>
          <div className="flex-1 space-y-3">
            <h3 className="text-base font-semibold text-[#2E2A2B]">Target Returns</h3>
            <p className="text-[#2E2A2B] leading-relaxed">
              Target gross IRR of <span className="text-[#596152] font-semibold">19-23%</span> through disciplined reinvestment and operational compounding. Base-case underwriting assumes margin expansion and debt paydown, with flat-to-modest exit multiples.
            </p>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-8 text-center space-y-4 shadow-sm">
        <h3 className="text-base font-semibold text-[#2E2A2B]">Core Message</h3>
        <div className="max-w-3xl mx-auto space-y-3">
          <p className="text-xl text-[#2E2A2B] font-semibold leading-relaxed">
            Nivo does not buy technology risk.
          </p>
          <p className="text-sm text-[#596152] font-semibold leading-relaxed">
            Nivo buys operational improvement potential.
          </p>
        </div>
        <div className="pt-6 space-y-2 border-t border-[#2E2A2B]/10 mt-6">
          <p className="text-[#2E2A2B] leading-relaxed">
            We welcome discussions with investors who value operational discipline, long-term compounding, and sustainable value creation over financial engineering.
          </p>
          <div className="pt-4">
            <div className="inline-flex items-center gap-2 text-[#596152] font-medium">
              <span>Contact: invest@nivogroup.se</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

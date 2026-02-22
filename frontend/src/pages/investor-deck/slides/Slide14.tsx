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
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-deck-fg">
          Capital Raise
        </h1>
        <p className="text-sm text-deck-accent">
          SEK 200m to establish the compounding foundation
        </p>
      </div>

      {/* Raise Overview */}
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-8 space-y-6">
            <div className="space-y-3">
              <div className="text-sm font-semibold text-deck-accent uppercase tracking-wider">Fund Size</div>
              <div className="text-2xl font-bold text-deck-fg">SEK 200m</div>
              <div className="text-deck-accent">Initial close target</div>
            </div>
            <div className="pt-4 border-t border-deck-accent/20 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-deck-accent">Minimum investment</span>
                <span className="text-deck-fg font-semibold">SEK 5m</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-deck-accent">Target close</span>
                <span className="text-deck-fg font-semibold">Q2 2026</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-deck-accent">First deployment</span>
                <span className="text-deck-fg font-semibold">Q3 2026</span>
              </div>
            </div>
          </div>

          <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-deck-accent" />
              <h3 className="font-semibold text-deck-fg">Current Status</h3>
            </div>
            <p className="text-deck-fg text-sm leading-relaxed">
              Seeking 2-3 anchor investors to establish fund momentum. Strong pipeline in place. Management team committed and operational.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-8 space-y-6 shadow-sm">
            <h3 className="text-base font-semibold text-deck-fg">Use of Funds</h3>
            <div className="space-y-4">
              {useOfFunds.map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-deck-fg text-sm">{item.category}</span>
                    <span className="text-deck-fg font-semibold">{item.amount}</span>
                  </div>
                  <div className="w-full h-2 bg-deck-fg/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-deck-accent rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-deck-accent" />
              <h3 className="font-semibold text-deck-fg">Investment Horizon</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-deck-fg/10">
                <span className="text-deck-accent">Deployment period</span>
                <span className="text-deck-fg">18-24 months</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-deck-fg/10">
                <span className="text-deck-accent">Hold period per company</span>
                <span className="text-deck-fg">5-7 years</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-deck-accent">Fund life</span>
                <span className="text-deck-fg">10 years + 2x1 ext.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expected Returns */}
      <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-8">
        <div className="flex items-center gap-8">
          <div className="w-16 h-16 rounded-lg bg-deck-accent/20 border border-deck-accent/50 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-8 h-8 text-deck-accent" />
          </div>
          <div className="flex-1 space-y-3">
            <h3 className="text-base font-semibold text-deck-fg">Target Returns</h3>
            <p className="text-deck-fg leading-relaxed">
              Target gross IRR of <span className="text-deck-accent font-semibold">19-23%</span> through disciplined reinvestment and operational compounding. Base-case underwriting assumes margin expansion and debt paydown, with flat-to-modest exit multiples.
            </p>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-8 text-center space-y-4 shadow-sm">
        <h3 className="text-base font-semibold text-deck-fg">Core Message</h3>
        <div className="max-w-3xl mx-auto space-y-3">
          <p className="text-xl text-deck-fg font-semibold leading-relaxed">
            Nivo does not buy technology risk.
          </p>
          <p className="text-sm text-deck-accent font-semibold leading-relaxed">
            Nivo buys operational improvement potential.
          </p>
        </div>
        <div className="pt-6 space-y-2 border-t border-deck-fg/10 mt-6">
          <p className="text-deck-fg leading-relaxed">
            We welcome discussions with investors who value operational discipline, long-term compounding, and sustainable value creation over financial engineering.
          </p>
          <div className="pt-4">
            <div className="inline-flex items-center gap-2 text-deck-accent font-medium">
              <span>Contact: invest@nivogroup.se</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Target, TrendingUp, Users } from "lucide-react";

export function Slide18() {
  const caseStudy = {
    company: "Nordic Industrial Services AB",
    sector: "Facility Maintenance",
    acquired: "Q3 2026 (illustrative)",
    revenue: "SEK 45m",
    ebitda: "SEK 4.5m (10%)",
    purchasePrice: "SEK 27m EV (6.0x EBITDA)",
    capitalStructure: "SEK 20.2m equity / SEK 6.8m debt",
  };

  const improvements = [
    {
      area: "Pricing",
      baseline: "No pricing framework",
      action: "Implemented value-based pricing for 40% of contracts",
      impact: "+150 bps margin",
    },
    {
      area: "Operations",
      baseline: "Manual scheduling, paper-based reporting",
      action: "Digital workflow system, automated dispatch",
      impact: "+100 bps margin",
    },
    {
      area: "Cost Structure",
      baseline: "Fragmented overhead, no procurement discipline",
      action: "Consolidated functions, vendor renegotiation",
      impact: "+50 bps margin",
    },
  ];

  return (
    <div className="h-full flex flex-col justify-center space-y-5">
      {/* Title */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-deck-fg">
          Case Study (Illustrative)
        </h1>
        <p className="text-sm text-deck-accent">
          How operational improvements drive compounding returns
        </p>
      </div>

      {/* Company Overview */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-semibold text-deck-accent uppercase tracking-wider">Company</h3>
          <div className="space-y-1">
            <p className="text-lg font-bold text-deck-fg">{caseStudy.company}</p>
            <p className="text-xs text-deck-fg/70">{caseStudy.sector}</p>
          </div>
        </div>

        <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-semibold text-deck-accent uppercase tracking-wider">Entry Metrics</h3>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-deck-fg/70">Revenue</span>
              <span className="text-deck-fg font-semibold">{caseStudy.revenue}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-deck-fg/70">EBITDA</span>
              <span className="text-deck-fg font-semibold">{caseStudy.ebitda}</span>
            </div>
          </div>
        </div>

        <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-semibold text-deck-accent uppercase tracking-wider">Valuation</h3>
          <div className="space-y-1">
            <p className="text-lg font-bold text-deck-fg">{caseStudy.purchasePrice}</p>
            <p className="text-xs text-deck-fg/70">{caseStudy.capitalStructure}</p>
          </div>
        </div>
      </div>

      {/* Value Creation Plan */}
      <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-6 shadow-sm">
        <h3 className="text-base font-semibold text-deck-fg mb-4">Value Creation Roadmap (24 months)</h3>
        <div className="space-y-4">
          {improvements.map((improvement, index) => (
            <div key={index} className="grid grid-cols-4 gap-4 pb-4 border-b border-deck-fg/10 last:border-0 last:pb-0">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-deck-accent uppercase tracking-wider">Area</div>
                <p className="text-sm text-deck-fg font-semibold">{improvement.area}</p>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-deck-accent uppercase tracking-wider">Baseline</div>
                <p className="text-xs text-deck-fg/80">{improvement.baseline}</p>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-deck-accent uppercase tracking-wider">Action</div>
                <p className="text-xs text-deck-fg/80">{improvement.action}</p>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-deck-accent uppercase tracking-wider">Impact</div>
                <p className="text-sm text-deck-accent font-bold">{improvement.impact}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center">
              <Target className="w-5 h-5 text-deck-accent" />
            </div>
            <h3 className="font-semibold text-deck-fg">Post-Improvement Metrics</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-deck-fg/10">
              <span className="text-deck-accent">EBITDA Margin</span>
              <span className="text-deck-fg font-semibold">10% → 13%</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-deck-fg/10">
              <span className="text-deck-accent">Run-rate EBITDA (24m)</span>
              <span className="text-deck-fg font-semibold">SEK 6.8m</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-deck-accent">ROIC on invested capital</span>
              <span className="text-deck-accent font-bold text-lg">20%+</span>
            </div>
          </div>
        </div>

        <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-deck-accent/20 border border-deck-accent/50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-deck-accent" />
            </div>
            <h3 className="font-semibold text-deck-fg">Returns Scenario</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-deck-accent/20">
              <span className="text-deck-fg">Year 5 EBITDA / multiple</span>
              <span className="text-deck-fg font-semibold">SEK 7.9m @ 6.5x</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-deck-accent/20">
              <span className="text-deck-fg">Exit EV / net debt</span>
              <span className="text-deck-fg font-semibold">SEK 51m / SEK 4.5m</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-deck-accent/20">
              <span className="text-deck-fg">Gross MOIC</span>
              <span className="text-deck-accent font-bold text-lg">2.3x</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-deck-fg">Gross IRR (5 years)</span>
              <span className="text-deck-accent font-bold text-lg">~18%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Message */}
      <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-4 text-center shadow-sm">
        <p className="text-sm text-deck-fg font-semibold">
          Margin improvement through operational excellence creates sustainable value.
        </p>
      </div>
    </div>
  );
}

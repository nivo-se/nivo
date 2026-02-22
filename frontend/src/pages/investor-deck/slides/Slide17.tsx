import { AlertTriangle, TrendingDown, Shield } from "lucide-react";

export function Slide17() {
  const risks = [
    {
      icon: AlertTriangle,
      title: "Execution Risk",
      description: "Value creation initiatives may take longer or cost more than anticipated",
      mitigation: [
        "Proven playbook from prior operational roles",
        "Conservative underwriting with stress scenarios",
        "Experienced advisors for specialized areas",
      ],
    },
    {
      icon: TrendingDown,
      title: "Market Risk",
      description: "Economic downturn or sector-specific challenges could impact portfolio",
      mitigation: [
        "Target defensive, non-cyclical sectors",
        "Diversification across 3-4 companies",
        "Conservative leverage (<2x Net Debt/EBITDA)",
      ],
    },
    {
      icon: Shield,
      title: "Key Person Risk",
      description: "Dependence on founder-managed businesses creates transition risk",
      mitigation: [
        "Retain key management with aligned incentives",
        "Gradual transition planning over 12-24 months",
        "Build operational depth through process documentation",
      ],
    },
  ];

  return (
    <div className="h-full flex flex-col justify-center space-y-5">
      {/* Title */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-deck-fg">
          Risk Factors & Mitigation
        </h1>
        <p className="text-sm text-deck-accent">
          Transparent assessment with disciplined mitigation strategies
        </p>
      </div>

      {/* Risks Grid */}
      <div className="grid grid-cols-3 gap-5">
        {risks.map((risk, index) => (
          <div
            key={index}
            className="bg-deck-surface border border-deck-fg/10 rounded-lg p-6 space-y-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center flex-shrink-0">
                <risk.icon className="w-5 h-5 text-deck-accent" />
              </div>
              <h3 className="text-base font-semibold text-deck-fg">{risk.title}</h3>
            </div>
            <p className="text-xs text-deck-fg/70 leading-relaxed">{risk.description}</p>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-deck-accent uppercase tracking-wider">Mitigation</div>
              <ul className="space-y-1.5">
                {risk.mitigation.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-deck-accent mt-1.5 flex-shrink-0"></div>
                    <span className="text-xs text-deck-fg">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Additional Risks */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-5 space-y-3">
          <h3 className="text-base font-semibold text-deck-fg">Portfolio Concentration</h3>
          <p className="text-xs text-deck-fg/80 leading-relaxed">
            With 3-4 companies, individual performance has outsized impact. Mitigated through rigorous screening, sector diversity, and deep operational involvement.
          </p>
        </div>

        <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-5 space-y-3">
          <h3 className="text-base font-semibold text-deck-fg">Liquidity Risk</h3>
          <p className="text-xs text-deck-fg/80 leading-relaxed">
            SME exit markets can be illiquid. Mitigated by building companies attractive to strategic buyers, maintaining flexibility on exit timing, and targeting normalized ROIC to justify valuations.
          </p>
        </div>
      </div>

      {/* Risk Management Framework */}
      <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-6 shadow-sm">
        <h3 className="text-base font-semibold text-deck-fg mb-4">Risk Management Framework</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-deck-accent uppercase tracking-wider">Pre-Investment</div>
            <p className="text-xs text-deck-fg/80">Quality of earnings, legal, operational DD</p>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-deck-accent uppercase tracking-wider">Post-Close</div>
            <p className="text-xs text-deck-fg/80">Monthly financials, KPI tracking, board governance</p>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-deck-accent uppercase tracking-wider">Portfolio Level</div>
            <p className="text-xs text-deck-fg/80">Quarterly IC reviews, stress testing, reserves</p>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-deck-accent uppercase tracking-wider">LP Reporting</div>
            <p className="text-xs text-deck-fg/80">Transparent quarterly updates, full disclosure</p>
          </div>
        </div>
      </div>

      {/* Key Message */}
      <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-4 text-center shadow-sm">
        <p className="text-sm text-deck-fg font-semibold">
          Risks are real but manageable through discipline, transparency, and operational excellence.
        </p>
      </div>
    </div>
  );
}

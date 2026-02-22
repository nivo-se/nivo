import { Search, FileText, MessageSquare, CheckCircle } from "lucide-react";

export function Slide15() {
  const phases = [
    {
      icon: Search,
      phase: "Sourcing",
      activities: [
        "Direct outreach to target companies",
        "Industry broker network",
        "Own deal origination playbook",
      ],
    },
    {
      icon: FileText,
      title: "Due Diligence",
      activities: [
        "Financial quality of earnings review",
        "Operational improvement identification",
        "Management capability assessment",
      ],
    },
    {
      icon: MessageSquare,
      title: "Negotiation",
      activities: [
        "Structure for value creation",
        "Management alignment",
        "Risk mitigation provisions",
      ],
    },
    {
      icon: CheckCircle,
      title: "Execution",
      activities: [
        "Day 1 readiness plan",
        "First 100-day priorities",
        "Value creation implementation",
      ],
    },
  ];

  return (
    <div className="h-full flex flex-col justify-center space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-deck-fg">
          Investment Process
        </h1>
        <p className="text-sm text-deck-accent">
          Disciplined, repeatable approach from sourcing to value creation
        </p>
      </div>

      {/* Process Grid */}
      <div className="grid grid-cols-4 gap-4">
        {phases.map((phase, index) => (
          <div
            key={index}
            className="bg-deck-surface border border-deck-fg/10 rounded-lg p-5 space-y-4 shadow-sm"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center">
                <phase.icon className="w-5 h-5 text-deck-accent" />
              </div>
              <h3 className="text-base font-semibold text-deck-fg">{phase.phase ?? phase.title}</h3>
            </div>
            <ul className="space-y-2">
              {phase.activities.map((activity, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-deck-accent mt-1.5 flex-shrink-0"></div>
                  <span className="text-xs text-deck-fg/80">{activity}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Pipeline Status */}
      <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-6 space-y-4">
        <h3 className="text-base font-semibold text-deck-fg">Current Pipeline Status</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-deck-accent uppercase tracking-wider">Initial Screen</div>
            <p className="text-3xl font-bold text-deck-fg">12</p>
            <p className="text-xs text-deck-fg/70">Companies under review</p>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-deck-accent uppercase tracking-wider">Due Diligence</div>
            <p className="text-3xl font-bold text-deck-fg">2</p>
            <p className="text-xs text-deck-fg/70">Active diligence processes</p>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-deck-accent uppercase tracking-wider">Negotiation</div>
            <p className="text-3xl font-bold text-deck-fg">1</p>
            <p className="text-xs text-deck-fg/70">LOI stage or beyond</p>
          </div>
        </div>
      </div>

      {/* Investment Criteria Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-5 space-y-3 shadow-sm">
          <h3 className="text-base font-semibold text-deck-fg">Target Company Profile</h3>
          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-deck-accent mt-1 flex-shrink-0"></div>
              <span className="text-deck-fg/80">Revenue: SEK 50-200m</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-deck-accent mt-1 flex-shrink-0"></div>
              <span className="text-deck-fg/80">EBITDA margin: 8-15%</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-deck-accent mt-1 flex-shrink-0"></div>
              <span className="text-deck-fg/80">Geography: Nordics-focused</span>
            </li>
          </ul>
        </div>

        <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-5 space-y-3 shadow-sm">
          <h3 className="text-base font-semibold text-deck-fg">Value Creation Potential</h3>
          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-deck-accent mt-1 flex-shrink-0"></div>
              <span className="text-deck-fg/80">Pricing power untapped</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-deck-accent mt-1 flex-shrink-0"></div>
              <span className="text-deck-fg/80">Manual processes to digitize</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-deck-accent mt-1 flex-shrink-0"></div>
              <span className="text-deck-fg/80">Cost structure to optimize</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Key Message */}
      <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-4 text-center shadow-sm">
        <p className="text-sm text-deck-fg font-semibold">
          Systematic sourcing generates proprietary deal flow. Disciplined process reduces execution risk.
        </p>
      </div>
    </div>
  );
}

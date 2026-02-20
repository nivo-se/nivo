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
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#2E2A2B]">
          Investment Process
        </h1>
        <p className="text-sm text-[#596152]">
          Disciplined, repeatable approach from sourcing to value creation
        </p>
      </div>

      {/* Process Grid */}
      <div className="grid grid-cols-4 gap-4">
        {phases.map((phase, index) => (
          <div
            key={index}
            className="bg-white border border-[#2E2A2B]/10 rounded-lg p-5 space-y-4 shadow-sm"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#596152]/10 border border-[#596152]/30 flex items-center justify-center">
                <phase.icon className="w-5 h-5 text-[#596152]" />
              </div>
              <h3 className="text-base font-semibold text-[#2E2A2B]">{phase.phase ?? phase.title}</h3>
            </div>
            <ul className="space-y-2">
              {phase.activities.map((activity, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-[#596152] mt-1.5 flex-shrink-0"></div>
                  <span className="text-xs text-[#2E2A2B]/80">{activity}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Pipeline Status */}
      <div className="bg-[#596152]/10 border border-[#596152]/30 rounded-lg p-6 space-y-4">
        <h3 className="text-base font-semibold text-[#2E2A2B]">Current Pipeline Status</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#596152] uppercase tracking-wider">Initial Screen</div>
            <p className="text-3xl font-bold text-[#2E2A2B]">12</p>
            <p className="text-xs text-[#2E2A2B]/70">Companies under review</p>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#596152] uppercase tracking-wider">Due Diligence</div>
            <p className="text-3xl font-bold text-[#2E2A2B]">2</p>
            <p className="text-xs text-[#2E2A2B]/70">Active diligence processes</p>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#596152] uppercase tracking-wider">Negotiation</div>
            <p className="text-3xl font-bold text-[#2E2A2B]">1</p>
            <p className="text-xs text-[#2E2A2B]/70">LOI stage or beyond</p>
          </div>
        </div>
      </div>

      {/* Investment Criteria Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-5 space-y-3 shadow-sm">
          <h3 className="text-base font-semibold text-[#2E2A2B]">Target Company Profile</h3>
          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-[#596152] mt-1 flex-shrink-0"></div>
              <span className="text-[#2E2A2B]/80">Revenue: SEK 50-200m</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-[#596152] mt-1 flex-shrink-0"></div>
              <span className="text-[#2E2A2B]/80">EBITDA margin: 8-15%</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-[#596152] mt-1 flex-shrink-0"></div>
              <span className="text-[#2E2A2B]/80">Geography: Nordics-focused</span>
            </li>
          </ul>
        </div>

        <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-5 space-y-3 shadow-sm">
          <h3 className="text-base font-semibold text-[#2E2A2B]">Value Creation Potential</h3>
          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-[#596152] mt-1 flex-shrink-0"></div>
              <span className="text-[#2E2A2B]/80">Pricing power untapped</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-[#596152] mt-1 flex-shrink-0"></div>
              <span className="text-[#2E2A2B]/80">Manual processes to digitize</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-[#596152] mt-1 flex-shrink-0"></div>
              <span className="text-[#2E2A2B]/80">Cost structure to optimize</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Key Message */}
      <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-4 text-center shadow-sm">
        <p className="text-sm text-[#2E2A2B] font-semibold">
          Systematic sourcing generates proprietary deal flow. Disciplined process reduces execution risk.
        </p>
      </div>
    </div>
  );
}

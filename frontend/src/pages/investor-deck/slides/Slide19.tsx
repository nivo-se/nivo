import { Users, Award, Briefcase } from "lucide-react";

export function Slide19() {
  const team = [
    {
      icon: Briefcase,
      title: "Operational Experience",
      items: [
        "20+ years operational leadership",
        "Experience scaling SMEs",
        "Direct P&L responsibility",
      ],
    },
    {
      icon: Award,
      title: "Capital Allocation",
      items: [
        "Value-focused acquisitions",
        "Pricing and negotiation",
        "Long-term perspective",
      ],
    },
    {
      icon: Users,
      title: "Technical Capabilities",
      items: [
        "AI/automation implementation",
        "Process optimization",
        "Change management",
      ],
    },
  ];

  return (
    <div className="h-full flex flex-col justify-center space-y-4">
      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#2E2A2B]">
          Team
        </h1>
        <p className="text-sm text-[#596152]">
          Operational expertise, capital discipline, long-term commitment
        </p>
      </div>

      {/* Team Capabilities */}
      <div className="grid grid-cols-3 gap-4">
        {team.map((area, index) => (
          <div
            key={index}
            className="bg-white border border-[#2E2A2B]/10 rounded-lg p-5 space-y-3 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-[#596152]/10 border border-[#596152]/30 flex items-center justify-center">
                <area.icon className="w-5 h-5 text-[#596152]" />
              </div>
              <h3 className="text-base font-semibold text-[#2E2A2B]">{area.title}</h3>
            </div>
            <ul className="space-y-1.5">
              {area.items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-[#596152] mt-1.5 flex-shrink-0"></div>
                  <span className="text-[#2E2A2B]/80 text-xs">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Commitment */}
      <div className="bg-[#596152]/10 border border-[#596152]/30 rounded-lg p-5">
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-[#2E2A2B]">Long-term Alignment</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-[#596152] uppercase tracking-wider">GP Commitment</div>
              <p className="text-base text-[#2E2A2B] font-semibold">5%+ of fund</p>
              <p className="text-xs text-[#2E2A2B]/70">Meaningful skin in the game</p>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-[#596152] uppercase tracking-wider">Time Horizon</div>
              <p className="text-base text-[#2E2A2B] font-semibold">10+ years</p>
              <p className="text-xs text-[#2E2A2B]/70">Patient capital approach</p>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-[#596152] uppercase tracking-wider">Carry Structure</div>
              <p className="text-base text-[#2E2A2B] font-semibold">20% / 8% pref</p>
              <p className="text-xs text-[#2E2A2B]/70">Standard alignment</p>
            </div>
          </div>
        </div>
      </div>

      {/* Advisory Board */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-4 space-y-2 shadow-sm">
          <h3 className="text-sm font-semibold text-[#2E2A2B]">Operating Advisors</h3>
          <div className="space-y-1.5 text-xs text-[#2E2A2B]/80">
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-[#596152] mt-1 flex-shrink-0"></div>
              <p>Pricing strategy experts from McKinsey and Simon-Kucher</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-[#596152] mt-1 flex-shrink-0"></div>
              <p>AI implementation specialists from Nordic tech</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-[#596152] mt-1 flex-shrink-0"></div>
              <p>Former CFOs from Nordic mid-market companies</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-4 space-y-2 shadow-sm">
          <h3 className="text-sm font-semibold text-[#2E2A2B]">Professional Network</h3>
          <div className="space-y-1.5 text-xs text-[#2E2A2B]/80">
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-[#596152] mt-1 flex-shrink-0"></div>
              <p>Established relationships with top-tier law firms</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-[#596152] mt-1 flex-shrink-0"></div>
              <p>Partnership with leading Nordic accounting firms</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-[#596152] mt-1 flex-shrink-0"></div>
              <p>Access to operational talent pool for portfolio</p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Message */}
      <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-3 text-center shadow-sm">
        <p className="text-sm text-[#2E2A2B] font-semibold">
          We operate companies. We don't just own them.
        </p>
      </div>
    </div>
  );
}

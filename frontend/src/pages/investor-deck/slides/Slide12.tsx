import { Briefcase, Award, Target } from "lucide-react";

export function Slide12() {
  const team = [
    {
      name: "Partner 1",
      role: "Founding Partner",
      background: [
        "15+ years operational leadership in Nordic SMEs",
        "Led 8+ business transformations",
        "Background in industrial services and manufacturing",
        "M.Sc. Industrial Engineering",
      ],
    },
    {
      name: "Partner 2",
      role: "Founding Partner",
      background: [
        "12+ years private equity and growth equity",
        "Investment experience across 20+ Nordic companies",
        "Specialized in operational value creation",
        "MBA, Stockholm School of Economics",
      ],
    },
  ];

  const advisors = [
    {
      name: "Senior Advisor",
      expertise: "Former CEO of SEK 400m Nordic industrial group. 25+ years operational experience.",
    },
    {
      name: "Financial Advisor",
      expertise: "Former CFO of listed Nordic company. Expertise in financial systems and reporting.",
    },
  ];

  return (
    <div className="h-full flex flex-col justify-center space-y-7">
      {/* Title */}
      <div className="space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#2E2A2B]">
          Team
        </h1>
        <p className="text-sm text-[#596152]">
          Operational experience meets disciplined capital allocation
        </p>
      </div>

      {/* Core Team */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="w-5 h-5 text-[#596152]" />
          <h2 className="text-base font-semibold text-[#2E2A2B]">Core Team</h2>
        </div>
        <div className="grid grid-cols-2 gap-6">
          {team.map((member, index) => (
            <div
              key={index}
              className="bg-white border border-[#2E2A2B]/10 rounded-lg p-8 space-y-4 shadow-sm"
            >
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-[#2E2A2B]">{member.name}</h3>
                <p className="text-[#596152] font-medium">{member.role}</p>
              </div>
              <ul className="space-y-2.5">
                {member.background.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#596152] mt-2 flex-shrink-0" />
                    <span className="text-[#2E2A2B] text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Advisory Board */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-[#596152]" />
          <h2 className="text-base font-semibold text-[#2E2A2B]">Advisory Board</h2>
        </div>
        <div className="grid grid-cols-2 gap-6">
          {advisors.map((advisor, index) => (
            <div
              key={index}
              className="bg-[#596152]/10 border border-[#596152]/30 rounded-lg p-6 space-y-3"
            >
              <h3 className="text-lg font-semibold text-[#2E2A2B]">{advisor.name}</h3>
              <p className="text-[#2E2A2B] text-sm leading-relaxed">{advisor.expertise}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Team Philosophy */}
      <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-8 shadow-sm">
        <div className="flex items-start gap-6">
          <div className="w-12 h-12 rounded-lg bg-[#596152]/10 border border-[#596152]/30 flex items-center justify-center flex-shrink-0">
            <Target className="w-6 h-6 text-[#596152]" />
          </div>
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-[#2E2A2B]">Team Philosophy</h3>
            <p className="text-[#2E2A2B] leading-relaxed">
              We are operators first, investors second. Our team has sat in CEO and CFO chairs, managed P&Ls, and executed operational improvements. This is not advisory work—it is hands-on execution guided by proven experience.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

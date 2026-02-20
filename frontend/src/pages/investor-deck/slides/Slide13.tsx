import { Shield, Users, FileText, BarChart } from "lucide-react";

export function Slide13() {
  const governance = [
    {
      icon: Shield,
      title: "Legal Structure",
      items: [
        "Swedish limited partnership (kommanditbolag)",
        "10-year fund life with two 1-year extensions",
        "General Partner committed to operational management",
        "Limited Partner protections per market standard",
      ],
    },
    {
      icon: Users,
      title: "Investment Committee",
      items: [
        "All acquisitions require IC approval",
        "Independent members with relevant expertise",
        "Focus on financial discipline and strategic fit",
        "Quarterly portfolio reviews",
      ],
    },
    {
      icon: FileText,
      title: "Reporting Framework",
      items: [
        "Quarterly investor reports with full transparency",
        "Portfolio company financial performance",
        "Progress against value creation milestones",
        "Pipeline development updates",
      ],
    },
    {
      icon: BarChart,
      title: "Alignment",
      items: [
        "GP co-investment of 5% of total fund",
        "Carried interest at 20% above 8% preferred return",
        "No management fees on uncalled capital",
        "Clawback provisions to protect LP interests",
      ],
    },
  ];

  return (
    <div className="h-full flex flex-col justify-center space-y-7">
      {/* Title */}
      <div className="space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#2E2A2B]">
          Fund Structure & Governance
        </h1>
        <p className="text-sm text-[#596152]">
          Institutional framework with LP-aligned incentives
        </p>
      </div>

      {/* Governance Grid */}
      <div className="grid grid-cols-2 gap-6">
        {governance.map((area, index) => (
          <div
            key={index}
            className="bg-white border border-[#2E2A2B]/10 rounded-lg p-8 space-y-6 shadow-sm hover:border-[#596152]/30 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#596152]/10 border border-[#596152]/30 flex items-center justify-center flex-shrink-0">
                <area.icon className="w-6 h-6 text-[#596152]" />
              </div>
              <h3 className="text-base font-semibold text-[#2E2A2B]">{area.title}</h3>
            </div>
            <ul className="space-y-3">
              {area.items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#596152] mt-2 flex-shrink-0"></div>
                  <span className="text-[#2E2A2B]/80 text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Key Terms */}
      <div className="bg-[#596152]/10 border border-[#596152]/30 rounded-lg p-8">
        <h3 className="text-base font-semibold text-[#2E2A2B] mb-6">Key Terms Summary</h3>
        <div className="grid grid-cols-4 gap-6">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#596152] uppercase tracking-wider">Target Size</div>
            <p className="text-2xl font-bold text-[#2E2A2B]">SEK 200m</p>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#596152] uppercase tracking-wider">Min Investment</div>
            <p className="text-2xl font-bold text-[#2E2A2B]">SEK 5m</p>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#596152] uppercase tracking-wider">Management Fee</div>
            <p className="text-2xl font-bold text-[#2E2A2B]">2.0%</p>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#596152] uppercase tracking-wider">Carry / Pref</div>
            <p className="text-2xl font-bold text-[#2E2A2B]">20% / 8%</p>
          </div>
        </div>
      </div>

      {/* Key Message */}
      <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-6 text-center shadow-sm">
        <p className="text-base text-[#2E2A2B] font-semibold">
          Institutional-quality structure designed for long-term alignment.
        </p>
      </div>
    </div>
  );
}

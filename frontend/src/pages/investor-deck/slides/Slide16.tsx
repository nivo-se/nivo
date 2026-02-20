import { TrendingUp, Globe, Building2, Users } from "lucide-react";

export function Slide16() {
  const marketMetrics = [
    {
      icon: Building2,
      metric: "~15,000",
      label: "SMEs in target size band",
    },
    {
      icon: Users,
      metric: "Owner-managed",
      label: "Traditional structures",
    },
    {
      icon: TrendingUp,
      metric: "Under-digitised",
      label: "Meaningful process and systems gap",
    },
    {
      icon: Globe,
      metric: "Stable markets",
      label: "B2B services & manufacturing",
    },
  ];

  return (
    <div className="h-full flex flex-col justify-center space-y-5">
      {/* Title */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#2E2A2B]">
          Nordic Market Context
        </h1>
        <p className="text-sm text-[#596152]">
          Large, underserved opportunity in profitable but stagnant SMEs
        </p>
      </div>

      {/* Market Metrics */}
      <div className="grid grid-cols-4 gap-4">
        {marketMetrics.map((item, index) => (
          <div
            key={index}
            className="bg-white border border-[#2E2A2B]/10 rounded-lg p-5 space-y-3 shadow-sm"
          >
            <div className="w-10 h-10 rounded-lg bg-[#596152]/10 border border-[#596152]/30 flex items-center justify-center">
              <item.icon className="w-5 h-5 text-[#596152]" />
            </div>
            <div className="space-y-1">
              <div className="text-xl font-bold text-[#2E2A2B]">{item.metric}</div>
              <p className="text-xs text-[#596152]">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Market Opportunity */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-[#596152]/10 border border-[#596152]/30 rounded-lg p-6 space-y-4">
          <h3 className="text-base font-semibold text-[#2E2A2B]">The Nordic Advantage</h3>
          <ul className="space-y-2.5">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#596152] mt-2 flex-shrink-0"></div>
              <span className="text-[#2E2A2B] text-sm">Strong rule of law and transparent business environment</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#596152] mt-2 flex-shrink-0"></div>
              <span className="text-[#2E2A2B] text-sm">Highly educated workforce with strong work ethic</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#596152] mt-2 flex-shrink-0"></div>
              <span className="text-[#2E2A2B] text-sm">Generational ownership transitions create deal flow</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#596152] mt-2 flex-shrink-0"></div>
              <span className="text-[#2E2A2B] text-sm">Limited PE competition in the sub-SEK 200m segment</span>
            </li>
          </ul>
        </div>

        <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-6 space-y-4 shadow-sm">
          <h3 className="text-base font-semibold text-[#2E2A2B]">The Improvement Gap</h3>
          <ul className="space-y-2.5">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#596152] mt-2 flex-shrink-0"></div>
              <span className="text-[#2E2A2B] text-sm">Excel-based operations with no modern systems</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#596152] mt-2 flex-shrink-0"></div>
              <span className="text-[#2E2A2B] text-sm">Inconsistent pricing and limited sales governance</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#596152] mt-2 flex-shrink-0"></div>
              <span className="text-[#2E2A2B] text-sm">Cost structures untouched for years</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#596152] mt-2 flex-shrink-0"></div>
              <span className="text-[#2E2A2B] text-sm">No professional financial reporting or KPI tracking</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Target Sectors */}
      <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-[#2E2A2B] mb-4">Priority Sectors</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-[#596152]">Industrial Services</h4>
            <p className="text-xs text-[#2E2A2B]/80">Maintenance, logistics, specialized technical services</p>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-[#596152]">B2B Software & IT</h4>
            <p className="text-xs text-[#2E2A2B]/80">Niche vertical SaaS, integration services, managed IT</p>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-[#596152]">Light Manufacturing</h4>
            <p className="text-xs text-[#2E2A2B]/80">Components, assembly, specialized production</p>
          </div>
        </div>
      </div>

      {/* Market Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#596152]/10 border border-[#596152]/30 rounded-lg p-4 text-center space-y-2">
          <div className="text-2xl font-bold text-[#2E2A2B]">SEK 50-200m</div>
          <p className="text-xs text-[#596152]">Target revenue range</p>
        </div>
        <div className="bg-[#596152]/10 border border-[#596152]/30 rounded-lg p-4 text-center space-y-2">
          <div className="text-2xl font-bold text-[#2E2A2B]">5-7x EBITDA</div>
          <p className="text-xs text-[#596152]">Typical entry multiples</p>
        </div>
        <div className="bg-[#596152]/10 border border-[#596152]/30 rounded-lg p-4 text-center space-y-2">
          <div className="text-2xl font-bold text-[#2E2A2B]">300-500 bps</div>
          <p className="text-xs text-[#596152]">Target margin improvement</p>
        </div>
      </div>

      {/* Key Message */}
      <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-4 text-center shadow-sm">
        <p className="text-sm text-[#2E2A2B] font-semibold">
          Massive supply of operationally sound companies starved of modern management practices.
        </p>
      </div>
    </div>
  );
}

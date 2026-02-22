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
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-deck-fg">
          Nordic Market Context
        </h1>
        <p className="text-sm text-deck-accent">
          Large, underserved opportunity in profitable but stagnant SMEs
        </p>
      </div>

      {/* Market Metrics */}
      <div className="grid grid-cols-4 gap-4">
        {marketMetrics.map((item, index) => (
          <div
            key={index}
            className="bg-deck-surface border border-deck-fg/10 rounded-lg p-5 space-y-3 shadow-sm"
          >
            <div className="w-10 h-10 rounded-lg bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center">
              <item.icon className="w-5 h-5 text-deck-accent" />
            </div>
            <div className="space-y-1">
              <div className="text-xl font-bold text-deck-fg">{item.metric}</div>
              <p className="text-xs text-deck-accent">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Market Opportunity */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-6 space-y-4">
          <h3 className="text-base font-semibold text-deck-fg">The Nordic Advantage</h3>
          <ul className="space-y-2.5">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-deck-accent mt-2 flex-shrink-0"></div>
              <span className="text-deck-fg text-sm">Strong rule of law and transparent business environment</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-deck-accent mt-2 flex-shrink-0"></div>
              <span className="text-deck-fg text-sm">Highly educated workforce with strong work ethic</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-deck-accent mt-2 flex-shrink-0"></div>
              <span className="text-deck-fg text-sm">Generational ownership transitions create deal flow</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-deck-accent mt-2 flex-shrink-0"></div>
              <span className="text-deck-fg text-sm">Limited PE competition in the sub-SEK 200m segment</span>
            </li>
          </ul>
        </div>

        <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-6 space-y-4 shadow-sm">
          <h3 className="text-base font-semibold text-deck-fg">The Improvement Gap</h3>
          <ul className="space-y-2.5">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-deck-accent mt-2 flex-shrink-0"></div>
              <span className="text-deck-fg text-sm">Excel-based operations with no modern systems</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-deck-accent mt-2 flex-shrink-0"></div>
              <span className="text-deck-fg text-sm">Inconsistent pricing and limited sales governance</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-deck-accent mt-2 flex-shrink-0"></div>
              <span className="text-deck-fg text-sm">Cost structures untouched for years</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-deck-accent mt-2 flex-shrink-0"></div>
              <span className="text-deck-fg text-sm">No professional financial reporting or KPI tracking</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Target Sectors */}
      <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-deck-fg mb-4">Priority Sectors</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-deck-accent">Industrial Services</h4>
            <p className="text-xs text-deck-fg/80">Maintenance, logistics, specialized technical services</p>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-deck-accent">B2B Software & IT</h4>
            <p className="text-xs text-deck-fg/80">Niche vertical SaaS, integration services, managed IT</p>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-deck-accent">Light Manufacturing</h4>
            <p className="text-xs text-deck-fg/80">Components, assembly, specialized production</p>
          </div>
        </div>
      </div>

      {/* Market Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-4 text-center space-y-2">
          <div className="text-2xl font-bold text-deck-fg">SEK 50-200m</div>
          <p className="text-xs text-deck-accent">Target revenue range</p>
        </div>
        <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-4 text-center space-y-2">
          <div className="text-2xl font-bold text-deck-fg">5-7x EBITDA</div>
          <p className="text-xs text-deck-accent">Typical entry multiples</p>
        </div>
        <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-4 text-center space-y-2">
          <div className="text-2xl font-bold text-deck-fg">300-500 bps</div>
          <p className="text-xs text-deck-accent">Target margin improvement</p>
        </div>
      </div>

      {/* Key Message */}
      <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-4 text-center shadow-sm">
        <p className="text-sm text-deck-fg font-semibold">
          Massive supply of operationally sound companies starved of modern management practices.
        </p>
      </div>
    </div>
  );
}

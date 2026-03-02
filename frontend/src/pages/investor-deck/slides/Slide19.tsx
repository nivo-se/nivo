import { Users, Award, Briefcase } from "lucide-react";

export function Slide19() {
  const team = [
    { icon: Briefcase, title: "Operational", items: ["20+ years ops leadership", "Scaling SMEs", "P&L responsibility"] },
    { icon: Award, title: "Capital", items: ["Value-focused acquisitions", "Pricing & negotiation", "Long-term view"] },
    { icon: Users, title: "Technical", items: ["AI/automation", "Process optimization", "Change management"] },
  ];
  const alignment = [
    { label: "GP Commitment", value: "5%+ of fund" },
    { label: "Horizon", value: "10+ years" },
    { label: "Carry", value: "20% / 8% pref" },
  ];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-[var(--deck-slide-gap)]">
      <div className="flex-shrink-0 space-y-0.5">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-deck-fg">Team</h1>
        <p className="text-xs sm:text-sm text-deck-accent leading-snug">Ops expertise, capital discipline, long-term commitment</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 min-h-0">
        {team.map((t, i) => {
          const Icon = t.icon;
          return (
            <div key={i} className="bg-deck-surface border border-deck-border rounded-lg p-2.5 sm:p-3 shadow-[var(--deck-shadow-card)] flex flex-col">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-deck-accent/10 border border-deck-accent-border flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-deck-accent" />
                </div>
                <h3 className="text-xs font-semibold text-deck-fg">{t.title}</h3>
              </div>
              <ul className="mt-1.5 space-y-0.5">
                {t.items.map((item, j) => (
                  <li key={j} className="text-[10px] text-deck-fg/80 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-deck-accent flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="flex-shrink-0 bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2 sm:p-2.5">
        <h3 className="text-xs font-semibold text-deck-fg mb-1">Alignment</h3>
        <div className="grid grid-cols-3 gap-2 text-[10px] sm:text-xs">
          {alignment.map((a) => (
            <div key={a.label}>
              <p className="font-semibold text-deck-accent uppercase">{a.label}</p>
              <p className="font-semibold text-deck-fg">{a.value}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[10px] sm:text-xs text-deck-fg font-semibold text-center flex-shrink-0">We operate companies. We don't just own them.</p>
    </div>
  );
}

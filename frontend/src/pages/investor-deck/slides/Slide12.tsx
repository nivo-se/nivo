import { Target } from "lucide-react";

export function Slide12() {
  const team = [
    { name: "Partner 1", role: "Founding Partner", bullets: ["15+ years Nordic company ops", "8+ transformations", "M.Sc. Industrial Eng."] },
    { name: "Partner 2", role: "Founding Partner", bullets: ["12+ years PE/growth", "20+ Nordic companies", "MBA SSE"] },
    { name: "Partner 3", role: "Founding Partner", bullets: ["10+ years M&A", "Tech & industrials", "M.Sc. Economics"] },
  ];
  const advisors = [
    { name: "Senior Advisor", expertise: "Ex-CEO SEK 400m industrial. 25+ years ops." },
    { name: "Financial Advisor", expertise: "Ex-CFO listed Nordic. Financial systems." },
  ];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-[var(--deck-slide-gap)]">
      <div className="flex-shrink-0 space-y-0.5">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-deck-fg">Team</h1>
        <p className="text-xs sm:text-sm text-deck-accent leading-snug">Operational experience meets disciplined capital</p>
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-3">
        {team.map((m, i) => (
          <div key={i} className="bg-deck-surface border border-deck-border rounded-lg p-2.5 sm:p-3 shadow-[var(--deck-shadow-card)] flex flex-col">
            <h3 className="text-xs font-semibold text-deck-fg">{m.name}</h3>
            <p className="text-[10px] text-deck-accent font-medium">{m.role}</p>
            <ul className="mt-1.5 space-y-0.5">
              {m.bullets.map((b, j) => (
                <li key={j} className="flex items-center gap-1.5 text-[10px] text-deck-fg/80">
                  <span className="w-1 h-1 rounded-full bg-deck-accent flex-shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-shrink-0">
        {advisors.map((a, i) => (
          <div key={i} className="bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2 sm:p-2.5">
            <h3 className="text-xs font-semibold text-deck-fg">{a.name}</h3>
            <p className="text-[10px] text-deck-fg/80 leading-snug mt-0.5">{a.expertise}</p>
          </div>
        ))}
      </div>
      <div className="flex-shrink-0 bg-deck-surface border border-deck-border rounded-lg p-2 sm:p-2.5 flex items-start gap-2">
        <Target className="w-5 h-5 text-deck-accent flex-shrink-0 mt-0.5" />
        <p className="text-[10px] sm:text-xs text-deck-fg leading-snug">Operators first, investors second. Hands-on execution guided by proven experience.</p>
      </div>
    </div>
  );
}

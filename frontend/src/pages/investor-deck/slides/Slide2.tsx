export function Slide2() {
  const items = [
    { title: "Manual workflows", desc: "Spreadsheets, email, manual processes." },
    { title: "Limited integration", desc: "Fragmented tech, minimal data flow." },
    { title: "Pricing inefficiencies", desc: "Cost-plus or legacy pricing." },
    { title: "Low transparency", desc: "Limited visibility into margins and KPIs." },
  ];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-[var(--deck-slide-gap)]">
      <div className="flex-shrink-0 space-y-0.5">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-deck-fg">
          The Opportunity
        </h1>
        <p className="text-xs sm:text-sm text-deck-accent leading-snug">
          Nordic SMEs are often profitable but structurally under-digitised
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 flex-1 min-h-0">
        {items.map((item) => (
          <div
            key={item.title}
            className="bg-deck-surface border border-deck-border rounded-lg p-2.5 sm:p-3 shadow-[var(--deck-shadow-card)] flex flex-col"
          >
            <div className="w-8 h-8 rounded-lg bg-deck-accent/10 border border-deck-accent-border flex items-center justify-center flex-shrink-0">
              <div className="w-4 h-4 border-2 border-deck-accent rounded" />
            </div>
            <h3 className="text-xs sm:text-sm font-semibold text-deck-fg mt-1.5">{item.title}</h3>
            <p className="text-[10px] sm:text-xs text-deck-fg/70 leading-snug mt-0.5">{item.desc}</p>
          </div>
        ))}
      </div>
      <div className="flex-shrink-0 bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2.5 sm:p-3 text-center">
        <p className="text-xs sm:text-sm text-deck-fg font-semibold leading-snug">
          Not technological disruption — <span className="text-deck-accent">operational elevation.</span>
        </p>
      </div>
    </div>
  );
}

export function Slide3() {
  const items = [
    { label: "WHAT", value: "Acquire profitable under-digitised SMEs" },
    { label: "WHERE", value: "Nordic region" },
    { label: "SIZE", value: "SEK 50–200m revenue" },
    { label: "MODEL", value: "Operational compounder" },
    { label: "EDGE", value: "Proprietary segmentation engine" },
    { label: "VALUE", value: "Structured execution + selective AI" },
    { label: "ROIC", value: "15% normalized target" },
    { label: "REINVEST", value: "100% + ~30% leverage" },
    { label: "OUTCOME", value: "Long-term compounding equity growth" },
  ];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-[var(--deck-slide-gap)]">
      <div className="flex-shrink-0 space-y-0.5">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-deck-fg">
          Investment Overview
        </h1>
        <p className="text-xs sm:text-sm text-deck-accent leading-snug">
          A disciplined approach to Nordic SME compounding
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5 flex-1 min-h-0 overflow-auto">
        {items.map((item) => (
          <div
            key={item.label}
            className="bg-deck-surface border border-deck-border rounded-lg p-2 sm:p-2.5 hover:border-deck-accent/50 transition-colors shadow-[var(--deck-shadow-card)]"
          >
            <div className="text-[10px] sm:text-xs font-semibold text-deck-accent uppercase tracking-wider">
              {item.label}
            </div>
            <div className="text-xs sm:text-sm text-deck-fg leading-snug mt-0.5">
              {item.value}
            </div>
          </div>
        ))}
      </div>
      <div className="flex-shrink-0 bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2 sm:p-2.5 text-center">
        <p className="text-xs sm:text-sm text-deck-fg leading-snug">
          Nivo buys <span className="font-semibold">operational improvement potential</span>, not technology risk.
        </p>
      </div>
    </div>
  );
}

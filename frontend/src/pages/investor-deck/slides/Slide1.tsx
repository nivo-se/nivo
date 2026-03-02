export function Slide1() {
  const highlights = [
    { label: "Target fund size", value: "SEK 1,000m" },
    { label: "Target gross IRR", value: "19-23%" },
    { label: "Target gross MOIC", value: "2.2-2.8x" },
    { label: "Base case hold", value: "5-10 years" },
  ];

  const pillars = [
    { number: "01", title: "Acquire Right", detail: "Disciplined entry, clear improvement headroom." },
    { number: "02", title: "Execute Relentlessly", detail: "Pricing discipline, margin expansion, reporting." },
    { number: "03", title: "Compound with Discipline", detail: "Reinvest cash flow, reduce debt, build equity." },
  ];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-[var(--deck-slide-gap)]">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4 flex-1 min-h-0">
        <div className="lg:col-span-3 flex flex-col justify-center gap-3 sm:gap-4 min-h-0">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-deck-accent/10 border border-deck-accent-border rounded-full text-deck-accent text-xs sm:text-sm font-semibold uppercase tracking-wider w-fit">
            Investor Brief
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-deck-fg leading-tight">
            Nordic Operational Compounder
          </h1>
          <p className="text-sm sm:text-base text-deck-accent max-w-2xl leading-snug">
            Nivo acquires profitable, under-digitised Nordic SMEs and builds value through pricing discipline, operating rigor, and structured reinvestment.
          </p>
          <div className="bg-deck-accent/10 border border-deck-accent-border rounded-lg p-3 sm:p-4">
            <p className="text-base sm:text-lg font-bold text-deck-quote-foreground leading-snug">
              We do not buy technology risk. We buy execution upside.
            </p>
          </div>
        </div>
        <div className="lg:col-span-2 bg-deck-surface border border-deck-border rounded-lg p-3 sm:p-4 shadow-[var(--deck-shadow-card)] flex flex-col justify-center">
          <p className="text-xs font-semibold text-deck-accent uppercase tracking-wider">Underwriting Snapshot</p>
          <h2 className="text-sm sm:text-base font-bold text-deck-fg mt-0.5">Disciplined Base Case</h2>
          <div className="space-y-1.5 mt-3">
            {highlights.map((item) => (
              <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-deck-border last:border-b-0">
                <span className="text-xs sm:text-sm text-deck-accent">{item.label}</span>
                <span className="text-xs sm:text-sm font-semibold text-deck-fg tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-deck-fg/70 leading-snug mt-2">
            Return profile: EBITDA growth and debt paydown, not multiple expansion.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 flex-shrink-0">
        {pillars.map((pillar) => (
          <div
            key={pillar.number}
            className="bg-deck-surface border border-deck-border rounded-lg p-2.5 sm:p-3 shadow-[var(--deck-shadow-card)]"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-deck-accent uppercase tracking-wider">Step {pillar.number}</span>
              <div className="w-5 h-5 rounded-full bg-deck-accent/10 border border-deck-accent-border" />
            </div>
            <h3 className="text-sm font-semibold text-deck-fg mt-1">{pillar.title}</h3>
            <p className="text-xs text-deck-fg/80 leading-snug mt-0.5">{pillar.detail}</p>
          </div>
        ))}
      </div>
      <p className="text-xs sm:text-sm text-deck-fg font-semibold text-center leading-snug flex-shrink-0">
        Execution → margins → cash flow → equity.
      </p>
    </div>
  );
}

export function Slide1() {
  const highlights = [
    { label: "Target fund size", value: "SEK 200m" },
    { label: "Target gross IRR", value: "19-23%" },
    { label: "Target gross MOIC", value: "2.2-2.8x" },
    { label: "Base case hold", value: "5 years" },
  ];

  const pillars = [
    {
      number: "01",
      title: "Acquire Right",
      detail: "Buy resilient SMEs at disciplined entry valuations with clear improvement headroom.",
    },
    {
      number: "02",
      title: "Execute Relentlessly",
      detail: "Drive pricing discipline, margin expansion, and reporting control from day one.",
    },
    {
      number: "03",
      title: "Compound with Discipline",
      detail: "Reinvest cash flow and reduce debt to build equity value through operations.",
    },
  ];

  return (
    <div className="h-full flex flex-col justify-center space-y-10">
      <div className="grid grid-cols-5 gap-8 items-stretch">
        <div className="col-span-3 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-deck-accent/10 border border-deck-accent/30 rounded-full text-deck-accent text-xs font-semibold uppercase tracking-wider">
            Investor Brief
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-deck-fg leading-tight">
              Nordic Operational
              <br />
              Compounder
            </h1>
            <p className="text-base text-deck-accent max-w-3xl leading-relaxed">
              Nivo acquires profitable but under-digitised Nordic SMEs and builds value through
              pricing discipline, operating rigor, and structured reinvestment.
            </p>
          </div>

          <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-xl p-6">
            <p className="text-xl font-semibold text-deck-fg leading-relaxed">
              We do not buy technology risk.
              <span className="text-deck-accent"> We buy execution upside.</span>
            </p>
          </div>
        </div>

        <div className="col-span-2 bg-deck-surface border border-deck-fg/10 rounded-xl p-6 shadow-sm space-y-4">
          <div>
            <p className="text-xs font-semibold text-deck-accent uppercase tracking-wider">
              Underwriting Snapshot
            </p>
            <h2 className="text-lg font-bold text-deck-fg mt-1">Disciplined Base Case</h2>
          </div>
          <div className="space-y-2">
            {highlights.map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-deck-fg/10 last:border-b-0">
                <span className="text-sm text-deck-accent">{item.label}</span>
                <span className="text-base font-semibold text-deck-fg">{item.value}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-deck-fg/70">
            Return profile is driven by EBITDA growth and debt paydown, not aggressive multiple expansion.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {pillars.map((pillar) => (
          <div
            key={pillar.number}
            className="bg-deck-surface border border-deck-fg/10 rounded-xl p-6 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-deck-accent uppercase tracking-wider">
                Step {pillar.number}
              </span>
              <div className="w-7 h-7 rounded-full bg-deck-accent/10 border border-deck-accent/30" />
            </div>
            <h3 className="text-lg font-semibold text-deck-fg">{pillar.title}</h3>
            <p className="text-sm text-deck-fg/80 leading-relaxed">{pillar.detail}</p>
          </div>
        ))}
      </div>

      <div className="bg-deck-surface border border-deck-fg/10 rounded-xl p-5 text-center shadow-sm">
        <p className="text-base text-deck-fg font-semibold tracking-tight">
          Execution expands margins. Margins expand cash flow. Cash flow compounds equity.
        </p>
      </div>
    </div>
  );
}

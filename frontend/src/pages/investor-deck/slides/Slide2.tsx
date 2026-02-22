export function Slide2() {
  return (
    <div className="h-full flex flex-col justify-center space-y-8">
      {/* Title */}
      <div className="space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-deck-fg">
          The Opportunity
        </h1>
        <p className="text-sm text-deck-accent max-w-4xl leading-relaxed">
          Nordic SMEs are often profitable but structurally under-digitised
        </p>
      </div>

      {/* Common Characteristics */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-8 space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center mb-2">
            <div className="w-6 h-6 border-2 border-deck-accent rounded"></div>
          </div>
          <h3 className="text-sm font-semibold text-deck-fg">Manual workflows</h3>
          <p className="text-deck-fg/70 leading-relaxed">
            Heavy reliance on spreadsheets, email, and manual processes
          </p>
        </div>

        <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-8 space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center mb-2">
            <div className="w-6 h-6 border-2 border-deck-accent rounded"></div>
          </div>
          <h3 className="text-sm font-semibold text-deck-fg">Limited system integration</h3>
          <p className="text-deck-fg/70 leading-relaxed">
            Fragmented technology landscape with minimal data flow
          </p>
        </div>

        <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-8 space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center mb-2">
            <div className="w-6 h-6 border-2 border-deck-accent rounded"></div>
          </div>
          <h3 className="text-sm font-semibold text-deck-fg">Pricing inefficiencies</h3>
          <p className="text-deck-fg/70 leading-relaxed">
            Cost-plus or legacy pricing without systematic value capture
          </p>
        </div>

        <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-8 space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center mb-2">
            <div className="w-6 h-6 border-2 border-deck-accent rounded"></div>
          </div>
          <h3 className="text-sm font-semibold text-deck-fg">Low operational transparency</h3>
          <p className="text-deck-fg/70 leading-relaxed">
            Limited visibility into margins, customer profitability, and operational KPIs
          </p>
        </div>
      </div>

      {/* Key Insight */}
      <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-8 text-center">
        <p className="text-base text-deck-fg font-semibold leading-relaxed">
          These companies do not require technological disruption.<br />
          <span className="text-deck-accent">They require operational elevation.</span>
        </p>
      </div>
    </div>
  );
}
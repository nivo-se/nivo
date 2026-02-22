import { TrendingUp, RefreshCw, DollarSign } from "lucide-react";

export function Slide21() {
  return (
    <div className="h-full flex flex-col justify-center space-y-4">
      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-deck-fg">
          Exit Strategy & Returns
        </h1>
        <p className="text-sm text-deck-accent">
          Value realization through multiple pathways
        </p>
      </div>

      {/* Exit Options */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-5 space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-deck-accent" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-deck-fg">Strategic Sale</h3>
            <p className="text-xs text-deck-fg/70">
              Sale to strategic buyer seeking capabilities or market position
            </p>
          </div>
          <div className="pt-2 border-t border-deck-fg/10">
            <p className="text-xs text-deck-accent font-semibold uppercase tracking-wider">Primary Exit</p>
          </div>
        </div>

        <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-5 space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-deck-accent" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-deck-fg">Secondary Buyout</h3>
            <p className="text-xs text-deck-fg/70">
              Sale to larger PE fund or growth equity investor
            </p>
          </div>
          <div className="pt-2 border-t border-deck-fg/10">
            <p className="text-xs text-deck-accent font-semibold uppercase tracking-wider">Secondary Path</p>
          </div>
        </div>

        <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-5 space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-deck-accent" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-deck-fg">Recapitalization</h3>
            <p className="text-xs text-deck-fg/70">
              Partial exit via dividend recap while maintaining control
            </p>
          </div>
          <div className="pt-2 border-t border-deck-fg/10">
            <p className="text-xs text-deck-accent font-semibold uppercase tracking-wider">Alternative Path</p>
          </div>
        </div>
      </div>

      {/* Value Creation Timeline */}
      <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-5 space-y-3">
        <h3 className="text-base font-semibold text-deck-fg">Value Creation Timeline</h3>
        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-deck-accent uppercase tracking-wider">Year 1-2</div>
            <p className="text-xs text-deck-fg">Operational initiatives deliver 200-300 bps of margin expansion</p>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold text-deck-accent uppercase tracking-wider">Year 3-4</div>
            <p className="text-xs text-deck-fg">Cash conversion and debt reduction increase equity value</p>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold text-deck-accent uppercase tracking-wider">Year 5-6</div>
            <p className="text-xs text-deck-fg">ROIC sustained at 15%+, strategic positioning improves</p>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold text-deck-accent uppercase tracking-wider">Year 7+</div>
            <p className="text-xs text-deck-fg">Exit or recapitalization based on market and portfolio readiness</p>
          </div>
        </div>
      </div>

      {/* Returns Profile */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-5 space-y-3 shadow-sm">
          <h3 className="text-base font-semibold text-deck-fg">Target Returns</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center py-1">
              <span className="text-deck-accent">Gross IRR</span>
              <span className="text-deck-fg font-semibold text-lg">19-23%</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-deck-accent">Net IRR (post-fees)</span>
              <span className="text-deck-fg font-semibold text-lg">15-18%</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-deck-accent">Target MOIC</span>
              <span className="text-deck-fg font-semibold text-lg">2.2-2.8x</span>
            </div>
          </div>
        </div>

        <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-5 space-y-3 shadow-sm">
          <h3 className="text-base font-semibold text-deck-fg">Value Drivers</h3>
          <div className="space-y-2">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-deck-accent">Margin expansion</span>
                <span className="text-deck-fg font-semibold">45%</span>
              </div>
              <div className="w-full h-1.5 bg-deck-fg/5 rounded-full">
                <div className="h-full bg-deck-accent rounded-full" style={{ width: "45%" }}></div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-deck-accent">Revenue growth</span>
                <span className="text-deck-fg font-semibold">35%</span>
              </div>
              <div className="w-full h-1.5 bg-deck-fg/5 rounded-full">
                <div className="h-full bg-deck-accent rounded-full" style={{ width: "35%" }}></div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-deck-accent">Debt paydown & cash conversion</span>
                <span className="text-deck-fg font-semibold">20%</span>
              </div>
              <div className="w-full h-1.5 bg-deck-fg/5 rounded-full">
                <div className="h-full bg-deck-accent rounded-full" style={{ width: "20%" }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Message */}
      <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-3 text-center shadow-sm">
        <p className="text-sm text-deck-fg font-semibold">
          Returns are driven by operations, cash conversion, and disciplined capital structure.
        </p>
      </div>
    </div>
  );
}

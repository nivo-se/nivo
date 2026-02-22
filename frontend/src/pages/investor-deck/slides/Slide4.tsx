import { Filter, Database, Target, Search } from "lucide-react";

export function Slide4() {
  return (
    <div className="h-full flex flex-col justify-center space-y-8">
      {/* Title */}
      <div className="space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-deck-fg">
          Sourcing Engine
        </h1>
        <p className="text-sm text-deck-accent max-w-4xl leading-relaxed">
          Disciplined pipeline development through data-driven analysis
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-8">
        {/* Systematic Segmentation */}
        <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center flex-shrink-0">
              <Filter className="w-6 h-6 text-deck-accent" />
            </div>
            <h3 className="text-base font-semibold text-deck-fg">Systematic Segmentation</h3>
          </div>
          <p className="text-deck-fg leading-relaxed">
            We analyse the Swedish SME universe within the target size band.
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-deck-accent mt-2 flex-shrink-0"></div>
              <p className="text-deck-fg/80">Revenue SEK 50–200m</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-deck-accent mt-2 flex-shrink-0"></div>
              <p className="text-deck-fg/80">Stable base economics</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-deck-accent mt-2 flex-shrink-0"></div>
              <p className="text-deck-fg/80">Signs of margin stagnation</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-deck-accent mt-2 flex-shrink-0"></div>
              <p className="text-deck-fg/80">Niche market positioning</p>
            </div>
          </div>
          <div className="pt-4 border-t border-deck-fg/10">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-deck-accent" />
              <span className="font-semibold text-deck-accent">Output: Ranked Target 100 shortlist</span>
            </div>
          </div>
        </div>

        {/* Outside-In Intelligence */}
        <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center flex-shrink-0">
              <Search className="w-6 h-6 text-deck-accent" />
            </div>
            <h3 className="text-base font-semibold text-deck-fg">Outside-In Intelligence</h3>
          </div>
          <p className="text-deck-fg leading-relaxed">
            Before engagement we analyse:
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-deck-accent mt-2 flex-shrink-0"></div>
              <p className="text-deck-fg/80">Products & services</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-deck-accent mt-2 flex-shrink-0"></div>
              <p className="text-deck-fg/80">Customer segments</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-deck-accent mt-2 flex-shrink-0"></div>
              <p className="text-deck-fg/80">Go-to-market model</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-deck-accent mt-2 flex-shrink-0"></div>
              <p className="text-deck-fg/80">Pricing structure</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-deck-accent mt-2 flex-shrink-0"></div>
              <p className="text-deck-fg/80">Operational signals</p>
            </div>
          </div>
          <div className="pt-4 border-t border-deck-fg/10">
            <p className="text-deck-accent font-semibold">
              This enables informed dialogue and disciplined entry decisions.
            </p>
          </div>
        </div>
      </div>

      {/* Process Flow */}
      <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-deck-accent" />
            <span className="text-deck-fg font-medium">Universe Analysis</span>
          </div>
          <div className="text-deck-accent text-2xl">→</div>
          <div className="flex items-center gap-3">
            <Filter className="w-6 h-6 text-deck-accent" />
            <span className="text-deck-fg font-medium">Systematic Filtering</span>
          </div>
          <div className="text-deck-accent text-2xl">→</div>
          <div className="flex items-center gap-3">
            <Search className="w-6 h-6 text-deck-accent" />
            <span className="text-deck-fg font-medium">Outside-In Research</span>
          </div>
          <div className="text-deck-accent text-2xl">→</div>
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6 text-deck-accent" />
            <span className="text-deck-fg font-medium">Prioritized Targets</span>
          </div>
        </div>
      </div>
    </div>
  );
}
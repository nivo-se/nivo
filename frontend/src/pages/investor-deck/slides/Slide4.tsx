import { Filter, Database, Target, Search } from "lucide-react";

export function Slide4() {
  return (
    <div className="h-full flex flex-col justify-center space-y-8">
      {/* Title */}
      <div className="space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#2E2A2B]">
          Sourcing Engine
        </h1>
        <p className="text-sm text-[#596152] max-w-4xl leading-relaxed">
          Disciplined pipeline development through data-driven analysis
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-8">
        {/* Systematic Segmentation */}
        <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#596152]/10 border border-[#596152]/30 flex items-center justify-center flex-shrink-0">
              <Filter className="w-6 h-6 text-[#596152]" />
            </div>
            <h3 className="text-base font-semibold text-[#2E2A2B]">Systematic Segmentation</h3>
          </div>
          <p className="text-[#2E2A2B] leading-relaxed">
            We analyse the Swedish SME universe within the target size band.
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#596152] mt-2 flex-shrink-0"></div>
              <p className="text-[#2E2A2B]/80">Revenue SEK 50–200m</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#596152] mt-2 flex-shrink-0"></div>
              <p className="text-[#2E2A2B]/80">Stable base economics</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#596152] mt-2 flex-shrink-0"></div>
              <p className="text-[#2E2A2B]/80">Signs of margin stagnation</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#596152] mt-2 flex-shrink-0"></div>
              <p className="text-[#2E2A2B]/80">Niche market positioning</p>
            </div>
          </div>
          <div className="pt-4 border-t border-[#2E2A2B]/10">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-[#596152]" />
              <span className="font-semibold text-[#596152]">Output: Ranked Target 100 shortlist</span>
            </div>
          </div>
        </div>

        {/* Outside-In Intelligence */}
        <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#596152]/10 border border-[#596152]/30 flex items-center justify-center flex-shrink-0">
              <Search className="w-6 h-6 text-[#596152]" />
            </div>
            <h3 className="text-base font-semibold text-[#2E2A2B]">Outside-In Intelligence</h3>
          </div>
          <p className="text-[#2E2A2B] leading-relaxed">
            Before engagement we analyse:
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#596152] mt-2 flex-shrink-0"></div>
              <p className="text-[#2E2A2B]/80">Products & services</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#596152] mt-2 flex-shrink-0"></div>
              <p className="text-[#2E2A2B]/80">Customer segments</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#596152] mt-2 flex-shrink-0"></div>
              <p className="text-[#2E2A2B]/80">Go-to-market model</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#596152] mt-2 flex-shrink-0"></div>
              <p className="text-[#2E2A2B]/80">Pricing structure</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#596152] mt-2 flex-shrink-0"></div>
              <p className="text-[#2E2A2B]/80">Operational signals</p>
            </div>
          </div>
          <div className="pt-4 border-t border-[#2E2A2B]/10">
            <p className="text-[#596152] font-semibold">
              This enables informed dialogue and disciplined entry decisions.
            </p>
          </div>
        </div>
      </div>

      {/* Process Flow */}
      <div className="bg-[#596152]/10 border border-[#596152]/30 rounded-lg p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-[#596152]" />
            <span className="text-[#2E2A2B] font-medium">Universe Analysis</span>
          </div>
          <div className="text-[#596152] text-2xl">→</div>
          <div className="flex items-center gap-3">
            <Filter className="w-6 h-6 text-[#596152]" />
            <span className="text-[#2E2A2B] font-medium">Systematic Filtering</span>
          </div>
          <div className="text-[#596152] text-2xl">→</div>
          <div className="flex items-center gap-3">
            <Search className="w-6 h-6 text-[#596152]" />
            <span className="text-[#2E2A2B] font-medium">Outside-In Research</span>
          </div>
          <div className="text-[#596152] text-2xl">→</div>
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6 text-[#596152]" />
            <span className="text-[#2E2A2B] font-medium">Prioritized Targets</span>
          </div>
        </div>
      </div>
    </div>
  );
}
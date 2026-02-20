export function Slide2() {
  return (
    <div className="h-full flex flex-col justify-center space-y-8">
      {/* Title */}
      <div className="space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#2E2A2B]">
          The Opportunity
        </h1>
        <p className="text-sm text-[#596152] max-w-4xl leading-relaxed">
          Nordic SMEs are often profitable but structurally under-digitised
        </p>
      </div>

      {/* Common Characteristics */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-8 space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-[#596152]/10 border border-[#596152]/30 flex items-center justify-center mb-2">
            <div className="w-6 h-6 border-2 border-[#596152] rounded"></div>
          </div>
          <h3 className="text-sm font-semibold text-[#2E2A2B]">Manual workflows</h3>
          <p className="text-[#2E2A2B]/70 leading-relaxed">
            Heavy reliance on spreadsheets, email, and manual processes
          </p>
        </div>

        <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-8 space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-[#596152]/10 border border-[#596152]/30 flex items-center justify-center mb-2">
            <div className="w-6 h-6 border-2 border-[#596152] rounded"></div>
          </div>
          <h3 className="text-sm font-semibold text-[#2E2A2B]">Limited system integration</h3>
          <p className="text-[#2E2A2B]/70 leading-relaxed">
            Fragmented technology landscape with minimal data flow
          </p>
        </div>

        <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-8 space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-[#596152]/10 border border-[#596152]/30 flex items-center justify-center mb-2">
            <div className="w-6 h-6 border-2 border-[#596152] rounded"></div>
          </div>
          <h3 className="text-sm font-semibold text-[#2E2A2B]">Pricing inefficiencies</h3>
          <p className="text-[#2E2A2B]/70 leading-relaxed">
            Cost-plus or legacy pricing without systematic value capture
          </p>
        </div>

        <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-8 space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-[#596152]/10 border border-[#596152]/30 flex items-center justify-center mb-2">
            <div className="w-6 h-6 border-2 border-[#596152] rounded"></div>
          </div>
          <h3 className="text-sm font-semibold text-[#2E2A2B]">Low operational transparency</h3>
          <p className="text-[#2E2A2B]/70 leading-relaxed">
            Limited visibility into margins, customer profitability, and operational KPIs
          </p>
        </div>
      </div>

      {/* Key Insight */}
      <div className="bg-[#596152]/10 border border-[#596152]/30 rounded-lg p-8 text-center">
        <p className="text-base text-[#2E2A2B] font-semibold leading-relaxed">
          These companies do not require technological disruption.<br />
          <span className="text-[#596152]">They require operational elevation.</span>
        </p>
      </div>
    </div>
  );
}
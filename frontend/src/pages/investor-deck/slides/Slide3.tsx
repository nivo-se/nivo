export function Slide3() {
  const items = [
    { label: "WHAT", value: "Acquire profitable under-digitised SMEs" },
    { label: "WHERE", value: "Nordic region" },
    { label: "SIZE", value: "SEK 50–200m revenue" },
    { label: "MODEL", value: "Operational compounder" },
    { label: "EDGE", value: "Proprietary segmentation engine" },
    { label: "VALUE CREATION", value: "Structured execution + selective AI enablement" },
    { label: "FINANCIAL DISCIPLINE", value: "15% normalized ROIC target" },
    { label: "REINVESTMENT", value: "100% reinvestment + ~30% leverage" },
    { label: "OUTCOME", value: "Long-term compounding equity growth" },
  ];

  return (
    <div className="h-full flex flex-col justify-center space-y-8">
      {/* Title */}
      <div className="space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#2E2A2B]">
          Investment Overview
        </h1>
        <p className="text-sm text-[#596152]">
          A disciplined approach to Nordic SME compounding
        </p>
      </div>

      {/* 9-Block Grid */}
      <div className="grid grid-cols-3 gap-4">
        {items.map((item, index) => (
          <div
            key={index}
            className="bg-white border border-[#2E2A2B]/10 rounded-lg p-6 space-y-3 hover:border-[#596152]/50 transition-colors shadow-sm"
          >
            <div className="text-xs font-semibold text-[#596152] uppercase tracking-wider">
              {item.label}
            </div>
            <div className="text-sm text-[#2E2A2B] leading-relaxed">
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Message */}
      <div className="bg-[#596152]/10 border border-[#596152]/30 rounded-lg p-6 text-center">
        <p className="text-base text-[#2E2A2B]">
          Nivo does not buy technology risk. <span className="font-semibold">Nivo buys operational improvement potential.</span>
        </p>
      </div>
    </div>
  );
}
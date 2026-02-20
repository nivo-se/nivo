import { ArrowRight } from "lucide-react";

export function Slide5() {
  const steps = [
    {
      number: "01",
      title: "Acquire",
      description: "Acquire profitable, under-digitised SME with proven business model and stable cash flows",
    },
    {
      number: "02",
      title: "Improve",
      description: "Implement structured improvements in pricing, sales discipline, cost structure and reporting",
    },
    {
      number: "03",
      title: "Optimize ROIC",
      description: "Increase return on invested capital toward normalized 15% through operational excellence",
    },
    {
      number: "04",
      title: "Reinvest",
      description: "Reinvest 100% of operational cash flow back into the business, supplemented by ~30% leverage",
    },
    {
      number: "05",
      title: "Compound",
      description: "Allow capital to compound annually. Repeat the cycle with increasing capability and scale",
    },
  ];

  return (
    <div className="h-full flex flex-col justify-center space-y-8">
      {/* Title */}
      <div className="space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#2E2A2B]">
          From Acquisition to Compounding
        </h1>
        <p className="text-sm text-[#596152] max-w-4xl leading-relaxed">
          A disciplined five-step process that strengthens with scale
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={index}>
            <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-6 hover:border-[#596152]/50 transition-colors shadow-sm">
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 rounded-lg bg-[#596152]/10 border border-[#596152]/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl font-bold text-[#596152]">{step.number}</span>
                </div>
                <div className="flex-1 space-y-2 pt-1">
                  <h3 className="text-sm font-semibold text-[#2E2A2B]">{step.title}</h3>
                  <p className="text-[#596152] leading-relaxed">{step.description}</p>
                </div>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className="flex justify-center py-2">
                <ArrowRight className="w-5 h-5 text-[#596152]/50 rotate-90" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom Message */}
      <div className="bg-[#596152]/10 border border-[#596152]/30 rounded-lg p-6 text-center">
        <p className="text-base text-[#2E2A2B] font-semibold">
          The model strengthens with scale: Each acquisition increases data, benchmarks and execution capability
        </p>
      </div>
    </div>
  );
}
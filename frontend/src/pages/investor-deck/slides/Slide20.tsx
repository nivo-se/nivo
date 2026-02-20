import { Shield, FileText, Users2, Gavel } from "lucide-react";

export function Slide20() {
  return (
    <div className="h-full flex flex-col justify-center space-y-4">
      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#2E2A2B]">
          Governance
        </h1>
        <p className="text-sm text-[#596152]">
          Clear ownership, defined decision rights, structured reporting
        </p>
      </div>

      {/* Governance Structure */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-5 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-[#596152]/10 border border-[#596152]/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#596152]" />
            </div>
            <h3 className="text-base font-semibold text-[#2E2A2B]">Ownership Model</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="space-y-1">
              <p className="font-semibold text-[#596152] uppercase tracking-wider">Control Structure</p>
              <p className="text-[#2E2A2B]">Majority equity ownership (51-100%)</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-[#596152] uppercase tracking-wider">Management</p>
              <p className="text-[#2E2A2B]">Board seats with operational oversight</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-[#596152] uppercase tracking-wider">Alignment</p>
              <p className="text-[#2E2A2B]">Incentives tied to ROIC and cash flow</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-5 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-[#596152]/10 border border-[#596152]/30 flex items-center justify-center">
              <Gavel className="w-5 h-5 text-[#596152]" />
            </div>
            <h3 className="text-base font-semibold text-[#2E2A2B]">Decision Rights</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="space-y-1">
              <p className="font-semibold text-[#596152] uppercase tracking-wider">Board Level</p>
              <p className="text-[#2E2A2B]">Strategy, capital allocation, M&A</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-[#596152] uppercase tracking-wider">Management Level</p>
              <p className="text-[#2E2A2B]">Day-to-day operations, hiring</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-[#596152] uppercase tracking-wider">Thresholds</p>
              <p className="text-[#2E2A2B]">Clear monetary limits defined</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reporting */}
      <div className="bg-[#596152]/10 border border-[#596152]/30 rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-[#596152]/20 border border-[#596152]/50 flex items-center justify-center">
            <FileText className="w-5 h-5 text-[#596152]" />
          </div>
          <h3 className="text-base font-semibold text-[#2E2A2B]">Structured Reporting Cadence</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#596152] uppercase tracking-wider">Monthly</div>
            <ul className="space-y-1 text-xs text-[#2E2A2B]">
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-[#596152] mt-1 flex-shrink-0"></div>
                <span>Financial statements</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-[#596152] mt-1 flex-shrink-0"></div>
                <span>KPI dashboard</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-[#596152] mt-1 flex-shrink-0"></div>
                <span>Cash flow updates</span>
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#596152] uppercase tracking-wider">Quarterly</div>
            <ul className="space-y-1 text-xs text-[#2E2A2B]">
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-[#596152] mt-1 flex-shrink-0"></div>
                <span>Board meetings</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-[#596152] mt-1 flex-shrink-0"></div>
                <span>Strategic reviews</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-[#596152] mt-1 flex-shrink-0"></div>
                <span>LP updates</span>
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#596152] uppercase tracking-wider">Annual</div>
            <ul className="space-y-1 text-xs text-[#2E2A2B]">
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-[#596152] mt-1 flex-shrink-0"></div>
                <span>Audited financials</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-[#596152] mt-1 flex-shrink-0"></div>
                <span>Portfolio valuations</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-[#596152] mt-1 flex-shrink-0"></div>
                <span>Strategic planning</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Investor Relations */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-4 space-y-2 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#596152]/10 border border-[#596152]/30 flex items-center justify-center">
              <Users2 className="w-4 h-4 text-[#596152]" />
            </div>
            <h3 className="text-sm font-semibold text-[#2E2A2B]">LP Communication</h3>
          </div>
          <div className="space-y-1 text-xs text-[#2E2A2B]/80">
            <p>Transparent, regular performance updates</p>
            <p>Direct GP access for questions</p>
            <p>Annual meetings with portfolio tours</p>
          </div>
        </div>

        <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-4 space-y-2 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#596152]/10 border border-[#596152]/30 flex items-center justify-center">
              <FileText className="w-4 h-4 text-[#596152]" />
            </div>
            <h3 className="text-sm font-semibold text-[#2E2A2B]">Documentation</h3>
          </div>
          <div className="space-y-1 text-xs text-[#2E2A2B]/80">
            <p>Standard Nordic PE fund docs</p>
            <p>Clear, enforceable LP protections</p>
            <p>Independent administrator & auditor</p>
          </div>
        </div>
      </div>

      {/* Key Message */}
      <div className="bg-white border border-[#2E2A2B]/10 rounded-lg p-3 text-center shadow-sm">
        <p className="text-sm text-[#2E2A2B] font-semibold">
          Disciplined governance protects capital and ensures alignment with investors.
        </p>
      </div>
    </div>
  );
}

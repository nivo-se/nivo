import { Shield, FileText, Users2, Gavel } from "lucide-react";

export function Slide20() {
  return (
    <div className="h-full flex flex-col justify-center space-y-4">
      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-deck-fg">
          Governance
        </h1>
        <p className="text-sm text-deck-accent">
          Clear ownership, defined decision rights, structured reporting
        </p>
      </div>

      {/* Governance Structure */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-5 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-deck-accent" />
            </div>
            <h3 className="text-base font-semibold text-deck-fg">Ownership Model</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="space-y-1">
              <p className="font-semibold text-deck-accent uppercase tracking-wider">Control Structure</p>
              <p className="text-deck-fg">Majority equity ownership (51-100%)</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-deck-accent uppercase tracking-wider">Management</p>
              <p className="text-deck-fg">Board seats with operational oversight</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-deck-accent uppercase tracking-wider">Alignment</p>
              <p className="text-deck-fg">Incentives tied to ROIC and cash flow</p>
            </div>
          </div>
        </div>

        <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-5 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center">
              <Gavel className="w-5 h-5 text-deck-accent" />
            </div>
            <h3 className="text-base font-semibold text-deck-fg">Decision Rights</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="space-y-1">
              <p className="font-semibold text-deck-accent uppercase tracking-wider">Board Level</p>
              <p className="text-deck-fg">Strategy, capital allocation, M&A</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-deck-accent uppercase tracking-wider">Management Level</p>
              <p className="text-deck-fg">Day-to-day operations, hiring</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-deck-accent uppercase tracking-wider">Thresholds</p>
              <p className="text-deck-fg">Clear monetary limits defined</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reporting */}
      <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-deck-accent/20 border border-deck-accent/50 flex items-center justify-center">
            <FileText className="w-5 h-5 text-deck-accent" />
          </div>
          <h3 className="text-base font-semibold text-deck-fg">Structured Reporting Cadence</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-deck-accent uppercase tracking-wider">Monthly</div>
            <ul className="space-y-1 text-xs text-deck-fg">
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-deck-accent mt-1 flex-shrink-0"></div>
                <span>Financial statements</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-deck-accent mt-1 flex-shrink-0"></div>
                <span>KPI dashboard</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-deck-accent mt-1 flex-shrink-0"></div>
                <span>Cash flow updates</span>
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-deck-accent uppercase tracking-wider">Quarterly</div>
            <ul className="space-y-1 text-xs text-deck-fg">
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-deck-accent mt-1 flex-shrink-0"></div>
                <span>Board meetings</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-deck-accent mt-1 flex-shrink-0"></div>
                <span>Strategic reviews</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-deck-accent mt-1 flex-shrink-0"></div>
                <span>LP updates</span>
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-deck-accent uppercase tracking-wider">Annual</div>
            <ul className="space-y-1 text-xs text-deck-fg">
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-deck-accent mt-1 flex-shrink-0"></div>
                <span>Audited financials</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-deck-accent mt-1 flex-shrink-0"></div>
                <span>Portfolio valuations</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-deck-accent mt-1 flex-shrink-0"></div>
                <span>Strategic planning</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Investor Relations */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-4 space-y-2 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center">
              <Users2 className="w-4 h-4 text-deck-accent" />
            </div>
            <h3 className="text-sm font-semibold text-deck-fg">LP Communication</h3>
          </div>
          <div className="space-y-1 text-xs text-deck-fg/80">
            <p>Transparent, regular performance updates</p>
            <p>Direct GP access for questions</p>
            <p>Annual meetings with portfolio tours</p>
          </div>
        </div>

        <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-4 space-y-2 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center">
              <FileText className="w-4 h-4 text-deck-accent" />
            </div>
            <h3 className="text-sm font-semibold text-deck-fg">Documentation</h3>
          </div>
          <div className="space-y-1 text-xs text-deck-fg/80">
            <p>Standard Nordic PE fund docs</p>
            <p>Clear, enforceable LP protections</p>
            <p>Independent administrator & auditor</p>
          </div>
        </div>
      </div>

      {/* Key Message */}
      <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-3 text-center shadow-sm">
        <p className="text-sm text-deck-fg font-semibold">
          Disciplined governance protects capital and ensures alignment with investors.
        </p>
      </div>
    </div>
  );
}

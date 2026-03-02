import { Shield, FileText, Users2, Gavel } from "lucide-react";

export function Slide20() {
  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-[var(--deck-slide-gap)]">
      <div className="flex-shrink-0 space-y-0.5">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-deck-fg">Governance</h1>
        <p className="text-xs sm:text-sm text-deck-accent leading-snug">Ownership, decision rights, reporting</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1 min-h-0">
        <div className="bg-deck-surface border border-deck-border rounded-lg p-2 sm:p-2.5 shadow-[var(--deck-shadow-card)] flex flex-col">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-deck-accent" />
            <h3 className="text-xs font-semibold text-deck-fg">Ownership</h3>
          </div>
          <div className="mt-1.5 space-y-1 text-[10px] sm:text-xs">
            <p><span className="font-semibold text-deck-accent">Control:</span> Majority 51–100%</p>
            <p><span className="font-semibold text-deck-accent">Board:</span> Operational oversight</p>
            <p><span className="font-semibold text-deck-accent">Alignment:</span> ROIC & cash flow incentives</p>
          </div>
        </div>
        <div className="bg-deck-surface border border-deck-border rounded-lg p-2 sm:p-2.5 shadow-[var(--deck-shadow-card)] flex flex-col">
          <div className="flex items-center gap-2">
            <Gavel className="w-5 h-5 text-deck-accent" />
            <h3 className="text-xs font-semibold text-deck-fg">Decision Rights</h3>
          </div>
          <div className="mt-1.5 space-y-1 text-[10px] sm:text-xs">
            <p><span className="font-semibold text-deck-accent">Board:</span> Strategy, capital, M&A</p>
            <p><span className="font-semibold text-deck-accent">Mgmt:</span> Day-to-day, hiring</p>
            <p><span className="font-semibold text-deck-accent">Thresholds:</span> Clear limits</p>
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2 sm:p-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          <FileText className="w-5 h-5 text-deck-accent" />
          <h3 className="text-xs font-semibold text-deck-fg">Reporting</h3>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[10px] sm:text-xs">
          <div>
            <p className="font-semibold text-deck-accent uppercase">Monthly</p>
            <p className="text-deck-fg/80">Financials, KPI, cash flow</p>
          </div>
          <div>
            <p className="font-semibold text-deck-accent uppercase">Quarterly</p>
            <p className="text-deck-fg/80">Board, strategy, LP updates</p>
          </div>
          <div>
            <p className="font-semibold text-deck-accent uppercase">Annual</p>
            <p className="text-deck-fg/80">Audit, valuations, planning</p>
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="bg-deck-surface border border-deck-border rounded-lg p-2 shadow-[var(--deck-shadow-card)] flex items-center gap-2">
          <Users2 className="w-5 h-5 text-deck-accent flex-shrink-0" />
          <p className="text-[10px] sm:text-xs text-deck-fg/80">LP: transparent updates, GP access, annual meetings</p>
        </div>
        <div className="bg-deck-surface border border-deck-border rounded-lg p-2 shadow-[var(--deck-shadow-card)] flex items-center gap-2">
          <FileText className="w-5 h-5 text-deck-accent flex-shrink-0" />
          <p className="text-[10px] sm:text-xs text-deck-fg/80">Nordic PE docs, LP protections, admin & auditor</p>
        </div>
      </div>
      <p className="text-[10px] sm:text-xs text-deck-fg font-semibold text-center flex-shrink-0">Disciplined governance protects capital and alignment.</p>
    </div>
  );
}

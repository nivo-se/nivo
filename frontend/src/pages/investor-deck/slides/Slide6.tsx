import { Building2, CheckCircle2, Eye } from "lucide-react";

export function Slide6() {
  const pipeline = [
    { stage: "Active Due Diligence", count: 2, color: "bg-deck-accent" },
    { stage: "Advanced Discussion", count: 5, color: "bg-deck-accent/70" },
    { stage: "Initial Contact", count: 12, color: "bg-deck-accent/40" },
    { stage: "Identified & Researched", count: 81, color: "bg-deck-fg/30" },
  ];

  const targetCompanies = [
    {
      name: "Company A",
      sector: "Industrial Services",
      revenue: "SEK 120m",
      employees: "~85",
      status: "Due Diligence",
      statusColor: "text-deck-accent",
    },
    {
      name: "Company B",
      sector: "Business Services",
      revenue: "SEK 75m",
      employees: "~50",
      status: "Advanced Discussion",
      statusColor: "text-deck-accent/80",
    },
    {
      name: "Company C",
      sector: "Specialized Distribution",
      revenue: "SEK 165m",
      employees: "~110",
      status: "Due Diligence",
      statusColor: "text-deck-accent",
    },
  ];

  return (
    <div className="h-full flex flex-col justify-center space-y-7">
      {/* Title */}
      <div className="space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-deck-fg">
          Pipeline
        </h1>
        <p className="text-sm text-deck-accent">
          Target 100 prioritized by operational improvement potential
        </p>
      </div>

      {/* Pipeline Status */}
      <div className="grid grid-cols-4 gap-4">
        {pipeline.map((item, index) => (
          <div key={index} className="bg-deck-surface border border-deck-fg/10 rounded-lg p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className={`w-3 h-3 rounded-full ${item.color}`} />
              <span className="text-3xl font-bold text-deck-fg">{item.count}</span>
            </div>
            <div className="text-sm text-deck-accent">{item.stage}</div>
          </div>
        ))}
      </div>

      {/* Active Targets */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-deck-accent" />
          <h2 className="text-base font-semibold text-deck-fg">Active Targets (Illustrative)</h2>
        </div>
        
        <div className="space-y-3">
          {targetCompanies.map((company, index) => (
            <div key={index} className="bg-deck-surface border border-deck-fg/10 rounded-lg p-6 shadow-sm">
              <div className="grid grid-cols-6 gap-6 items-center">
                <div className="col-span-2 flex items-center gap-4">
                  <div className="w-10 h-10 rounded bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-deck-accent" />
                  </div>
                  <div>
                    <div className="font-semibold text-deck-fg">{company.name}</div>
                    <div className="text-sm text-deck-accent/70">{company.sector}</div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-deck-accent/70">Revenue</div>
                  <div className="text-deck-fg font-semibold">{company.revenue}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-deck-accent/70">Employees</div>
                  <div className="text-deck-fg font-semibold">{company.employees}</div>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${company.statusColor}`} />
                  <span className={`text-sm font-medium ${company.statusColor}`}>
                    {company.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Note */}
      <div className="bg-deck-surface/50 border border-deck-fg/10 rounded-lg p-4">
        <p className="text-sm text-deck-accent text-center">
          Company names anonymized for confidentiality. All targets fit established selection criteria.
        </p>
      </div>
    </div>
  );
}
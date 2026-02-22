import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const ENTRY_REVENUE = 100;
const REVENUE_CAGR = 0.06;
const ENTRY_MARGIN = 0.1;
const TARGET_MARGIN = 0.13;
const ENTRY_MULTIPLE = 6.0;
const EXIT_MULTIPLE = 6.5;
const ENTRY_EQUITY = 45;
const ENTRY_DEBT = 15;
const YEARS = 5;

type ProjectionRow = {
  year: number;
  label: string;
  revenue: number;
  margin: number;
  ebitda: number;
  debt: number;
  enterpriseValue: number;
  equityValue: number;
};

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function buildProjection(): ProjectionRow[] {
  const rows: ProjectionRow[] = [];
  let debt = ENTRY_DEBT;

  for (let year = 0; year <= YEARS; year += 1) {
    const revenue = ENTRY_REVENUE * (1 + REVENUE_CAGR) ** year;
    const margin = Math.min(TARGET_MARGIN, ENTRY_MARGIN + year * 0.01);
    const ebitda = revenue * margin;
    const enterpriseValue = ebitda * ENTRY_MULTIPLE;
    const equityValue = enterpriseValue - debt;

    rows.push({
      year,
      label: `Y${year}`,
      revenue: round(revenue),
      margin: round(margin * 100),
      ebitda: round(ebitda),
      debt: round(debt),
      enterpriseValue: round(enterpriseValue),
      equityValue: round(equityValue),
    });

    if (year < YEARS) {
      debt = Math.max(0, debt - ebitda * 0.15);
    }
  }

  return rows;
}

export function Slide7() {
  const projection = buildProjection();
  const exit = projection[projection.length - 1];
  const exitEnterpriseValue = round(exit.ebitda * EXIT_MULTIPLE);
  const exitEquityValue = round(exitEnterpriseValue - exit.debt);
  const grossMoic = exitEquityValue / ENTRY_EQUITY;
  const grossIrr = (grossMoic ** (1 / YEARS) - 1) * 100;

  return (
    <div className="h-full flex flex-col justify-center space-y-7">
      <div className="space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-deck-fg">
          Investment Model
        </h1>
        <p className="text-sm text-deck-accent">
          Base case links operating improvements directly to equity value creation
        </p>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-semibold text-deck-fg">Underwriting Assumptions</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between border-b border-deck-fg/10 pb-2">
                <span className="text-deck-accent">Entry EV/EBITDA</span>
                <span className="font-semibold text-deck-fg">6.0x</span>
              </div>
              <div className="flex justify-between border-b border-deck-fg/10 pb-2">
                <span className="text-deck-accent">Exit EV/EBITDA</span>
                <span className="font-semibold text-deck-fg">6.5x</span>
              </div>
              <div className="flex justify-between border-b border-deck-fg/10 pb-2">
                <span className="text-deck-accent">Revenue CAGR</span>
                <span className="font-semibold text-deck-fg">6%</span>
              </div>
              <div className="flex justify-between border-b border-deck-fg/10 pb-2">
                <span className="text-deck-accent">EBITDA margin</span>
                <span className="font-semibold text-deck-fg">10% → 13%</span>
              </div>
              <div className="flex justify-between border-b border-deck-fg/10 pb-2">
                <span className="text-deck-accent">Entry leverage</span>
                <span className="font-semibold text-deck-fg">25% debt / 75% equity</span>
              </div>
              <div className="flex justify-between border-b border-deck-fg/10 pb-2">
                <span className="text-deck-accent">Hold period</span>
                <span className="font-semibold text-deck-fg">5 years</span>
              </div>
            </div>
          </div>

          <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-6 space-y-3">
            <h3 className="text-sm font-semibold text-deck-fg">Entry to Exit Bridge (Illustrative)</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <p className="text-deck-accent font-semibold">At Entry</p>
                <p className="text-deck-fg">EV: 60.0</p>
                <p className="text-deck-fg">Debt: 15.0</p>
                <p className="text-deck-fg font-semibold">Equity: 45.0</p>
              </div>
              <div className="space-y-2">
                <p className="text-deck-accent font-semibold">At Exit</p>
                <p className="text-deck-fg">EV: {exitEnterpriseValue}</p>
                <p className="text-deck-fg">Debt: {exit.debt}</p>
                <p className="text-deck-fg font-semibold">Equity: {exitEquityValue}</p>
              </div>
            </div>
            <div className="pt-3 border-t border-deck-accent/30 flex items-center justify-between">
              <p className="text-deck-fg font-semibold">Gross MOIC / IRR</p>
              <p className="text-deck-accent font-bold">{grossMoic.toFixed(2)}x / {grossIrr.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="bg-deck-surface border border-deck-fg/10 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-deck-fg mb-4">Enterprise Value Build (5 Years)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={projection} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--deck-fg) / 0.13)" />
              <XAxis dataKey="label" stroke="hsl(var(--deck-accent))" />
              <YAxis stroke="hsl(var(--deck-accent))" />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--deck-surface))", border: "1px solid hsl(var(--deck-fg) / 0.13)", borderRadius: 8 }}
                formatter={(value: number, name: string) => {
                  const label = name === "equityValue" ? "Equity Value" : "Net Debt";
                  return [value.toFixed(1), label];
                }}
              />
              <Bar dataKey="equityValue" stackId="a" fill="hsl(var(--deck-accent))" name="equityValue" />
              <Bar dataKey="debt" stackId="a" fill="hsl(var(--deck-accent) / 0.4)" name="debt" />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 overflow-hidden rounded border border-deck-fg/10">
            <table className="w-full text-xs">
              <thead className="bg-deck-accent/10">
                <tr>
                  <th className="px-2 py-1.5 text-left text-deck-fg font-semibold">Year</th>
                  <th className="px-2 py-1.5 text-right text-deck-fg font-semibold">Revenue</th>
                  <th className="px-2 py-1.5 text-right text-deck-fg font-semibold">EBITDA</th>
                  <th className="px-2 py-1.5 text-right text-deck-fg font-semibold">Net Debt</th>
                  <th className="px-2 py-1.5 text-right text-deck-accent font-semibold">Equity</th>
                </tr>
              </thead>
              <tbody className="bg-deck-surface">
                {projection.map((row) => (
                  <tr key={row.year} className="border-t border-deck-fg/5">
                    <td className="px-2 py-1.5 text-deck-fg">{row.label}</td>
                    <td className="px-2 py-1.5 text-right text-deck-fg">{row.revenue.toFixed(1)}</td>
                    <td className="px-2 py-1.5 text-right text-deck-fg">{row.ebitda.toFixed(1)}</td>
                    <td className="px-2 py-1.5 text-right text-deck-fg">{row.debt.toFixed(1)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-deck-accent">{row.equityValue.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-6 text-center">
        <p className="text-base text-deck-fg font-semibold">
          Returns are built by EBITDA growth and debt reduction, not aggressive multiple assumptions.
        </p>
      </div>
    </div>
  );
}

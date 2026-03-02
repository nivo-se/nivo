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
    if (year < YEARS) debt = Math.max(0, debt - ebitda * 0.15);
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
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-[var(--deck-slide-gap)]">
      <div className="flex-shrink-0 space-y-0.5">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-deck-fg">Investment Model</h1>
        <p className="text-xs sm:text-sm text-deck-accent leading-snug">Operating improvements → equity value creation</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 flex-1 min-h-0">
        <div className="space-y-2 min-h-0 flex flex-col">
          <div className="bg-deck-surface border border-deck-border rounded-lg p-2 sm:p-2.5 shadow-[var(--deck-shadow-card)]">
            <h3 className="text-xs font-semibold text-deck-fg">Assumptions</h3>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] sm:text-xs mt-1.5">
              <div className="flex justify-between"><span className="text-deck-accent">Entry EV/EBITDA</span><span className="font-semibold text-deck-fg">6.0x</span></div>
              <div className="flex justify-between"><span className="text-deck-accent">Exit EV/EBITDA</span><span className="font-semibold text-deck-fg">6.5x</span></div>
              <div className="flex justify-between"><span className="text-deck-accent">Revenue CAGR</span><span className="font-semibold text-deck-fg">6%</span></div>
              <div className="flex justify-between"><span className="text-deck-accent">Margin</span><span className="font-semibold text-deck-fg">10%→13%</span></div>
              <div className="flex justify-between"><span className="text-deck-accent">Leverage</span><span className="font-semibold text-deck-fg">25/75</span></div>
              <div className="flex justify-between"><span className="text-deck-accent">Hold</span><span className="font-semibold text-deck-fg">5y</span></div>
            </div>
          </div>
          <div className="bg-deck-accent/10 border border-deck-accent-border rounded-lg p-2 sm:p-2.5 flex-shrink-0">
            <h3 className="text-xs font-semibold text-deck-fg">Entry → Exit (Illustrative)</h3>
            <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-xs mt-1">
              <div>
                <p className="text-deck-accent font-semibold">Entry</p>
                <p className="text-deck-fg">Equity: 45.0</p>
              </div>
              <div>
                <p className="text-deck-accent font-semibold">Exit</p>
                <p className="text-deck-fg">Equity: {exitEquityValue}</p>
              </div>
            </div>
            <p className="text-xs font-bold text-deck-accent mt-1.5 pt-1 border-t border-deck-accent-border">
              Gross MOIC {grossMoic.toFixed(2)}x · IRR {grossIrr.toFixed(1)}%
            </p>
          </div>
        </div>
        <div className="bg-deck-surface border border-deck-border rounded-lg p-2 sm:p-2.5 shadow-[var(--deck-shadow-card)] min-h-0 flex flex-col">
          <h3 className="text-xs font-semibold text-deck-fg flex-shrink-0">EV Build (5Y)</h3>
          <div className="h-[100px] sm:h-[110px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projection} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--deck-fg) / 0.13)" />
                <XAxis dataKey="label" stroke="hsl(var(--deck-accent))" tick={{ fontSize: 10 }} />
                <YAxis stroke="hsl(var(--deck-accent))" tick={{ fontSize: 10 }} width={28} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--deck-surface))", border: "1px solid hsl(var(--deck-fg) / 0.13)", borderRadius: 6, fontSize: 11 }}
                  formatter={(value: number, name: string) => [value.toFixed(1), name === "equityValue" ? "Equity" : "Debt"]}
                />
                <Bar dataKey="equityValue" stackId="a" fill="hsl(var(--deck-accent))" name="equityValue" />
                <Bar dataKey="debt" stackId="a" fill="hsl(var(--deck-accent) / 0.4)" name="debt" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto rounded border border-deck-border flex-shrink-0 mt-1">
            <table className="w-full text-[10px] min-w-[240px]">
              <thead className="bg-deck-accent/10">
                <tr>
                  <th className="px-1.5 py-1 text-left text-deck-fg font-semibold">Y</th>
                  <th className="px-1.5 py-1 text-right text-deck-fg font-semibold">Rev</th>
                  <th className="px-1.5 py-1 text-right text-deck-fg font-semibold">EBITDA</th>
                  <th className="px-1.5 py-1 text-right text-deck-accent font-semibold">Equity</th>
                </tr>
              </thead>
              <tbody className="bg-deck-surface">
                {projection.map((row) => (
                  <tr key={row.year} className="border-t border-deck-border">
                    <td className="px-1.5 py-0.5 text-deck-fg">{row.label}</td>
                    <td className="px-1.5 py-0.5 text-right text-deck-fg">{row.revenue.toFixed(1)}</td>
                    <td className="px-1.5 py-0.5 text-right text-deck-fg">{row.ebitda.toFixed(1)}</td>
                    <td className="px-1.5 py-0.5 text-right font-semibold text-deck-accent">{row.equityValue.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="text-[10px] sm:text-xs text-deck-fg font-semibold text-center flex-shrink-0">Returns from EBITDA growth and debt reduction, not multiple expansion.</p>
    </div>
  );
}

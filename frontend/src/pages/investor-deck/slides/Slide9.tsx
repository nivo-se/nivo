import { TrendingUp, DollarSign, Cpu } from "lucide-react";

export function Slide9() {
  const playbooks = [
    {
      icon: TrendingUp,
      title: "Revenue",
      items: [
        "Pricing structure & discipline",
        "Sales process governance",
        "Customer retention focus",
        "Product mix optimization",
      ],
    },
    {
      icon: DollarSign,
      title: "Margins",
      items: [
        "Overhead optimisation",
        "Working capital management",
        "Procurement discipline",
        "Cost allocation clarity",
      ],
    },
    {
      icon: Cpu,
      title: "Digital & AI",
      items: [
        "Workflow automation",
        "Reporting transparency",
        "Data-enabled decision making",
        "AI increases execution capacity per employee",
      ],
    },
  ];

  return (
    <div className="h-full flex flex-col justify-center space-y-7">
      {/* Title */}
      <div className="space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-deck-fg">
          Value Creation Playbook
        </h1>
        <p className="text-sm text-deck-accent">
          Structured execution across three operational pillars
        </p>
      </div>

      {/* Playbooks Grid */}
      <div className="grid grid-cols-3 gap-6">
        {playbooks.map((playbook, index) => (
          <div
            key={index}
            className="bg-deck-surface border border-deck-fg/10 rounded-lg p-8 space-y-6 shadow-sm hover:border-deck-accent/30 transition-colors"
          >
            <div className="flex flex-col items-start gap-4">
              <div className="w-14 h-14 rounded-lg bg-deck-accent/10 border border-deck-accent/30 flex items-center justify-center flex-shrink-0">
                <playbook.icon className="w-7 h-7 text-deck-accent" />
              </div>
              <h3 className="text-base font-semibold text-deck-fg">{playbook.title}</h3>
            </div>
            <ul className="space-y-3">
              {playbook.items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-deck-accent mt-2 flex-shrink-0"></div>
                  <span className="text-deck-fg/80 text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Key Message */}
      <div className="bg-deck-accent/10 border border-deck-accent/30 rounded-lg p-6 text-center">
        <p className="text-base text-deck-fg font-semibold">
          AI increases execution capacity. Disciplined execution drives margins.
        </p>
      </div>
    </div>
  );
}

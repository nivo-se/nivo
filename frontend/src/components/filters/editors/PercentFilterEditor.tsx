import { Input } from "@/components/ui/input";

type Props = {
  op: string;
  value: unknown;
  onChange: (op: string, value: unknown) => void;
};

/**
 * Displays percent (e.g. 12) but stores ratio (0.12) for the API.
 * Accepts either "12" or "0.12" and normalizes to ratio.
 */
export function PercentFilterEditor({ op, value, onChange }: Props) {
  const toDisplay = (v: unknown): string => {
    if (v == null) return "";
    const n = Number(v);
    if (Number.isNaN(n)) return "";
    return n > 1 ? String(n) : (n * 100).toFixed(1);
  };
  const fromDisplay = (s: string): number | undefined => {
    const n = parseFloat(s);
    if (Number.isNaN(n)) return undefined;
    return n > 1 ? n / 100 : n;
  };

  const val = Array.isArray(value) ? value : value != null ? [value, value] : [undefined, undefined];
  const displayVal = [toDisplay(val[0]), toDisplay(val[1])];
  const isBetween = op === "between";

  if (isBetween) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <Input
          type="number"
          step="0.1"
          placeholder="Min %"
          value={displayVal[0]}
          onChange={(e) => onChange(op, [fromDisplay(e.target.value), val[1]])}
          className="h-7 text-[11px] w-20 shrink-0"
        />
        <span className="text-muted-foreground text-[11px] shrink-0">–</span>
        <Input
          type="number"
          step="0.1"
          placeholder="Max %"
          value={displayVal[1]}
          onChange={(e) => onChange(op, [val[0], fromDisplay(e.target.value)])}
          className="h-7 text-[11px] w-20 shrink-0"
        />
        <span className="text-muted-foreground text-[11px] shrink-0">%</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0 max-w-[120px]">
      <Input
        type="number"
        step="0.1"
        placeholder="%"
        value={displayVal[0]}
        onChange={(e) => onChange(op, fromDisplay(e.target.value))}
        className="h-7 text-[11px]"
      />
      <span className="text-muted-foreground text-[11px] shrink-0">%</span>
    </div>
  );
}

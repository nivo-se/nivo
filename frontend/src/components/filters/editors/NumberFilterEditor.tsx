import { Input } from "@/components/ui/input";

type Props = {
  op: string;
  value: unknown;
  onChange: (op: string, value: unknown) => void;
  unit?: string;
};

export function NumberFilterEditor({ op, value, onChange }: Props) {
  const raw = Array.isArray(value) ? value : value != null ? [Number(value), Number(value)] : [undefined, undefined];
  const val: [number | undefined, number | undefined] = [raw[0], raw[1]];
  const isBetween = op === "between";

  if (isBetween) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <Input
          type="number"
          placeholder="Min"
          value={val[0] ?? ""}
          onChange={(e) => onChange(op, [e.target.value ? Number(e.target.value) : undefined, val[1]])}
          className="h-7 text-[11px] w-20 shrink-0"
        />
        <span className="text-muted-foreground text-[11px] shrink-0">–</span>
        <Input
          type="number"
          placeholder="Max"
          value={val[1] ?? ""}
          onChange={(e) => onChange(op, [val[0], e.target.value ? Number(e.target.value) : undefined])}
          className="h-7 text-[11px] w-20 shrink-0"
        />
      </div>
    );
  }

  return (
    <Input
      type="number"
      value={val[0] ?? ""}
      onChange={(e) => onChange(op, e.target.value ? Number(e.target.value) : undefined)}
      className="h-7 text-[11px] max-w-[140px]"
      placeholder={op === ">=" ? "Min" : op === "<=" ? "Max" : "Value"}
    />
  );
}

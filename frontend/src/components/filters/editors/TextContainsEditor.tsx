import { Input } from "@/components/ui/input";

type Props = {
  value: unknown;
  onChange: (value: string) => void;
};

export function TextContainsEditor({ value, onChange }: Props) {
  const s = typeof value === "string" ? value : value != null ? String(value) : "";

  return (
    <Input
      placeholder="Contains..."
      value={s}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 text-[11px] max-w-[200px]"
    />
  );
}

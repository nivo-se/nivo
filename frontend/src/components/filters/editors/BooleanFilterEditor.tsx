import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  value: unknown;
  onChange: (value: boolean) => void;
};

export function BooleanFilterEditor({ value, onChange }: Props) {
  const b = value === true || value === "true" || value === 1;
  const str = b ? "yes" : "no";

  return (
    <Select value={str} onValueChange={(v) => onChange(v === "yes")}>
      <SelectTrigger className="h-7 text-[11px] w-[100px] border-0 bg-transparent shadow-none focus:ring-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="yes">Yes</SelectItem>
        <SelectItem value="no">No</SelectItem>
      </SelectContent>
    </Select>
  );
}

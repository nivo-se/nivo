import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NumberFilterEditor } from "./editors/NumberFilterEditor";
import { PercentFilterEditor } from "./editors/PercentFilterEditor";
import { BooleanFilterEditor } from "./editors/BooleanFilterEditor";
import { TextContainsEditor } from "./editors/TextContainsEditor";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type {
  FilterTaxonomy,
  FilterTaxonomyItem,
  FilterItem,
} from "@/lib/services/universeQueryService";

export type FilterRowState = Partial<FilterItem>;

type Props = {
  rowIndex: number;
  row: FilterRowState;
  taxonomy: FilterTaxonomy | null;
  taxonomyLoading?: boolean;
  onRowChange: (index: number, row: FilterRowState) => void;
  onRemove: (index: number) => void;
};

function flattenTaxonomyItems(taxonomy: FilterTaxonomy): FilterTaxonomyItem[] {
  return taxonomy.groups.flatMap((g) => g.items);
}

export function FilterRow({
  rowIndex,
  row,
  taxonomy,
  taxonomyLoading = false,
  onRowChange,
  onRemove,
}: Props) {
  const items = taxonomy ? flattenTaxonomyItems(taxonomy) : [];
  const selectedItem = row.field ? items.find((i) => i.field === row.field) : null;
  const op = row.op ?? (selectedItem?.type === "boolean" ? "=" : ">=");
  const value = row.value;

  const update = (updates: Partial<FilterRowState>) => {
    onRowChange(rowIndex, { ...row, ...updates });
  };

  const handleFieldSelect = (field: string) => {
    const item = items.find((i) => i.field === field);
    if (item) {
      update({
        field: item.field,
        op: item.type === "boolean" ? "=" : (item.ops[0] ?? "="),
        value: item.type === "boolean" ? undefined : undefined,
        type: item.type,
      });
    }
  };

  const handleOpChange = (newOp: string) => {
    update({ op: newOp });
  };

  const handleValueChange = (v: unknown) => {
    update({ value: v });
  };

  const renderValueEditor = () => {
    if (!selectedItem) return null;
    if (selectedItem.type === "number") {
      return (
        <NumberFilterEditor
          op={op}
          value={value}
          onChange={(o, v) => update({ op: o, value: v })}
          unit={selectedItem.unit}
        />
      );
    }
    if (selectedItem.type === "percent") {
      return (
        <PercentFilterEditor
          op={op}
          value={value}
          onChange={(o, v) => update({ op: o, value: v })}
        />
      );
    }
    if (selectedItem.type === "boolean") {
      return (
        <BooleanFilterEditor
          value={value}
          onChange={(v) => update({ value: v })}
        />
      );
    }
    if (selectedItem.type === "text" && selectedItem.ops.includes("contains")) {
      return (
        <TextContainsEditor
          value={value}
          onChange={(v) => update({ value: v })}
        />
      );
    }
    return null;
  };

  const opsForField = selectedItem?.ops ?? [];
  const showOpSelect = selectedItem && selectedItem.type !== "boolean" && opsForField.length > 1;

  return (
    <div className="grid grid-cols-[200px_110px_minmax(0,1fr)_32px] gap-2 h-9 items-center rounded-lg border px-2 bg-muted/10">
      <Select
        value={row.field ?? ""}
        onValueChange={handleFieldSelect}
        disabled={taxonomyLoading || !taxonomy}
      >
        <SelectTrigger className="h-7 text-[11px] border-0 bg-transparent shadow-none focus:ring-0 px-1">
          <SelectValue placeholder="Select field…" />
        </SelectTrigger>
        <SelectContent>
          {taxonomy?.groups.map((g) => (
            <SelectGroup key={g.id}>
              <SelectLabel className="text-[10px] uppercase text-muted-foreground">
                {g.label}
              </SelectLabel>
              {g.items.map((item) => (
                <SelectItem key={item.field} value={item.field}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {showOpSelect ? (
        <Select value={op} onValueChange={handleOpChange}>
          <SelectTrigger className="h-7 text-[11px] border-0 bg-transparent shadow-none focus:ring-0 px-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opsForField.map((o) => (
              <SelectItem key={o} value={o}>
                {o === ">=" ? "≥" : o === "<=" ? "≤" : o === "between" ? "Between" : o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div />
      )}
      <div className="min-w-0 flex items-center">
        {selectedItem && renderValueEditor()}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRemove(rowIndex)}
        className="h-7 w-7 shrink-0 rounded-md w-8"
        aria-label="Remove row"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

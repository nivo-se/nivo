import { Button } from "@/components/ui/button";
import { FilterRow, type FilterRowState } from "./FilterRow";
import type {
  FilterTaxonomy,
  FilterItem,
} from "@/lib/services/universeQueryService";
import { Plus } from "lucide-react";

function rowToFilter(row: FilterRowState): FilterItem | null {
  if (
    !row.field ||
    !row.op ||
    row.value === undefined ||
    row.value === null ||
    !row.type
  )
    return null;
  if (row.type === "text" && String(row.value).trim() === "") return null;
  if (
    (row.type === "number" || row.type === "percent") &&
    row.op !== "between" &&
    (typeof row.value !== "number" || Number.isNaN(row.value))
  )
    return null;
  if (
    row.op === "between" &&
    (!Array.isArray(row.value) || row.value[0] == null)
  )
    return null;
  return { field: row.field, op: row.op, value: row.value, type: row.type };
}

export type Props = {
  rows: FilterRowState[];
  taxonomy: FilterTaxonomy | null;
  taxonomyLoading?: boolean;
  onRowsChange: (rows: FilterRowState[]) => void;
};

/** Converts row stack to FilterItem[] (valid rows only). */
export function rowsToFilters(rows: FilterRowState[]): FilterItem[] {
  const out: FilterItem[] = [];
  for (const row of rows) {
    const f = rowToFilter(row);
    if (f) out.push(f);
  }
  return out;
}

export function FilterRows({
  rows,
  taxonomy,
  taxonomyLoading = false,
  onRowsChange,
}: Props) {
  const addRow = () => {
    onRowsChange([...rows, {}]);
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    if (next.length === 0) next.push({});
    onRowsChange(next);
  };

  const updateRow = (index: number, row: FilterRowState) => {
    const next = [...rows];
    next[index] = row;
    onRowsChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <FilterRow
          key={i}
          rowIndex={i}
          row={row}
          taxonomy={taxonomy}
          taxonomyLoading={taxonomyLoading}
          onRowChange={updateRow}
          onRemove={removeRow}
        />
      ))}
      <Button
        variant="outline"
        size="xs"
        onClick={addRow}
        className="h-7 px-2.5 text-[11px] rounded-full gap-1.5 w-fit"
      >
        <Plus className="h-3.5 w-3.5" />
        Add filter row
      </Button>
    </div>
  );
}

/**
 * Convert frontend Universe filter rules to backend CreateFromQuery payload format.
 */
const FIELD_TYPE_MAP: Record<string, string> = {
  revenue_latest: "number",
  ebitda_margin_latest: "percent",
  revenue_cagr_3y: "percent",
  employees_latest: "number",
  segment_names: "text",
  has_homepage: "boolean",
  has_ai_profile: "boolean",
  has_3y_financials: "boolean",
  is_stale: "boolean",
  data_quality_score: "number",
};

const OP_MAP: Record<string, string> = {
  gt: ">=",
  gte: ">=",
  lt: "<=",
  lte: "<=",
  eq: "=",
  contains: "contains",
};

export type FrontendFilterRule = { field: string; operator: string; value: unknown };

export function includeRulesToBackendFilters(
  rules: FrontendFilterRule[]
): { field: string; op: string; value: unknown; type: string }[] {
  return rules
    .filter((r) => r.field && r.operator && r.value !== undefined && r.value !== "")
    .filter((r) => OP_MAP[r.operator] != null) // skip neq etc.
    .map((r) => {
      const op = OP_MAP[r.operator]!;
      const type = FIELD_TYPE_MAP[r.field] ?? "number";
      return { field: r.field, op, value: r.value, type };
    });
}

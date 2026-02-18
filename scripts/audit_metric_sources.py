#!/usr/bin/env python3
"""
Audit metric sources across schema, backend endpoints, and frontend usage.

Read-only by design:
- Static scan always runs.
- Runtime SQL checks are optional and SELECT-only.

Usage:
  python3 scripts/audit_metric_sources.py
  python3 scripts/audit_metric_sources.py --runtime-sql
  python3 scripts/audit_metric_sources.py --runtime-sql --sample-size 300 --output docs/metric_audit.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


ROOT = Path(__file__).resolve().parents[1]


CORE_METRICS: Dict[str, Sequence[str]] = {
    "revenue": (
        r"\brevenue\b",
        r"\brevenue_latest\b",
        r"\blatest_revenue_sek\b",
        r"\brevenue_sek\b",
        r"\bsi_sek\b",
        r"\bsdi_sek\b",
    ),
    "ebitda": (
        r"\bebitda\b",
        r"\bebitda_latest\b",
        r"\blatest_ebitda_sek\b",
        r"\bebitda_sek\b",
        r"\bors_sek\b",
    ),
    "ebit": (
        r"\bebit\b",
        r"\blatest_ebit_sek\b",
        r"\bebit_sek\b",
        r"\bresultat_e_avskrivningar_sek\b",
    ),
    "profit": (
        r"\bprofit\b",
        r"\blatest_profit_sek\b",
        r"\bprofit_sek\b",
        r"\bdr_sek\b",
    ),
    "employees": (
        r"\bemployees\b",
        r"\bemployees_latest\b",
    ),
    "revenue_cagr_3y": (
        r"\brevenue_cagr_3y\b",
    ),
    "ebitda_margin": (
        r"\bebitda_margin\b",
        r"\bavg_ebitda_margin\b",
    ),
    "ebit_margin": (
        r"\bebit_margin\b",
        r"\bavg_ebit_margin\b",
    ),
    "net_margin": (
        r"\bnet_margin\b",
        r"\bavg_net_margin\b",
    ),
    "equity_ratio": (
        r"\bequity_ratio\b",
        r"\bequity_ratio_latest\b",
    ),
    "debt_to_equity": (
        r"\bdebt_to_equity\b",
        r"\bdebt_to_equity_latest\b",
    ),
    "growth_yoy": (
        r"\brevenue_growth_yoy\b",
        r"\byoy\b",
    ),
}


TABLE_NAME_RE = re.compile(
    r"CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?(TABLE|VIEW)\s+"
    r"(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)",
    re.IGNORECASE,
)

ROUTE_RE = re.compile(
    r'@router\.(get|post|put|patch|delete)\("([^"]+)"',
    re.IGNORECASE,
)

FUNC_RE = re.compile(r"^\s*async\s+def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(")


@dataclass
class RouteInfo:
    file: str
    line: int
    method: str
    path: str
    function: str
    referenced_tables: List[str]
    referenced_metrics: List[str]


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="latin-1")


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def find_sql_block(text: str, start_idx: int) -> str:
    """Best-effort extraction from CREATE ... up to the next ');'."""
    tail = text[start_idx:]
    end = tail.find(");")
    if end == -1:
        return tail
    return tail[: end + 2]


def parse_columns_from_create_table(create_block: str) -> Tuple[List[str], List[str], List[str]]:
    columns: List[str] = []
    pk_constraints: List[str] = []
    unique_constraints: List[str] = []

    in_parens = False
    for raw in create_block.splitlines():
        line = raw.strip()
        if not line:
            continue
        if "(" in line:
            in_parens = True
            # Skip the CREATE TABLE line itself.
            if line.upper().startswith("CREATE "):
                continue
        if not in_parens:
            continue
        if line.startswith(")"):
            break
        line_clean = line.rstrip(",")

        upper = line_clean.upper()
        if upper.startswith("PRIMARY KEY"):
            pk_constraints.append(line_clean)
            continue
        if " PRIMARY KEY" in upper:
            parts = line_clean.split()
            if parts:
                columns.append(parts[0].strip('"'))
                pk_constraints.append(parts[0].strip('"'))
            continue
        if upper.startswith("UNIQUE") or " UNIQUE" in upper:
            unique_constraints.append(line_clean)

        if line_clean.startswith("CONSTRAINT"):
            continue

        col_match = re.match(r'"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s+[a-zA-Z]', line_clean)
        if col_match:
            columns.append(col_match.group(1))

    return sorted(set(columns)), pk_constraints, unique_constraints


def enumerate_schema_objects(repo_root: Path) -> Dict[str, Any]:
    sql_files = sorted((repo_root / "database").rglob("*.sql"))
    objects: Dict[str, Dict[str, Any]] = {}

    for sql_file in sql_files:
        text = read_text(sql_file)
        for match in TABLE_NAME_RE.finditer(text):
            kind = match.group(1).upper()
            name = match.group(2)
            start = match.start()
            block = find_sql_block(text, start)

            entry = objects.setdefault(
                name,
                {
                    "kind": kind,
                    "definitions": [],
                },
            )
            if kind == "TABLE":
                columns, pks, uniques = parse_columns_from_create_table(block)
            else:
                columns, pks, uniques = [], [], []
            entry["definitions"].append(
                {
                    "file": str(sql_file.relative_to(repo_root)),
                    "kind": kind,
                    "line": text[:start].count("\n") + 1,
                    "columns": columns,
                    "primary_keys": pks,
                    "unique_constraints": uniques,
                }
            )
    return objects


def collect_routes(repo_root: Path) -> List[RouteInfo]:
    api_dir = repo_root / "backend" / "api"
    files = sorted(api_dir.glob("*.py"))
    routes: List[RouteInfo] = []
    known_tables = {
        "companies",
        "financials",
        "company_financials",
        "company_kpis",
        "company_metrics",
        "coverage_metrics",
        "saved_lists",
        "saved_list_items",
        "saved_company_lists",
        "prospects",
        "prospect_notes",
        "acquisition_runs",
        "company_analysis",
        "company_research",
        "ai_profiles",
        "company_enrichment",
        "enrichment_runs",
    }

    metric_patterns: Dict[str, List[re.Pattern[str]]] = {
        metric: [re.compile(p, re.IGNORECASE) for p in pats]
        for metric, pats in CORE_METRICS.items()
    }

    for file_path in files:
        lines = read_text(file_path).splitlines()
        idx = 0
        while idx < len(lines):
            m = ROUTE_RE.search(lines[idx])
            if not m:
                idx += 1
                continue

            method = m.group(1).upper()
            path = m.group(2)
            route_line = idx + 1

            fn_name = "unknown"
            fn_idx = idx + 1
            while fn_idx < len(lines):
                fm = FUNC_RE.match(lines[fn_idx])
                if fm:
                    fn_name = fm.group(1)
                    break
                fn_idx += 1
            block_end = fn_idx + 1
            while block_end < len(lines):
                if ROUTE_RE.search(lines[block_end]):
                    break
                block_end += 1
            block_text = "\n".join(lines[idx:block_end]).lower()

            ref_tables = sorted(
                t for t in known_tables if re.search(rf"\b{re.escape(t)}\b", block_text)
            )
            ref_metrics = sorted(
                metric
                for metric, patterns in metric_patterns.items()
                if any(p.search(block_text) for p in patterns)
            )
            routes.append(
                RouteInfo(
                    file=str(file_path.relative_to(repo_root)),
                    line=route_line,
                    method=method,
                    path=path,
                    function=fn_name,
                    referenced_tables=ref_tables,
                    referenced_metrics=ref_metrics,
                )
            )
            idx = block_end
    return routes


def iter_source_files(repo_root: Path) -> Iterable[Path]:
    include_roots = [
        repo_root / "backend",
        repo_root / "frontend" / "src",
        repo_root / "frontend" / "server",
        repo_root / "database",
        repo_root / "scripts",
    ]
    exts = {".py", ".ts", ".tsx", ".js", ".jsx", ".sql", ".md"}
    for root in include_roots:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix.lower() in exts:
                yield path


def collect_metric_hits(repo_root: Path) -> Dict[str, List[Dict[str, Any]]]:
    patterns = {
        metric: [re.compile(p, re.IGNORECASE) for p in pats]
        for metric, pats in CORE_METRICS.items()
    }
    hits: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for path in iter_source_files(repo_root):
        rel = str(path.relative_to(repo_root))
        for i, raw in enumerate(read_text(path).splitlines(), start=1):
            line = raw.strip()
            if not line:
                continue
            for metric, metric_pats in patterns.items():
                if any(p.search(line) for p in metric_pats):
                    hits[metric].append(
                        {
                            "file": rel,
                            "line": i,
                            "snippet": line[:220],
                        }
                    )
    return hits


def build_metric_usage_graph(
    routes: Sequence[RouteInfo],
    metric_hits: Dict[str, List[Dict[str, Any]]],
) -> Dict[str, Any]:
    graph: Dict[str, Any] = {}
    for metric in CORE_METRICS.keys():
        route_refs = [
            {
                "method": r.method,
                "path": r.path,
                "file": r.file,
                "line": r.line,
                "tables": r.referenced_tables,
            }
            for r in routes
            if metric in r.referenced_metrics
        ]
        frontend_refs = [
            h for h in metric_hits.get(metric, [])
            if h["file"].startswith("frontend/src/")
        ]
        graph[metric] = {
            "backend_routes": route_refs,
            "frontend_refs": frontend_refs[:120],
            "frontend_ref_count": len(frontend_refs),
        }
    return graph


def connect_psycopg() -> Any:
    try:
        import psycopg2
    except ImportError as exc:
        raise RuntimeError("psycopg2 is not installed; runtime SQL checks skipped") from exc

    load_env_file(ROOT / ".env")
    url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if url:
        return psycopg2.connect(url, connect_timeout=10)
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5433")),
        dbname=os.getenv("POSTGRES_DB", "nivo"),
        user=os.getenv("POSTGRES_USER", "nivo"),
        password=os.getenv("POSTGRES_PASSWORD", "nivo"),
        connect_timeout=10,
    )


def run_runtime_checks(sample_size: int) -> Dict[str, Any]:
    conn = connect_psycopg()
    cur = conn.cursor()

    def one(sql: str, params: Optional[Sequence[Any]] = None) -> Dict[str, Any]:
        cur.execute(sql, params or [])
        cols = [d[0] for d in cur.description]
        row = cur.fetchone()
        return dict(zip(cols, row)) if row else {}

    output: Dict[str, Any] = {}
    output["db_info"] = one(
        "SELECT current_database() AS current_database, version() AS version"
    )
    output["counts"] = one(
        """
        SELECT
          (SELECT COUNT(*) FROM companies) AS companies,
          (SELECT COUNT(*) FROM financials) AS financials_rows,
          (SELECT COUNT(*) FROM company_kpis) AS company_kpis_rows
        """
    )
    output["coverage"] = one(
        """
        WITH fin_years AS (
          SELECT orgnr, COUNT(DISTINCT year) AS years
          FROM financials
          GROUP BY orgnr
        ),
        fin_ac AS (
          SELECT DISTINCT orgnr
          FROM financials
          WHERE account_codes IS NOT NULL
            AND account_codes::text <> 'null'
            AND account_codes::text <> '{}'
        )
        SELECT
          (SELECT COUNT(*) FROM fin_years WHERE years >= 3) AS companies_ge_3y_financials,
          (SELECT COUNT(*) FROM fin_ac) AS companies_with_account_codes,
          (SELECT COUNT(*) FROM companies WHERE homepage IS NOT NULL AND BTRIM(homepage) <> '') AS companies_with_homepage,
          (SELECT COUNT(*) FROM companies WHERE email IS NOT NULL AND BTRIM(email) <> '') AS companies_with_email
        """
    )
    output["financial_year_distribution"] = one(
        """
        WITH fin_counts AS (
          SELECT orgnr,
                 COUNT(DISTINCT year) AS years_any,
                 COUNT(DISTINCT CASE WHEN (period = '12' OR RIGHT(COALESCE(period, ''), 2) = '12') THEN year END) AS years_annual
          FROM financials
          WHERE currency IS NULL OR currency = 'SEK'
          GROUP BY orgnr
        )
        SELECT
          COUNT(*) FILTER (WHERE years_any <= 1) AS companies_with_le_1_year_any,
          COUNT(*) FILTER (WHERE years_annual <= 1) AS companies_with_le_1_year_annual,
          COUNT(*) FILTER (WHERE years_annual >= 4) AS companies_with_ge_4_year_annual
        FROM fin_counts
        """
    )
    output["revenue_alignment_sample"] = one(
        f"""
        WITH sample AS (
          SELECT orgnr
          FROM companies
          ORDER BY random()
          LIMIT {int(sample_size)}
        ),
        k AS (
          SELECT s.orgnr, k.latest_revenue_sek
          FROM sample s
          LEFT JOIN company_kpis k ON k.orgnr = s.orgnr
        ),
        fa AS (
          SELECT DISTINCT ON (f.orgnr)
                 f.orgnr,
                 COALESCE(f.si_sek, f.sdi_sek) AS revenue_annual,
                 f.year AS year_annual
          FROM financials f
          JOIN sample s ON s.orgnr = f.orgnr
          WHERE (f.currency IS NULL OR f.currency = 'SEK')
            AND (f.period = '12' OR RIGHT(COALESCE(f.period, ''), 2) = '12')
          ORDER BY f.orgnr, f.year DESC, COALESCE(f.period, '') DESC
        ),
        fn AS (
          SELECT DISTINCT ON (f.orgnr)
                 f.orgnr,
                 COALESCE(f.si_sek, f.sdi_sek) AS revenue_any,
                 f.year AS year_any
          FROM financials f
          JOIN sample s ON s.orgnr = f.orgnr
          WHERE (f.currency IS NULL OR f.currency = 'SEK')
          ORDER BY f.orgnr, f.year DESC, COALESCE(f.period, '') DESC
        ),
        joined AS (
          SELECT
            k.orgnr,
            k.latest_revenue_sek,
            fa.revenue_annual,
            fn.revenue_any
          FROM k
          LEFT JOIN fa ON fa.orgnr = k.orgnr
          LEFT JOIN fn ON fn.orgnr = k.orgnr
        )
        SELECT
          COUNT(*) AS sampled,
          COUNT(*) FILTER (WHERE latest_revenue_sek IS NOT NULL) AS kpi_present,
          COUNT(*) FILTER (WHERE revenue_annual IS NOT NULL) AS annual_present,
          COUNT(*) FILTER (WHERE revenue_any IS NOT NULL) AS any_present,
          COUNT(*) FILTER (
            WHERE latest_revenue_sek IS NOT NULL
              AND revenue_annual IS NOT NULL
              AND ABS(latest_revenue_sek - revenue_annual) > 1
          ) AS kpi_vs_annual_mismatch,
          COUNT(*) FILTER (
            WHERE latest_revenue_sek IS NOT NULL
              AND revenue_annual IS NULL
              AND revenue_any IS NOT NULL
          ) AS kpi_without_annual_but_any_exists
        FROM joined
        """
    )
    output["kpi_revenue_below_50m"] = one(
        """
        SELECT
          COUNT(*) FILTER (WHERE latest_revenue_sek IS NOT NULL) AS kpi_non_null,
          COUNT(*) FILTER (WHERE latest_revenue_sek IS NOT NULL AND latest_revenue_sek < 50000000) AS kpi_below_50m,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE latest_revenue_sek IS NOT NULL AND latest_revenue_sek < 50000000)
            / NULLIF(COUNT(*) FILTER (WHERE latest_revenue_sek IS NOT NULL), 0),
            2
          ) AS pct_below_50m
        FROM company_kpis
        """
    )

    cur.close()
    conn.close()
    return output


def summarize_duplicate_concepts(schema_objects: Dict[str, Any]) -> List[str]:
    pairs = [
        ("financials", "company_financials"),
        ("company_kpis", "company_metrics"),
        ("saved_company_lists", "saved_lists"),
    ]
    findings: List[str] = []
    for a, b in pairs:
        if a in schema_objects and b in schema_objects:
            findings.append(f"{a} <-> {b}")
    return findings


def generate_report_payload(include_runtime: bool, sample_size: int) -> Dict[str, Any]:
    schema_objects = enumerate_schema_objects(ROOT)
    routes = collect_routes(ROOT)
    metric_hits = collect_metric_hits(ROOT)
    metric_graph = build_metric_usage_graph(routes, metric_hits)

    payload: Dict[str, Any] = {
        "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "repo_root": str(ROOT),
        "schema_object_count": len(schema_objects),
        "schema_objects": schema_objects,
        "duplicate_concepts": summarize_duplicate_concepts(schema_objects),
        "routes": [r.__dict__ for r in routes],
        "metric_graph": metric_graph,
        "metric_hit_counts": {k: len(v) for k, v in metric_hits.items()},
        "runtime_sql": None,
    }

    if include_runtime:
        try:
            payload["runtime_sql"] = run_runtime_checks(sample_size=sample_size)
        except Exception as exc:  # pragma: no cover - environment dependent
            payload["runtime_sql"] = {
                "error": str(exc),
                "note": "Runtime checks failed; static audit is still complete.",
            }
    return payload


def print_human_summary(payload: Dict[str, Any]) -> None:
    print("Metric Source Audit")
    print("=" * 80)
    print(f"Schema objects: {payload.get('schema_object_count')}")
    print("Duplicate concepts:")
    for item in payload.get("duplicate_concepts", []):
        print(f"  - {item}")
    print("")
    print("Top metric hit counts:")
    for metric, count in sorted(
        payload.get("metric_hit_counts", {}).items(), key=lambda x: x[1], reverse=True
    ):
        print(f"  - {metric}: {count}")
    print("")
    runtime = payload.get("runtime_sql")
    if runtime:
        if isinstance(runtime, dict) and runtime.get("error"):
            print("Runtime SQL: FAILED")
            print(f"  {runtime.get('error')}")
        else:
            print("Runtime SQL: OK")
            counts = runtime.get("counts", {})
            coverage = runtime.get("coverage", {})
            print(
                f"  companies={counts.get('companies')} financials_rows={counts.get('financials_rows')} "
                f"kpi_rows={counts.get('company_kpis_rows')}"
            )
            print(
                f"  coverage: >=3y={coverage.get('companies_ge_3y_financials')} "
                f"account_codes={coverage.get('companies_with_account_codes')}"
            )


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit metric sources (static + optional runtime SQL)")
    parser.add_argument(
        "--runtime-sql",
        action="store_true",
        help="Run optional SELECT-only SQL checks using DATABASE_URL/POSTGRES_*.",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=200,
        help="Sample size for runtime mismatch checks (default: 200).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional output file (.json recommended).",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress human summary and print only JSON if no --output provided.",
    )
    args = parser.parse_args()

    payload = generate_report_payload(
        include_runtime=bool(args.runtime_sql),
        sample_size=max(1, int(args.sample_size)),
    )

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
        if not args.quiet:
            print(f"Wrote audit payload: {args.output}")
            print_human_summary(payload)
    else:
        if not args.quiet:
            print_human_summary(payload)
            print("")
        print(json.dumps(payload, indent=2, default=str))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())


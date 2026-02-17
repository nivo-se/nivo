#!/usr/bin/env python3
"""
Postgres integrity audit (read-only).
Connects via DATABASE_URL or POSTGRES_* env vars.
Produces docs/POSTGRES_INTEGRITY_AUDIT.md.

Exit codes:
  0 = PASS (no blocking issues)
  1 = WARN (non-blocking issues)
  2 = FAIL (blocking: duplicates on core keys, orphans > 0.1%%, mismatch > 10%%, orgnr collisions)

No writes, no migrations, no deletes.
"""
from __future__ import annotations

import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = REPO_ROOT / "docs" / "POSTGRES_INTEGRITY_AUDIT.md"

# Thresholds
ORPHAN_FAIL_PCT = 0.001  # 0.1%
KPI_MISMATCH_WARN_PCT = 0.02  # 2%
KPI_MISMATCH_FAIL_PCT = 0.10  # 10%
KPI_MATCH_REL_DIFF = 0.005  # 0.5%
KPI_MATCH_ABS_DIFF = 1  # SEK tolerance for integer-ish values
SAMPLE_SIZE = 200


def _connect():
    """Connect to Postgres using DATABASE_URL or POSTGRES_* env vars."""
    try:
        import psycopg2
    except ImportError:
        print("❌ psycopg2 not found. Install: pip install psycopg2-binary")
        sys.exit(1)

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


def _redact_url(url: str | None) -> str:
    if not url:
        return "<not set, using POSTGRES_*>"
    m = re.match(r"postgres(?:ql)?://([^:]+):([^@]+)@([^/]+)/(.+?)(?:\?|$)", url)
    if m:
        user, _pwd, host, db = m.groups()
        return f"postgresql://{user}:***@{host}/{db}"
    return "<redacted>"


def _fetch_one(cur, sql: str, params=None):
    cur.execute(sql, params or ())
    row = cur.fetchone()
    return row[0] if row is not None else None


def _fetch_all(cur, sql: str, params=None):
    cur.execute(sql, params or ())
    return cur.fetchall()


def _table_exists(cur, table: str) -> bool:
    r = _fetch_one(
        cur,
        """
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = %s
        """,
        (table,),
    )
    return r is not None


def run_audit():
    results = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "db_url_redacted": _redact_url(
            os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
        ),
        "row_counts": {},
        "duplicates": {"companies": [], "company_kpis": [], "ai_profiles": [], "financials": []},
        "orphans": {},
        "orphan_samples": {},
        "orgnr_integrity": {
            "non_digit_count": 0,
            "non_digit_examples": [],
            "wrong_length_count": 0,
            "wrong_length_examples": [],
            "norm_collisions": [],
        },
        "kpi_sample": {"sampled": 0, "mismatches": 0, "mismatch_rate": 0.0, "examples": []},
        "coverage": {"view_exists": False, "has_homepage_mismatches": 0},
        "perf": {"universe_plan": None, "financials_plan": None},
    }

    with _connect() as conn:
        conn.autocommit = True
        cur = conn.cursor()

        # ---- Row counts ----
        for tbl in ("companies", "financials", "company_kpis", "ai_profiles", "saved_list_items", "company_analysis"):
            if _table_exists(cur, tbl):
                results["row_counts"][tbl] = _fetch_one(cur, f"SELECT COUNT(*) FROM {tbl}") or 0
            else:
                results["row_counts"][tbl] = None

        # ---- Duplicate checks ----
        # companies(orgnr)
        dup_c = _fetch_all(
            cur,
            "SELECT orgnr, count(*) c FROM companies GROUP BY orgnr HAVING count(*) > 1",
        )
        results["duplicates"]["companies"] = [(r[0], r[1]) for r in dup_c[:20]]

        # company_kpis(orgnr)
        dup_k = _fetch_all(
            cur,
            "SELECT orgnr, count(*) c FROM company_kpis GROUP BY orgnr HAVING count(*) > 1",
        )
        results["duplicates"]["company_kpis"] = [(r[0], r[1]) for r in dup_k[:20]]

        # ai_profiles: org_number (1 row per company per schema)
        dup_a = _fetch_all(
            cur,
            "SELECT org_number, count(*) c FROM ai_profiles GROUP BY org_number HAVING count(*) > 1",
        )
        results["duplicates"]["ai_profiles"] = [(r[0], r[1]) for r in dup_a[:20]]

        # financials(orgnr, year, period) - schema unique key; multiple periods/year are valid
        dup_f = _fetch_all(
            cur,
            "SELECT orgnr, year, period, count(*) c FROM financials GROUP BY orgnr, year, period HAVING count(*) > 1",
        )
        results["duplicates"]["financials"] = [(r[0], r[1], r[2], r[3]) for r in dup_f[:20]]

        # ---- Orphan checks ----
        r = _fetch_one(
            cur,
            "SELECT count(*) FROM financials f LEFT JOIN companies c ON c.orgnr=f.orgnr WHERE c.orgnr IS NULL",
        )
        results["orphans"]["financials"] = r or 0
        if r and r > 0:
            samples = _fetch_all(
                cur,
                "SELECT DISTINCT f.orgnr FROM financials f LEFT JOIN companies c ON c.orgnr=f.orgnr WHERE c.orgnr IS NULL LIMIT 20",
            )
            results["orphan_samples"]["financials"] = [s[0] for s in samples]
        else:
            results["orphan_samples"]["financials"] = []

        r = _fetch_one(
            cur,
            "SELECT count(*) FROM company_kpis k LEFT JOIN companies c ON c.orgnr=k.orgnr WHERE c.orgnr IS NULL",
        )
        results["orphans"]["company_kpis"] = r or 0
        if r and r > 0:
            samples = _fetch_all(
                cur,
                "SELECT DISTINCT k.orgnr FROM company_kpis k LEFT JOIN companies c ON c.orgnr=k.orgnr WHERE c.orgnr IS NULL LIMIT 20",
            )
            results["orphan_samples"]["company_kpis"] = [s[0] for s in samples]
        else:
            results["orphan_samples"]["company_kpis"] = []

        r = _fetch_one(
            cur,
            "SELECT count(*) FROM ai_profiles a LEFT JOIN companies c ON c.orgnr=a.org_number WHERE c.orgnr IS NULL",
        )
        results["orphans"]["ai_profiles"] = r or 0
        if r and r > 0:
            samples = _fetch_all(
                cur,
                "SELECT DISTINCT a.org_number FROM ai_profiles a LEFT JOIN companies c ON c.orgnr=a.org_number WHERE c.orgnr IS NULL LIMIT 20",
            )
            results["orphan_samples"]["ai_profiles"] = [s[0] for s in samples]
        else:
            results["orphan_samples"]["ai_profiles"] = []

        if _table_exists(cur, "saved_list_items"):
            r = _fetch_one(
                cur,
                "SELECT count(*) FROM saved_list_items s LEFT JOIN companies c ON c.orgnr=s.orgnr WHERE c.orgnr IS NULL",
            )
            results["orphans"]["saved_list_items"] = r or 0
            if r and r > 0:
                samples = _fetch_all(
                    cur,
                    "SELECT DISTINCT s.orgnr FROM saved_list_items s LEFT JOIN companies c ON c.orgnr=s.orgnr WHERE c.orgnr IS NULL LIMIT 20",
                )
                results["orphan_samples"]["saved_list_items"] = [s[0] for s in samples]
            else:
                results["orphan_samples"]["saved_list_items"] = []
        else:
            results["orphans"]["saved_list_items"] = None
            results["orphan_samples"]["saved_list_items"] = []

        if _table_exists(cur, "company_analysis"):
            r = _fetch_one(
                cur,
                "SELECT count(*) FROM company_analysis a LEFT JOIN companies c ON c.orgnr=a.orgnr WHERE a.orgnr IS NOT NULL AND c.orgnr IS NULL",
            )
            results["orphans"]["company_analysis"] = r or 0
            if r and r > 0:
                samples = _fetch_all(
                    cur,
                    "SELECT DISTINCT a.orgnr FROM company_analysis a LEFT JOIN companies c ON c.orgnr=a.orgnr WHERE a.orgnr IS NOT NULL AND c.orgnr IS NULL LIMIT 20",
                )
                results["orphan_samples"]["company_analysis"] = [s[0] for s in samples]
            else:
                results["orphan_samples"]["company_analysis"] = []
        else:
            results["orphans"]["company_analysis"] = None
            results["orphan_samples"]["company_analysis"] = []

        # ---- Orgnr integrity ----
        # companies.orgnr: non-digits
        r = _fetch_one(
            cur,
            "SELECT count(*) FROM companies WHERE orgnr !~ '^[0-9]+$'",
        )
        results["orgnr_integrity"]["non_digit_count"] = r or 0
        if r and r > 0:
            ex = _fetch_all(cur, "SELECT orgnr FROM companies WHERE orgnr !~ '^[0-9]+$' LIMIT 20")
            results["orgnr_integrity"]["non_digit_examples"] = [e[0] for e in ex]
        else:
            results["orgnr_integrity"]["non_digit_examples"] = []

        # companies.orgnr: length != 10
        r = _fetch_one(
            cur,
            "SELECT count(*) FROM companies WHERE length(orgnr) <> 10",
        )
        results["orgnr_integrity"]["wrong_length_count"] = r or 0
        if r and r > 0:
            ex = _fetch_all(cur, "SELECT orgnr, length(orgnr) FROM companies WHERE length(orgnr) <> 10 LIMIT 20")
            results["orgnr_integrity"]["wrong_length_examples"] = [(e[0], e[1]) for e in ex]
        else:
            results["orgnr_integrity"]["wrong_length_examples"] = []

        # Normalization collisions (same orgnr_norm, different orgnr strings)
        coll = _fetch_all(
            cur,
            """
            WITH norm AS (
                SELECT orgnr, regexp_replace(orgnr, '[^0-9]', '', 'g') AS orgnr_norm
                FROM companies
            )
            SELECT orgnr_norm, count(*), array_agg(orgnr)
            FROM norm
            GROUP BY orgnr_norm
            HAVING count(*) > 1
            LIMIT 20
            """,
        )
        results["orgnr_integrity"]["norm_collisions"] = [(r[0], r[1], list(r[2])) for r in coll]

        # ---- KPI vs financials sampling ----
        candidates = _fetch_all(
            cur,
            """
            SELECT k.orgnr
            FROM company_kpis k
            INNER JOIN financials f ON f.orgnr = k.orgnr
            WHERE k.latest_revenue_sek IS NOT NULL
              AND f.currency IS NOT DISTINCT FROM 'SEK'
              AND (f.period = '12' OR f.period LIKE '%%-12')
              AND (f.si_sek IS NOT NULL OR f.sdi_sek IS NOT NULL)
            GROUP BY k.orgnr
            ORDER BY RANDOM()
            LIMIT %s
            """,
            (SAMPLE_SIZE,),
        )
        orgnrs = [row[0] for row in candidates] if candidates else []

        if len(orgnrs) >= 1:
            placeholders = ",".join("%s" for _ in orgnrs)
            rows = _fetch_all(
                cur,
                f"""
                WITH kpi_rev AS (
                    SELECT orgnr, latest_revenue_sek FROM company_kpis
                    WHERE orgnr IN ({placeholders})
                ),
                fin_rev AS (
                    SELECT DISTINCT ON (orgnr) orgnr,
                        COALESCE(si_sek, sdi_sek) AS revenue_sek
                    FROM financials
                    WHERE orgnr IN ({placeholders})
                      AND (currency IS NULL OR currency = 'SEK')
                      AND (period = '12' OR period LIKE '%%-12')
                    ORDER BY orgnr, year DESC
                )
                SELECT k.orgnr, k.latest_revenue_sek AS kpi_rev, f.revenue_sek AS fin_rev
                FROM kpi_rev k
                LEFT JOIN fin_rev f ON f.orgnr = k.orgnr
                WHERE f.revenue_sek IS NOT NULL AND k.latest_revenue_sek IS NOT NULL
                """,
                orgnrs + orgnrs,
            )
            mismatches = 0
            examples = []
            for row in rows:
                kpi_rev = float(row[1]) if row[1] is not None else None
                fin_rev = float(row[2]) if row[2] is not None else None
                if kpi_rev is not None and fin_rev is not None and fin_rev > 0:
                    abs_diff = abs(kpi_rev - fin_rev)
                    rel_diff = abs_diff / fin_rev
                    is_match = abs_diff <= KPI_MATCH_ABS_DIFF or rel_diff <= KPI_MATCH_REL_DIFF
                    if not is_match:
                        mismatches += 1
                        if len(examples) < 10:
                            examples.append((row[0], kpi_rev, fin_rev, rel_diff * 100))
            results["kpi_sample"]["sampled"] = len(rows) if rows else 0
            results["kpi_sample"]["mismatches"] = mismatches
            results["kpi_sample"]["mismatch_rate"] = (
                mismatches / len(rows) if rows else 0.0
            )
            results["kpi_sample"]["examples"] = examples
        else:
            results["kpi_sample"]["sampled"] = 0

        # ---- Coverage sanity ----
        r = _fetch_one(
            cur,
            "SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='coverage_metrics'",
        )
        results["coverage"]["view_exists"] = r is not None

        if results["coverage"]["view_exists"]:
            # Sample 500: compare cm.has_homepage vs (companies.homepage IS NOT NULL AND != '')
            r = _fetch_one(
                cur,
                """
                WITH sample AS (
                    SELECT c.orgnr,
                        (c.homepage IS NOT NULL AND c.homepage != '') AS c_has,
                        cm.has_homepage AS cm_has
                    FROM companies c
                    JOIN coverage_metrics cm ON cm.orgnr = c.orgnr
                    LIMIT 500
                )
                SELECT count(*) FROM sample WHERE c_has != cm_has
                """,
            )
            results["coverage"]["has_homepage_mismatches"] = r or 0

        # ---- Optional performance sniff ----
        try:
            plan = _fetch_all(
                cur,
                "EXPLAIN (FORMAT TEXT) SELECT orgnr FROM coverage_metrics ORDER BY data_quality_score LIMIT 50",
            )
            results["perf"]["universe_plan"] = "\n".join(r[0] for r in plan) if plan else None
        except Exception:
            results["perf"]["universe_plan"] = "(query failed)"

        try:
            test_orgnr = orgnrs[0] if orgnrs else "0000000000"
            plan = _fetch_all(
                cur,
                "EXPLAIN (FORMAT TEXT) SELECT * FROM financials WHERE orgnr = %s ORDER BY year DESC LIMIT 5",
                (test_orgnr,),
            )
            results["perf"]["financials_plan"] = "\n".join(r[0] for r in plan) if plan else None
        except Exception:
            results["perf"]["financials_plan"] = "(query failed)"

    return results


def _dup_status(dup: dict) -> tuple[str, bool]:
    total = sum(len(v) for v in dup.values() if isinstance(v, list))
    return ("FAIL" if total > 0 else "PASS", total == 0)


def _orphan_status(orphans: dict, row_counts: dict) -> tuple[str, bool]:
    tbl_to_count = {"financials": "financials", "company_kpis": "company_kpis",
                    "ai_profiles": "ai_profiles", "saved_list_items": "saved_list_items",
                    "company_analysis": "company_analysis"}
    status = "PASS"
    for k, v in orphans.items():
        if v is None or v == 0:
            continue
        total = row_counts.get(tbl_to_count.get(k, k))
        if total is not None and total > 0:
            pct = v / total
            if pct > ORPHAN_FAIL_PCT:
                status = "FAIL"
                break
            else:
                status = "WARN"
        else:
            if v > 0:
                status = "WARN"
    return status, status == "PASS"


def _kpi_status(kpi: dict) -> tuple[str, bool]:
    if kpi["sampled"] == 0:
        return "PASS", True
    rate = kpi["mismatch_rate"]
    if rate > KPI_MISMATCH_FAIL_PCT:
        return "FAIL", False
    if rate > KPI_MISMATCH_WARN_PCT:
        return "WARN", True
    return "PASS", True


def _orgnr_status(oi: dict) -> tuple[str, bool]:
    """Orgnr integrity: norm_collisions = FAIL (same company twice); non-digit/wrong-length = WARN."""
    if len(oi.get("norm_collisions", [])) > 0:
        return "FAIL", False
    if oi.get("non_digit_count", 0) > 0 or oi.get("wrong_length_count", 0) > 0:
        return "WARN", True
    return "PASS", True


def write_report(results: dict) -> int:
    dup = results["duplicates"]
    orphans = results["orphans"]
    kpi = results["kpi_sample"]
    rc = results["row_counts"]

    dup_status, dup_ok = _dup_status(dup)
    orphan_status, orphan_ok = _orphan_status(orphans, rc)
    kpi_status, kpi_ok = _kpi_status(kpi)
    orgnr_status, orgnr_ok = _orgnr_status(results.get("orgnr_integrity", {}))

    # Overall: FAIL > WARN > PASS
    overall = "PASS"
    if dup_status == "FAIL" or orphan_status == "FAIL" or kpi_status == "FAIL" or orgnr_status == "FAIL":
        overall = "FAIL"
        exit_code = 2
    elif dup_status == "WARN" or orphan_status == "WARN" or kpi_status == "WARN" or orgnr_status == "WARN":
        overall = "WARN"
        exit_code = 1
    else:
        exit_code = 0

    lines = [
        "# Postgres Integrity Audit Report",
        "",
        f"**Generated:** {results['timestamp']}",
        f"**Database:** {results['db_url_redacted']}",
        "",
        "## Row counts",
        "",
        "| Table | Count |",
        "|-------|-------|",
    ]
    for tbl in ("companies", "financials", "company_kpis", "ai_profiles"):
        c = rc.get(tbl)
        lines.append(f"| {tbl} | {c if c is not None else 'N/A'} |")

    lines.extend([
        "",
        "---",
        "",
        "## 1. Duplicate checks",
        "",
        f"**Status:** {'❌ ' + dup_status if dup_status != 'PASS' else '✅ ' + dup_status}",
        "",
        "| Table | Key | Duplicate groups | Top offenders |",
        "|-------|-----|------------------|---------------|",
    ])

    def _dup_row(label: str, key: str, offenders: list) -> str:
        if not offenders:
            return f"| {label} | {key} | 0 | — |"
        top = "; ".join(f"{o[0]}({o[1]})" for o in offenders[:5])
        if len(offenders) > 5:
            top += f" … +{len(offenders)-5} more"
        return f"| {label} | {key} | {len(offenders)} groups | {top} |"

    lines.append(_dup_row("companies", "orgnr", dup["companies"]))
    lines.append(_dup_row("company_kpis", "orgnr", dup["company_kpis"]))
    lines.append(_dup_row("ai_profiles", "org_number", dup["ai_profiles"]))
    if dup["financials"]:
        top = "; ".join(f"{o[0]}/{o[1]}/{o[2]}({o[3]})" for o in dup["financials"][:5])
        if len(dup["financials"]) > 5:
            top += f" … +{len(dup['financials'])-5} more"
        lines.append(f"| financials | orgnr, year, period | {len(dup['financials'])} groups | {top} |")
    else:
        lines.append("| financials | orgnr, year, period | 0 | — |")

    lines.extend([
        "",
        "---",
        "",
        "## 2. Orphan checks",
        "",
        f"**Status:** {'❌ ' + orphan_status if orphan_status != 'PASS' else '⚠️ ' + orphan_status if orphan_status == 'WARN' else '✅ ' + orphan_status}",
        "",
        "| Check | Count |",
        "|-------|-------|",
        f"| financials.orgnr not in companies | {orphans.get('financials', 0)} |",
        f"| company_kpis.orgnr not in companies | {orphans.get('company_kpis', 0)} |",
        f"| ai_profiles.org_number not in companies | {orphans.get('ai_profiles', 0)} |",
        f"| saved_list_items.orgnr not in companies | {orphans.get('saved_list_items') if orphans.get('saved_list_items') is not None else 'N/A'} |",
        f"| company_analysis.orgnr not in companies | {orphans.get('company_analysis') if orphans.get('company_analysis') is not None else 'N/A'} |",
        "",
    ])
    # Orphan samples
    samples = results.get("orphan_samples", {})
    for tbl in ("financials", "company_kpis", "ai_profiles", "saved_list_items", "company_analysis"):
        if samples.get(tbl) and orphans.get(tbl, 0) > 0:
            lines.append(f"Sample offending orgnr ({tbl}): {', '.join(str(s) for s in samples[tbl][:10])}")
            if len(samples[tbl]) > 10:
                lines.append(f"  … +{len(samples[tbl])-10} more")
            lines.append("")
    lines.extend([
        "---",
        "",
        "## 3. Orgnr integrity",
        "",
        f"**Status:** {'❌ ' + orgnr_status if orgnr_status != 'PASS' else '⚠️ ' + orgnr_status if orgnr_status == 'WARN' else '✅ ' + orgnr_status}",
        "",
    ])
    oi = results.get("orgnr_integrity", {})
    nd = oi.get("non_digit_count", 0)
    wl = oi.get("wrong_length_count", 0)
    nc = oi.get("norm_collisions", [])
    lines.extend([
        f"- **companies.orgnr with non-digits:** {nd}",
    ])
    if oi.get("non_digit_examples"):
        lines.append(f"  Examples (top 20): {', '.join(repr(e) for e in oi['non_digit_examples'][:10])}")
        if len(oi["non_digit_examples"]) > 10:
            lines.append(f"  … +{len(oi['non_digit_examples'])-10} more")
    lines.extend([
        "",
        f"- **companies.orgnr with length ≠ 10:** {wl}",
    ])
    if oi.get("wrong_length_examples"):
        ex = oi["wrong_length_examples"][:10]
        lines.append(f"  Examples: {', '.join(f'{e[0]}(len={e[1]})' for e in ex)}")
    lines.extend([
        "",
        f"- **Normalization collisions** (same orgnr_norm, different raw values): {len(nc)} groups",
    ])
    if nc:
        for row in nc[:5]:
            lines.append(f"  - orgnr_norm={row[0]} count={row[1]} variants={row[2]}")
        if len(nc) > 5:
            lines.append(f"  … +{len(nc)-5} more")
    lines.extend([
        "",
        "---",
        "",
        "## 4. KPI vs financials sampling",
        "",
        f"**Status:** {'❌ ' + kpi_status if kpi_status != 'PASS' else '⚠️ ' + kpi_status if kpi_status == 'WARN' else '✅ ' + kpi_status}",
        "",
        f"- Sampled: {kpi['sampled']} companies (max {SAMPLE_SIZE})",
        f"- Mismatches (abs diff > {KPI_MATCH_ABS_DIFF} AND rel diff > {KPI_MATCH_REL_DIFF*100}%%): {kpi['mismatches']}",
        f"- Mismatch rate: {kpi['mismatch_rate']*100:.1f}%%",
        "",
    ])

    if kpi.get("examples"):
        lines.append("**Example mismatches (orgnr, kpi_rev, fin_rev, rel_diff%%):**")
        for ex in kpi["examples"][:5]:
            lines.append(f"- {ex[0]}: {ex[1]:.0f} vs {ex[2]:.0f} ({ex[3]:.2f}%%)")
        lines.append("")

    lines.extend([
        "---",
        "",
        "## 5. Coverage sanity",
        "",
        f"- coverage_metrics view exists: {'✅' if results['coverage']['view_exists'] else '❌'}",
        f"- has_homepage alignment mismatches (sample 500): {results['coverage']['has_homepage_mismatches']}",
        "",
        "---",
        "",
        "## 6. Performance sniff (EXPLAIN only)",
        "",
        "**Universe base query:**",
        "```",
        (results["perf"]["universe_plan"] or "(not run)"),
        "```",
        "",
        "**Financials drilldown:**",
        "```",
        (results["perf"]["financials_plan"] or "(not run)"),
        "```",
        "",
        "---",
        "",
        "## Summary",
        "",
        f"| Overall | **{overall}** |",
        "",
        "- **PASS:** All critical checks pass; mismatch/orphans under thresholds.",
        "- **WARN:** Minor issues (orphans present but <0.1%%; mismatch 2–10%%).",
        "- **FAIL:** Duplicates on core keys, or orphans >0.1%%, or mismatch >10%%, or orgnr normalization collisions.",
        "",
    ])

    if overall in ("WARN", "FAIL"):
        lines.extend([
            "---",
            "",
            "## Recommended actions",
            "",
        ])
        if dup_status != "PASS":
            lines.append("- **Duplicates:** Investigate and deduplicate. Core keys must be unique.")
        if orphan_status != "PASS":
            lines.append("- **Orphans:** Remove or fix orphan rows. FK constraints should prevent these.")
        if kpi_status != "PASS":
            lines.append(f"- **KPI vs financials ({kpi['mismatch_rate']*100:.1f}% mismatch):** Review company_kpis aggregation or financials data.")
        if orgnr_status != "PASS":
            oi = results.get("orgnr_integrity", {})
            if oi.get("norm_collisions"):
                lines.append("- **Orgnr normalization collisions:** Same company stored with different orgnr formats (e.g. hyphen/space). Add orgnr_norm for joins; consider one-time normalization.")
            else:
                lines.append("- **Orgnr format (non-digit/wrong-length):** Normalize orgnr to 10 digits. Use orgnr_norm for joins until stored values are fixed.")
        lines.append("")

    lines.extend([
        "---",
        "",
        "## How to run",
        "",
        "```",
        "python3 scripts/audit_postgres_integrity.py",
        "```",
        "",
        "**Exit codes:**",
        "- `0` = PASS (no blocking issues)",
        "- `1` = WARN (non-blocking issues)",
        "- `2` = FAIL (blocking issues)",
        "",
    ])

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"Report written to {OUTPUT_PATH}")
    return exit_code


def main():
    results = run_audit()
    exit_code = write_report(results)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()

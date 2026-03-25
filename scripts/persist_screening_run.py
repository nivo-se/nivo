#!/usr/bin/env python3
"""
Persist a screening batch (Layer 1 + optional Layer 2 + optional pipeline manifests) to Postgres.

Reads manifest JSON files and CSV/JSONL artifacts, inserts one public.screening_runs row and
public.screening_run_companies rows (upsert on run_id + orgnr).

Requires: psycopg2-binary, python-dotenv (optional). DATABASE_URL or SUPABASE_DB_URL or POSTGRES_*.

Example:
  PYTHONPATH=. python3 scripts/persist_screening_run.py \\
    --layer1-manifest shortlist_200_manifest.json \\
    --layer1-csv shortlist_200.csv \\
    --layer2-manifest layer2_out/layer2_manifest_20260324T120811Z.json \\
    --pipeline-manifest layer2_out/pipeline_manifest_20260324T120811Z.json \\
    --layer2-csv layer2_out/layer2_results_20260324T120811Z.csv \\
    --layer2-jsonl layer2_out/layer2_results_20260324T120811Z.jsonl
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # type: ignore[misc, assignment]


def _load_dotenv() -> None:
    if load_dotenv:
        load_dotenv(REPO_ROOT / ".env")
        load_dotenv(REPO_ROOT / "backend" / ".env", override=False)


def connect_pg():
    import psycopg2

    url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if url:
        return psycopg2.connect(url, connect_timeout=30)
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5433")),
        dbname=os.getenv("POSTGRES_DB", "nivo"),
        user=os.getenv("POSTGRES_USER", "nivo"),
        password=os.getenv("POSTGRES_PASSWORD", "nivo"),
        connect_timeout=30,
    )


def load_json(path: Path) -> Dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError(f"Expected JSON object in {path}")
    return data


def parse_created_at(value: Optional[str]) -> datetime:
    if value is None or (isinstance(value, str) and not value.strip()):
        return datetime.now(timezone.utc)
    s = str(value).strip()
    m = re.match(r"^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$", s)
    if m:
        y, mo, d, hh, mm, ss = (int(x) for x in m.groups())
        return datetime(y, mo, d, hh, mm, ss, tzinfo=timezone.utc)
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
    except ValueError as e:
        raise ValueError(f"Unrecognized created_at_utc format: {value!r}") from e
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def norm_orgnr(value: Any) -> Optional[str]:
    if value is None:
        return None
    digits = "".join(c for c in str(value) if c.isdigit())
    return digits or None


def read_csv_rows(path: Path) -> Tuple[List[str], List[Dict[str, Any]]]:
    with path.open(newline="", encoding="utf-8") as f:
        rdr = csv.DictReader(f)
        fieldnames = list(rdr.fieldnames or [])
        rows = [dict(r) for r in rdr]
    return fieldnames, rows


def read_jsonl(path: Path) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            if isinstance(obj, dict):
                out.append(obj)
    return out


def parse_optional_float(x: Any) -> Optional[float]:
    if x is None:
        return None
    if isinstance(x, (int, float)) and not isinstance(x, bool):
        return float(x)
    s = str(x).strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def parse_optional_int(x: Any) -> Optional[int]:
    if x is None:
        return None
    if isinstance(x, int) and not isinstance(x, bool):
        return int(x)
    s = str(x).strip()
    if not s:
        return None
    try:
        return int(float(s))
    except ValueError:
        return None


def parse_optional_bool(x: Any) -> Optional[bool]:
    if x is None:
        return None
    if isinstance(x, bool):
        return x
    s = str(x).strip().lower()
    if not s:
        return None
    if s in ("true", "1", "yes", "y", "t"):
        return True
    if s in ("false", "0", "no", "n", "f"):
        return False
    return None


# Layer 2 JSON / CSV keys mapped to dedicated columns (case-insensitive for CSV)
_L2_COLUMN_KEYS = frozenset(
    {
        "orgnr",
        "company_name",
        "is_fit_for_nivo",
        "fit_confidence",
        "blended_score",
        "stage1_total_score",
        "error",
    }
)


def layer2_classification_remainder(row: Dict[str, Any]) -> Dict[str, Any]:
    """Strip fields stored in dedicated columns; remainder goes to layer2_classification_json."""
    out: Dict[str, Any] = {}
    for k, v in row.items():
        if isinstance(k, str):
            if k.lower() in _L2_COLUMN_KEYS:
                continue
        out[k] = v
    return out


def merge_layer2_classification_json(
    jsonl_obj: Optional[Dict[str, Any]],
    csv_obj: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """Prefer JSONL; add CSV-only keys (case-insensitive) for columns not already present."""
    if jsonl_obj is None and csv_obj is None:
        return None
    if jsonl_obj is not None and csv_obj is None:
        r = layer2_classification_remainder(jsonl_obj)
        return r or None
    if csv_obj is not None and jsonl_obj is None:
        r = layer2_classification_remainder(csv_obj)
        return r or None
    assert jsonl_obj is not None and csv_obj is not None
    merged = layer2_classification_remainder(jsonl_obj)
    csv_rest = layer2_classification_remainder(csv_obj)
    keys_lower = {str(k).lower() for k in merged}
    for k, v in csv_rest.items():
        lk = str(k).lower() if k is not None else ""
        if lk in keys_lower:
            continue
        merged[k] = v
        keys_lower.add(lk)
    return merged or None


def pick_run_meta(
    layer1: Optional[Dict[str, Any]],
    layer2: Optional[Dict[str, Any]],
    pipeline: Optional[Dict[str, Any]],
) -> Tuple[str, datetime, Optional[str], Optional[str], Optional[str], Optional[str], Optional[str], Optional[int], Optional[str]]:
    """Priority: pipeline → layer2 → layer1 (for umbrella runs)."""
    if not layer1:
        raise ValueError("layer1 manifest is required")

    run_kind = (pipeline or layer2 or layer1).get("run_kind")
    if not run_kind:
        run_kind = "unknown_screening_run"

    created_raw = None
    for m in (pipeline, layer2, layer1):
        if m and m.get("created_at_utc"):
            created_raw = m.get("created_at_utc")
            break
    created_at = parse_created_at(created_raw)

    git_commit = None
    for m in (pipeline, layer2, layer1):
        if m and m.get("git_commit"):
            git_commit = str(m.get("git_commit"))
            break

    script_name = None
    script_version = None
    for m in (pipeline, layer2, layer1):
        if m and m.get("script"):
            script_name = str(m.get("script"))
            script_version = str(m.get("script_version")) if m.get("script_version") is not None else None
            break

    config_path = layer1.get("config_path") if layer1 else None
    config_hash = layer1.get("config_hash_sha256") if layer1 else None
    top_n = layer1.get("top_n") if layer1 else None
    if top_n is not None:
        try:
            top_n = int(top_n)
        except (TypeError, ValueError):
            top_n = None

    status = pipeline.get("status") if pipeline else None

    return (
        str(run_kind),
        created_at,
        git_commit,
        script_name,
        script_version,
        config_path,
        config_hash,
        top_n,
        status,
    )


def build_settings_json(
    layer1: Optional[Dict[str, Any]],
    layer2: Optional[Dict[str, Any]],
    pipeline: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    if layer1:
        out["layer1"] = {
            "settings": layer1.get("settings"),
            "cli": layer1.get("cli"),
            "row_counts": layer1.get("row_counts"),
            "artifacts": layer1.get("artifacts"),
        }
    if layer2:
        out["layer2"] = {
            "cli": layer2.get("cli"),
            "blend": layer2.get("blend"),
            "retrieval": layer2.get("retrieval"),
            "tavily_raw": layer2.get("tavily_raw"),
            "tavily_low_credit": layer2.get("tavily_low_credit"),
            "artifacts": layer2.get("artifacts"),
            "input_csv": layer2.get("input_csv"),
            "model": layer2.get("model"),
            "temperature": layer2.get("temperature"),
        }
    if pipeline:
        out["pipeline"] = {
            "cli": pipeline.get("cli"),
            "status": pipeline.get("status"),
            "layer2_skipped": pipeline.get("layer2_skipped"),
            "report": pipeline.get("report"),
            "artifacts": pipeline.get("artifacts"),
            "run_id": pipeline.get("run_id"),
        }
    return out


def merge_company_rows(
    layer1_rows: List[Dict[str, Any]],
    layer2_csv_rows: Optional[List[Dict[str, Any]]],
    layer2_jsonl_rows: Optional[List[Dict[str, Any]]],
) -> Dict[str, Dict[str, Any]]:
    """orgnr -> {layer1, layer2_csv, layer2_jsonl} (each optional)."""
    by_org: Dict[str, Dict[str, Any]] = {}

    for r in layer1_rows:
        org = norm_orgnr(r.get("orgnr"))
        if not org:
            continue
        slot = by_org.setdefault(org, {})
        slot["layer1"] = r

    if layer2_csv_rows:
        for r in layer2_csv_rows:
            org = norm_orgnr(r.get("orgnr"))
            if not org:
                continue
            slot = by_org.setdefault(org, {})
            slot["layer2_csv"] = r

    if layer2_jsonl_rows:
        for obj in layer2_jsonl_rows:
            org = norm_orgnr(obj.get("orgnr"))
            if not org:
                continue
            slot = by_org.setdefault(org, {})
            slot["layer2_jsonl"] = obj

    return by_org


def build_company_db_row(
    org: str,
    slot: Dict[str, Any],
    source_artifacts: Dict[str, Optional[str]],
) -> Dict[str, Any]:
    l1 = slot.get("layer1")
    l1 = l1 if isinstance(l1, dict) else None
    j_obj = slot.get("layer2_jsonl") if isinstance(slot.get("layer2_jsonl"), dict) else None
    c_obj = slot.get("layer2_csv") if isinstance(slot.get("layer2_csv"), dict) else None
    l2_primary = j_obj or c_obj

    company_name = None
    if l1 and l1.get("company_name") is not None:
        company_name = str(l1.get("company_name"))
    elif l2_primary and l2_primary.get("company_name") is not None:
        company_name = str(l2_primary.get("company_name"))

    rank = parse_optional_int(l1.get("rank")) if l1 else None

    layer1_total_score = parse_optional_float(l1.get("total_score")) if l1 else None
    layer1_base_similarity_score = parse_optional_float(l1.get("base_similarity_score")) if l1 else None
    layer1_product_signal = parse_optional_bool(l1.get("layer1_product_signal")) if l1 else None
    layer1_exclusion_flags = None
    if l1 and l1.get("exclusion_flags") is not None:
        layer1_exclusion_flags = str(l1.get("exclusion_flags"))

    l2_is_fit = None
    l2_fit_conf = None
    l2_blend = None
    l2_err = None
    class_json: Optional[Dict[str, Any]] = None

    if j_obj or c_obj:
        primary = j_obj or c_obj
        assert primary is not None
        l2_is_fit = parse_optional_bool(primary.get("is_fit_for_nivo"))
        l2_fit_conf = parse_optional_float(primary.get("fit_confidence"))
        l2_blend = parse_optional_float(primary.get("blended_score"))
        err_raw = primary.get("error")
        if err_raw is not None:
            l2_err = str(err_raw) if not isinstance(err_raw, (dict, list)) else json.dumps(err_raw)

        stage1 = parse_optional_float(primary.get("stage1_total_score"))
        if layer1_total_score is None and stage1 is not None:
            layer1_total_score = stage1

        class_json = merge_layer2_classification_json(j_obj, c_obj)

    raw_row: Dict[str, Any] = {
        "layer1": l1,
        "layer2_csv": c_obj,
        "layer2_jsonl": j_obj,
    }

    return {
        "orgnr": org,
        "company_name": company_name,
        "rank": rank,
        "layer1_total_score": layer1_total_score,
        "layer1_base_similarity_score": layer1_base_similarity_score,
        "layer1_product_signal": layer1_product_signal,
        "layer1_exclusion_flags": layer1_exclusion_flags,
        "layer2_is_fit_for_nivo": l2_is_fit,
        "layer2_fit_confidence": l2_fit_conf,
        "layer2_blended_score": l2_blend,
        "layer2_classification_json": class_json,
        "layer2_error": l2_err,
        "raw_row_json": raw_row,
        "source_artifacts_json": dict(source_artifacts),
    }


def main() -> int:
    _load_dotenv()

    ap = argparse.ArgumentParser(description="Persist screening run manifests + CSV/JSONL to Postgres")
    ap.add_argument("--layer1-manifest", type=Path, required=True)
    ap.add_argument("--layer1-csv", type=Path, required=True)
    ap.add_argument("--layer2-manifest", type=Path, default=None)
    ap.add_argument("--pipeline-manifest", type=Path, default=None)
    ap.add_argument("--layer2-csv", type=Path, default=None)
    ap.add_argument("--layer2-jsonl", type=Path, default=None)
    ap.add_argument("--notes", type=str, default=None)

    args = ap.parse_args()

    try:
        from psycopg2.extras import Json, execute_values
    except ImportError:
        print("psycopg2-binary is required.", file=sys.stderr)
        raise SystemExit(1)

    layer1_path = args.layer1_manifest
    l1_csv_path = args.layer1_csv
    if not layer1_path.is_file():
        print(f"Missing layer1 manifest: {layer1_path}", file=sys.stderr)
        return 1
    if not l1_csv_path.is_file():
        print(f"Missing layer1 csv: {l1_csv_path}", file=sys.stderr)
        return 1

    layer1 = load_json(layer1_path)
    _, layer1_rows = read_csv_rows(l1_csv_path)
    layer1_count = len(layer1_rows)

    layer2_manifest = load_json(args.layer2_manifest) if args.layer2_manifest else None
    pipeline_manifest = load_json(args.pipeline_manifest) if args.pipeline_manifest else None

    layer2_csv_rows: Optional[List[Dict[str, Any]]] = None
    layer2_csv_count = 0
    if args.layer2_csv:
        if not args.layer2_csv.is_file():
            print(f"Missing layer2 csv: {args.layer2_csv}", file=sys.stderr)
            return 1
        _, layer2_csv_rows = read_csv_rows(args.layer2_csv)
        layer2_csv_count = len(layer2_csv_rows)

    layer2_jsonl_rows: Optional[List[Dict[str, Any]]] = None
    layer2_jsonl_count = 0
    if args.layer2_jsonl:
        if not args.layer2_jsonl.is_file():
            print(f"Missing layer2 jsonl: {args.layer2_jsonl}", file=sys.stderr)
            return 1
        layer2_jsonl_rows = read_jsonl(args.layer2_jsonl)
        layer2_jsonl_count = len(layer2_jsonl_rows)

    meta = pick_run_meta(layer1, layer2_manifest, pipeline_manifest)
    (
        run_kind,
        created_at,
        git_commit,
        script_name,
        script_version,
        config_path,
        config_hash,
        top_n,
        status,
    ) = meta

    settings_json = build_settings_json(layer1, layer2_manifest, pipeline_manifest)
    manifest_json: Dict[str, Any] = {"layer1": layer1}
    if layer2_manifest is not None:
        manifest_json["layer2"] = layer2_manifest
    if pipeline_manifest is not None:
        manifest_json["pipeline"] = pipeline_manifest

    source_artifacts: Dict[str, Optional[str]] = {
        "layer1_manifest": str(layer1_path.resolve()),
        "layer1_csv": str(l1_csv_path.resolve()),
        "layer2_manifest": str(args.layer2_manifest.resolve()) if args.layer2_manifest else None,
        "pipeline_manifest": str(args.pipeline_manifest.resolve()) if args.pipeline_manifest else None,
        "layer2_csv": str(args.layer2_csv.resolve()) if args.layer2_csv else None,
        "layer2_jsonl": str(args.layer2_jsonl.resolve()) if args.layer2_jsonl else None,
    }

    merged = merge_company_rows(layer1_rows, layer2_csv_rows, layer2_jsonl_rows)

    company_payloads: List[Dict[str, Any]] = []
    for org, slot in merged.items():
        company_payloads.append(build_company_db_row(org, slot, source_artifacts))

    insert_run_sql = """
        INSERT INTO public.screening_runs (
            run_kind,
            parent_run_id,
            created_at,
            git_commit,
            script_name,
            script_version,
            config_path,
            config_hash_sha256,
            top_n,
            status,
            settings_json,
            manifest_json,
            notes
        ) VALUES (
            %s, NULL, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        RETURNING id
    """

    conn = connect_pg()
    try:
        conn.autocommit = False
        with conn.cursor() as cur:
            cur.execute(
                insert_run_sql,
                (
                    run_kind,
                    created_at,
                    git_commit,
                    script_name,
                    script_version,
                    config_path,
                    config_hash,
                    top_n,
                    status,
                    Json(settings_json),
                    Json(manifest_json),
                    args.notes,
                ),
            )
            run_id = cur.fetchone()[0]

            if company_payloads:
                values = [
                    (
                        run_id,
                        p["orgnr"],
                        p["company_name"],
                        p["rank"],
                        p["layer1_total_score"],
                        p["layer1_base_similarity_score"],
                        p["layer1_product_signal"],
                        p["layer1_exclusion_flags"],
                        p["layer2_is_fit_for_nivo"],
                        p["layer2_fit_confidence"],
                        p["layer2_blended_score"],
                        Json(p["layer2_classification_json"]) if p["layer2_classification_json"] else None,
                        p["layer2_error"],
                        Json(p["raw_row_json"]),
                        Json(p["source_artifacts_json"]),
                    )
                    for p in company_payloads
                ]
                execute_values(
                    cur,
                    """
                    INSERT INTO public.screening_run_companies (
                        run_id,
                        orgnr,
                        company_name,
                        rank,
                        layer1_total_score,
                        layer1_base_similarity_score,
                        layer1_product_signal,
                        layer1_exclusion_flags,
                        layer2_is_fit_for_nivo,
                        layer2_fit_confidence,
                        layer2_blended_score,
                        layer2_classification_json,
                        layer2_error,
                        raw_row_json,
                        source_artifacts_json
                    ) VALUES %s
                    ON CONFLICT (run_id, orgnr) DO UPDATE SET
                        company_name = EXCLUDED.company_name,
                        rank = EXCLUDED.rank,
                        layer1_total_score = EXCLUDED.layer1_total_score,
                        layer1_base_similarity_score = EXCLUDED.layer1_base_similarity_score,
                        layer1_product_signal = EXCLUDED.layer1_product_signal,
                        layer1_exclusion_flags = EXCLUDED.layer1_exclusion_flags,
                        layer2_is_fit_for_nivo = EXCLUDED.layer2_is_fit_for_nivo,
                        layer2_fit_confidence = EXCLUDED.layer2_fit_confidence,
                        layer2_blended_score = EXCLUDED.layer2_blended_score,
                        layer2_classification_json = EXCLUDED.layer2_classification_json,
                        layer2_error = EXCLUDED.layer2_error,
                        raw_row_json = EXCLUDED.raw_row_json,
                        source_artifacts_json = EXCLUDED.source_artifacts_json
                    """,
                    values,
                    template="(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                )

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    print(f"screening_run_id={run_id}")
    print(f"companies_persisted={len(company_payloads)}")
    print(f"layer1_csv_rows={layer1_count}")
    print(f"layer2_csv_rows={layer2_csv_count}")
    print(f"layer2_jsonl_rows={layer2_jsonl_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

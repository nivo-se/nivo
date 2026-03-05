"""
AI Analysis API: screening and deep analysis for the frontend AI-insikter flow.

POST /api/ai-analysis — run screening or deep analysis; persists to Postgres (acquisition_runs + company_analysis).
GET  /api/ai-analysis — run detail (runId) or history (history=1); reads from Postgres.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, Request

from ..agentic_pipeline.ai_analysis import (
    AIAnalysisBatch,
    AIAnalysisConfig,
    AgenticLLMAnalyzer,
    ScreeningBatch,
)
from ..services.db_factory import get_database_service

logger = logging.getLogger(__name__)

AI_ANALYSIS_CRITERIA_SOURCE = "ai_analysis"


def _normalize_run_status(status: str) -> str:
    """Map agentic run status to acquisition_runs constraint (complete/failed/running)."""
    s = (status or "").lower()
    if s in ("complete", "completed", "completed_with_errors"):
        return "complete"
    if s == "failed":
        return "failed"
    return "running"


def _persist_run(
    db: Any,
    run_id: str,
    analysis_type: str,
    status: str,
    started_at: datetime,
    completed_at: Optional[datetime],
    error_message: Optional[str],
    initiated_by: str,
    filters: Optional[Dict[str, Any]],
    company_count: int,
) -> None:
    """Write AI analysis run metadata to acquisition_runs."""
    criteria = {
        "source": AI_ANALYSIS_CRITERIA_SOURCE,
        "analysisType": analysis_type,
        "initiatedBy": initiated_by,
        "company_count": company_count,
        "filters": filters or {},
    }
    started_iso = started_at.isoformat() if started_at else None
    completed_iso = completed_at.isoformat() if completed_at else None
    status_db = _normalize_run_status(status)
    try:
        db.run_raw_query(
            """
            INSERT INTO acquisition_runs
            (id, criteria, stage, status, stage1_count, stage2_count, stage3_count,
             started_at, completed_at, error_message, created_by)
            VALUES (?::uuid, ?::jsonb, 0, ?, 0, 0, ?, ?, ?, ?, ?)
            """,
            [
                run_id,
                json.dumps(criteria, ensure_ascii=False),
                status_db,
                company_count,
                started_iso,
                completed_iso,
                error_message or None,
                initiated_by,
            ],
        )
    except Exception as e:
        logger.warning("Failed to persist AI run to acquisition_runs: %s", e)


def _recommendation_from_agentic(rec: str) -> str:
    """Map agentic recommendation to company_analysis enum (buy/pass/watch)."""
    if not rec:
        return "watch"
    r = (rec or "").strip().lower()
    if "pursue" in r or "buy" in r:
        return "buy"
    if "pass" in r:
        return "pass"
    return "watch"


def _persist_screening_results(db: Any, run_id: str, batch: ScreeningBatch) -> None:
    """Write screening results to company_analysis (one row per company)."""
    for r in batch.results:
        try:
            rec = "pass" if (r.risk_flag or "").lower() == "high" else ("buy" if (r.risk_flag or "").lower() == "low" else "watch")
            score = int(r.screening_score) if r.screening_score is not None else None
            if score is not None:
                score = max(1, min(10, round(score / 10.0)))
            db.run_raw_query(
                """
                INSERT INTO company_analysis
                (orgnr, run_id, recommendation, strategic_fit_score, investment_memo, raw_analysis)
                VALUES (?, ?::uuid, ?, ?, ?, ?::jsonb)
                ON CONFLICT (orgnr, run_id) DO UPDATE SET
                    recommendation = EXCLUDED.recommendation,
                    strategic_fit_score = EXCLUDED.strategic_fit_score,
                    investment_memo = EXCLUDED.investment_memo,
                    raw_analysis = EXCLUDED.raw_analysis,
                    analyzed_at = NOW()
                """,
                [
                    r.orgnr or "",
                    run_id,
                    rec,
                    score,
                    r.brief_summary or "",
                    json.dumps({"screening_score": r.screening_score, "risk_flag": r.risk_flag, "brief_summary": r.brief_summary, "raw": r.raw_json}, ensure_ascii=False),
                ],
            )
        except Exception as e:
            logger.warning("Failed to persist screening result for %s: %s", r.orgnr, e)


def _persist_deep_results(db: Any, run_id: str, batch: AIAnalysisBatch) -> None:
    """Write deep analysis results to company_analysis."""
    for rec in batch.companies:
        try:
            rec_norm = _recommendation_from_agentic(rec.recommendation or "")
            fit = int(rec.confidence * 2) if rec.confidence is not None else None
            if fit is not None:
                fit = max(1, min(10, fit))
            raw = {
                "summary": rec.summary,
                "recommendation": rec.recommendation,
                "confidence": rec.confidence,
                "risk_score": rec.risk_score,
                "financial_grade": rec.financial_grade,
                "commercial_grade": rec.commercial_grade,
                "operational_grade": rec.operational_grade,
                "next_steps": list(rec.next_steps) if rec.next_steps else [],
                "sections": [{"section_type": s.section_type, "title": s.title, "content_md": s.content_md} for s in rec.sections],
                "metrics": [{"metric_name": m.metric_name, "metric_value": m.metric_value} for m in rec.metrics],
            }
            db.run_raw_query(
                """
                INSERT INTO company_analysis
                (orgnr, run_id, recommendation, strategic_fit_score, investment_memo, raw_analysis)
                VALUES (?, ?::uuid, ?, ?, ?, ?::jsonb)
                ON CONFLICT (orgnr, run_id) DO UPDATE SET
                    recommendation = EXCLUDED.recommendation,
                    strategic_fit_score = EXCLUDED.strategic_fit_score,
                    investment_memo = EXCLUDED.investment_memo,
                    raw_analysis = EXCLUDED.raw_analysis,
                    analyzed_at = NOW()
                """,
                [
                    rec.orgnr or "",
                    run_id,
                    rec_norm,
                    fit,
                    rec.summary or "",
                    json.dumps(raw, ensure_ascii=False),
                ],
            )
        except Exception as e:
            logger.warning("Failed to persist deep result for %s: %s", rec.orgnr, e)

router = APIRouter(prefix="/api/ai-analysis", tags=["ai-analysis"])


def _companies_to_dataframe(companies: List[Dict[str, Any]]) -> pd.DataFrame:
    """Build a shortlist DataFrame from request companies (frontend payload)."""
    rows = []
    for c in companies:
        orgnr = (c.get("OrgNr") or c.get("orgnr") or "").strip()
        if not orgnr:
            continue
        name = c.get("name") or c.get("company_name") or c.get("CompanyName") or "Unknown"
        rows.append({
            "orgnr": orgnr,
            "OrgNr": orgnr,
            "company_name": name,
            "name": name,
            "segment_name": c.get("segment_name") or c.get("segment_names") or "Unknown",
            "revenue": c.get("SDI") or c.get("revenue") or c.get("latest_revenue_sek"),
            "profit": c.get("DR") or c.get("profit") or c.get("latest_profit_sek"),
            "employees": c.get("employees") or c.get("employees_latest"),
            "homepage": c.get("homepage") or c.get("website"),
            "Revenue_growth": c.get("Revenue_growth") or c.get("revenue_cagr_3y"),
            "EBIT_margin": c.get("EBIT_margin") or c.get("avg_ebitda_margin"),
            "NetProfit_margin": c.get("NetProfit_margin") or c.get("avg_net_margin"),
        })
    return pd.DataFrame(rows)


def _run_to_payload(run: Any) -> Dict[str, Any]:
    def _iso(dt: Optional[datetime]) -> Optional[str]:
        return dt.isoformat() if dt else None
    return {
        "id": run.id,
        "status": run.status,
        "modelVersion": getattr(run, "model_version", "gpt-4o-mini"),
        "analysisMode": getattr(run, "analysis_mode", "screening"),
        "startedAt": _iso(getattr(run, "started_at", None)),
        "completedAt": _iso(getattr(run, "completed_at", None)),
        "errorMessage": getattr(run, "error_message", None),
    }


def _screening_results_to_payload(batch: ScreeningBatch) -> List[Dict[str, Any]]:
    out = []
    for r in batch.results:
        out.append({
            "orgnr": r.orgnr or "",
            "companyName": r.company_name or "",
            "screeningScore": int(r.screening_score) if r.screening_score is not None else None,
            "riskFlag": r.risk_flag if r.risk_flag in ("Low", "Medium", "High") else "Medium",
            "briefSummary": r.brief_summary or None,
        })
    return out


def _deep_companies_to_payload(batch: AIAnalysisBatch) -> List[Dict[str, Any]]:
    out = []
    for rec in batch.companies:
        sections = [
            {
                "section_type": s.section_type,
                "title": s.title,
                "content_md": s.content_md,
                "supporting_metrics": list(s.supporting_metrics) if s.supporting_metrics else [],
                "confidence": s.confidence,
            }
            for s in rec.sections
        ]
        metrics = [
            {
                "metric_name": m.metric_name,
                "metric_value": m.metric_value,
                "metric_unit": m.metric_unit,
                "source": m.source,
                "year": m.year,
                "confidence": m.confidence,
            }
            for m in rec.metrics
        ]
        out.append({
            "orgnr": rec.orgnr or "",
            "companyName": rec.company_name or "",
            "summary": rec.summary,
            "recommendation": rec.recommendation,
            "confidence": rec.confidence,
            "riskScore": rec.risk_score,
            "financialGrade": rec.financial_grade,
            "commercialGrade": rec.commercial_grade,
            "operationalGrade": rec.operational_grade,
            "nextSteps": list(rec.next_steps) if rec.next_steps else [],
            "sections": sections,
            "metrics": metrics,
        })
    return out


@router.post("")
async def post_ai_analysis(request: Request) -> Dict[str, Any]:
    """
    Run screening or deep analysis on the given companies.
    Expects: companies (list), analysisType ('screening' | 'deep'), optional instructions, filters, initiatedBy.
    """
    body = await request.json()
    companies = body.get("companies") or []
    analysis_type = (body.get("analysisType") or "screening").lower()
    if analysis_type not in ("screening", "deep"):
        raise HTTPException(400, "analysisType must be 'screening' or 'deep'")

    if not isinstance(companies, list) or len(companies) == 0:
        raise HTTPException(400, "companies array is required and must not be empty")

    df = _companies_to_dataframe(companies)
    if df.empty:
        raise HTTPException(400, "No valid companies (missing OrgNr/orgnr)")

    config = AIAnalysisConfig(
        model="gpt-4o-mini",
        write_to_disk=False,
        batch_size=5,
    )
    analyzer = AgenticLLMAnalyzer(config)

    initiated_by = body.get("initiatedBy") or body.get("initiated_by") or "unknown-user"
    filters = body.get("filters")

    try:
        if analysis_type == "screening":
            batch: ScreeningBatch = analyzer.run_screening(
                df,
                initiated_by=initiated_by,
                filters=filters,
            )
            run_payload = _run_to_payload(batch.run)
            results = _screening_results_to_payload(batch)
            if not results and batch.errors:
                err_msg = batch.run.error_message or "; ".join(batch.errors[:3])
                if len(batch.errors) > 3:
                    err_msg += f" (... and {len(batch.errors) - 3} more)"
                raise HTTPException(
                    500,
                    f"AI screening failed for all companies. "
                    f"Check OPENAI_API_KEY in .env and API logs. Details: {err_msg}",
                )
            try:
                db = get_database_service()
                if hasattr(db, "table_exists") and db.table_exists("acquisition_runs") and db.table_exists("company_analysis"):
                    _persist_run(
                        db,
                        batch.run.id,
                        "screening",
                        batch.run.status,
                        batch.run.started_at,
                        batch.run.completed_at,
                        batch.run.error_message,
                        initiated_by,
                        filters,
                        len(batch.results),
                    )
                    _persist_screening_results(db, batch.run.id, batch)
            except Exception as e:
                logger.warning("Failed to persist screening run: %s", e)
            return {
                "success": True,
                "run": run_payload,
                "analysis": {"results": results},
            }
        else:
            batch: AIAnalysisBatch = analyzer.run(
                df,
                initiated_by=initiated_by,
                filters=filters,
            )
            run_payload = _run_to_payload(batch.run)
            companies_payload = _deep_companies_to_payload(batch)
            if not companies_payload and batch.errors:
                err_msg = batch.run.error_message or "; ".join(batch.errors[:3])
                if len(batch.errors) > 3:
                    err_msg += f" (... and {len(batch.errors) - 3} more)"
                raise HTTPException(
                    500,
                    f"AI deep analysis failed for all companies. "
                    f"Check OPENAI_API_KEY in .env and API logs. Details: {err_msg}",
                )
            try:
                db = get_database_service()
                if hasattr(db, "table_exists") and db.table_exists("acquisition_runs") and db.table_exists("company_analysis"):
                    _persist_run(
                        db,
                        batch.run.id,
                        "deep",
                        batch.run.status,
                        batch.run.started_at,
                        batch.run.completed_at,
                        batch.run.error_message,
                        initiated_by,
                        filters,
                        len(batch.companies),
                    )
                    _persist_deep_results(db, batch.run.id, batch)
            except Exception as e:
                logger.warning("Failed to persist deep run: %s", e)
            return {
                "success": True,
                "run": run_payload,
                "analysis": {"companies": companies_payload},
            }
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.exception("AI analysis failed")
        raise HTTPException(500, str(e))


def _row_to_run_payload(row: Dict[str, Any]) -> Dict[str, Any]:
    """Shape acquisition_runs row to run payload for API."""
    criteria = row.get("criteria") or {}
    if isinstance(criteria, str):
        try:
            criteria = json.loads(criteria)
        except Exception:
            criteria = {}
    return {
        "id": str(row.get("id", "")),
        "status": row.get("status", ""),
        "modelVersion": "gpt-4o-mini",
        "analysisMode": criteria.get("analysisType", "screening"),
        "startedAt": str(row.get("started_at", "")) if row.get("started_at") else None,
        "completedAt": str(row.get("completed_at", "")) if row.get("completed_at") else None,
        "errorMessage": row.get("error_message"),
    }


@router.get("")
async def get_ai_analysis(
    runId: Optional[str] = None,
    history: Optional[str] = None,
    limit: Optional[int] = 10,
) -> Dict[str, Any]:
    """
    Get run detail (runId) or history (history=1).
    Reads from Postgres (acquisition_runs + company_analysis).
    """
    if not runId and history is None:
        raise HTTPException(400, "Specify runId or history query parameter")

    try:
        db = get_database_service()
    except Exception:
        if runId:
            raise HTTPException(404, "Run not found")
        return {"success": True, "history": [], "data": []}

    if not hasattr(db, "table_exists") or not db.table_exists("acquisition_runs") or not db.table_exists("company_analysis"):
        if runId:
            raise HTTPException(404, "Run not found")
        return {"success": True, "history": [], "data": []}

    if runId:
        rows = db.run_raw_query("SELECT * FROM acquisition_runs WHERE id::text = ? LIMIT 1", [runId])
        if not rows:
            raise HTTPException(404, "Run not found")
        run_row = rows[0]
        criteria = run_row.get("criteria") or {}
        if isinstance(criteria, str):
            try:
                criteria = json.loads(criteria)
            except Exception:
                criteria = {}
        if criteria.get("source") != AI_ANALYSIS_CRITERIA_SOURCE:
            raise HTTPException(404, "Run not found")
        analysis_type = criteria.get("analysisType", "screening")
        run_payload = _row_to_run_payload(run_row)
        company_rows = db.run_raw_query(
            """
            SELECT a.*, c.company_name
            FROM company_analysis a
            LEFT JOIN companies c ON c.orgnr = a.orgnr
            WHERE a.run_id::text = ?
            ORDER BY a.strategic_fit_score DESC
            """,
            [runId],
        )
        if analysis_type == "screening":
            results = []
            for r in company_rows:
                raw = r.get("raw_analysis") or {}
                if isinstance(raw, str):
                    try:
                        raw = json.loads(raw)
                    except Exception:
                        raw = {}
                results.append({
                    "orgnr": r.get("orgnr", ""),
                    "companyName": r.get("company_name") or "",
                    "screeningScore": raw.get("screening_score"),
                    "riskFlag": {"buy": "Low", "pass": "High", "watch": "Medium"}.get(r.get("recommendation") or "", "Medium"),
                    "briefSummary": r.get("investment_memo"),
                })
            return {"success": True, "run": run_payload, "analysis": {"results": results}}
        else:
            companies = []
            for r in company_rows:
                raw = r.get("raw_analysis") or {}
                if isinstance(raw, str):
                    try:
                        raw = json.loads(raw)
                    except Exception:
                        raw = {}
                companies.append({
                    "orgnr": r.get("orgnr", ""),
                    "companyName": r.get("company_name") or "",
                    "summary": raw.get("summary"),
                    "recommendation": raw.get("recommendation"),
                    "confidence": raw.get("confidence"),
                    "riskScore": raw.get("risk_score"),
                    "financialGrade": raw.get("financial_grade"),
                    "commercialGrade": raw.get("commercial_grade"),
                    "operationalGrade": raw.get("operational_grade"),
                    "nextSteps": raw.get("next_steps") or [],
                    "sections": raw.get("sections") or [],
                    "metrics": raw.get("metrics") or [],
                })
            return {"success": True, "run": run_payload, "analysis": {"companies": companies}}

    # history: recent runs from ai_analysis only
    try:
        rows = db.run_raw_query(
            "SELECT * FROM acquisition_runs ORDER BY started_at DESC LIMIT ?",
            [limit * 2],
        )
        out = []
        for r in rows:
            crit = r.get("criteria")
            if isinstance(crit, str):
                try:
                    crit = json.loads(crit)
                except Exception:
                    crit = {}
            if isinstance(crit, dict) and crit.get("source") == AI_ANALYSIS_CRITERIA_SOURCE:
                out.append(_row_to_run_payload(r))
                if len(out) >= limit:
                    break
        return {"success": True, "history": out, "data": out}
    except Exception as e:
        logger.warning("AI analysis history query failed: %s", e)
        return {"success": True, "history": [], "data": []}

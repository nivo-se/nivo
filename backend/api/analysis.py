"""
Acquisition Workflow API Endpoints
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..analysis.stage1_filter import FilterCriteria
from ..analysis.workflow import AnalysisWorkflow
from ..services.db_factory import get_database_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analysis", tags=["analysis"])

ACTIVE_RUN_TASKS: Dict[str, asyncio.Task[None]] = {}


class RunConfig(BaseModel):
    auto_approve: bool = False
    overwrite_existing: bool = False


class StartWorkflowRequest(BaseModel):
    """Request to start analysis workflow."""

    name: Optional[str] = Field(None, description="Run name shown in UI")
    list_id: Optional[str] = Field(None, description="saved_lists.id for target companies")
    template_id: Optional[str] = Field(None, description="Prompt template id")
    template_name: Optional[str] = Field(None, description="Prompt template name")
    template_prompt: Optional[str] = Field(None, description="Prompt template body")
    config: RunConfig = Field(default_factory=RunConfig)
    orgnrs: Optional[List[str]] = Field(None, description="Explicit company orgnrs")
    run_async: bool = Field(True, description="Run in background and return immediately")
    min_revenue: float = Field(10_000_000, description="Minimum revenue in SEK")
    min_ebitda_margin: float = Field(
        0.05, description="Minimum EBITDA margin (0.05 = 5%)"
    )
    min_growth: float = Field(0.10, description="Minimum 3Y CAGR (0.10 = 10%)")
    industries: Optional[List[str]] = Field(None, description="NACE industry codes")
    max_results: int = Field(500, ge=1, le=1000, description="Maximum companies to analyze")


class WorkflowStatusResponse(BaseModel):
    """Workflow run status."""

    run_id: str
    status: str
    stage: int
    stage1_count: Optional[int] = None
    stage2_count: Optional[int] = None
    stage3_count: Optional[int] = None
    started_at: str
    completed_at: Optional[str] = None
    error_message: Optional[str] = None
    name: Optional[str] = None
    list_id: Optional[str] = None
    template_id: Optional[str] = None
    template_name: Optional[str] = None
    config: RunConfig = Field(default_factory=RunConfig)
    criteria: Dict[str, Any] = Field(default_factory=dict)


class CompanyAnalysisResponse(BaseModel):
    """Company analysis result."""

    orgnr: str
    company_name: str
    business_model: Optional[str]
    products_summary: Optional[str]
    market_position: Optional[str]
    swot_strengths: List[str] = Field(default_factory=list)
    swot_weaknesses: List[str] = Field(default_factory=list)
    swot_opportunities: List[str] = Field(default_factory=list)
    swot_threats: List[str] = Field(default_factory=list)
    strategic_fit_score: int
    recommendation: str
    investment_memo: str
    result_status: str = "pending"
    extracted_products: List[str] = Field(default_factory=list)
    extracted_markets: List[str] = Field(default_factory=list)
    sales_channels: List[str] = Field(default_factory=list)
    digital_score: int = 0


class PromptTemplateCreate(BaseModel):
    name: str
    description: str = ""
    prompt: str
    variables: List[str] = Field(default_factory=list)
    scoring_dimensions: List[Dict[str, Any]] = Field(default_factory=list)


class PromptTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    prompt: Optional[str] = None
    variables: Optional[List[str]] = None
    scoring_dimensions: Optional[List[Dict[str, Any]]] = None


class ReviewPayload(BaseModel):
    note: Optional[str] = None


class DuplicateTemplatePayload(BaseModel):
    name: Optional[str] = None


def _ensure_prompt_templates_table(db: Any) -> None:
    db.run_raw_query(
        """
        CREATE TABLE IF NOT EXISTS analysis_prompt_templates (
            id uuid PRIMARY KEY,
            name text NOT NULL,
            description text,
            prompt text NOT NULL,
            variables jsonb NOT NULL DEFAULT '[]'::jsonb,
            scoring_dimensions jsonb NOT NULL DEFAULT '[]'::jsonb,
            created_by text,
            created_at timestamptz NOT NULL DEFAULT NOW(),
            updated_at timestamptz NOT NULL DEFAULT NOW()
        )
        """
    )


def _shape_template_row(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(row.get("id", "")),
        "name": str(row.get("name", "")),
        "description": str(row.get("description") or ""),
        "prompt": str(row.get("prompt", "")),
        "variables": _parse_json_field(row.get("variables")),
        "scoringDimensions": _parse_json_field(row.get("scoring_dimensions")),
        "created_at": str(row.get("created_at", "")),
        "created_by": str(row.get("created_by") or "system"),
    }


def _parse_json_field(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        try:
            parsed = json.loads(text)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


def _parse_criteria(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return dict(value)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return {}
        try:
            parsed = json.loads(text)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def _extract_run_metadata(criteria: Dict[str, Any]) -> Dict[str, Any]:
    cfg = criteria.get("config")
    cfg_dict = cfg if isinstance(cfg, dict) else {}
    return {
        "name": criteria.get("name"),
        "list_id": criteria.get("list_id"),
        "template_id": criteria.get("template_id"),
        "template_name": criteria.get("template_name"),
        "config": {
            "auto_approve": bool(cfg_dict.get("auto_approve", False)),
            "overwrite_existing": bool(cfg_dict.get("overwrite_existing", False)),
        },
    }


def _ensure_analysis_review_table(db: Any) -> None:
    """Create moderation table if missing (non-invasive runtime bootstrap)."""
    db.run_raw_query(
        """
        CREATE TABLE IF NOT EXISTS analysis_result_reviews (
            id uuid PRIMARY KEY,
            run_id uuid NOT NULL,
            orgnr text NOT NULL,
            status text NOT NULL,
            note text,
            updated_by text,
            updated_at timestamptz NOT NULL DEFAULT NOW(),
            UNIQUE (run_id, orgnr)
        )
        """
    )


def _shape_run_row(row: Dict[str, Any]) -> Dict[str, Any]:
    criteria = _parse_criteria(row.get("criteria"))
    metadata = _extract_run_metadata(criteria)
    return {
        "run_id": str(row.get("id", "")),
        "status": str(row.get("status", "")),
        "stage": int(row.get("stage") or 0),
        "stage1_count": row.get("stage1_count"),
        "stage2_count": row.get("stage2_count"),
        "stage3_count": row.get("stage3_count"),
        "started_at": str(row.get("started_at") or ""),
        "completed_at": str(row["completed_at"]) if row.get("completed_at") else None,
        "error_message": row.get("error_message"),
        "name": metadata["name"],
        "list_id": metadata["list_id"],
        "template_id": metadata["template_id"],
        "template_name": metadata["template_name"],
        "config": metadata["config"],
        "criteria": criteria,
    }


def _resolve_target_orgnrs(db: Any, request: StartWorkflowRequest) -> Optional[List[str]]:
    if request.list_id:
        if hasattr(db, "table_exists") and not db.table_exists("saved_list_items"):
            raise HTTPException(status_code=400, detail="List storage not available")
        rows = db.run_raw_query(
            "SELECT orgnr FROM saved_list_items WHERE list_id::text = ? ORDER BY added_at DESC",
            [request.list_id],
        )
        orgnrs = [str(r["orgnr"]).strip() for r in rows if r.get("orgnr")]
        if not orgnrs:
            raise HTTPException(status_code=400, detail="Selected list has no companies")
        return orgnrs
    if request.orgnrs:
        orgnrs = []
        seen: set[str] = set()
        for orgnr in request.orgnrs:
            val = str(orgnr).strip()
            if not val or val in seen:
                continue
            seen.add(val)
            orgnrs.append(val)
        return orgnrs if orgnrs else None
    return None


def _build_run_context(request: StartWorkflowRequest) -> Dict[str, Any]:
    return {
        "name": request.name,
        "list_id": request.list_id,
        "template_id": request.template_id,
        "template_name": request.template_name,
        "template_prompt": request.template_prompt,
        "config": {
            "auto_approve": bool(request.config.auto_approve),
            "overwrite_existing": bool(request.config.overwrite_existing),
        },
    }


@router.post("/start")
async def start_workflow(request: StartWorkflowRequest):
    """Start a new analysis workflow run."""
    try:
        db = get_database_service()
        criteria = FilterCriteria(
            min_revenue=request.min_revenue,
            min_ebitda_margin=request.min_ebitda_margin,
            min_growth=request.min_growth,
            industries=request.industries,
            max_results=request.max_results,
        )
        selected_orgnrs = _resolve_target_orgnrs(db, request)
        if selected_orgnrs is not None:
            criteria.max_results = max(len(selected_orgnrs), 1)
        run_context = _build_run_context(request)
        workflow = AnalysisWorkflow()
        run_id, started_at = workflow.create_run_record(
            criteria=criteria,
            created_by="system",
            run_context=run_context,
        )

        async def _run_in_background() -> None:
            try:
                await workflow.run(
                    criteria=criteria,
                    created_by="system",
                    run_id=run_id,
                    started_at=started_at,
                    selected_orgnrs=selected_orgnrs,
                    run_context=run_context,
                    create_record=False,
                )
            except Exception as exc:
                logger.error("Background workflow failed (%s): %s", run_id, exc)
            finally:
                ACTIVE_RUN_TASKS.pop(run_id, None)

        if request.run_async:
            task = asyncio.create_task(_run_in_background())
            ACTIVE_RUN_TASKS[run_id] = task
            return {
                "success": True,
                "run_id": run_id,
                "status": "running",
                "stage1_count": None,
                "stage2_count": None,
                "stage3_count": None,
                "started_at": started_at,
                "name": run_context.get("name"),
                "list_id": run_context.get("list_id"),
                "template_id": run_context.get("template_id"),
                "template_name": run_context.get("template_name"),
                "config": run_context.get("config"),
            }

        result = await workflow.run(
            criteria=criteria,
            created_by="system",
            run_id=run_id,
            started_at=started_at,
            selected_orgnrs=selected_orgnrs,
            run_context=run_context,
            create_record=False,
        )
        return {
            "success": True,
            "run_id": result.run_id,
            "status": result.status,
            "stage1_count": result.stage1_count,
            "stage2_count": result.stage2_count,
            "stage3_count": result.stage3_count,
            "started_at": result.started_at,
            "completed_at": result.completed_at,
            "name": run_context.get("name"),
            "list_id": run_context.get("list_id"),
            "template_id": run_context.get("template_id"),
            "template_name": run_context.get("template_name"),
            "config": run_context.get("config"),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to start workflow: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/runs/{run_id}", response_model=WorkflowStatusResponse)
async def get_run_status(run_id: str):
    """Get status of a workflow run."""
    db = get_database_service()

    try:
        rows = db.run_raw_query(
            "SELECT * FROM acquisition_runs WHERE id::text = ?",
            params=[run_id],
        )

        if not rows:
            raise HTTPException(status_code=404, detail="Run not found")

        payload = _shape_run_row(rows[0])
        return WorkflowStatusResponse(**payload)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get run status: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/runs/{run_id}/companies")
async def get_run_companies(run_id: str, recommendation: Optional[str] = None):
    """Get all companies analyzed in a run."""
    db = get_database_service()
    _ensure_analysis_review_table(db)

    try:
        sql = """
        SELECT a.*, c.company_name, ar.criteria AS run_criteria,
               r.extracted_products, r.extracted_markets, r.sales_channels, r.digital_score,
               rev.status AS reviewed_status
        FROM company_analysis a
        JOIN companies c ON c.orgnr = a.orgnr
        JOIN acquisition_runs ar ON ar.id = a.run_id
        LEFT JOIN company_research r ON r.orgnr = a.orgnr
        LEFT JOIN analysis_result_reviews rev ON rev.run_id = a.run_id AND rev.orgnr = a.orgnr
        WHERE a.run_id::text = ?
        """
        params: List[Any] = [run_id]

        if recommendation:
            sql += " AND a.recommendation = ?"
            params.append(recommendation)

        sql += " ORDER BY a.strategic_fit_score DESC"

        rows = db.run_raw_query(sql, params=params)

        companies: List[CompanyAnalysisResponse] = []
        for row in rows:
            run_criteria = _parse_criteria(row.get("run_criteria"))
            cfg = run_criteria.get("config") if isinstance(run_criteria.get("config"), dict) else {}
            auto_approve = bool(cfg.get("auto_approve"))
            companies.append(
                CompanyAnalysisResponse(
                    orgnr=str(row["orgnr"]),
                    company_name=str(row.get("company_name", "")),
                    business_model=row.get("business_model"),
                    products_summary=row.get("products_summary"),
                    market_position=row.get("market_position"),
                    swot_strengths=_parse_json_field(row.get("swot_strengths")),
                    swot_weaknesses=_parse_json_field(row.get("swot_weaknesses")),
                    swot_opportunities=_parse_json_field(row.get("swot_opportunities")),
                    swot_threats=_parse_json_field(row.get("swot_threats")),
                    strategic_fit_score=int(row.get("strategic_fit_score") or 0),
                    recommendation=str(row.get("recommendation", "")),
                    investment_memo=str(row.get("investment_memo", "")),
                    result_status=str(row.get("reviewed_status") or ("approved" if auto_approve else "pending")),
                    extracted_products=_parse_json_field(row.get("extracted_products")),
                    extracted_markets=_parse_json_field(row.get("extracted_markets")),
                    sales_channels=_parse_json_field(row.get("sales_channels")),
                    digital_score=int(row.get("digital_score") or 0),
                )
            )

        return {"success": True, "count": len(rows), "companies": companies}

    except Exception as e:
        logger.error("Failed to get run companies: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/companies/{orgnr}/analysis")
async def get_company_analysis(orgnr: str):
    """Get latest analysis for a specific company. Returns 404 when no analysis or tables missing."""
    try:
        db = get_database_service()
    except Exception as e:
        logger.debug("get_company_analysis: no DB: %s", e)
        raise HTTPException(status_code=404, detail="No analysis available")

    if hasattr(db, "table_exists"):
        if not (db.table_exists("company_analysis") and db.table_exists("companies")):
            raise HTTPException(status_code=404, detail="No analysis available")

    try:
        rows = db.run_raw_query(
            """
            SELECT a.*, c.company_name
            FROM company_analysis a
            JOIN companies c ON c.orgnr = a.orgnr
            WHERE a.orgnr = ?
            ORDER BY a.analyzed_at DESC
            LIMIT 1
            """,
            params=[orgnr],
        )
    except Exception as e:
        logger.warning("get_company_analysis query failed: %s", e)
        raise HTTPException(status_code=404, detail="No analysis available")

    if not rows:
        raise HTTPException(status_code=404, detail="No analysis found for this company")

    row = rows[0]

    return CompanyAnalysisResponse(
        orgnr=str(row["orgnr"]),
        company_name=str(row.get("company_name", "")),
        business_model=row.get("business_model"),
        products_summary=row.get("products_summary"),
        market_position=row.get("market_position"),
        swot_strengths=_parse_json_field(row.get("swot_strengths")),
        swot_weaknesses=_parse_json_field(row.get("swot_weaknesses")),
        swot_opportunities=_parse_json_field(row.get("swot_opportunities")),
        swot_threats=_parse_json_field(row.get("swot_threats")),
        strategic_fit_score=int(row.get("strategic_fit_score") or 0),
        recommendation=str(row.get("recommendation", "")),
        investment_memo=str(row.get("investment_memo", "")),
    )


@router.get("/templates")
async def list_prompt_templates():
    db = get_database_service()
    _ensure_prompt_templates_table(db)
    rows = db.run_raw_query(
        "SELECT * FROM analysis_prompt_templates ORDER BY updated_at DESC"
    )
    return {"items": [_shape_template_row(r) for r in rows]}


@router.post("/templates")
async def create_prompt_template(body: PromptTemplateCreate):
    db = get_database_service()
    _ensure_prompt_templates_table(db)
    template_id = str(__import__("uuid").uuid4())
    db.run_raw_query(
        """
        INSERT INTO analysis_prompt_templates
        (id, name, description, prompt, variables, scoring_dimensions, created_by)
        VALUES (?::uuid, ?, ?, ?, ?::jsonb, ?::jsonb, 'system')
        """,
        [
            template_id,
            body.name,
            body.description,
            body.prompt,
            json.dumps(body.variables or [], ensure_ascii=False),
            json.dumps(body.scoring_dimensions or [], ensure_ascii=False),
        ],
    )
    row = db.run_raw_query("SELECT * FROM analysis_prompt_templates WHERE id::text = ?", [template_id])[0]
    return _shape_template_row(row)


@router.put("/templates/{template_id}")
async def update_prompt_template(template_id: str, body: PromptTemplateUpdate):
    db = get_database_service()
    _ensure_prompt_templates_table(db)
    rows = db.run_raw_query("SELECT * FROM analysis_prompt_templates WHERE id::text = ?", [template_id])
    if not rows:
        raise HTTPException(status_code=404, detail="Template not found")

    updates: List[str] = []
    params: List[Any] = []
    if body.name is not None:
        updates.append("name = ?")
        params.append(body.name)
    if body.description is not None:
        updates.append("description = ?")
        params.append(body.description)
    if body.prompt is not None:
        updates.append("prompt = ?")
        params.append(body.prompt)
    if body.variables is not None:
        updates.append("variables = ?::jsonb")
        params.append(json.dumps(body.variables, ensure_ascii=False))
    if body.scoring_dimensions is not None:
        updates.append("scoring_dimensions = ?::jsonb")
        params.append(json.dumps(body.scoring_dimensions, ensure_ascii=False))

    if updates:
        updates.append("updated_at = NOW()")
        params.append(template_id)
        db.run_raw_query(
            f"UPDATE analysis_prompt_templates SET {', '.join(updates)} WHERE id::text = ?",
            params,
        )

    row = db.run_raw_query("SELECT * FROM analysis_prompt_templates WHERE id::text = ?", [template_id])[0]
    return _shape_template_row(row)


@router.post("/templates/{template_id}/duplicate")
async def duplicate_prompt_template(template_id: str, payload: DuplicateTemplatePayload = DuplicateTemplatePayload()):
    db = get_database_service()
    _ensure_prompt_templates_table(db)
    rows = db.run_raw_query("SELECT * FROM analysis_prompt_templates WHERE id::text = ?", [template_id])
    if not rows:
        raise HTTPException(status_code=404, detail="Template not found")
    src = rows[0]
    new_id = str(__import__("uuid").uuid4())
    new_name = payload.name or f"{src.get('name', 'Template')} (Copy)"
    db.run_raw_query(
        """
        INSERT INTO analysis_prompt_templates
        (id, name, description, prompt, variables, scoring_dimensions, created_by)
        VALUES (?::uuid, ?, ?, ?, ?::jsonb, ?::jsonb, 'system')
        """,
        [
            new_id,
            new_name,
            src.get("description") or "",
            src.get("prompt") or "",
            json.dumps(_parse_json_field(src.get("variables")), ensure_ascii=False),
            json.dumps(_parse_json_field(src.get("scoring_dimensions")), ensure_ascii=False),
        ],
    )
    row = db.run_raw_query("SELECT * FROM analysis_prompt_templates WHERE id::text = ?", [new_id])[0]
    return _shape_template_row(row)


@router.post("/runs/{run_id}/cancel")
async def cancel_run(run_id: str):
    """Cancel a queued/running analysis run."""
    db = get_database_service()
    if not (hasattr(db, "table_exists") and db.table_exists("acquisition_runs")):
        raise HTTPException(status_code=404, detail="Run not found")

    rows = db.run_raw_query("SELECT * FROM acquisition_runs WHERE id::text = ? LIMIT 1", [run_id])
    if not rows:
        raise HTTPException(status_code=404, detail="Run not found")

    status = str(rows[0].get("status", ""))
    if status in ("complete", "completed", "failed", "cancelled"):
        raise HTTPException(status_code=409, detail=f"Run already {status}")

    db.run_raw_query(
        "UPDATE acquisition_runs SET status = 'cancelled', completed_at = NOW() WHERE id::text = ?",
        [run_id],
    )

    task = ACTIVE_RUN_TASKS.get(run_id)
    if task and not task.done():
        task.cancel()

    return {"success": True, "run_id": run_id, "status": "cancelled"}


@router.post("/results/{result_id}/approve")
async def approve_result(result_id: str, payload: ReviewPayload = ReviewPayload()):
    """Approve analysis result by composite id (runId::orgnr)."""
    return await _set_result_review_status(result_id, "approved", payload.model_dump())


@router.post("/results/{result_id}/reject")
async def reject_result(result_id: str, payload: ReviewPayload = ReviewPayload()):
    """Reject analysis result by composite id (runId::orgnr)."""
    return await _set_result_review_status(result_id, "rejected", payload.model_dump())


async def _set_result_review_status(result_id: str, status: str, payload: Dict[str, Any]):
    if "::" in result_id:
        run_id, orgnr = result_id.split("::", 1)
    else:
        raise HTTPException(status_code=400, detail="result_id must be runId::orgnr")

    db = get_database_service()
    if not (hasattr(db, "table_exists") and db.table_exists("company_analysis")):
        raise HTTPException(status_code=404, detail="Analysis data unavailable")

    existing = db.run_raw_query(
        "SELECT 1 FROM company_analysis WHERE run_id::text = ? AND orgnr = ? LIMIT 1",
        [run_id, orgnr],
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Result not found")

    _ensure_analysis_review_table(db)
    note = payload.get("note") if isinstance(payload, dict) else None
    db.run_raw_query(
        """
        INSERT INTO analysis_result_reviews (id, run_id, orgnr, status, note, updated_by)
        VALUES (?::uuid, ?::uuid, ?, ?, ?, NULL)
        ON CONFLICT (run_id, orgnr) DO UPDATE
        SET status = EXCLUDED.status,
            note = EXCLUDED.note,
            updated_at = NOW()
        """,
        [str(__import__("uuid").uuid4()), run_id, orgnr, status, note],
    )

    return {"success": True, "result_id": result_id, "status": status}


@router.get("/status")
async def analysis_status():
    """
    Report whether the analysis schema is ready.
    UI can show 'Analysis module not installed' when analysis_schema_ready is false.
    """
    required_tables = ["companies", "acquisition_runs", "company_analysis"]
    missing: List[str] = []
    try:
        db = get_database_service()
    except Exception:
        return {
            "ok": True,
            "analysis_schema_ready": False,
            "missing_tables": required_tables,
            "message": "Database not configured",
        }

    if hasattr(db, "table_exists"):
        for t in required_tables:
            if not db.table_exists(t):
                missing.append(t)
    else:
        missing = required_tables

    return {
        "ok": True,
        "analysis_schema_ready": len(missing) == 0,
        "missing_tables": missing,
        "message": "Analysis schema ready"
        if not missing
        else f"Missing tables: {', '.join(missing)}",
    }


@router.get("/runs")
async def list_runs(limit: int = 20):
    """List recent workflow runs. Returns empty runs on DB/table mismatch."""
    try:
        db = get_database_service()
    except Exception as e:
        logger.warning("Analysis runs: get_database_service failed: %s", e)
        return {"success": True, "runs": []}

    if not (hasattr(db, "table_exists") and db.table_exists("acquisition_runs")):
        return {"success": True, "runs": []}

    try:
        rows = db.run_raw_query(
            """
            SELECT id, status, stage, stage1_count, stage2_count, stage3_count,
                   started_at, completed_at, error_message, criteria
            FROM acquisition_runs
            ORDER BY started_at DESC
            LIMIT ?
            """,
            [limit],
        )

        return {"success": True, "runs": [_shape_run_row(row) for row in rows]}

    except Exception as e:
        logger.warning("Analysis runs: query failed: %s", e)
        return {"success": True, "runs": []}

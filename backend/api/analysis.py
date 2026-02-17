"""
Acquisition Workflow API Endpoints
"""

from __future__ import annotations

import json
import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..analysis.stage1_filter import FilterCriteria
from ..analysis.workflow import AnalysisWorkflow
from ..services.db_factory import get_database_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


class StartWorkflowRequest(BaseModel):
    """Request to start analysis workflow"""
    min_revenue: float = Field(10_000_000, description="Minimum revenue in SEK")
    min_ebitda_margin: float = Field(0.05, description="Minimum EBITDA margin (0.05 = 5%)")
    min_growth: float = Field(0.10, description="Minimum 3Y CAGR (0.10 = 10%)")
    industries: Optional[List[str]] = Field(None, description="NACE industry codes")
    max_results: int = Field(500, ge=1, le=1000, description="Maximum companies to analyze")


class WorkflowStatusResponse(BaseModel):
    """Workflow run status"""
    run_id: str
    status: str
    stage: int
    stage1_count: Optional[int]
    stage2_count: Optional[int]
    stage3_count: Optional[int]
    started_at: str
    completed_at: Optional[str]
    error_message: Optional[str]
    


class CompanyAnalysisResponse(BaseModel):
    """Company analysis result"""
    orgnr: str
    company_name: str
    business_model: Optional[str]
    products_summary: Optional[str]
    market_position: Optional[str]
    swot_strengths: List[str]
    swot_weaknesses: List[str]
    swot_opportunities: List[str]
    swot_threats: List[str]
    strategic_fit_score: int
    recommendation: str
    investment_memo: str
    # Enriched data
    extracted_products: List[str] = []
    extracted_markets: List[str] = []
    sales_channels: List[str] = []
    digital_score: int = 0


@router.post("/start")
async def start_workflow(request: StartWorkflowRequest):
    """Start a new analysis workflow run"""
    try:
        criteria = FilterCriteria(
            min_revenue=request.min_revenue,
            min_ebitda_margin=request.min_ebitda_margin,
            min_growth=request.min_growth,
            industries=request.industries,
            max_results=request.max_results
        )
        
        workflow = AnalysisWorkflow()
        result = await workflow.run(criteria)
        
        return {
            "success": True,
            "run_id": result.run_id,
            "status": result.status,
            "stage1_count": result.stage1_count,
            "stage2_count": result.stage2_count,
            "stage3_count": result.stage3_count,
        }
        
    except Exception as e:
        logger.error(f"Failed to start workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/runs/{run_id}", response_model=WorkflowStatusResponse)
async def get_run_status(run_id: str):
    """Get status of a workflow run"""
    db = get_database_service()
    
    try:
        rows = db.run_raw_query(
            "SELECT * FROM acquisition_runs WHERE id = ?",
            params=[run_id]
        )
        
        if not rows:
            raise HTTPException(status_code=404, detail="Run not found")
        
        run = rows[0]
        return WorkflowStatusResponse(
            run_id=run['id'],
            status=run['status'],
            stage=run['stage'],
            stage1_count=run.get('stage1_count'),
            stage2_count=run.get('stage2_count'),
            stage3_count=run.get('stage3_count'),
            started_at=run['started_at'],
            completed_at=run.get('completed_at'),
            error_message=run.get('error_message')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get run status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/runs/{run_id}/companies")
async def get_run_companies(run_id: str, recommendation: Optional[str] = None):
    """Get all companies analyzed in a run"""
    db = get_database_service()
    
    try:
        # Build query
        sql = """
        SELECT a.*, c.company_name, 
               r.extracted_products, r.extracted_markets, r.sales_channels, r.digital_score
        FROM company_analysis a
        JOIN companies c ON c.orgnr = a.orgnr
        LEFT JOIN company_research r ON r.orgnr = a.orgnr
        WHERE a.run_id = ?
        """
        params = [run_id]
        
        if recommendation:
            sql += " AND a.recommendation = ?"
            params.append(recommendation)
        
        sql += " ORDER BY a.strategic_fit_score DESC"
        
        rows = db.run_raw_query(sql, params=params)
        
        import json
        
        def parse_json_field(val):
            if not val: return []
            if isinstance(val, list): return val
            try: return json.loads(val)
            except: return []

        return {
            "success": True,
            "count": len(rows),
            "companies": [
                CompanyAnalysisResponse(
                    orgnr=row['orgnr'],
                    company_name=row['company_name'],
                    business_model=row.get('business_model'),
                    products_summary=row.get('products_summary'),
                    market_position=row.get('market_position'),
                    swot_strengths=parse_json_field(row.get('swot_strengths')),
                    swot_weaknesses=parse_json_field(row.get('swot_weaknesses')),
                    swot_opportunities=parse_json_field(row.get('swot_opportunities')),
                    swot_threats=parse_json_field(row.get('swot_threats')),
                    strategic_fit_score=row['strategic_fit_score'],
                    recommendation=row['recommendation'],
                    investment_memo=row.get('investment_memo', ''),
                    # Enriched data
                    extracted_products=parse_json_field(row.get('extracted_products')),
                    extracted_markets=parse_json_field(row.get('extracted_markets')),
                    sales_channels=parse_json_field(row.get('sales_channels')),
                    digital_score=row.get('digital_score') or 0
                )
                for row in rows
            ]
        }
        
    except Exception as e:
        logger.error(f"Failed to get run companies: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/companies/{orgnr}/analysis")
async def get_company_analysis(orgnr: str):
    """Get latest analysis for a specific company. Returns 404 when no analysis or tables missing."""
    try:
        db = get_database_service()
    except Exception as e:
        logger.debug("get_company_analysis: no DB: %s", e)
        raise HTTPException(status_code=404, detail="No analysis available")

    # Check if acquisition tables exist (Postgres may not have them)
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
    # Parse JSON/JSONB fields if they come as strings
    def _list(val):
        if val is None:
            return []
        if isinstance(val, list):
            return val
        if isinstance(val, str):
            try:
                return json.loads(val) if val else []
            except Exception:
                return []
        return []

    return CompanyAnalysisResponse(
        orgnr=row["orgnr"],
        company_name=row.get("company_name", ""),
        business_model=row.get("business_model"),
        products_summary=row.get("products_summary"),
        market_position=row.get("market_position"),
        swot_strengths=_list(row.get("swot_strengths")),
        swot_weaknesses=_list(row.get("swot_weaknesses")),
        swot_opportunities=_list(row.get("swot_opportunities")),
        swot_threats=_list(row.get("swot_threats")),
        strategic_fit_score=int(row.get("strategic_fit_score") or 0),
        recommendation=row.get("recommendation", ""),
        investment_memo=row.get("investment_memo", ""),
    )


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
        "message": "Analysis schema ready" if not missing else f"Missing tables: {', '.join(missing)}",
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
                   started_at, completed_at
            FROM acquisition_runs
            ORDER BY started_at DESC
            LIMIT ?
            """,
            [limit],
        )

        return {
            "success": True,
            "runs": [
                {
                    "run_id": row["id"],
                    "status": row["status"],
                    "stage": row["stage"],
                    "stage1_count": row.get("stage1_count"),
                    "stage2_count": row.get("stage2_count"),
                    "stage3_count": row.get("stage3_count"),
                    "started_at": str(row["started_at"]) if row.get("started_at") else "",
                    "completed_at": str(row["completed_at"]) if row.get("completed_at") else None,
                }
                for row in rows
            ],
        }

    except Exception as e:
        logger.warning("Analysis runs: query failed: %s", e)
        return {"success": True, "runs": []}

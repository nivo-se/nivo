"""LangGraph-based Deep Research orchestrator pipeline."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select

from backend.agents import AgentRegistry
from backend.db import SessionLocal
from backend.db.models.deep_research import AnalysisRun
from backend.orchestrator.persistence import RunStateRepository
from backend.orchestrator.state import OrchestratorState

try:
    from langgraph.graph import END, START, StateGraph
except Exception:  # pragma: no cover - runtime dependency issue
    END = "__end__"
    START = "__start__"
    StateGraph = None  # type: ignore

logger = logging.getLogger(__name__)

PIPELINE_NODES: list[str] = [
    "identity",
    "company_profile",
    "market_analysis",
    "competitor_discovery",
    "strategy",
    "value_creation",
    "financial_model",
    "valuation",
    "verification",
    "report_generation",
]


@dataclass(slots=True)
class OrchestratorRunResult:
    run_id: uuid.UUID
    company_id: uuid.UUID
    status: str
    stage: str
    progress_pct: int
    node_results: dict[str, Any]
    errors: list[str]


class LangGraphAgentOrchestrator:
    """Executes a deterministic Deep Research node pipeline using LangGraph."""

    def __init__(self) -> None:
        self.agent_registry = AgentRegistry.default()

    def _merge_node_result(
        self, state: OrchestratorState, node_name: str, output: dict
    ) -> dict:
        merged = dict(state.get("node_results", {}))
        merged[node_name] = output
        return {"current_node": node_name, "node_results": merged}

    def _node_wrapper(self, repo: RunStateRepository, node_name: str, state: OrchestratorState, compute_fn):
        input_payload = {
            "company_id": state.get("company_id"),
            "orgnr": state.get("orgnr"),
            "company_name": state.get("company_name"),
            "website": state.get("website"),
            "query": state.get("query"),
        }
        repo.upsert_node_state(
            run_id=uuid.UUID(state["run_id"]),
            node_name=node_name,
            status="running",
            input_json=input_payload,
            output_json={},
            error_message=None,
        )
        try:
            output = compute_fn(state)
            repo.upsert_node_state(
                run_id=uuid.UUID(state["run_id"]),
                node_name=node_name,
                status="completed",
                input_json=input_payload,
                output_json=output,
                error_message=None,
            )
            return self._merge_node_result(state, node_name, output)
        except Exception as exc:
            repo.session.rollback()
            try:
                repo.upsert_node_state(
                    run_id=uuid.UUID(state["run_id"]),
                    node_name=node_name,
                    status="failed",
                    input_json=input_payload,
                    output_json={},
                    error_message=str(exc),
                )
            except Exception:
                logger.exception(
                    "Failed to persist failed node state for run=%s node=%s",
                    state.get("run_id"),
                    node_name,
                )
            raise

    def _build_graph(self, repo: RunStateRepository):
        if StateGraph is None:
            raise RuntimeError("LangGraph is not available in this environment")
        graph = StateGraph(OrchestratorState)

        def identity(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                run_id = uuid.UUID(_state["run_id"])
                company_id = uuid.UUID(_state["company_id"])
                context = repo.build_agent_context(run_id, company_id)
                agent = self.agent_registry.get("identity")
                if agent is None:
                    raise RuntimeError("identity agent not registered")
                output = agent.run(context)
                repo.persist_identity(company_id, output)
                claim_ids = repo.persist_claims(
                    run_id=run_id,
                    company_id=company_id,
                    claims=output.claims,
                    default_claim_type="identity",
                )
                payload = output.model_dump(mode="json")
                payload["metadata"] = {
                    **payload.get("metadata", {}),
                    "claim_ids": [str(x) for x in claim_ids],
                    "source_ids": [str(x) for x in output.source_ids],
                }
                return payload

            return self._node_wrapper(repo, "identity", state, compute)

        def company_profile(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                run_id = uuid.UUID(_state["run_id"])
                company_id = uuid.UUID(_state["company_id"])
                context = repo.build_agent_context(run_id, company_id)
                agent = self.agent_registry.get("company_profile")
                if agent is None:
                    raise RuntimeError("company_profile agent not registered")
                output = agent.run(context)
                claim_ids = repo.persist_claims(
                    run_id=run_id,
                    company_id=company_id,
                    claims=output.claims,
                    default_claim_type="company_profile",
                )
                payload = output.model_dump(mode="json")
                payload["metadata"] = {
                    **payload.get("metadata", {}),
                    "claim_ids": [str(x) for x in claim_ids],
                    "source_ids": [str(x) for x in output.source_ids],
                }
                repo.persist_company_profile(
                    run_id=run_id,
                    company_id=company_id,
                    payload=payload,
                )
                return payload

            return self._node_wrapper(repo, "company_profile", state, compute)

        def market_analysis(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                run_id = uuid.UUID(_state["run_id"])
                company_id = uuid.UUID(_state["company_id"])
                context = repo.build_agent_context(run_id, company_id)
                agent = self.agent_registry.get("market_analysis")
                if agent is None:
                    raise RuntimeError("market_analysis agent not registered")
                output = agent.run(context)
                claim_ids = repo.persist_claims(
                    run_id=run_id,
                    company_id=company_id,
                    claims=output.claims,
                    default_claim_type="market_analysis",
                )
                payload = output.model_dump(mode="json")
                payload["metadata"] = {
                    **payload.get("metadata", {}),
                    "claim_ids": [str(x) for x in claim_ids],
                    "source_ids": [str(x) for x in output.source_ids],
                }
                repo.persist_market_analysis(
                    run_id=run_id,
                    company_id=company_id,
                    payload=payload,
                )
                return payload

            return self._node_wrapper(repo, "market_analysis", state, compute)

        def competitor_discovery(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                data = {"competitors": []}
                repo.persist_competitors(
                    run_id=uuid.UUID(_state["run_id"]),
                    company_id=uuid.UUID(_state["company_id"]),
                    payload=data,
                )
                return data

            return self._node_wrapper(repo, "competitor_discovery", state, compute)

        def strategy(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                data = {
                    "investment_thesis": "Placeholder thesis pending agent analysis.",
                    "acquisition_rationale": "Placeholder rationale.",
                    "key_risks": {},
                    "diligence_focus": {},
                    "integration_themes": {},
                    "metadata": {"source": "langgraph_stub"},
                }
                strategy_row = repo.persist_strategy(
                    run_id=uuid.UUID(_state["run_id"]),
                    company_id=uuid.UUID(_state["company_id"]),
                    payload=data,
                )
                data["strategy_id"] = str(strategy_row.id)
                return data

            return self._node_wrapper(repo, "strategy", state, compute)

        def value_creation(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                strategy_data = _state.get("node_results", {}).get("strategy", {})
                strategy_id = strategy_data.get("strategy_id")
                parsed_strategy_id = uuid.UUID(strategy_id) if strategy_id else None
                data = {
                    "initiatives": {},
                    "timeline": {},
                    "kpis": {},
                    "metadata": {"source": "langgraph_stub"},
                }
                repo.persist_value_creation(
                    run_id=uuid.UUID(_state["run_id"]),
                    company_id=uuid.UUID(_state["company_id"]),
                    strategy_id=parsed_strategy_id,
                    payload=data,
                )
                return data

            return self._node_wrapper(repo, "value_creation", state, compute)

        def financial_model(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                data = {
                    "model_version": "v1",
                    "assumption_set": {},
                    "forecast": {},
                    "sensitivity": {},
                    "metadata": {"source": "langgraph_stub"},
                }
                model_row = repo.persist_financial_model(
                    run_id=uuid.UUID(_state["run_id"]),
                    company_id=uuid.UUID(_state["company_id"]),
                    payload=data,
                )
                data["financial_model_id"] = str(model_row.id)
                return data

            return self._node_wrapper(repo, "financial_model", state, compute)

        def valuation(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                fm_data = _state.get("node_results", {}).get("financial_model", {})
                fm_id = fm_data.get("financial_model_id")
                parsed_fm_id = uuid.UUID(fm_id) if fm_id else None
                data = {
                    "method": "comps",
                    "enterprise_value": None,
                    "equity_value": None,
                    "valuation_range_low": None,
                    "valuation_range_high": None,
                    "currency": "SEK",
                    "metadata": {"source": "langgraph_stub"},
                }
                repo.persist_valuation(
                    run_id=uuid.UUID(_state["run_id"]),
                    company_id=uuid.UUID(_state["company_id"]),
                    financial_model_id=parsed_fm_id,
                    payload=data,
                )
                return data

            return self._node_wrapper(repo, "valuation", state, compute)

        def verification(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                return {"verified": True, "issues": [], "metadata": {"source": "langgraph_stub"}}

            return self._node_wrapper(repo, "verification", state, compute)

        def report_generation(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                data = {
                    "status": "draft",
                    "title": f"Deep Research Report - {_state.get('company_name') or _state.get('orgnr')}",
                    "sections": [
                        {
                            "section_key": "executive_summary",
                            "heading": "Executive Summary",
                            "content_md": "Stub report generated by LangGraph orchestrator.",
                            "sort_order": 1,
                        }
                    ],
                    "metadata": {"source": "langgraph_stub"},
                }
                report = repo.persist_report(
                    run_id=uuid.UUID(_state["run_id"]),
                    company_id=uuid.UUID(_state["company_id"]),
                    payload=data,
                )
                data["report_version_id"] = str(report.id)
                return data

            return self._node_wrapper(repo, "report_generation", state, compute)

        graph.add_node("identity", identity)
        graph.add_node("company_profile", company_profile)
        graph.add_node("market_analysis", market_analysis)
        graph.add_node("competitor_discovery", competitor_discovery)
        graph.add_node("strategy", strategy)
        graph.add_node("value_creation", value_creation)
        graph.add_node("financial_model", financial_model)
        graph.add_node("valuation", valuation)
        graph.add_node("verification", verification)
        graph.add_node("report_generation", report_generation)

        graph.add_edge(START, "identity")
        graph.add_edge("identity", "company_profile")
        graph.add_edge("company_profile", "market_analysis")
        graph.add_edge("market_analysis", "competitor_discovery")
        graph.add_edge("competitor_discovery", "strategy")
        graph.add_edge("strategy", "value_creation")
        graph.add_edge("value_creation", "financial_model")
        graph.add_edge("financial_model", "valuation")
        graph.add_edge("valuation", "verification")
        graph.add_edge("verification", "report_generation")
        graph.add_edge("report_generation", END)
        return graph.compile()

    @staticmethod
    def _progress_from_node_states(node_states: list[dict[str, Any]]) -> int:
        completed = sum(1 for n in node_states if n.get("status") == "completed")
        return int((completed / len(PIPELINE_NODES)) * 100) if PIPELINE_NODES else 0

    def execute_basic_run(
        self,
        *,
        company_name: str | None,
        orgnr: str | None,
        company_id: uuid.UUID | None,
        website: str | None,
        query: str | None,
        run_id: uuid.UUID | None = None,
    ) -> OrchestratorRunResult:
        with SessionLocal() as session:
            repo = RunStateRepository(session)
            company = repo.resolve_company(
                company_id=company_id,
                orgnr=orgnr,
                company_name=company_name or (f"Company {orgnr}" if orgnr else None),
                website=website,
            )
            run = repo.create_or_resume_run(
                run_id=run_id,
                company_id=company.id,
                query=query or company.name,
            )
            run_uuid = run.id
            company_uuid = company.id

            graph = self._build_graph(repo)
            init_state: OrchestratorState = {
                "run_id": str(run_uuid),
                "company_id": str(company_uuid),
                "orgnr": company.orgnr,
                "company_name": company.name,
                "website": company.website,
                "query": query or company.name,
                "status": "running",
                "current_node": "identity",
                "node_results": {},
                "errors": [],
            }
            try:
                final_state = graph.invoke(init_state)
                repo.finalize_run(run_uuid, status="completed", error=None)
                node_rows = repo.list_node_states(run_uuid)
                session.commit()
                node_results = dict(final_state.get("node_results", {}))
                return OrchestratorRunResult(
                    run_id=run_uuid,
                    company_id=company_uuid,
                    status="completed",
                    stage=str(final_state.get("current_node", "report_generation")),
                    progress_pct=self._progress_from_node_states(
                        [{"status": row.status} for row in node_rows]
                    ),
                    node_results=node_results,
                    errors=[],
                )
            except Exception as exc:
                session.rollback()
                logger.exception("LangGraph pipeline failed for run %s: %s", run_uuid, exc)
                repo.finalize_run(run_uuid, status="failed", error=str(exc))
                node_rows = repo.list_node_states(run_uuid)
                session.commit()
                return OrchestratorRunResult(
                    run_id=run_uuid,
                    company_id=company_uuid,
                    status="failed",
                    stage="failed",
                    progress_pct=self._progress_from_node_states(
                        [{"status": row.status} for row in node_rows]
                    ),
                    node_results={},
                    errors=[str(exc)],
                )

    def get_run_status(self, run_id: uuid.UUID) -> dict[str, Any] | None:
        with SessionLocal() as session:
            run = session.get(AnalysisRun, run_id)
            if run is None:
                return None
            repo = RunStateRepository(session)
            node_rows = repo.list_node_states(run_id)
            node_states = [
                {
                    "node_name": row.node_name,
                    "status": row.status,
                    "started_at": row.started_at.isoformat() if row.started_at else None,
                    "completed_at": row.completed_at.isoformat() if row.completed_at else None,
                    "error_message": row.error_message,
                }
                for row in node_rows
            ]
            stage = node_states[-1]["node_name"] if node_states else "identity"
            return {
                "run_id": run.id,
                "company_id": run.company_id,
                "status": run.status,
                "stage": stage,
                "progress_pct": self._progress_from_node_states(node_states),
                "node_states": node_states,
            }

    def list_runs(self, limit: int = 20) -> list[dict[str, Any]]:
        with SessionLocal() as session:
            rows = session.execute(
                select(AnalysisRun).order_by(AnalysisRun.created_at.desc()).limit(limit)
            ).scalars()
            out: list[dict[str, Any]] = []
            repo = RunStateRepository(session)
            for row in rows:
                node_states = repo.list_node_states(row.id)
                stage = node_states[-1].node_name if node_states else "identity"
                out.append(
                    {
                        "run_id": row.id,
                        "company_id": row.company_id,
                        "status": row.status,
                        "stage": stage,
                        "progress_pct": self._progress_from_node_states(
                            [{"status": n.status} for n in node_states]
                        ),
                    }
                )
            return out


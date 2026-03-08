"""LangGraph-based Deep Research orchestrator pipeline."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select

from backend.agents import AgentRegistry
from backend.db import SessionLocal
from backend.db.models.deep_research import AnalysisRun, Company
from backend.orchestrator.persistence import RunStateRepository
from backend.orchestrator.state import OrchestratorState
from backend.report_engine import ReportComposer
from backend.verification import VerificationPipeline

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
        self.verification_pipeline = VerificationPipeline()
        self.report_composer = ReportComposer()

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
                run_id = uuid.UUID(_state["run_id"])
                company_id = uuid.UUID(_state["company_id"])
                context = repo.build_agent_context(run_id, company_id)

                discovery_agent = self.agent_registry.get("competitor_discovery")
                profiling_agent = self.agent_registry.get("competitor_profiling")
                if discovery_agent is None:
                    raise RuntimeError("competitor_discovery agent not registered")
                if profiling_agent is None:
                    raise RuntimeError("competitor_profiling agent not registered")

                discovery_output = discovery_agent.run(context)
                profiling_output = profiling_agent.run(
                    context, discovery_output.competitors
                )

                profile_by_name = {p.name.lower(): p for p in profiling_output.profiles}
                competitors_payload = []
                for competitor in discovery_output.competitors:
                    profile = profile_by_name.get(competitor.name.lower())
                    competitors_payload.append(
                        {
                            "name": competitor.name,
                            "website": competitor.website,
                            "relation_score": competitor.relation_score,
                            "metadata": {
                                **competitor.metadata,
                                "source_ids": [str(x) for x in competitor.source_ids],
                            },
                            "profile_text": profile.profile_text if profile else None,
                            "strengths": profile.strengths if profile else [],
                            "weaknesses": profile.weaknesses if profile else [],
                            "differentiation": profile.differentiation if profile else [],
                            "profile_metadata": profile.metadata if profile else {},
                        }
                    )

                repo.persist_competitors(
                    run_id=run_id,
                    company_id=company_id,
                    payload={"competitors": competitors_payload},
                )
                all_claims = list(discovery_output.claims) + list(
                    profiling_output.claims
                )
                claim_ids = repo.persist_claims(
                    run_id=run_id,
                    company_id=company_id,
                    claims=all_claims,
                    default_claim_type="competitor_intelligence",
                )
                return {
                    "competitors": competitors_payload,
                    "metadata": {
                        "method": "semantic_similarity_plus_profiling",
                        "claim_ids": [str(x) for x in claim_ids],
                        "source_ids": [str(x) for x in discovery_output.source_ids],
                    },
                }

            return self._node_wrapper(repo, "competitor_discovery", state, compute)

        def strategy(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                run_id = uuid.UUID(_state["run_id"])
                company_id = uuid.UUID(_state["company_id"])
                context = repo.build_agent_context(run_id, company_id)
                competitor_payload = _state.get("node_results", {}).get(
                    "competitor_discovery", {}
                )
                agent = self.agent_registry.get("strategy_analysis")
                if agent is None:
                    raise RuntimeError("strategy_analysis agent not registered")
                output = agent.run(context, competitor_payload)
                claim_ids = repo.persist_claims(
                    run_id=run_id,
                    company_id=company_id,
                    claims=output.claims,
                    default_claim_type="strategy_analysis",
                )
                data = output.model_dump(mode="json")
                data["metadata"] = {
                    **data.get("metadata", {}),
                    "claim_ids": [str(x) for x in claim_ids],
                    "source_ids": [str(x) for x in output.source_ids],
                }
                strategy_row = repo.persist_strategy(
                    run_id=run_id,
                    company_id=company_id,
                    payload=data,
                )
                data["strategy_id"] = str(strategy_row.id)
                return data

            return self._node_wrapper(repo, "strategy", state, compute)

        def value_creation(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                run_id = uuid.UUID(_state["run_id"])
                company_id = uuid.UUID(_state["company_id"])
                context = repo.build_agent_context(run_id, company_id)
                strategy_data = _state.get("node_results", {}).get("strategy", {})
                strategy_id = strategy_data.get("strategy_id")
                parsed_strategy_id = uuid.UUID(strategy_id) if strategy_id else None
                agent = self.agent_registry.get("value_creation_identification")
                if agent is None:
                    raise RuntimeError(
                        "value_creation_identification agent not registered"
                    )
                output = agent.run(context, strategy_data)
                claim_ids = repo.persist_claims(
                    run_id=run_id,
                    company_id=company_id,
                    claims=output.claims,
                    default_claim_type="value_creation",
                )
                data = output.model_dump(mode="json")
                data["metadata"] = {
                    **data.get("metadata", {}),
                    "claim_ids": [str(x) for x in claim_ids],
                    "source_ids": [str(x) for x in output.source_ids],
                }
                repo.persist_value_creation(
                    run_id=run_id,
                    company_id=company_id,
                    strategy_id=parsed_strategy_id,
                    payload=data,
                )
                return data

            return self._node_wrapper(repo, "value_creation", state, compute)

        def financial_model(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                run_id = uuid.UUID(_state["run_id"])
                company_id = uuid.UUID(_state["company_id"])
                context = repo.build_agent_context(run_id, company_id)
                strategy_data = _state.get("node_results", {}).get("strategy", {})
                value_creation_data = _state.get("node_results", {}).get(
                    "value_creation", {}
                )
                agent = self.agent_registry.get("financial_modeling")
                if agent is None:
                    raise RuntimeError("financial_modeling agent not registered")
                output = agent.run(context, strategy_data, value_creation_data)
                claim_ids = repo.persist_claims(
                    run_id=run_id,
                    company_id=company_id,
                    claims=output.claims,
                    default_claim_type="financial_model",
                )
                data = output.model_dump(mode="json")
                data["metadata"] = {
                    **data.get("metadata", {}),
                    "claim_ids": [str(x) for x in claim_ids],
                    "source_ids": [str(x) for x in output.source_ids],
                }
                model_row = repo.persist_financial_model(
                    run_id=run_id,
                    company_id=company_id,
                    payload=data,
                )
                data["financial_model_id"] = str(model_row.id)
                return data

            return self._node_wrapper(repo, "financial_model", state, compute)

        def valuation(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                run_id = uuid.UUID(_state["run_id"])
                company_id = uuid.UUID(_state["company_id"])
                context = repo.build_agent_context(run_id, company_id)
                fm_data = _state.get("node_results", {}).get("financial_model", {})
                fm_id = fm_data.get("financial_model_id")
                parsed_fm_id = uuid.UUID(fm_id) if fm_id else None
                agent = self.agent_registry.get("valuation_analysis")
                if agent is None:
                    raise RuntimeError("valuation_analysis agent not registered")
                output = agent.run(context, fm_data)
                claim_ids = repo.persist_claims(
                    run_id=run_id,
                    company_id=company_id,
                    claims=output.claims,
                    default_claim_type="valuation",
                )
                data = output.model_dump(mode="json")
                data["metadata"] = {
                    **data.get("metadata", {}),
                    "claim_ids": [str(x) for x in claim_ids],
                    "source_ids": [str(x) for x in output.source_ids],
                }
                repo.persist_valuation(
                    run_id=run_id,
                    company_id=company_id,
                    financial_model_id=parsed_fm_id,
                    payload=data,
                )
                return data

            return self._node_wrapper(repo, "valuation", state, compute)

        def verification(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                run_id = uuid.UUID(_state["run_id"])
                company_id = uuid.UUID(_state["company_id"])
                claims = repo.list_claims_for_run(run_id, company_id)
                result = self.verification_pipeline.run(claims, strict_mode=False)
                verified_updates = result.pop("claim_updates", [])
                updated_claims = repo.apply_claim_verification(verified_updates)
                persisted_verifications = repo.persist_claim_verifications(
                    run_id=run_id, claim_updates=verified_updates,
                )
                result["metadata"] = {
                    "pipeline": self.verification_pipeline.name,
                    "updated_claims": updated_claims,
                    "persisted_verifications": persisted_verifications,
                }
                return result

            return self._node_wrapper(repo, "verification", state, compute)

        def report_generation(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                run_id = uuid.UUID(_state["run_id"])
                company_id = uuid.UUID(_state["company_id"])
                node_results = dict(_state.get("node_results", {}))
                verification_output = node_results.get("verification")
                data = self.report_composer.compose(
                    company_name=str(
                        _state.get("company_name") or _state.get("orgnr") or "Unknown Company"
                    ),
                    node_results=node_results,
                    verification_output=verification_output,
                )
                report = repo.persist_report(
                    run_id=run_id,
                    company_id=company_id,
                    payload=data,
                )
                data["report_version_id"] = str(report.id)
                data["version_number"] = report.version_number
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

    def execute_partial_run(
        self,
        *,
        run_id: uuid.UUID,
        start_from_node: str,
    ) -> OrchestratorRunResult:
        """Execute pipeline from a specific node, reusing upstream completed outputs."""
        if start_from_node not in PIPELINE_NODES:
            raise ValueError(f"Unknown node: {start_from_node}")

        start_idx = PIPELINE_NODES.index(start_from_node)
        with SessionLocal() as session:
            repo = RunStateRepository(session)
            run = session.get(AnalysisRun, run_id)
            if run is None:
                raise ValueError(f"Run not found: {run_id}")
            company = session.get(Company, run.company_id) if run.company_id else None
            if company is None:
                raise ValueError(f"Company not found for run: {run_id}")

            run.status = "running"
            run.error_message = None
            run.completed_at = None
            session.flush()

            existing_nodes = repo.list_node_states(run_id)
            node_results: dict[str, Any] = {}
            for row in existing_nodes:
                if row.node_name in PIPELINE_NODES:
                    idx = PIPELINE_NODES.index(row.node_name)
                    if idx < start_idx and row.status == "completed" and isinstance(row.output_json, dict):
                        node_results[row.node_name] = row.output_json

            graph = self._build_graph(repo)
            init_state: OrchestratorState = {
                "run_id": str(run_id),
                "company_id": str(company.id),
                "orgnr": company.orgnr,
                "company_name": company.name,
                "website": company.website,
                "query": run.query or company.name,
                "status": "running",
                "current_node": start_from_node,
                "node_results": node_results,
                "errors": [],
            }
            try:
                final_state = graph.invoke(init_state)
                repo.finalize_run(run_id, status="completed", error=None)
                node_rows = repo.list_node_states(run_id)
                session.commit()
                return OrchestratorRunResult(
                    run_id=run_id,
                    company_id=company.id,
                    status="completed",
                    stage=str(final_state.get("current_node", "report_generation")),
                    progress_pct=self._progress_from_node_states(
                        [{"status": row.status} for row in node_rows]
                    ),
                    node_results=dict(final_state.get("node_results", {})),
                    errors=[],
                )
            except Exception as exc:
                session.rollback()
                logger.exception("Partial pipeline failed for run %s: %s", run_id, exc)
                repo.finalize_run(run_id, status="failed", error=str(exc))
                node_rows = repo.list_node_states(run_id)
                session.commit()
                return OrchestratorRunResult(
                    run_id=run_id,
                    company_id=company.id,
                    status="failed",
                    stage="failed",
                    progress_pct=self._progress_from_node_states(
                        [{"status": row.status} for row in node_rows]
                    ),
                    node_results={},
                    errors=[str(exc)],
                )

    @staticmethod
    def _build_stages(node_rows: list) -> list[dict[str, Any]]:
        """Build stages[] in PIPELINE_NODES order from RunNodeState rows."""
        by_name = {row.node_name: row for row in node_rows}
        stages: list[dict[str, Any]] = []
        for node_name in PIPELINE_NODES:
            row = by_name.get(node_name)
            if row:
                stages.append({
                    "stage": node_name,
                    "status": row.status,
                    "started_at": row.started_at,
                    "finished_at": row.completed_at,
                })
            else:
                stages.append({
                    "stage": node_name,
                    "status": "pending",
                    "started_at": None,
                    "finished_at": None,
                })
        return stages

    @staticmethod
    def _current_stage_from_rows(node_rows: list) -> str:
        """Derive current_stage: the latest non-pending node, or 'identity' if none started."""
        by_name = {row.node_name: row for row in node_rows}
        current = "identity"
        for node_name in PIPELINE_NODES:
            row = by_name.get(node_name)
            if row and row.status in ("running", "completed", "failed"):
                current = node_name
        return current

    def get_run_status(self, run_id: uuid.UUID) -> dict[str, Any] | None:
        with SessionLocal() as session:
            run = session.get(AnalysisRun, run_id)
            if run is None:
                return None
            repo = RunStateRepository(session)
            node_rows = repo.list_node_states(run_id)
            stages = self._build_stages(node_rows)
            current_stage = self._current_stage_from_rows(node_rows)
            return {
                "run_id": run.id,
                "company_id": run.company_id,
                "status": run.status,
                "current_stage": current_stage,
                "stages": stages,
            }

    def list_runs(self, limit: int = 20) -> list[dict[str, Any]]:
        with SessionLocal() as session:
            rows = session.execute(
                select(AnalysisRun).order_by(AnalysisRun.created_at.desc()).limit(limit)
            ).scalars()
            out: list[dict[str, Any]] = []
            repo = RunStateRepository(session)
            for row in rows:
                node_rows = repo.list_node_states(row.id)
                stages = self._build_stages(node_rows)
                current_stage = self._current_stage_from_rows(node_rows)
                out.append(
                    {
                        "run_id": row.id,
                        "company_id": row.company_id,
                        "status": row.status,
                        "current_stage": current_stage,
                        "stages": stages,
                    }
                )
            return out


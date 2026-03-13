"""LangGraph-based Deep Research orchestrator pipeline."""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select

from backend.agents import AgentRegistry
from backend.db import SessionLocal
from backend.db.models.deep_research import AnalysisRun, Company
from backend.orchestrator.persistence import RunStateRepository
from backend.orchestrator.run_diagnostics import build_run_diagnostics
from backend.orchestrator.stage_validators import (
    MAX_STAGE_RETRIES,
    STAGE_VALIDATORS,
    STRICT_STAGE_GATING,
    StageValidation,
    StageValidationError,
)
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
    "company_understanding",
    "report_spec",
    "web_retrieval",
    "evidence_validation",
    "company_profile",
    "market_analysis",
    "competitor_discovery",
    "product_research",
    "transaction_research",
    "strategy",
    "value_creation",
    "financial_model",
    "assumption_registry",
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
        repo.session.commit()  # Commit so UI shows progress per node

        validator_fn = STAGE_VALIDATORS.get(node_name)
        validation = StageValidation(status="pass")
        attempt = 0
        output: dict = {}
        t0 = time.monotonic()

        try:
            for attempt in range(MAX_STAGE_RETRIES + 1):
                output = compute_fn(state)

                if validator_fn is None:
                    break

                validation = validator_fn(output)
                if validation.status == "pass":
                    break

                if attempt < MAX_STAGE_RETRIES:
                    logger.warning(
                        "Stage %s validation failed (attempt %d/%d): %s — retrying",
                        node_name, attempt + 1, MAX_STAGE_RETRIES, validation.issues,
                    )
                    continue

                logger.warning(
                    "Stage %s validation failed after %d attempts: %s — marking degraded",
                    node_name, MAX_STAGE_RETRIES + 1, validation.issues,
                )
                if STRICT_STAGE_GATING:
                    raise StageValidationError(
                        f"Stage {node_name} failed validation after {MAX_STAGE_RETRIES + 1} "
                        f"attempts: {validation.issues}"
                    )

            elapsed_ms = int((time.monotonic() - t0) * 1000)

            stage_result = {
                "stage": node_name,
                "status": validation.status,
                "issues": validation.issues,
                "score": validation.score,
                "retry_count": attempt,
                "elapsed_ms": elapsed_ms,
            }
            evaluations = dict(state.get("stage_evaluations", {}))
            evaluations[node_name] = stage_result

            node_status = "skipped" if output.get("skipped") is True else "completed"
            repo.upsert_node_state(
                run_id=uuid.UUID(state["run_id"]),
                node_name=node_name,
                status=node_status,
                input_json=input_payload,
                output_json=output,
                error_message=None,
            )
            repo.session.commit()  # Commit so UI shows completed stages
            merged = self._merge_node_result(state, node_name, output)
            merged["stage_evaluations"] = evaluations
            return merged

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
                repo.session.commit()  # Persist failed state so UI shows it
            except Exception:
                logger.exception(
                    "Failed to persist failed node state for run=%s node=%s",
                    state.get("run_id"),
                    node_name,
                )
            raise

    @staticmethod
    def _evaluate_pipeline_integrity(state: OrchestratorState) -> tuple[bool, list[str]]:
        """Check all stage evaluations for failures before report generation.

        Returns (is_degraded, list_of_failed_stage_names).
        """
        evaluations = state.get("stage_evaluations", {})
        failed_stages = [
            name for name, ev in evaluations.items()
            if ev.get("status") == "fail"
        ]
        if failed_stages:
            logger.warning("Pipeline integrity: failed stages: %s", failed_stages)
        return (bool(failed_stages), failed_stages)

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

        def company_understanding(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                from backend.llm.company_understanding import extract_company_understanding

                identity_output = _state.get("node_results", {}).get("identity", {})
                company_name = _state.get("company_name") or identity_output.get("canonical_name") or "Company"
                claims = identity_output.get("claims", [])
                if isinstance(claims, list):
                    claim_texts = [
                        c.get("claim_text", "") if isinstance(c, dict) else getattr(c, "claim_text", "")
                        for c in claims
                    ]
                else:
                    claim_texts = []

                parts = [f"Company: {company_name}."]
                if identity_output.get("industry"):
                    parts.append(f"Industry: {identity_output.get('industry')}.")
                if identity_output.get("website"):
                    parts.append(f"Website: {identity_output.get('website')}.")
                if identity_output.get("orgnr"):
                    parts.append(f"Organization number: {identity_output.get('orgnr')}.")
                if identity_output.get("headquarters"):
                    parts.append(f"Headquarters: {identity_output.get('headquarters')}.")
                if claim_texts:
                    parts.append("Available information:")
                    parts.extend(claim_texts)
                raw_text = " ".join(parts)

                result = extract_company_understanding(company_name, raw_text)
                if result is None:
                    result = {
                        "company_description": "",
                        "products_services": [],
                        "business_model": "",
                        "target_customers": [],
                        "geographies": [],
                        "market_niche": "",
                        "confidence_score": 0.3,
                        "source_refs": [],
                        "extraction_method": "fallback_minimal",
                    }
                else:
                    result = dict(result)
                    result["source_refs"] = result.get("source_refs") or []
                    result["extraction_method"] = "llm"
                return result

            return self._node_wrapper(repo, "company_understanding", state, compute)

        def report_spec(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                from backend.services.deep_research.report_spec_builder import (
                    build_and_persist_report_spec,
                )

                run_id = uuid.UUID(_state["run_id"])
                company_id = uuid.UUID(_state["company_id"])
                company_understanding_output = _state.get("node_results", {}).get(
                    "company_understanding", {}
                )
                identity_output = _state.get("node_results", {}).get("identity", {})

                spec, persisted = build_and_persist_report_spec(
                    run_id=run_id,
                    company_id=company_id,
                    session=repo.session,
                    company_understanding=company_understanding_output,
                    identity=identity_output,
                    run_mode="standard_deep_research",
                    analyst_note=_state.get("query"),
                )
                return {
                    "report_id": str(spec.report_id),
                    "run_mode": spec.run_mode,
                    "policy_versions": spec.policy_versions.model_dump(),
                    "required_metrics_count": len(spec.required_metrics),
                    "persisted": persisted,
                }

            return self._node_wrapper(repo, "report_spec", state, compute)

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

        def web_retrieval(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                from backend.services.deep_research.input_completeness import (
                    DEEP_RESEARCH_THRESHOLDS,
                )
                from backend.services.deep_research.report_spec_builder import (
                    load_report_spec_for_run,
                )
                from backend.services.web_intel import WebRetrievalService

                run_id = uuid.UUID(_state["run_id"])
                company_id = uuid.UUID(_state["company_id"])
                company_understanding = _state.get("node_results", {}).get(
                    "company_understanding", {}
                )
                company_profile_legacy = _state.get("node_results", {}).get(
                    "company_profile", {}
                )
                company_name = _state.get("company_name") or ""
                orgnr = _state.get("orgnr")
                website = _state.get("website")

                conf_threshold = DEEP_RESEARCH_THRESHOLDS.get(
                    "company_understanding_confidence_threshold", 0.5
                )
                cu_confidence = company_understanding.get("confidence_score")
                cu_meets_threshold = (
                    cu_confidence is not None
                    and isinstance(cu_confidence, (int, float))
                    and cu_confidence >= conf_threshold
                )
                cu_has_business_model = bool(
                    (company_understanding.get("business_model") or "").strip()
                )
                cu_has_market_niche = bool(
                    (company_understanding.get("market_niche") or "").strip()
                )
                market_retrieval_gated = cu_meets_threshold and (
                    cu_has_business_model or cu_has_market_niche
                )

                profile_for_queries = (
                    company_understanding
                    if market_retrieval_gated
                    else None
                )
                market_label = (
                    company_understanding.get("market_niche")
                    or company_profile_legacy.get("market_niche")
                    if market_retrieval_gated
                    else None
                )

                report_spec = load_report_spec_for_run(repo.session, run_id)
                service = WebRetrievalService()
                bundle = service.retrieve(
                    run_id=run_id,
                    company_id=company_id,
                    company_name=company_name,
                    company_profile=profile_for_queries,
                    orgnr=orgnr,
                    company_website=website,
                    market_label=market_label,
                    report_spec=report_spec,
                )

                session_ids: list[uuid.UUID] = []
                for group in {"company_facts", "market", "competitors", "news"}:
                    group_queries = [
                        q for q in bundle.queries_executed
                        if q.get("query_group") == group
                    ]
                    if group_queries:
                        meta = {"result_counts": [q.get("result_count", 0) for q in group_queries]}
                        metric_keys = [q.get("metric_key") for q in group_queries if q.get("metric_key")]
                        if metric_keys:
                            meta["metric_keys"] = metric_keys
                        sid = repo.persist_web_search_session(
                            run_id=run_id,
                            company_id=company_id,
                            query_group=group,
                            queries=[q.get("query", "") for q in group_queries],
                            provider="tavily",
                            metadata=meta,
                        )
                        session_ids.append(sid)

                session_id = session_ids[0] if session_ids else None
                if bundle.accepted_evidence:
                    repo.persist_web_evidence(
                        run_id=run_id,
                        company_id=company_id,
                        session_id=session_id,
                        evidence_items=bundle.accepted_evidence,
                    )
                if bundle.rejected_evidence:
                    repo.persist_web_evidence_rejected(
                        run_id=run_id,
                        company_id=company_id,
                        items_with_reasons=bundle.rejected_evidence,
                    )

                payload = {
                    "queries_executed": bundle.queries_executed,
                    "accepted_count": len(bundle.accepted_evidence),
                    "rejected_count": len(bundle.rejected_evidence),
                    "normalized_sources": bundle.normalized_sources,
                    "metadata": {
                        **bundle.metadata,
                        "market_retrieval_gated": market_retrieval_gated,
                        "company_understanding_confidence": cu_confidence,
                    },
                }
                return payload

            return self._node_wrapper(repo, "web_retrieval", state, compute)

        def evidence_validation(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                from backend.services.deep_research.evidence_bundle_builder import (
                    build_from_db,
                    persist_evidence_bundle,
                )
                from backend.services.deep_research.report_spec_builder import (
                    load_report_spec_for_run,
                )

                run_id = uuid.UUID(_state["run_id"])
                company_id = uuid.UUID(_state["company_id"])
                web_retrieval_output = _state.get("node_results", {}).get("web_retrieval", {})
                queries_executed = web_retrieval_output.get("queries_executed") or []

                report_spec = load_report_spec_for_run(repo.session, run_id)
                required_metrics = []
                if report_spec:
                    required_metrics = report_spec.required_metrics

                bundle = build_from_db(
                    session=repo.session,
                    run_id=run_id,
                    company_id=company_id,
                    required_metrics=required_metrics,
                    queries_executed=queries_executed,
                )
                persist_evidence_bundle(
                    repo.session,
                    run_id,
                    company_id,
                    bundle,
                )
                repo.session.commit()

                return {
                    "items_count": len(bundle.items),
                    "rejected_count": len(bundle.rejected_items),
                    "coverage_rate": bundle.coverage_summary.coverage_rate,
                    "required_covered": bundle.coverage_summary.required_metrics_covered,
                    "required_total": bundle.coverage_summary.required_metrics_total,
                }

            return self._node_wrapper(repo, "evidence_validation", state, compute)

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
                from sqlalchemy import select

                from backend.db.models.deep_research import CompanyProfile, MarketAnalysis
                from backend.services.deep_research.competitor_discovery import (
                    CompetitorDiscoveryService,
                )
                from backend.services.deep_research.competitor_market_schemas import (
                    CompetitorMarketSynthesisOutput,
                )
                from backend.services.deep_research.competitor_profiler import (
                    CompetitorProfiler,
                )
                from backend.services.deep_research.competitor_verifier import (
                    CompetitorVerifier,
                )
                from backend.services.deep_research.evidence_loader import (
                    load_validated_evidence,
                )
                from backend.services.deep_research.market_model_builder import (
                    MarketModelBuilder,
                )
                from backend.services.deep_research.market_synthesis import (
                    MarketSynthesisService,
                )
                from backend.services.deep_research.positioning_engine import (
                    PositioningEngine,
                )

                run_id = uuid.UUID(_state["run_id"])
                company_id = uuid.UUID(_state["company_id"])
                company_name = _state.get("company_name") or ""
                company_website = _state.get("website")

                # Load inputs
                company_profile_row = repo.session.execute(
                    select(CompanyProfile).where(
                        CompanyProfile.run_id == run_id,
                        CompanyProfile.company_id == company_id,
                    )
                ).scalar_one_or_none()
                def _to_list(val):
                    if val is None:
                        return []
                    if isinstance(val, list):
                        return val
                    if isinstance(val, dict) and "items" in val:
                        return val["items"] or []
                    return []

                company_profile = {}
                if company_profile_row:
                    cp = company_profile_row
                    company_profile = {
                        "market_niche": (cp.extra or {}).get("market_niche"),
                        "products_services": _to_list(cp.products_services),
                        "customer_segments": _to_list(cp.customer_segments),
                        "geographies": _to_list(cp.geographies),
                    }

                market_row = repo.session.execute(
                    select(MarketAnalysis).where(
                        MarketAnalysis.run_id == run_id,
                        MarketAnalysis.company_id == company_id,
                    )
                ).scalar_one_or_none()
                market_analysis = {}
                if market_row:
                    market_analysis = {
                        "market_size": market_row.market_size,
                        "growth_rate": market_row.growth_rate,
                        "trends": (
                            market_row.trends.get("items")
                            if isinstance(market_row.trends, dict)
                            else market_row.trends or []
                        ),
                        "risks": (
                            market_row.risks.get("items")
                            if isinstance(market_row.risks, dict)
                            else market_row.risks or []
                        ),
                    }

                evidence = load_validated_evidence(
                    repo.session, run_id, company_id
                )

                # Workstream 3 pipeline
                discovery_svc = CompetitorDiscoveryService()
                candidates = discovery_svc.discover(
                    company_name=company_name,
                    company_profile=company_profile,
                    evidence=evidence,
                    company_website=company_website,
                )

                verifier = CompetitorVerifier()
                verified = verifier.verify(
                    candidates=candidates,
                    company_profile=company_profile,
                    evidence=evidence,
                )

                profiler = CompetitorProfiler()
                profiles = profiler.profile(verified=verified, evidence=evidence)

                model_builder = MarketModelBuilder()
                market_model = model_builder.build(
                    company_profile=company_profile,
                    market_analysis=market_analysis,
                    evidence=evidence,
                )

                positioning_engine = PositioningEngine()
                positioning = positioning_engine.analyze(
                    company_profile=company_profile,
                    competitor_profiles=profiles,
                    evidence=evidence,
                )

                synthesis_svc = MarketSynthesisService()
                synthesis = synthesis_svc.synthesize(
                    market_model=market_model,
                    positioning_analysis=positioning,
                    competitor_profiles=profiles,
                    evidence=evidence,
                )

                # Persist
                repo.persist_competitor_candidates(
                    run_id, company_id, candidates, verified
                )
                repo.persist_market_model(
                    run_id,
                    company_id,
                    market_model.model_dump(mode="json"),
                )
                repo.persist_positioning_analysis(
                    run_id,
                    company_id,
                    positioning.model_dump(mode="json"),
                )
                repo.persist_market_synthesis(
                    run_id,
                    company_id,
                    synthesis.model_dump(mode="json"),
                )

                # Build competitors payload for strategy agent (backward compat)
                competitors_payload = []
                for p in profiles:
                    competitors_payload.append(
                        {
                            "name": p.company_name,
                            "website": None,
                            "relation_score": p.profile_confidence,
                            "metadata": {
                                "verification_status": p.verification_status,
                                "profile_confidence": p.profile_confidence,
                            },
                            "profile_text": p.description,
                            "strengths": [],
                            "weaknesses": [],
                            "differentiation": p.product_focus,
                            "profile_metadata": p.metadata,
                        }
                    )
                repo.persist_competitors(
                    run_id=run_id,
                    company_id=company_id,
                    payload={"competitors": competitors_payload},
                )

                output = CompetitorMarketSynthesisOutput(
                    candidates=candidates,
                    verified_competitors=verified,
                    competitor_profiles=profiles,
                    market_model=market_model,
                    positioning_analysis=positioning,
                    market_synthesis=synthesis,
                    metadata={
                        "method": "workstream3_evidence_backed",
                        "candidate_count": len(candidates),
                        "verified_count": len([v for v in verified if v.verification_status != "rejected"]),
                        "profile_count": len(profiles),
                    },
                )
                result = output.model_dump(mode="json")
                # Backward compat: strategy agent expects "competitors"
                result["competitors"] = competitors_payload
                return result

            return self._node_wrapper(repo, "competitor_discovery", state, compute)

        def product_research(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                run_id = uuid.UUID(_state["run_id"])
                company_id = uuid.UUID(_state["company_id"])
                context = repo.build_agent_context(run_id, company_id)
                agent = self.agent_registry.get("product")
                if agent is None:
                    raise RuntimeError("product agent not registered")
                output = agent.run(context)
                claim_ids = repo.persist_claims(
                    run_id=run_id,
                    company_id=company_id,
                    claims=output.claims,
                    default_claim_type="product",
                )
                payload = output.model_dump(mode="json")
                payload["metadata"] = {
                    **payload.get("metadata", {}),
                    "claim_ids": [str(x) for x in claim_ids],
                    "source_ids": [str(x) for x in output.source_ids],
                }
                return payload

            return self._node_wrapper(repo, "product_research", state, compute)

        def transaction_research(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                run_id = uuid.UUID(_state["run_id"])
                company_id = uuid.UUID(_state["company_id"])
                context = repo.build_agent_context(run_id, company_id)
                agent = self.agent_registry.get("transaction")
                if agent is None:
                    raise RuntimeError("transaction agent not registered")
                output = agent.run(context)
                claim_ids = repo.persist_claims(
                    run_id=run_id,
                    company_id=company_id,
                    claims=output.claims,
                    default_claim_type="transaction",
                )
                payload = output.model_dump(mode="json")
                payload["metadata"] = {
                    **payload.get("metadata", {}),
                    "claim_ids": [str(x) for x in claim_ids],
                    "source_ids": [str(x) for x in output.source_ids],
                }
                return payload

            return self._node_wrapper(repo, "transaction_research", state, compute)

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
                from backend.services.deep_research.financials_loader import (
                    load_historical_financials,
                    compute_derived_metrics,
                )

                run_id = uuid.UUID(_state["run_id"])
                company_id = uuid.UUID(_state["company_id"])
                context = repo.build_agent_context(run_id, company_id)

                orgnr = _state.get("orgnr", "")
                if orgnr and not orgnr.startswith("tmp-"):
                    hist = load_historical_financials(orgnr)
                    if hist:
                        context.historical_financials = hist
                        context.derived_metrics = compute_derived_metrics(hist)

                market_data = _state.get("node_results", {}).get("market_analysis", {})
                context.market_data = market_data

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

        def assumption_registry(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                from backend.services.deep_research.assumption_registry_builder import (
                    build_and_persist_assumption_registry,
                )

                run_id = uuid.UUID(_state["run_id"])
                company_id = uuid.UUID(_state["company_id"])

                registry, persisted = build_and_persist_assumption_registry(
                    session=repo.session,
                    run_id=run_id,
                    company_id=company_id,
                )
                return {
                    "valuation_ready": registry.readiness.valuation_ready,
                    "blocked_reasons": registry.readiness.blocked_reasons,
                    "accepted_total": registry.completeness.accepted_total,
                    "required_total": registry.completeness.required_total,
                    "missing_keys": registry.completeness.missing_keys,
                    "persisted": bool(persisted),
                }

            return self._node_wrapper(repo, "assumption_registry", state, compute)

        def valuation(state: OrchestratorState):
            def compute(_state: OrchestratorState):
                from backend.services.valuation.sector_multiple_loader import (
                    load_sector_range,
                )

                run_id = uuid.UUID(_state["run_id"])
                company_id = uuid.UUID(_state["company_id"])
                assump = _state.get("node_results", {}).get("assumption_registry", {})
                valuation_ready = assump.get("valuation_ready", True)
                if not valuation_ready:
                    return {
                        "skipped": True,
                        "reason": "valuation_not_ready",
                        "blocked_reasons": assump.get("blocked_reasons", []),
                        "metadata": {"valuation_skipped_gracefully": True},
                    }

                # Phase 5: Try deterministic DCF when assumption registry is valuation-ready
                try:
                    from backend.services.valuation.dcf_engine import (
                        run_deterministic_valuation,
                    )
                    from backend.services.deep_research.assumption_registry_builder import (
                        load_assumption_registry_for_run,
                    )

                    registry = load_assumption_registry_for_run(
                        repo.session, run_id, company_id
                    )
                    if registry and registry.readiness.valuation_ready:
                        dcf_result = run_deterministic_valuation(
                            session=repo.session,
                            run_id=run_id,
                            company_id=company_id,
                            registry=registry,
                        )
                        if dcf_result:
                            fm_data = _state.get("node_results", {}).get(
                                "financial_model", {}
                            )
                            fm_id = fm_data.get("financial_model_id")
                            parsed_fm_id = uuid.UUID(fm_id) if fm_id else None
                            repo.persist_valuation(
                                run_id=run_id,
                                company_id=company_id,
                                financial_model_id=parsed_fm_id,
                                payload=dcf_result,
                            )
                            return dcf_result
                except Exception as e:
                    logger.warning(
                        "Deterministic DCF failed, falling back to agent: %s", e
                    )

                context = repo.build_agent_context(run_id, company_id)
                fm_data = _state.get("node_results", {}).get("financial_model", {})
                fm_id = fm_data.get("financial_model_id")
                parsed_fm_id = uuid.UUID(fm_id) if fm_id else None

                company = repo.session.get(Company, company_id)
                industry = company.industry if company else None
                sector_range = load_sector_range(repo.session, industry)

                agent = self.agent_registry.get("valuation_analysis")
                if agent is None:
                    raise RuntimeError("valuation_analysis agent not registered")
                output = agent.run(
                    context,
                    fm_data,
                    sector_range_low=sector_range.ev_ebitda_low,
                    sector_range_high=sector_range.ev_ebitda_high,
                )
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

                is_degraded, degraded_reasons = self._evaluate_pipeline_integrity(_state)

                from backend.services.deep_research.analysis_input_assembler import AnalysisInputAssembler
                from backend.services.deep_research.input_completeness import InputCompletenessValidator
                from backend.services.deep_research.debug_dump import build_debug_artifact

                assembler = AnalysisInputAssembler(repo.session)
                analysis_input = assembler.assemble(run_id, company_id)

                validator = InputCompletenessValidator()
                completeness_report = validator.validate(analysis_input)

                data = self.report_composer.compose_from_analysis_input(
                    analysis_input=analysis_input,
                    completeness_report=completeness_report,
                    report_degraded=is_degraded,
                    degraded_reasons=degraded_reasons,
                )

                from backend.services.deep_research.memo_reviewer import run_memo_review

                stage_evaluations = dict(_state.get("stage_evaluations", {}))
                review = run_memo_review(
                    report_sections=data.get("sections", {}),
                    completeness_report=completeness_report,
                    stage_evaluations=stage_evaluations,
                    report_degraded=is_degraded,
                    degraded_reasons=degraded_reasons,
                )
                data["memo_review"] = {
                    "approved": review.approved,
                    "issues": review.issues,
                    "recommended_changes": review.recommended_changes,
                }

                from backend.services.deep_research.report_quality_gate import (
                    evaluate_report_quality,
                )

                node_results = dict(_state.get("node_results", {}))
                val_output = node_results.get("valuation", {})
                valuation_skipped = (
                    isinstance(val_output, dict)
                    and val_output.get("skipped") is True
                    and val_output.get("reason") == "valuation_not_ready"
                )
                quality_result = evaluate_report_quality(
                    sections=data.get("sections", []),
                    report_degraded=is_degraded,
                    report_degraded_reasons=degraded_reasons,
                    valuation_skipped=valuation_skipped,
                    node_results=node_results,
                )
                meta = dict(data.get("metadata", {}))
                meta["report_quality_status"] = quality_result.status
                meta["report_quality_reason_codes"] = quality_result.reason_codes
                meta["report_quality_limitation_summary"] = quality_result.limitation_summary
                meta["report_degraded"] = is_degraded
                meta["report_degraded_reasons"] = degraded_reasons
                data["metadata"] = meta

                report = repo.persist_report(
                    run_id=run_id,
                    company_id=company_id,
                    payload=data,
                )
                data["report_version_id"] = str(report.id)
                data["version_number"] = report.version_number

                node_results = dict(_state.get("node_results", {}))
                fm_output = node_results.get("financial_model", {})
                val_output = node_results.get("valuation", {})
                assumptions_output = fm_output.get("assumption_set") if isinstance(fm_output, dict) else None
                projection_output = fm_output.get("forecast") if isinstance(fm_output, dict) else None

                web_intel_output = node_results.get("web_retrieval")
                competitor_market_output = node_results.get("competitor_discovery")
                company_understanding_output = node_results.get("company_understanding")

                debug_artifact = build_debug_artifact(
                    analysis_input=analysis_input,
                    completeness_report=completeness_report,
                    assumptions_output=assumptions_output,
                    projection_output=projection_output,
                    valuation_output=val_output if isinstance(val_output, dict) else None,
                    stage_evaluations=stage_evaluations,
                    report_degraded=is_degraded,
                    report_degraded_reasons=degraded_reasons,
                    web_intel_output=web_intel_output if isinstance(web_intel_output, dict) else None,
                    competitor_market_synthesis_output=competitor_market_output if isinstance(competitor_market_output, dict) else None,
                    company_understanding_output=company_understanding_output if isinstance(company_understanding_output, dict) else None,
                )
                repo.upsert_node_state(
                    run_id=run_id,
                    node_name="analysis_input_debug",
                    status="completed",
                    output_json=debug_artifact,
                )

                return data

            return self._node_wrapper(repo, "report_generation", state, compute)

        graph.add_node("identity", identity)
        graph.add_node("company_understanding", company_understanding)
        graph.add_node("report_spec", report_spec)
        graph.add_node("company_profile", company_profile)
        graph.add_node("web_retrieval", web_retrieval)
        graph.add_node("evidence_validation", evidence_validation)
        graph.add_node("market_analysis", market_analysis)
        graph.add_node("competitor_discovery", competitor_discovery)
        graph.add_node("product_research", product_research)
        graph.add_node("transaction_research", transaction_research)
        graph.add_node("strategy", strategy)
        graph.add_node("value_creation", value_creation)
        graph.add_node("financial_model", financial_model)
        graph.add_node("valuation", valuation)
        graph.add_node("verification", verification)
        graph.add_node("report_generation", report_generation)

        graph.add_edge(START, "identity")
        graph.add_edge("identity", "company_understanding")
        graph.add_edge("company_understanding", "report_spec")
        graph.add_edge("report_spec", "web_retrieval")
        graph.add_edge("web_retrieval", "evidence_validation")
        graph.add_edge("evidence_validation", "company_profile")
        graph.add_edge("company_profile", "market_analysis")
        graph.add_edge("market_analysis", "competitor_discovery")
        graph.add_edge("competitor_discovery", "product_research")
        graph.add_edge("product_research", "transaction_research")
        graph.add_edge("transaction_research", "strategy")
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

            # If resuming an existing run, use its already-assigned company
            existing_run = session.get(AnalysisRun, run_id) if run_id else None
            if existing_run and existing_run.company_id:
                company_id = company_id or existing_run.company_id

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
            session.commit()  # Commit so UI shows "running" immediately

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
                "stage_evaluations": {},
                "report_degraded": False,
                "report_degraded_reasons": [],
            }
            try:
                final_state = graph.invoke(init_state)
                node_rows = repo.list_node_states(run_uuid)
                report_output = final_state.get("node_results", {}).get("report_generation") or {}
                diagnostics = build_run_diagnostics(
                    node_rows=node_rows,
                    report_generation_output=report_output,
                )
                repo.finalize_run(
                    run_uuid,
                    status="completed",
                    error=None,
                    run_diagnostics=diagnostics,
                )
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
        instructions: str | None = None,
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
            session.commit()  # Commit so UI shows "running" immediately

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
                "stage_evaluations": {},
                "report_degraded": False,
                "report_degraded_reasons": [],
                "recompute_instructions": instructions,
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
                stage_data: dict[str, Any] = {
                    "stage": node_name,
                    "status": row.status,
                    "started_at": row.started_at,
                    "finished_at": row.completed_at,
                    "error_message": row.error_message,
                }
                if isinstance(row.output_json, dict) and row.output_json:
                    stage_data["output"] = row.output_json
                stages.append(stage_data)
            else:
                stages.append({
                    "stage": node_name,
                    "status": "pending",
                    "started_at": None,
                    "finished_at": None,
                    "error_message": None,
                })
        return stages

    @staticmethod
    def _current_stage_from_rows(node_rows: list) -> str:
        """Derive current_stage: the latest non-pending node, or 'identity' if none started."""
        by_name = {row.node_name: row for row in node_rows}
        current = "identity"
        for node_name in PIPELINE_NODES:
            row = by_name.get(node_name)
            if row and row.status in ("running", "completed", "failed", "skipped"):
                current = node_name
        return current

    def get_run_status(self, run_id: uuid.UUID) -> dict[str, Any] | None:
        with SessionLocal() as session:
            run = session.get(AnalysisRun, run_id)
            if run is None:
                return None
            company = session.get(Company, run.company_id) if run.company_id else None
            repo = RunStateRepository(session)
            node_rows = repo.list_node_states(run_id)
            stages = self._build_stages(node_rows)
            current_stage = self._current_stage_from_rows(node_rows)
            company_name = (company.name if company else None) or run.query
            orgnr = company.orgnr if company else None
            result: dict[str, Any] = {
                "run_id": run.id,
                "company_id": run.company_id,
                "company_name": company_name,
                "orgnr": orgnr,
                "created_at": run.created_at,
                "status": run.status,
                "current_stage": current_stage,
                "stages": stages,
                "error_message": run.error_message,
            }
            extra = run.extra or {}
            if "run_diagnostics" in extra:
                result["diagnostics"] = extra["run_diagnostics"]
                rd = extra["run_diagnostics"]
                if isinstance(rd, dict) and "report_quality_status" in rd:
                    result["report_quality_status"] = rd["report_quality_status"]
            return result

    def list_runs(self, limit: int = 20) -> list[dict[str, Any]]:
        with SessionLocal() as session:
            rows = session.execute(
                select(AnalysisRun).order_by(AnalysisRun.created_at.desc()).limit(limit)
            ).scalars().all()
            company_ids = {r.company_id for r in rows if r.company_id}
            companies_by_id: dict[uuid.UUID, tuple[str, str]] = {}
            if company_ids:
                for comp in session.execute(
                    select(Company).where(Company.id.in_(company_ids))
                ).scalars():
                    companies_by_id[comp.id] = (comp.name, comp.orgnr)

            out: list[dict[str, Any]] = []
            repo = RunStateRepository(session)
            for row in rows:
                node_rows = repo.list_node_states(row.id)
                stages = self._build_stages(node_rows)
                current_stage = self._current_stage_from_rows(node_rows)
                comp_info = companies_by_id.get(row.company_id) if row.company_id else None
                company_name = (comp_info[0] if comp_info else None) or row.query
                orgnr = comp_info[1] if comp_info else None
                out.append(
                    {
                        "run_id": row.id,
                        "company_id": row.company_id,
                        "company_name": company_name,
                        "orgnr": orgnr,
                        "created_at": row.created_at,
                        "status": row.status,
                        "current_stage": current_stage,
                        "stages": stages,
                        "error_message": row.error_message,
                    }
                )
            return out


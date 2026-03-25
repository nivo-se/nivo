"""Assembles the canonical AnalysisInput from DB entities and optional main-app financials."""

from __future__ import annotations

import logging
import uuid
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.db.models.deep_research import (
    Company,
    CompanyProfile,
    Competitor,
    CompetitorProfile,
    FinancialModel,
    MarketAnalysis,
    MarketModel as MarketModelRow,
    MarketSynthesis as MarketSynthesisRow,
    PositioningAnalysis as PositioningAnalysisRow,
    RunNodeState,
    Source,
    Strategy,
    Valuation,
    ValueCreation,
    WebEvidence,
)

from backend.agents.text_extraction import extract_products_from_text, infer_industry

from .financials_loader import load_historical_financials

from .analysis_input import (
    AnalysisInput,
    CompetitorInput,
    DerivedFinancialHistory,
    HistoricalYear,
    MarketInput,
    ModelAssumptions,
    ProjectionRow,
    SourceRef,
    StrategyInput,
    ValuationOutput,
    ValueCreationInitiative,
    VerificationSummary,
)

logger = logging.getLogger(__name__)


def _safe_list(val: Any) -> list:
    if isinstance(val, list):
        return val
    if isinstance(val, dict):
        items = val.get("items")
        return items if isinstance(items, list) else []
    return []


def _safe_dict(val: Any) -> dict:
    return val if isinstance(val, dict) else {}


def _safe_float(val: Any) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _parse_growth_rate(raw: str | None) -> float | None:
    """Best-effort parse of a growth-rate string like '5%' or '0.05' into a float (0.05)."""
    if raw is None:
        return None
    try:
        cleaned = raw.strip().replace(",", ".").rstrip("%").strip()
        v = float(cleaned)
        if v > 1:
            v /= 100.0
        return round(v, 4)
    except (ValueError, TypeError):
        return None


def _cagr(first: float, last: float, years: int) -> float | None:
    if years <= 0 or first <= 0 or last <= 0:
        return None
    try:
        return round(((last / first) ** (1.0 / years) - 1.0) * 100, 2)
    except (ZeroDivisionError, ValueError):
        return None


def _safe_pct(numerator: float | None, denominator: float | None) -> float | None:
    if numerator is None or denominator is None or denominator == 0:
        return None
    return round(numerator / denominator * 100, 2)


class AnalysisInputAssembler:
    """Builds a single canonical AnalysisInput from DB entities for a given run."""

    def __init__(self, session: Session):
        self.session = session

    def assemble(self, run_id: uuid.UUID, company_id: uuid.UUID) -> AnalysisInput:
        ai = AnalysisInput(run_id=run_id, company_id=company_id)

        self._load_company_identity(ai, company_id)
        self._load_company_profile(ai, run_id, company_id)
        self._load_market_analysis(ai, run_id, company_id)
        self._load_market_model(ai, run_id, company_id)
        self._load_competitors(ai, run_id, company_id)
        self._load_positioning(ai, run_id, company_id)
        self._load_market_synthesis(ai, run_id, company_id)
        self._load_strategy(ai, run_id, company_id)
        self._load_value_creation(ai, run_id, company_id)
        self._load_verification(ai, run_id, company_id)
        self._load_source_refs(ai, run_id, company_id)
        self._load_historical_financials(ai)
        self._compute_derived_history(ai)
        self._load_financial_model(ai, run_id, company_id)
        self._load_valuation(ai, run_id, company_id)
        self._build_model_assumptions(ai, run_id, company_id)
        self._backfill_from_node_states(ai, run_id)
        self._backfill_from_web_evidence(ai, run_id, company_id)

        return ai

    # ------------------------------------------------------------------
    # Loaders
    # ------------------------------------------------------------------

    def _load_company_identity(self, ai: AnalysisInput, company_id: uuid.UUID) -> None:
        company = self.session.get(Company, company_id)
        if company is None:
            return
        ai.canonical_name = company.name or ""
        ai.orgnr = company.orgnr
        ai.website = company.website
        ai.industry = company.industry
        ai.headquarters = company.headquarters

    def _load_company_profile(self, ai: AnalysisInput, run_id: uuid.UUID, company_id: uuid.UUID) -> None:
        row = self.session.execute(
            select(CompanyProfile).where(
                CompanyProfile.run_id == run_id, CompanyProfile.company_id == company_id
            )
        ).scalar_one_or_none()
        if row is None:
            return
        ai.summary = row.summary
        ai.business_model = row.business_model
        ai.products_services = _safe_list(row.products_services)
        ai.customer_segments_profile = _safe_list(row.customer_segments)
        ai.geographies = _safe_list(row.geographies)
        # Load first-class company understanding from extra (market_niche, etc.)
        extra = _safe_dict(row.extra)
        if extra.get("market_niche") and not ai.market.niche_label:
            ai.market.niche_label = str(extra["market_niche"])

    def _load_market_analysis(self, ai: AnalysisInput, run_id: uuid.UUID, company_id: uuid.UUID) -> None:
        row = self.session.execute(
            select(MarketAnalysis).where(
                MarketAnalysis.run_id == run_id, MarketAnalysis.company_id == company_id
            )
        ).scalar_one_or_none()
        if row is None:
            return
        base_growth = _parse_growth_rate(row.growth_rate)
        ai.market = MarketInput(
            market_label=str(row.market_size) if row.market_size else None,
            market_size=str(row.market_size) if row.market_size else None,
            market_growth_base=base_growth,
            market_growth_low=round(base_growth * 0.6, 4) if base_growth else None,
            market_growth_high=round(base_growth * 1.4, 4) if base_growth else None,
            key_trends=[str(t) for t in _safe_list(row.trends)],
            risks=[str(r) for r in _safe_list(row.risks)],
        )

    def _load_market_model(
        self, ai: AnalysisInput, run_id: uuid.UUID, company_id: uuid.UUID
    ) -> None:
        """Load Workstream 3 market model; enrich market input."""
        row = self.session.execute(
            select(MarketModelRow).where(
                MarketModelRow.run_id == run_id,
                MarketModelRow.company_id == company_id,
            )
        ).scalar_one_or_none()
        if row is None:
            return
        ai.market_model = {
            "market_label": row.market_label,
            "market_subsegment": row.market_subsegment,
            "demand_drivers": _safe_list(row.demand_drivers),
            "market_growth_signal": row.market_growth_signal,
            "concentration_signal": row.concentration_signal,
            "fragmentation_signal": row.fragmentation_signal,
            "confidence_score": float(row.confidence_score) if row.confidence_score else None,
        }
        if row.market_label and not ai.market.market_label:
            ai.market.market_label = row.market_label
        ai.market.market_subsegment = row.market_subsegment
        ai.market.concentration_signal = row.concentration_signal
        ai.market.fragmentation_signal = row.fragmentation_signal
        ai.market.market_maturity_signal = row.market_maturity_signal

    def _load_competitors(self, ai: AnalysisInput, run_id: uuid.UUID, company_id: uuid.UUID) -> None:
        comps = self.session.execute(
            select(Competitor).where(
                Competitor.run_id == run_id, Competitor.company_id == company_id
            )
        ).scalars().all()
        for comp in comps:
            profile_row = self.session.execute(
                select(CompetitorProfile).where(CompetitorProfile.competitor_id == comp.id)
            ).scalar_one_or_none()
            comp_extra = _safe_dict(comp.extra) if hasattr(comp, "extra") else {}
            profile_extra = _safe_dict(profile_row.extra) if profile_row and hasattr(profile_row, "extra") else {}
            ci = CompetitorInput(
                name=comp.competitor_name,
                website=comp.website,
                relation_score=float(comp.relation_score) if comp.relation_score is not None else None,
                revenue_msek=_safe_float(comp_extra.get("revenue_msek") or profile_extra.get("revenue_msek")),
                ebitda_margin_pct=_safe_float(comp_extra.get("ebitda_margin_pct") or profile_extra.get("ebitda_margin_pct")),
            )
            if profile_row:
                ci.strengths = _safe_list(profile_row.strengths)
                ci.weaknesses = _safe_list(profile_row.weaknesses)
                ci.differentiation = _safe_list(profile_row.differentiation)
            ai.competitors.append(ci)

    def _load_positioning(
        self, ai: AnalysisInput, run_id: uuid.UUID, company_id: uuid.UUID
    ) -> None:
        """Load Workstream 3 positioning analysis."""
        row = self.session.execute(
            select(PositioningAnalysisRow).where(
                PositioningAnalysisRow.run_id == run_id,
                PositioningAnalysisRow.company_id == company_id,
            )
        ).scalar_one_or_none()
        if row is None:
            return
        ai.positioning_analysis = {
            "differentiated_axes": _safe_list(row.differentiated_axes),
            "parity_axes": _safe_list(row.parity_axes),
            "disadvantage_axes": _safe_list(row.disadvantage_axes),
            "unclear_axes": _safe_list(row.unclear_axes),
            "positioning_summary": row.positioning_summary,
        }

    def _load_market_synthesis(
        self, ai: AnalysisInput, run_id: uuid.UUID, company_id: uuid.UUID
    ) -> None:
        """Load Workstream 3 market synthesis."""
        row = self.session.execute(
            select(MarketSynthesisRow).where(
                MarketSynthesisRow.run_id == run_id,
                MarketSynthesisRow.company_id == company_id,
            )
        ).scalar_one_or_none()
        if row is None:
            return
        ai.market_synthesis = {
            "market_attractiveness_score": float(row.market_attractiveness_score) if row.market_attractiveness_score else None,
            "competition_intensity_score": float(row.competition_intensity_score) if row.competition_intensity_score else None,
            "niche_defensibility_score": float(row.niche_defensibility_score) if row.niche_defensibility_score else None,
            "growth_support_score": float(row.growth_support_score) if row.growth_support_score else None,
            "synthesis_summary": row.synthesis_summary,
            "key_supporting_claims": _safe_list(row.key_supporting_claims),
            "key_uncertainties": _safe_list(row.key_uncertainties),
            "confidence_score": float(row.confidence_score) if row.confidence_score else None,
        }

    def _load_strategy(self, ai: AnalysisInput, run_id: uuid.UUID, company_id: uuid.UUID) -> None:
        row = self.session.execute(
            select(Strategy).where(
                Strategy.run_id == run_id, Strategy.company_id == company_id
            )
        ).scalar_one_or_none()
        if row is None:
            return
        ai.strategy = StrategyInput(
            investment_thesis=row.investment_thesis,
            acquisition_rationale=row.acquisition_rationale,
            key_risks=[str(r) for r in _safe_list(row.key_risks)],
            diligence_focus=[str(d) for d in _safe_list(row.diligence_focus)],
            integration_themes=[str(t) for t in _safe_list(row.integration_themes)],
        )

    def _load_value_creation(self, ai: AnalysisInput, run_id: uuid.UUID, company_id: uuid.UUID) -> None:
        row = self.session.execute(
            select(ValueCreation).where(
                ValueCreation.run_id == run_id, ValueCreation.company_id == company_id
            )
        ).scalar_one_or_none()
        if row is None:
            return
        for item in _safe_list(row.initiatives):
            if isinstance(item, dict):
                ai.value_creation_initiatives.append(ValueCreationInitiative(
                    description=item.get("description") or item.get("name") or str(item),
                    rationale=item.get("rationale"),
                    impact_assumption=item.get("impact_assumption") or item.get("impact"),
                    dependencies=_safe_list(item.get("dependencies")),
                    risks=_safe_list(item.get("risks")),
                ))
            elif isinstance(item, str):
                ai.value_creation_initiatives.append(ValueCreationInitiative(description=item))

    def _load_verification(self, ai: AnalysisInput, run_id: uuid.UUID, company_id: uuid.UUID) -> None:
        node = self.session.execute(
            select(RunNodeState).where(
                RunNodeState.run_id == run_id, RunNodeState.node_name == "verification"
            )
        ).scalar_one_or_none()
        if node is None:
            return
        out = _safe_dict(node.output_json)
        stats = _safe_dict(out.get("stats"))
        ai.verification = VerificationSummary(
            verified=bool(out.get("verified")),
            total_claims=int(stats.get("total", 0)),
            supported=int(stats.get("supported", 0)),
            unsupported=int(stats.get("unsupported", 0)),
            uncertain=int(stats.get("uncertain", 0)),
            per_type=_safe_dict(stats.get("per_type")),
        )

    def _load_source_refs(self, ai: AnalysisInput, run_id: uuid.UUID, company_id: uuid.UUID) -> None:
        rows = self.session.execute(
            select(Source).where(Source.run_id == run_id, Source.company_id == company_id)
        ).scalars().all()
        proprietary_count = 0
        for s in rows:
            extra = s.extra if isinstance(s.extra, dict) else {}
            provenance = extra.get("provenance", "public")
            if provenance == "proprietary":
                proprietary_count += 1
            ai.source_refs.append(SourceRef(
                source_id=str(s.id),
                title=s.title,
                url=s.url,
                source_type=s.source_type,
                provenance=provenance,
            ))
        ai.proprietary_source_count = proprietary_count

    # ------------------------------------------------------------------
    # Historical financials (from main app DB if orgnr exists)
    # ------------------------------------------------------------------

    def _load_historical_financials(self, ai: AnalysisInput) -> None:
        if not ai.orgnr:
            ai.stage_flags["financials_skipped_no_orgnr"] = True
            return
        if ai.orgnr.startswith("tmp-"):
            logger.warning(
                "Historical financials skipped: synthetic orgnr %s", ai.orgnr,
            )
            ai.stage_flags["financials_skipped_tmp_orgnr"] = True
            return

        raw_rows = load_historical_financials(ai.orgnr)
        for row in raw_rows:
            ai.historical_financials.append(HistoricalYear(
                year=row["year"],
                revenue_msek=row.get("revenue_msek"),
                ebitda_msek=row.get("ebitda_msek"),
                ebitda_margin_pct=row.get("ebitda_margin_pct"),
                net_income_msek=row.get("net_income_msek"),
            ))

    # ------------------------------------------------------------------
    # Derived financial history
    # ------------------------------------------------------------------

    def _compute_derived_history(self, ai: AnalysisInput) -> None:
        years = ai.historical_financials
        if not years:
            return

        revenues = [y.revenue_msek for y in years if y.revenue_msek and y.revenue_msek > 0]
        ebitdas = [y.ebitda_msek for y in years if y.ebitda_msek and y.ebitda_msek > 0]
        ebitda_margins = [y.ebitda_margin_pct for y in years if y.ebitda_margin_pct is not None]

        d = DerivedFinancialHistory()

        if len(revenues) >= 2:
            d.revenue_cagr_pct = _cagr(revenues[0], revenues[-1], len(revenues) - 1)
        if len(ebitdas) >= 2:
            d.ebitda_cagr_pct = _cagr(ebitdas[0], ebitdas[-1], len(ebitdas) - 1)

        d.ebitda_margin_trend = ebitda_margins
        d.latest_revenue_msek = revenues[-1] if revenues else None
        d.latest_ebitda_margin_pct = ebitda_margins[-1] if ebitda_margins else None

        capex_pcts = [
            _safe_pct(y.capex_msek, y.revenue_msek)
            for y in years
            if y.capex_msek is not None and y.revenue_msek and y.revenue_msek > 0
        ]
        if capex_pcts:
            d.avg_capex_pct_revenue = round(sum(capex_pcts) / len(capex_pcts), 2)

        nwc_pcts = [
            _safe_pct(y.nwc_msek, y.revenue_msek)
            for y in years
            if y.nwc_msek is not None and y.revenue_msek and y.revenue_msek > 0
        ]
        if nwc_pcts:
            d.avg_nwc_pct_revenue = round(sum(nwc_pcts) / len(nwc_pcts), 2)

        ai.derived_financial_history = d

    # ------------------------------------------------------------------
    # Financial model / valuation from DB
    # ------------------------------------------------------------------

    def _load_financial_model(self, ai: AnalysisInput, run_id: uuid.UUID, company_id: uuid.UUID) -> None:
        row = self.session.execute(
            select(FinancialModel).where(
                FinancialModel.run_id == run_id, FinancialModel.company_id == company_id
            )
        ).scalars().first()
        if row is None:
            return
        forecast = _safe_dict(row.forecast)
        scenarios = _safe_dict(forecast.get("scenarios"))
        for scenario_name, rows in scenarios.items():
            proj_rows = []
            for r in _safe_list(rows):
                if isinstance(r, dict):
                    proj_rows.append(ProjectionRow(
                        year=int(r.get("year", 0)),
                        revenue_msek=float(r.get("revenue_msek", 0)),
                        growth_pct=float(r.get("growth_pct", 0)),
                        ebitda_margin_pct=float(r.get("ebitda_margin_pct", 0)),
                        ebitda_msek=float(r.get("ebitda_msek", 0)),
                        fcf_msek=float(r.get("fcf_msek", 0)),
                    ))
            ai.projections[scenario_name] = proj_rows

    def _load_valuation(self, ai: AnalysisInput, run_id: uuid.UUID, company_id: uuid.UUID) -> None:
        row = self.session.execute(
            select(Valuation).where(
                Valuation.run_id == run_id, Valuation.company_id == company_id
            )
        ).scalars().first()
        if row is None:
            return
        extra = _safe_dict(row.extra) if hasattr(row, "extra") and row.extra else {}
        scenario_vals = extra.get("scenario_valuations", {})
        ai.valuation_output = ValuationOutput(
            method=row.method or "deterministic_dcf",
            enterprise_value_msek=float(row.enterprise_value) if row.enterprise_value is not None else None,
            equity_value_msek=float(row.equity_value) if row.equity_value is not None else None,
            valuation_range_low_msek=float(row.valuation_range_low) if row.valuation_range_low is not None else None,
            valuation_range_high_msek=float(row.valuation_range_high) if row.valuation_range_high is not None else None,
            net_debt_msek=_safe_float(extra.get("net_debt_msek")),
            scenario_valuations=scenario_vals if isinstance(scenario_vals, dict) else {},
            implied_ev_ebitda=_safe_float(extra.get("implied_ev_ebitda")),
            sector_sanity_range_low=float(extra.get("sector_sanity_range_low", 4.1)),
            sector_sanity_range_high=float(extra.get("sector_sanity_range_high", 8.0)),
            lint_passed=bool(extra.get("lint_passed", True)),
            lint_warnings=[str(w) for w in extra.get("lint_warnings", []) if w],
            primary_method=str(extra.get("primary_method", "dcf")),
            terminal_value_dominance_warning=bool(extra.get("terminal_value_dominance_warning", False)),
        )

    def _build_model_assumptions(self, ai: AnalysisInput, run_id: uuid.UUID, company_id: uuid.UUID) -> None:
        """Build model assumptions from assembled data — prefer real historicals over synthetic."""
        d = ai.derived_financial_history
        m = ai.market

        base_year = None
        if ai.historical_financials:
            base_year = ai.historical_financials[-1].year

        starting_rev = d.latest_revenue_msek

        growth_start = None
        if m.market_growth_base is not None:
            growth_start = m.market_growth_base
        elif d.revenue_cagr_pct is not None:
            growth_start = d.revenue_cagr_pct / 100.0

        margin_start = None
        if d.latest_ebitda_margin_pct is not None:
            margin_start = d.latest_ebitda_margin_pct / 100.0

        assumptions_source: str | None = None
        growth_terminal = None
        margin_terminal = None
        discount_wacc = None
        terminal_growth = None
        net_debt = None
        fm_row = self.session.execute(
            select(FinancialModel).where(
                FinancialModel.run_id == run_id, FinancialModel.company_id == company_id
            )
        ).scalar_one_or_none()
        if fm_row and fm_row.assumption_set:
            aset = _safe_dict(fm_row.assumption_set)
            assumptions_source = aset.get("assumptions_source") or None
            base_dict = _safe_dict(aset.get("base"))
            if base_dict:
                growth_terminal = _safe_float(base_dict.get("growth_terminal"))
                margin_terminal = _safe_float(base_dict.get("ebitda_margin_terminal"))
                discount_wacc = _safe_float(base_dict.get("discount_rate_wacc"))
                terminal_growth = _safe_float(base_dict.get("terminal_growth"))
                net_debt = _safe_float(base_dict.get("net_debt_msek"))

        ai.model_assumptions = ModelAssumptions(
            base_year=base_year,
            projection_years=3,
            starting_revenue_msek=starting_rev,
            growth_start=round(growth_start, 4) if growth_start else None,
            growth_terminal=round(growth_terminal, 4) if growth_terminal else None,
            ebitda_margin_start=round(margin_start, 4) if margin_start else None,
            ebitda_margin_terminal=round(margin_terminal, 4) if margin_terminal else None,
            capex_pct_revenue=d.avg_capex_pct_revenue / 100.0 if d.avg_capex_pct_revenue else None,
            nwc_pct_revenue=d.avg_nwc_pct_revenue / 100.0 if d.avg_nwc_pct_revenue else None,
            discount_rate_wacc=round(discount_wacc, 4) if discount_wacc else None,
            terminal_growth=round(terminal_growth, 4) if terminal_growth else None,
            net_debt_msek=net_debt,
            assumptions_source=assumptions_source,
        )

    # ------------------------------------------------------------------
    # Back-fill from node_results stored in run_node_states
    # ------------------------------------------------------------------

    def _backfill_from_node_states(self, ai: AnalysisInput, run_id: uuid.UUID) -> None:
        """Fill gaps from node output_json when entity tables lack data."""
        nodes = self.session.execute(
            select(RunNodeState).where(RunNodeState.run_id == run_id)
        ).scalars().all()
        by_name = {n.node_name: _safe_dict(n.output_json) for n in nodes}

        if not ai.canonical_name:
            identity = by_name.get("identity", {})
            ai.canonical_name = identity.get("canonical_name") or ""
            ai.website = ai.website or identity.get("website")
            ai.industry = ai.industry or identity.get("industry")
            ai.headquarters = ai.headquarters or identity.get("headquarters")

        if not ai.business_model:
            profile = by_name.get("company_profile", {})
            ai.summary = ai.summary or profile.get("summary")
            ai.business_model = profile.get("business_model")
            ai.products_services = ai.products_services or _safe_list(profile.get("products_services"))
            ai.geographies = ai.geographies or _safe_list(profile.get("geographies"))

        if not ai.products_services:
            product_research = by_name.get("product_research", {})
            ai.products_services = _safe_list(product_research.get("product_categories"))

        if not ai.transactions:
            tx_research = by_name.get("transaction_research", {})
            for t in _safe_list(tx_research.get("transactions")):
                if isinstance(t, dict):
                    ai.transactions.append(t)

        if not ai.market.key_trends:
            market = by_name.get("market_analysis", {})
            if market:
                base_growth = _parse_growth_rate(market.get("growth_rate"))
                ai.market.market_size = ai.market.market_size or market.get("market_size")
                ai.market.key_trends = [str(t) for t in _safe_list(market.get("trends"))]
                ai.market.risks = ai.market.risks or [str(r) for r in _safe_list(market.get("risks"))]
                if base_growth and ai.market.market_growth_base is None:
                    ai.market.market_growth_base = base_growth
                    ai.market.market_growth_low = round(base_growth * 0.6, 4)
                    ai.market.market_growth_high = round(base_growth * 1.4, 4)

        if not ai.competitors:
            comp_data = by_name.get("competitor_discovery", {})
            for item in _safe_list(comp_data.get("competitors")):
                if isinstance(item, dict):
                    ai.competitors.append(CompetitorInput(
                        name=item.get("name") or "",
                        website=item.get("website"),
                        revenue_msek=_safe_float(item.get("revenue_msek")),
                        ebitda_margin_pct=_safe_float(item.get("ebitda_margin_pct")),
                    ))

        if not ai.strategy.investment_thesis:
            strat = by_name.get("strategy", {})
            if strat:
                ai.strategy = StrategyInput(
                    investment_thesis=strat.get("investment_thesis"),
                    acquisition_rationale=strat.get("acquisition_rationale"),
                    key_risks=[str(r) for r in _safe_list(strat.get("key_risks"))],
                )

        if not ai.value_creation_initiatives:
            vc = by_name.get("value_creation", {})
            for item in _safe_list(vc.get("initiatives")):
                if isinstance(item, dict):
                    ai.value_creation_initiatives.append(ValueCreationInitiative(
                        description=item.get("description") or item.get("name") or str(item),
                    ))
                elif isinstance(item, str):
                    ai.value_creation_initiatives.append(ValueCreationInitiative(description=item))

    # ------------------------------------------------------------------
    # Back-fill from WebEvidence (Tavily) when identity/profile lack data
    # ------------------------------------------------------------------

    def _backfill_from_web_evidence(
        self, ai: AnalysisInput, run_id: uuid.UUID, company_id: uuid.UUID
    ) -> None:
        """Fill website, industry, products from Tavily web evidence when empty."""
        # Website: prefer tavily_company_facts Source URLs (homepage-like)
        if not ai.website:
            sources = self.session.execute(
                select(Source).where(
                    Source.run_id == run_id,
                    Source.company_id == company_id,
                    Source.source_type == "tavily_company_facts",
                ).order_by(Source.created_at.asc())
            ).scalars().all()
            if sources:
                # Prefer URL with shortest path (homepage)
                def path_len(url: str | None) -> int:
                    if not url:
                        return 9999
                    try:
                        p = urlparse(url)
                        path = (p.path or "/").rstrip("/")
                        return len(path) if path else 0
                    except Exception:
                        return 9999

                best = min(sources, key=lambda s: path_len(s.url))
                if best.url:
                    ai.website = best.url
                    logger.debug("Backfilled website from web evidence: %s", best.url[:60])

        # Industry and products: from company_facts WebEvidence
        company_facts_evidence: list[Any] = []
        we_rows = self.session.execute(
            select(WebEvidence).where(
                WebEvidence.run_id == run_id,
                WebEvidence.company_id == company_id,
            )
        ).scalars().all()
        for row in we_rows:
            extra = _safe_dict(row.extra)
            if extra.get("query_group") == "company_facts":
                company_facts_evidence.append(row)

        if company_facts_evidence:
            combined_text = " ".join(
                (r.claim or "") + " " + (r.supporting_text or "")
                for r in company_facts_evidence
            ).strip()

            if not ai.industry and combined_text:
                inferred = infer_industry(combined_text)
                if inferred:
                    ai.industry = inferred
                    logger.debug("Backfilled industry from web evidence: %s", inferred)

            if not ai.products_services and combined_text:
                products = extract_products_from_text(combined_text)
                if products:
                    ai.products_services = products
                    logger.debug("Backfilled %d products from web evidence", len(products))

        # Persist back to Company/CompanyProfile so future runs see enriched data
        if ai.website or ai.industry:
            company = self.session.get(Company, company_id)
            if company:
                if ai.website and not company.website:
                    company.website = ai.website
                if ai.industry and not company.industry:
                    company.industry = ai.industry
                self.session.flush()

        if ai.products_services:
            profile = self.session.execute(
                select(CompanyProfile).where(
                    CompanyProfile.run_id == run_id,
                    CompanyProfile.company_id == company_id,
                )
            ).scalar_one_or_none()
            if profile and not _safe_list(profile.products_services):
                profile.products_services = {"items": ai.products_services}
                self.session.flush()

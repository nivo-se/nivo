"""Assembles the canonical AnalysisInput from DB entities and optional main-app financials."""

from __future__ import annotations

import logging
import math
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.db.models.deep_research import (
    Company,
    CompanyProfile,
    Competitor,
    CompetitorProfile,
    FinancialModel,
    MarketAnalysis,
    RunNodeState,
    Source,
    Strategy,
    Valuation,
    ValueCreation,
)

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
        self._load_competitors(ai, run_id, company_id)
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
            ci = CompetitorInput(
                name=comp.competitor_name,
                website=comp.website,
                relation_score=float(comp.relation_score) if comp.relation_score is not None else None,
            )
            if profile_row:
                ci.strengths = _safe_list(profile_row.strengths)
                ci.weaknesses = _safe_list(profile_row.weaknesses)
                ci.differentiation = _safe_list(profile_row.differentiation)
            ai.competitors.append(ci)

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
        for s in rows:
            ai.source_refs.append(SourceRef(
                source_id=str(s.id),
                title=s.title,
                url=s.url,
                source_type=s.source_type,
            ))

    # ------------------------------------------------------------------
    # Historical financials (from main app DB if orgnr exists)
    # ------------------------------------------------------------------

    def _load_historical_financials(self, ai: AnalysisInput) -> None:
        if not ai.orgnr:
            return
        try:
            from backend.services.db_factory import get_database_service
            db = get_database_service()
        except Exception:
            logger.debug("Cannot load main-app financials: DB service unavailable")
            return

        try:
            sql = """
                WITH ranked AS (
                    SELECT
                        year,
                        COALESCE(si_sek, sdi_sek) as revenue_sek,
                        dr_sek as profit_sek,
                        COALESCE(ebitda_sek, ors_sek) as ebitda_sek,
                        ROW_NUMBER() OVER (
                            PARTITION BY year
                            ORDER BY COALESCE(period::text, '') DESC
                        ) AS rn
                    FROM financials
                    WHERE orgnr = ?
                      AND (currency IS NULL OR currency = 'SEK')
                      AND year >= 2018
                )
                SELECT year, revenue_sek, profit_sek, ebitda_sek
                FROM ranked
                WHERE rn = 1
                ORDER BY year ASC
                LIMIT 4
            """
            rows = db.run_raw_query(sql, params=[ai.orgnr])
        except Exception as e:
            logger.debug("Historical financials query failed: %s", e)
            return

        for row in rows:
            rev_sek = row.get("revenue_sek")
            ebitda_sek = row.get("ebitda_sek")
            rev_msek = round(float(rev_sek) / 1_000_000, 2) if rev_sek else None
            ebitda_msek = round(float(ebitda_sek) / 1_000_000, 2) if ebitda_sek else None
            margin = _safe_pct(ebitda_msek, rev_msek) if rev_msek and ebitda_msek else None
            profit_sek = row.get("profit_sek")
            net_msek = round(float(profit_sek) / 1_000_000, 2) if profit_sek else None

            ai.historical_financials.append(HistoricalYear(
                year=int(row["year"]),
                revenue_msek=rev_msek,
                ebitda_msek=ebitda_msek,
                ebitda_margin_pct=margin,
                net_income_msek=net_msek,
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
        ai.valuation_output = ValuationOutput(
            method=row.method or "deterministic_dcf",
            enterprise_value_msek=float(row.enterprise_value) if row.enterprise_value is not None else None,
            equity_value_msek=float(row.equity_value) if row.equity_value is not None else None,
            valuation_range_low_msek=float(row.valuation_range_low) if row.valuation_range_low is not None else None,
            valuation_range_high_msek=float(row.valuation_range_high) if row.valuation_range_high is not None else None,
            net_debt_msek=None,
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

        ai.model_assumptions = ModelAssumptions(
            base_year=base_year,
            projection_years=3,
            starting_revenue_msek=starting_rev,
            growth_start=round(growth_start, 4) if growth_start else None,
            ebitda_margin_start=round(margin_start, 4) if margin_start else None,
            capex_pct_revenue=d.avg_capex_pct_revenue / 100.0 if d.avg_capex_pct_revenue else None,
            nwc_pct_revenue=d.avg_nwc_pct_revenue / 100.0 if d.avg_nwc_pct_revenue else None,
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

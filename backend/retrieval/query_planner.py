"""Query planning for company retrieval searches."""

from __future__ import annotations

from dataclasses import dataclass

from backend.config import AppSettings

from .types import PlannedQuery


@dataclass(slots=True)
class QueryPlanner:
    """Builds deterministic search queries for a company."""

    settings: AppSettings

    def plan(
        self,
        *,
        company_name: str,
        orgnr: str | None = None,
        website: str | None = None,
        max_queries: int | None = None,
        company_profile_output: dict | None = None,
    ) -> list[PlannedQuery]:
        limit = max_queries or self.settings.retrieval_max_queries
        name = company_name.strip()
        planned: list[PlannedQuery] = [
            PlannedQuery(
                query=f'"{name}" official website',
                reason="Find canonical company homepage",
                priority=1,
            ),
            PlannedQuery(
                query=f'"{name}" company profile Sweden',
                reason="Gather neutral profile context",
                priority=2,
            ),
            PlannedQuery(
                query=f'"{name}" latest news Sweden',
                reason="Gather recent company developments",
                priority=3,
            ),
        ]
        if orgnr:
            planned.append(
                PlannedQuery(
                    query=f'"{name}" {orgnr}',
                    reason="Disambiguate organization-number specific results",
                    priority=0,
                )
            )
        if website:
            planned.append(
                PlannedQuery(
                    query=website.strip(),
                    reason="Direct company website provided",
                    priority=-1,
                )
            )
        if company_profile_output:
            planned.extend(
                self.plan_market_queries(
                    company_name=name, company_profile=company_profile_output
                )
            )
        planned = sorted(planned, key=lambda q: q.priority)
        return planned[:limit]

    def plan_market_queries(
        self, *, company_name: str, company_profile: dict
    ) -> list[PlannedQuery]:
        """Generate market-specific queries using company understanding."""
        queries: list[PlannedQuery] = []
        priority_base = 10

        products = company_profile.get("products_services") or []
        if isinstance(products, str):
            products = [products]
        for product in products[:3]:
            product = product.strip()
            if not product:
                continue
            queries.append(
                PlannedQuery(
                    query=f'"{product}" market size Sweden',
                    reason=f"Market sizing for product/service: {product}",
                    priority=priority_base,
                )
            )
            priority_base += 1

        business_model = company_profile.get("business_model")
        if business_model and isinstance(business_model, str):
            queries.append(
                PlannedQuery(
                    query=f'"{business_model.strip()}" trends',
                    reason=f"Business model trends: {business_model.strip()}",
                    priority=priority_base,
                )
            )
            priority_base += 1

        geographies = company_profile.get("geographies") or []
        if isinstance(geographies, str):
            geographies = [geographies]
        for geo in geographies[:2]:
            geo = geo.strip()
            if not geo:
                continue
            queries.append(
                PlannedQuery(
                    query=f'"{company_name}" market {geo}',
                    reason=f"Geographic market presence: {geo}",
                    priority=priority_base,
                )
            )
            priority_base += 1

        market_niche = company_profile.get("market_niche")
        if market_niche and isinstance(market_niche, str) and market_niche.strip():
            queries.append(
                PlannedQuery(
                    query=f'"{market_niche.strip()}" market size growth',
                    reason=f"Market sizing for niche: {market_niche.strip()}",
                    priority=priority_base,
                )
            )

        return queries

    def plan_competitor_queries(
        self,
        *,
        company_name: str,
        company_profile: dict,
        market_label: str | None = None,
    ) -> list[PlannedQuery]:
        """Generate competitor-focused queries."""
        queries: list[PlannedQuery] = []
        priority_base = 20
        name = company_name.strip()

        niche = market_label or company_profile.get("market_niche")
        if not niche:
            products = company_profile.get("products_services") or []
            if isinstance(products, str):
                products = [products]
            niche = products[0].strip() if products else None

        if niche:
            queries.append(
                PlannedQuery(
                    query=f'"{niche}" competitors Nordic',
                    reason=f"Find Nordic competitors in: {niche}",
                    priority=priority_base,
                )
            )
            priority_base += 1
            queries.append(
                PlannedQuery(
                    query=f'"{niche}" market leaders Sweden',
                    reason=f"Identify market leaders in: {niche}",
                    priority=priority_base,
                )
            )
            priority_base += 1

        queries.append(
            PlannedQuery(
                query=f'"{name}" competitors',
                reason="Direct competitor search",
                priority=priority_base,
            )
        )
        priority_base += 1

        business_model = company_profile.get("business_model")
        if business_model and isinstance(business_model, str):
            queries.append(
                PlannedQuery(
                    query=f'"{business_model.strip()}" companies Sweden',
                    reason=f"Companies with similar business model: {business_model.strip()}",
                    priority=priority_base,
                )
            )

        return queries

    def plan_news_queries(
        self, *, company_name: str, company_profile: dict | None = None
    ) -> list[PlannedQuery]:
        """Generate news/developments queries."""
        name = company_name.strip()
        return [
            PlannedQuery(
                query=f'"{name}" latest news Sweden',
                reason="Recent company developments",
                priority=30,
            ),
            PlannedQuery(
                query=f'"{name}" 2024 2025',
                reason="Recent company updates",
                priority=31,
            ),
        ]

    def _fallback_market_competitor_queries(
        self, *, company_name: str, limit: int = 4
    ) -> list[PlannedQuery]:
        """Fallback market/competitor queries when company_profile is thin or empty."""
        name = company_name.strip()
        return [
            PlannedQuery(
                query=f'"{name}" market Sweden',
                reason="Fallback: market context when profile is thin",
                priority=10,
            ),
            PlannedQuery(
                query=f'"{name}" market size growth',
                reason="Fallback: market sizing when profile is thin",
                priority=11,
            ),
            PlannedQuery(
                query=f'"{name}" competitors Nordic',
                reason="Fallback: Nordic competitors when profile is thin",
                priority=20,
            ),
            PlannedQuery(
                query=f'"{name}" competitors Sweden',
                reason="Fallback: Swedish competitors when profile is thin",
                priority=21,
            ),
        ][:limit]

    def plan_stage_queries(
        self,
        *,
        company_name: str,
        orgnr: str | None = None,
        website: str | None = None,
        company_profile: dict | None = None,
        market_label: str | None = None,
        max_queries: int | None = None,
    ) -> list[PlannedQuery]:
        """Return grouped queries for web retrieval: company_facts, market, competitors, news."""
        limit = max_queries or 6
        planned: list[PlannedQuery] = []

        base = self.plan(
            company_name=company_name,
            orgnr=orgnr,
            website=website,
            max_queries=3,
            company_profile_output=None,
        )
        for q in base[:2]:
            q.query_group = "company_facts"
            planned.append(q)

        market_qs: list[PlannedQuery] = []
        comp_qs: list[PlannedQuery] = []
        if company_profile:
            market_qs = self.plan_market_queries(
                company_name=company_name, company_profile=company_profile
            )
            for q in market_qs[:3]:
                q.query_group = "market"
                planned.append(q)

            comp_qs = self.plan_competitor_queries(
                company_name=company_name,
                company_profile=company_profile,
                market_label=market_label,
            )
            for q in comp_qs[:3]:
                q.query_group = "competitors"
                planned.append(q)

        fallback_qs = self._fallback_market_competitor_queries(
            company_name=company_name, limit=4
        )
        for q in fallback_qs:
            q.query_group = "market" if "market" in q.query else "competitors"
            if not market_qs and q.query_group == "market":
                planned.append(q)
            elif not comp_qs and q.query_group == "competitors":
                planned.append(q)

        news_qs = self.plan_news_queries(
            company_name=company_name, company_profile=company_profile
        )
        for q in news_qs[:2]:
            q.query_group = "news"
            planned.append(q)

        planned = sorted(planned, key=lambda x: (x.priority, x.query))
        return planned[:limit]

    def plan_supplemental_queries(
        self,
        *,
        company_name: str,
        company_profile: dict | None = None,
        market_label: str | None = None,
        missing_groups: list[str] | None = None,
        max_queries: int = 2,
    ) -> list[PlannedQuery]:
        """Generate gap-filling queries for supplemental retrieval rounds.

        Used when primary round evidence is weak. Targets missing evidence groups
        (market, competitors, company_facts) with more specific queries.
        """
        name = company_name.strip()
        missing = set(missing_groups or [])
        queries: list[PlannedQuery] = []
        priority_base = 50

        niche = market_label or (company_profile or {}).get("market_niche")
        products = (company_profile or {}).get("products_services") or []
        if isinstance(products, str):
            products = [products]

        if "market" in missing and niche:
            queries.append(
                PlannedQuery(
                    query=f'"{niche}" market size growth Europe',
                    reason="Supplemental: market sizing for niche",
                    priority=priority_base,
                    query_group="market",
                )
            )
            priority_base += 1
        if "market" in missing and products:
            p = products[0] if products else None
            if p and isinstance(p, str) and p.strip():
                queries.append(
                    PlannedQuery(
                        query=f'"{p.strip()}" market Nordics',
                        reason="Supplemental: product-specific market",
                        priority=priority_base,
                        query_group="market",
                    )
                )
                priority_base += 1

        if "competitors" in missing and niche:
            queries.append(
                PlannedQuery(
                    query=f'"{niche}" competitors Nordic',
                    reason="Supplemental: niche competitors",
                    priority=priority_base,
                    query_group="competitors",
                )
            )
            priority_base += 1
        if "competitors" in missing:
            queries.append(
                PlannedQuery(
                    query=f'"{name}" competitors comparison',
                    reason="Supplemental: direct competitor search",
                    priority=priority_base,
                    query_group="competitors",
                )
            )
            priority_base += 1

        if "company_facts" in missing:
            queries.append(
                PlannedQuery(
                    query=f'"{name}" company profile',
                    reason="Supplemental: company profile",
                    priority=priority_base,
                    query_group="company_facts",
                )
            )

        return sorted(queries, key=lambda x: x.priority)[:max_queries]


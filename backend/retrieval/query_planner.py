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

        niche = market_label
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


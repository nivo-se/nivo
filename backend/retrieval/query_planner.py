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
            # A direct URL should be fetched even when search providers are unavailable.
            planned.append(
                PlannedQuery(
                    query=website.strip(),
                    reason="Direct company website provided",
                    priority=-1,
                )
            )
        # Keep deterministic order, lowest priority value first.
        planned = sorted(planned, key=lambda q: q.priority)
        return planned[:limit]


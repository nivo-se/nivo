"""Workstream 3: Build structured market model from validated evidence."""

from __future__ import annotations

from dataclasses import dataclass

from .competitor_market_schemas import EvidenceRef, MarketModel
from .evidence_loader import EvidenceRecord


def _collect_matches(text: str, mapping: dict[str, list[str]], max_items: int = 4) -> list[str]:
    out: list[str] = []
    lower = text.lower()
    for label, keywords in mapping.items():
        if any(k in lower for k in keywords):
            out.append(label)
        if len(out) >= max_items:
            break
    return out


@dataclass(slots=True)
class MarketModelBuilder:
    """Build structured market model from company profile, market analysis, and evidence."""

    def build(
        self,
        *,
        company_profile: dict,
        market_analysis: dict,
        evidence: list[EvidenceRecord],
    ) -> MarketModel:
        """Build canonical market model with evidence refs."""
        # Combine text from evidence (market + company_facts)
        market_ev = [e for e in evidence if e.query_group in ("market", "company_facts")]
        text_parts: list[str] = []
        evidence_refs: list[EvidenceRef] = []
        for e in market_ev:
            text_parts.append(e.claim or "")
            if e.supporting_text:
                text_parts.append(e.supporting_text)
            evidence_refs.append(
                EvidenceRef(
                    web_evidence_id=e.id,
                    source_url=e.source_url,
                    source_id=e.source_id,
                    excerpt=e.supporting_text[:280] if e.supporting_text else None,
                )
            )
        combined = " ".join(text_parts)

        # Add market analysis content
        ma = market_analysis or {}
        trends = [str(t) for t in (ma.get("trends") or [])]
        risks = [str(r) for r in (ma.get("risks") or [])]
        if trends:
            combined += " " + " ".join(trends)
        if risks:
            combined += " " + " ".join(risks)

        market_label = (
            str(company_profile.get("market_niche") or "")
            or str(ma.get("market_size") or ma.get("market_label") or "Unspecified market")
            or "Unspecified market"
        )
        if not market_label or market_label == "None":
            market_label = "Unspecified market"

        # Demand drivers from keyword mapping
        demand_map = {
            "Digital transformation": ["digital", "automation", "cloud", "ai", "technology"],
            "Sustainability": ["sustainability", "green", "esg", "carbon"],
            "Regulatory compliance": ["regulation", "compliance", "policy"],
            "Cost optimization": ["cost", "efficiency", "optimization"],
        }
        demand_drivers = _collect_matches(combined, demand_map, max_items=5)

        # Growth signal
        growth_signal = None
        if "growing" in combined.lower() or "growth" in combined.lower() or "high growth" in combined.lower():
            growth_signal = "Market described as growing"
        if ma.get("growth_rate"):
            growth_signal = str(ma["growth_rate"])

        # Concentration / fragmentation
        concentration_signal = None
        if any(k in combined.lower() for k in ["fragmented", "fragmentation", "many players"]):
            concentration_signal = "Fragmented"
        if any(k in combined.lower() for k in ["consolidation", "consolidating", "concentrated", "oligopoly"]):
            concentration_signal = "Consolidating"

        fragmentation_signal = None
        if "fragmented" in combined.lower():
            fragmentation_signal = "High fragmentation"
        if "consolidation" in combined.lower():
            fragmentation_signal = "Consolidation underway"

        # Maturity
        maturity_signal = None
        if any(k in combined.lower() for k in ["mature", "maturity", "established"]):
            maturity_signal = "Mature"
        if any(k in combined.lower() for k in ["emerging", "nascent", "early-stage"]):
            maturity_signal = "Emerging"

        # Cyclicality
        cyclicality_signal = None
        if any(k in combined.lower() for k in ["cyclical", "cycle", "economic cycle"]):
            cyclicality_signal = "Cyclical"

        # Regulatory
        regulatory_signal = None
        if any(k in combined.lower() for k in ["regulated", "regulation", "compliance", "regulatory"]):
            regulatory_signal = "Regulated"

        # Geography from company profile
        geos = company_profile.get("geographies") or []
        geography_scope = ", ".join(str(g) for g in geos) if geos else None

        # Customer segment
        customers = company_profile.get("customer_segments") or company_profile.get("customer_segments_profile") or []
        customer_segment = ", ".join(str(c) for c in customers) if customers else None

        # Confidence
        n_ev = len(evidence_refs)
        confidence = min(0.9, 0.3 + n_ev * 0.1)

        return MarketModel(
            market_label=market_label,
            market_subsegment=None,
            geography_scope=geography_scope,
            customer_segment=customer_segment,
            buying_model=None,
            demand_drivers=demand_drivers,
            market_growth_signal=growth_signal,
            concentration_signal=concentration_signal,
            fragmentation_signal=fragmentation_signal,
            market_maturity_signal=maturity_signal,
            cyclicality_signal=cyclicality_signal,
            regulatory_signal=regulatory_signal,
            evidence_refs=evidence_refs,
            confidence_score=round(confidence, 2),
            metadata={},
        )

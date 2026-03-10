"""Transaction discovery agent per DEEP_RESEARCH_AGENT_PROMPTS_PRO Section 5."""

from __future__ import annotations

import re
from dataclasses import dataclass

from .context import AgentContext
from .schemas import AgentClaim, SourceEvidence, TransactionAgentOutput, TransactionRecord


def _extract_number(text: str) -> float | None:
    """Extract numeric value from string (handles SEK, m, bn, etc.)."""
    text = text.replace(",", ".").replace(" ", "")
    match = re.search(r"(\d+(?:\.\d+)?)\s*(?:msek|msek|m\s*sek|million|bn|billion)?", text, re.I)
    if match:
        val = float(match.group(1))
        if "bn" in text.lower() or "billion" in text.lower():
            val *= 1000
        return val
    return None


def _extract_year(text: str) -> str | None:
    """Extract 4-digit year from text."""
    match = re.search(r"\b(20[12]\d|19[89]\d)\b", text)
    return match.group(1) if match else None


@dataclass(slots=True)
class TransactionAgent:
    """Extracts precedent transactions from source evidence."""

    def run(self, context: AgentContext) -> TransactionAgentOutput:
        text = context.joined_text(max_chars=20000)
        transactions: list[TransactionRecord] = []

        acquisition_patterns = [
            r"(\w+(?:\s+\w+)*)\s+(?:acquired|bought|purchased|acquires)\s+(\w+(?:\s+\w+)*)",
            r"(\w+(?:\s+\w+)*)\s+(?:sold to|acquired by)\s+(\w+(?:\s+\w+)*)",
            r"acquisition of\s+(\w+(?:\s+\w+)*)\s+by\s+(\w+(?:\s+\w+)*)",
            r"(\w+(?:\s+\w+)*)\s+acquired\s+(\w+(?:\s+\w+)*)",
        ]

        seen_pairs: set[tuple[str, str]] = set()
        for pattern in acquisition_patterns:
            for m in re.finditer(pattern, text, re.I):
                buyer = m.group(1).strip()[:200]
                target = m.group(2).strip()[:200]
                if (buyer, target) in seen_pairs:
                    continue
                seen_pairs.add((buyer, target))

                ev = _extract_number(text[max(0, m.start() - 200) : m.end() + 300])
                year = _extract_year(text[max(0, m.start() - 100) : m.end() + 100])
                multiple = None
                mult_match = re.search(
                    r"(\d+(?:\.\d+)?)\s*[x×]\s*(?:EBITDA|ebitda)",
                    text[max(0, m.start() - 150) : m.end() + 200],
                    re.I,
                )
                if mult_match:
                    multiple = float(mult_match.group(1))

                primary_source = context.primary_source()
                source_url = primary_source.url if primary_source else None

                transactions.append(
                    TransactionRecord(
                        target=target,
                        buyer=buyer,
                        year=str(year) if year else None,
                        enterprise_value=ev,
                        ebitda=None,
                        ev_ebitda_multiple=multiple,
                        source_url=source_url,
                    )
                )
                if len(transactions) >= 5:
                    break
            if len(transactions) >= 5:
                break

        primary_source = context.primary_source()
        primary_chunk = context.primary_chunk()
        evidence = SourceEvidence(
            source_id=primary_source.source_id if primary_source else None,
            source_chunk_id=primary_chunk.chunk_id if primary_chunk else None,
            source_url=primary_source.url if primary_source else None,
            source_title=primary_source.title if primary_source else None,
            excerpt=primary_chunk.text[:280] if primary_chunk else None,
        )

        claims: list[AgentClaim] = []
        if transactions:
            claims.append(
                AgentClaim(
                    claim_text=f"Found {len(transactions)} precedent transaction(s) in industry",
                    claim_type="transaction_discovery",
                    confidence=0.6 if len(transactions) >= 2 else 0.45,
                    evidence=evidence,
                )
            )

        return TransactionAgentOutput(
            transactions=transactions,
            source_ids=[s.source_id for s in context.sources],
            claims=claims,
            metadata={
                "source_count": len(context.sources),
                "transaction_count": len(transactions),
            },
        )

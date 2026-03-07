"""Report composition scaffold (no report logic yet)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict


@dataclass(slots=True)
class ReportComposer:
    """Composes placeholder report payloads."""

    version: str = "v0"

    def empty_report(self) -> Dict[str, str]:
        return {"version": self.version, "status": "not_implemented"}


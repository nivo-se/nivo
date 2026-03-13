"""Deep Research V2 schemas: report_spec, evidence, assumption.

Per docs/deep_research/tightning/02, 04.
"""

from .report_spec import (
    ReportSpec,
    ReportSpecCompany,
    AnalystContext,
    ResearchScope,
    RequiredMetric,
    PolicyVersions,
    AcceptanceRules,
    OutputPreferences,
)
from .evidence import (
    EvidenceItem,
    EvidenceSource,
    EvidenceScores,
    EvidenceValidation,
    EvidenceExtraction,
    EvidenceScope,
    EvidenceCoverageSummary,
    ValidatedEvidenceBundle,
)
from .assumption import (
    AssumptionItem,
    AssumptionRegistry,
    AssumptionScope,
    PointEstimates,
    PolicyRefs,
    AssumptionRegistryCompleteness,
    AssumptionRegistryReadiness,
)

__all__ = [
    "ReportSpec",
    "ReportSpecCompany",
    "AnalystContext",
    "ResearchScope",
    "RequiredMetric",
    "PolicyVersions",
    "AcceptanceRules",
    "OutputPreferences",
    "EvidenceItem",
    "EvidenceSource",
    "EvidenceScores",
    "EvidenceValidation",
    "EvidenceExtraction",
    "EvidenceScope",
    "EvidenceCoverageSummary",
    "ValidatedEvidenceBundle",
    "AssumptionItem",
    "AssumptionRegistry",
    "AssumptionScope",
    "PointEstimates",
    "PolicyRefs",
    "AssumptionRegistryCompleteness",
    "AssumptionRegistryReadiness",
]

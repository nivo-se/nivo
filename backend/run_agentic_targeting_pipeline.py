"""Entry point for the agentic targeting pipeline."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from agentic_pipeline.config import PipelineConfig
from agentic_pipeline.orchestrator import AgenticTargetingPipeline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the agentic targeting pipeline")
    parser.add_argument("--db-path", type=Path, default=Path("allabolag.db"), help="Path to the SQLite database")
    parser.add_argument("--top", type=int, default=30, help="Number of companies to shortlist")
    parser.add_argument("--no-db", action="store_true", help="Skip writing results back to the database")
    parser.add_argument("--no-csv", action="store_true", help="Skip writing CSV outputs")
    parser.add_argument("--no-excel", action="store_true", help="Skip writing Excel outputs")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = PipelineConfig(
        db_path=args.db_path,
        n_top_companies=args.top,
        write_to_db=not args.no_db,
        write_to_csv=not args.no_csv,
        write_to_excel=not args.no_excel,
    )
    pipeline = AgenticTargetingPipeline(config)
    artifacts = pipeline.run()

    issues = [issue.message for issue in artifacts.quality_issues]
    print(json.dumps({"quality_issues": issues, "shortlist_size": len(artifacts.shortlist)}, indent=2))


if __name__ == "__main__":
    main()

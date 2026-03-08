#!/usr/bin/env python3
"""Delete all deep research runs and reports from the database.

Uses schema deep_research. Deleting from analysis_runs cascades to:
report_versions, report_sections, sources, source_chunks, claims,
company_profiles, market_analysis, competitors, competitor_profiles,
strategy, value_creation, financial_models, valuations, run_node_states,
claim_verifications.

Companies (deep_research.companies) are left intact.
Requires DATABASE_URL or POSTGRES_* (or SUPABASE_DB_URL) to be set.
"""

from __future__ import annotations

import os
import sys

# Allow running from repo root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text

from backend.db.session import get_engine


def main() -> None:
    engine = get_engine()
    with engine.connect() as conn:
        # Count before
        runs = conn.execute(
            text("SELECT COUNT(*) FROM deep_research.analysis_runs")
        ).scalar_one()
        reports = conn.execute(
            text("SELECT COUNT(*) FROM deep_research.report_versions")
        ).scalar_one()
        print(f"Current: {runs} analysis runs, {reports} report versions.")

        if runs == 0 and reports == 0:
            print("Nothing to delete.")
            return

        conn.execute(text("DELETE FROM deep_research.analysis_runs"))
        conn.commit()
        print("Deleted all deep research runs (and cascaded reports/sources/claims/etc.).")

        # Verify
        runs_after = conn.execute(
            text("SELECT COUNT(*) FROM deep_research.analysis_runs")
        ).scalar_one()
        reports_after = conn.execute(
            text("SELECT COUNT(*) FROM deep_research.report_versions")
        ).scalar_one()
        print(f"After: {runs_after} runs, {reports_after} report versions.")


if __name__ == "__main__":
    main()

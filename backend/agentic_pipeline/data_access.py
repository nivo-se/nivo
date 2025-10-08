"""Data loading utilities for the agentic targeting pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional

import pandas as pd
from sqlalchemy import create_engine, inspect


REQUIRED_TABLES: Iterable[str] = (
    "company_kpis",
    "company_accounts",
    "companies_enriched",
)


@dataclass(slots=True)
class DataLoadResult:
    """Container for merged dataset and diagnostics."""

    dataset: pd.DataFrame
    issues: list[str]


class TargetingDataLoader:
    """Loads and merges company datasets from SQLite or Supabase mirrors."""

    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.engine = create_engine(f"sqlite:///{db_path}")

    def validate_tables(self) -> list[str]:
        inspector = inspect(self.engine)
        available = set(inspector.get_table_names())
        missing = [table for table in REQUIRED_TABLES if table not in available]
        return missing

    def load_latest_by_year(self, table: str, key_columns: Iterable[str]) -> pd.DataFrame:
        df = pd.read_sql_table(table, self.engine)
        if df.empty:
            return df
        idx = df.groupby(list(key_columns))["year"].idxmax()
        return df.loc[idx].reset_index(drop=True)

    def load(self) -> DataLoadResult:
        issues: list[str] = []
        missing = self.validate_tables()
        if missing:
            issues.append(f"Missing required tables: {', '.join(missing)}")
            return DataLoadResult(pd.DataFrame(), issues)

        kpis = self.load_latest_by_year("company_kpis", ["OrgNr"])
        accounts = self.load_latest_by_year("company_accounts", ["OrgNr"])
        enriched = pd.read_sql_table("companies_enriched", self.engine)

        if kpis.empty or accounts.empty or enriched.empty:
            issues.append("One or more source tables are empty.")
            return DataLoadResult(pd.DataFrame(), issues)

        merged = kpis.merge(accounts, on=["OrgNr", "year"], suffixes=("_kpi", "_acc"))
        merged = merged.merge(enriched, on="OrgNr", how="left", suffixes=(None, None))
        merged = merged.drop_duplicates(subset=["OrgNr"]).reset_index(drop=True)

        return DataLoadResult(merged, issues)


__all__ = ["TargetingDataLoader", "DataLoadResult"]

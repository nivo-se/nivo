"""Data loading utilities for the agentic targeting pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional

import pandas as pd
from sqlalchemy import create_engine, inspect


REQUIRED_TABLES: Iterable[str] = (
    "company_kpis",
    "financials",
    "companies",
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

        # KPIs are already aggregated per company
        kpis = pd.read_sql_table("company_kpis", self.engine)
        
        # Financials have history, get latest
        accounts = self.load_latest_by_year("financials", ["orgnr"])
        
        enriched = pd.read_sql_table("companies", self.engine)

        if kpis.empty or accounts.empty or enriched.empty:
            issues.append("One or more source tables are empty.")
            return DataLoadResult(pd.DataFrame(), issues)

        # Ensure consistent column naming
        for df in [kpis, accounts, enriched]:
            df.columns = [c.lower() for c in df.columns]

        # Merge KPIs and Accounts
        # KPIs don't have 'year' column, but 'latest_year'.
        # We merge on orgnr.
        merged = kpis.merge(accounts, on="orgnr", suffixes=("_kpi", "_acc"))
        
        # Merge Enriched
        merged = merged.merge(enriched, on="orgnr", how="left", suffixes=("", "_enriched"))
        merged = merged.drop_duplicates(subset=["orgnr"]).reset_index(drop=True)

        return DataLoadResult(merged, issues)


__all__ = ["TargetingDataLoader", "DataLoadResult"]

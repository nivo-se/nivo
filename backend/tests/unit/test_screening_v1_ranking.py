"""
Unit tests for scripts/screening_rank_v1.py (no DB).

Run from repo root: python3 -m unittest backend.tests.unit.test_screening_v1_ranking
(requires numpy, pandas, pyyaml, psycopg2-binary — use backend venv: backend/venv/bin/python)

Integration/calibration against Postgres: set SCREENING_V1_CALIBRATION=1 and valid DATABASE_URL,
then run: python3 -m unittest backend.tests.unit.test_screening_v1_ranking.ScreeningV1IntegrationSmokeTest
"""

from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT_PATH = REPO_ROOT / "scripts" / "screening_rank_v1.py"


def _load_screening_script():
    name = "screening_rank_v1"
    spec = importlib.util.spec_from_file_location(name, SCRIPT_PATH)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


srv1 = _load_screening_script()


def _synthetic_universe(n: int = 120, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    year = 2023
    rows = []
    for i in range(n):
        org = f"{1000000000 + i:d}"
        base = i < 15
        rev = float(rng.uniform(80e6, 120e6) if base else rng.uniform(50e6, 200e6))
        rows.append(
            {
                "orgnr": org,
                "company_name": f"Co {org}",
                "employees_latest": int(rng.integers(40, 200) if base else rng.integers(10, 800)),
                "has_homepage": True,
                "primary_nace": "25.110",
                "latest_year": year,
                "latest_revenue_sek": rev,
                "revenue_cagr_3y": float(rng.uniform(0.02, 0.12) if base else rng.uniform(-0.05, 0.2)),
                "revenue_growth_yoy": float(rng.normal(0.05, 0.08)),
                "avg_ebitda_margin": float(rng.uniform(0.08, 0.14) if base else rng.uniform(0.02, 0.2)),
                "avg_ebit_margin": float(rng.uniform(0.04, 0.10) if base else rng.uniform(0.0, 0.15)),
                "avg_net_margin": float(rng.uniform(0.02, 0.08)),
                "equity_ratio_latest": float(rng.uniform(0.25, 0.45)),
                "debt_to_equity_latest": float(rng.uniform(0.3, 1.2)),
                "revenue_per_employee": float(rev / max(1, int(rng.integers(40, 200)))),
                "ebitda_per_employee": float(rng.uniform(50_000, 200_000)),
                "company_size_bucket": "medium",
                "growth_bucket": "growing",
                "profitability_bucket": "profitable",
                "fit_score": int(rng.integers(20, 60) if base else rng.integers(0, 40)),
                "ops_upside_score": int(rng.integers(30, 70) if base else rng.integers(0, 50)),
                "nivo_total_score": int(rng.integers(40, 90) if base else rng.integers(0, 60)),
                "segment_tier": "A" if base else "B",
            }
        )
    return pd.DataFrame(rows)


class ScreeningV1RankingTest(unittest.TestCase):
    def test_hard_exclusion_nace_and_revenue(self):
        cfg = {
            "constraints": {"min_revenue_sek": 50_000_000},
            "nace_deny_prefixes": ["64"],
        }
        row = pd.Series(
            {
                "orgnr": "123",
                "latest_revenue_sek": 60_000_000,
                "primary_nace": "64.111",
                "latest_year": 2023,
            }
        )
        self.assertIn("NACE_DENIED", srv1.hard_exclusion_flags(row, cfg))
        row2 = pd.Series(
            {
                "orgnr": "123",
                "latest_revenue_sek": 40_000_000,
                "primary_nace": "25.110",
                "latest_year": 2023,
            }
        )
        self.assertIn("REVENUE_BELOW_MIN", srv1.hard_exclusion_flags(row2, cfg))

    def test_winsorize_reduces_extremes(self):
        s = pd.Series([1.0, 2.0, 3.0, 4.0, 100.0])
        w = srv1.winsorize_series(s, 0.2, 0.8)
        self.assertLess(float(w.iloc[-1]), 100.0)

    def test_multi_centroid_prefers_best_match(self):
        df = _synthetic_universe(80, seed=1)
        liked_a = [df.loc[0, "orgnr"], df.loc[1, "orgnr"]]
        liked_b = [df.loc[50, "orgnr"], df.loc[51, "orgnr"]]
        cfg = {
            "constraints": {"min_revenue_sek": 50_000_000, "max_latest_year_age": 10},
            "nace_deny_prefixes": [],
            "feature_rules": {"min_population_coverage": 0.4, "min_non_null_per_company": 4},
            "winsor": {"p_low": 0.05, "p_high": 0.95},
            "liked_orgnrs": liked_a,
            "archetypes": [
                {"id": "b", "liked_orgnrs": liked_b},
            ],
        }
        ranked, _ = srv1.run_pipeline(df, cfg, use_legacy=False, alpha=0.5)
        self.assertFalse(ranked.empty)
        self.assertIn("matched_model", ranked.columns)
        self.assertTrue(set(ranked["matched_model"].unique()) <= {"global", "archetype:b"})
        top_orgnrs = set(ranked.head(10)["orgnr"].astype(str))
        self.assertTrue(liked_a[0] in top_orgnrs or liked_a[1] in top_orgnrs)

    def test_mode_a_vs_b_legacy_changes_scores(self):
        df = _synthetic_universe(60, seed=2)
        liked = [df.loc[0, "orgnr"], df.loc[2, "orgnr"]]
        cfg = {
            "constraints": {"min_revenue_sek": 50_000_000, "max_latest_year_age": 10},
            "nace_deny_prefixes": [],
            "feature_rules": {"min_population_coverage": 0.4, "min_non_null_per_company": 4},
            "winsor": {"p_low": 0.05, "p_high": 0.95},
            "liked_orgnrs": liked,
            "archetypes": [],
        }
        ra, _ = srv1.run_pipeline(df, cfg, use_legacy=False, alpha=0.45)
        rb, _ = srv1.run_pipeline(df, cfg, use_legacy=True, alpha=0.45)
        self.assertFalse(ra.empty)
        self.assertFalse(rb.empty)
        merged = ra.merge(rb, on="orgnr", suffixes=("_a", "_b"))
        self.assertFalse((merged["total_score_a"] == merged["total_score_b"]).all())

    def test_csv_columns_present(self):
        df = _synthetic_universe(40, seed=3)
        liked = [df.loc[0, "orgnr"]]
        cfg = {
            "constraints": {"min_revenue_sek": 50_000_000, "max_latest_year_age": 10},
            "nace_deny_prefixes": [],
            "feature_rules": {"min_population_coverage": 0.35, "min_non_null_per_company": 3},
            "winsor": {"p_low": 0.05, "p_high": 0.95},
            "liked_orgnrs": liked,
            "archetypes": [],
        }
        ranked, _ = srv1.run_pipeline(df, cfg, use_legacy=False, alpha=0.45)
        required = {
            "rank",
            "matched_model",
            "distance_value",
            "feature_count_used",
            "exclusion_flags",
            "total_score",
            "base_similarity_score",
            "service_indicator",
            "applied_penalty",
            "penalty_flags",
        }
        self.assertTrue(required.issubset(set(ranked.columns)))

    def test_name_exclusion_keyword(self):
        cfg = {
            "constraints": {"min_revenue_sek": 50_000_000},
            "name_exclusion_keywords": ["vvs"],
        }
        row = pd.Series(
            {
                "orgnr": "123",
                "company_name": "Stockholms VVS Aktiebolag",
                "latest_revenue_sek": 80_000_000,
                "primary_nace": "25.110",
                "latest_year": 2023,
            }
        )
        flags = srv1.hard_exclusion_flags(row, cfg)
        self.assertTrue(any(f.startswith("NAME_EXCLUDED:") for f in flags))

    def test_el_token_does_not_match_electric(self):
        name_lc = "ifö electric ab"
        tokens = srv1._name_tokens(name_lc)
        self.assertFalse(srv1.keyword_matches_name(name_lc, "el", tokens))
        self.assertGreaterEqual(
            srv1.compute_service_indicator(
                pd.Series(
                    {
                        "company_name": "Ifö Electric AB",
                        "latest_revenue_sek": 100e6,
                        "employees_latest": 100,
                        "avg_ebitda_margin": 0.1,
                        "revenue_per_employee": 1e6,
                    }
                )
            ),
            0.0,
        )

    def test_anlaggning_exclusion(self):
        cfg = {"constraints": {"min_revenue_sek": 50_000_000}, "name_exclusion_keywords": ["anläggning"]}
        row = pd.Series(
            {
                "orgnr": "123",
                "company_name": "Mälardalens Spår och Anläggning AB",
                "latest_revenue_sek": 80e6,
                "primary_nace": "42.110",
                "latest_year": 2023,
            }
        )
        self.assertTrue(any("NAME_EXCLUDED" in f for f in srv1.hard_exclusion_flags(row, cfg)))

    def test_name_penalty_and_final_score(self):
        df = _synthetic_universe(50, seed=4)
        liked = [df.loc[0, "orgnr"]]
        cfg = {
            "constraints": {"min_revenue_sek": 50_000_000, "max_latest_year_age": 10},
            "feature_rules": {"min_population_coverage": 0.35, "min_non_null_per_company": 3},
            "winsor": {"p_low": 0.05, "p_high": 0.95},
            "liked_orgnrs": liked,
            "archetypes": [],
            "name_penalty_keywords": {
                "group_like": {"penalty": 0.35, "keywords": ["group"]},
            },
        }
        df.loc[10, "company_name"] = "Test Group Sverige AB"
        ranked, _ = srv1.run_pipeline(df, cfg, use_legacy=False, alpha=0.45)
        row = ranked[ranked["orgnr"].astype(str) == df.loc[10, "orgnr"]]
        self.assertFalse(row.empty)
        r0 = row.iloc[0]
        self.assertIn("name_penalty:group_like", str(r0["penalty_flags"]))
        self.assertLessEqual(float(r0["applied_penalty"]), srv1.DEFAULT_MAX_COMBINED_PENALTY)
        self.assertLessEqual(float(r0["total_score"]), float(r0["base_similarity_score"]))


@unittest.skipUnless(os.getenv("SCREENING_V1_CALIBRATION") == "1", "SCREENING_V1_CALIBRATION=1")
class ScreeningV1IntegrationSmokeTest(unittest.TestCase):
    def test_calibration_script_runs(self):
        yml = REPO_ROOT / "scripts" / "fixtures" / "screening_v1_calibration.yaml"
        r = subprocess.run(
            [sys.executable, str(SCRIPT_PATH), "--calibrate", "--config", str(yml)],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
        )
        self.assertIn(r.returncode, (0, 1))


if __name__ == "__main__":
    unittest.main()

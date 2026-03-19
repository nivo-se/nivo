#!/usr/bin/env python3
"""
Convenience entry point for profile-learning offline toolkit.

Run from repo root:
  python scripts/profile_learning_cli.py validate-batch path/to/batches/batch_id
  python scripts/profile_learning_cli.py validate-approved path/to/approved_comparison.json
  python scripts/profile_learning_cli.py generate-config path/to/approved_comparison.json [--output-dir path/to/output]
"""

import sys
from pathlib import Path

# Ensure repo root is on path for `python -m profile_learning.cli`
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from profile_learning.cli import main

if __name__ == "__main__":
    sys.exit(main())

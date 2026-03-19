#!/usr/bin/env python3
"""
CLI for profile-learning offline toolkit.

Usage:
  python -m profile_learning.cli validate-batch <batch_root>
  python -m profile_learning.cli validate-approved <approved_comparison.json>
  python -m profile_learning.cli generate-config <approved_comparison.json> [--output-dir DIR]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _cmd_validate_batch(batch_root: Path) -> int:
    from .validate import validate_batch

    errors = validate_batch(batch_root)
    if not errors:
        print("OK: batch valid")
        return 0
    for e in errors:
        print(f"ERROR: {e}")
    return 1


def _cmd_validate_approved(path: Path) -> int:
    from .validate import validate_approved_comparison

    if not path.exists():
        print(f"ERROR: file not found: {path}")
        return 1
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"ERROR: invalid JSON: {e}")
        return 1
    errors = validate_approved_comparison(data)
    if not errors:
        print("OK: approved comparison valid")
        return 0
    for e in errors:
        print(f"ERROR: {e}")
    return 1


def _cmd_generate_config(approved_path: Path, output_dir: Path | None) -> int:
    from .map_to_config import generate_config

    if not approved_path.exists():
        print(f"ERROR: file not found: {approved_path}")
        return 1
    try:
        with open(approved_path, encoding="utf-8") as f:
            approved = json.load(f)
    except json.JSONDecodeError as e:
        print(f"ERROR: invalid JSON: {e}")
        return 1
    config, rejection_log = generate_config(approved)
    out_dir = output_dir or approved_path.parent
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    config_path = out_dir / "config_json.json"
    log_path = out_dir / "mapping_rejection_log.json"
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    with open(log_path, "w", encoding="utf-8") as f:
        json.dump(rejection_log, f, indent=2, ensure_ascii=False)
    print(f"Wrote: {config_path}")
    print(f"Wrote: {log_path}")
    if rejection_log:
        print(f"Rejections: {len(rejection_log)}")
        for r in rejection_log:
            print(f"  - [{r.get('type')}] {r.get('identifier')}: {r.get('reason')}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Profile-learning offline toolkit: validate batches and generate Layer 1 config JSON."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    p_batch = subparsers.add_parser("validate-batch", help="Validate a batch folder (manifest, reports, extractions)")
    p_batch.add_argument("batch_root", type=Path, help="Path to batch root (contains manifest.json)")

    p_approved = subparsers.add_parser("validate-approved", help="Validate an approved comparison JSON file")
    p_approved.add_argument("approved_file", type=Path, help="Path to approved_comparison.json")

    p_gen = subparsers.add_parser("generate-config", help="Generate config_json and rejection log from approved comparison")
    p_gen.add_argument("approved_file", type=Path, help="Path to approved_comparison.json")
    p_gen.add_argument("--output-dir", "-o", type=Path, default=None, help="Output directory (default: same as approved file)")

    args = parser.parse_args()

    if args.command == "validate-batch":
        return _cmd_validate_batch(args.batch_root)
    if args.command == "validate-approved":
        return _cmd_validate_approved(args.approved_file)
    if args.command == "generate-config":
        return _cmd_generate_config(args.approved_file, args.output_dir)
    return 1


if __name__ == "__main__":
    sys.exit(main())

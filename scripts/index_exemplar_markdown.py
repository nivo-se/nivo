#!/usr/bin/env python3
"""
Optional exemplar RAG prep: chunk markdown files under docs/deep_research/screening_exemplars/
and write JSONL lines (path, chunk_index, text) for downstream indexing.

Does not require Postgres or vector DB. Example:
  python3 scripts/index_exemplar_markdown.py --out /tmp/exemplar_chunks.jsonl
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]
_DEFAULT_DIR = _REPO_ROOT / "docs" / "deep_research" / "screening_exemplars"


def chunk_text(text: str, max_chars: int = 1200) -> list[str]:
    """Split on blank lines; merge small paragraphs up to max_chars."""
    paras = [p.strip() for p in re.split(r"\n\s*\n+", text) if p.strip()]
    chunks: list[str] = []
    buf = ""
    for p in paras:
        if len(buf) + len(p) + 2 <= max_chars:
            buf = f"{buf}\n\n{p}".strip() if buf else p
        else:
            if buf:
                chunks.append(buf)
            buf = p if len(p) <= max_chars else p[:max_chars]
    if buf:
        chunks.append(buf)
    return chunks


def main() -> None:
    ap = argparse.ArgumentParser(description="Chunk exemplar .md files to JSONL.")
    ap.add_argument(
        "--dir",
        type=Path,
        default=_DEFAULT_DIR,
        help="Directory containing exemplar markdown",
    )
    ap.add_argument("--out", type=Path, required=True, help="Output JSONL path")
    ap.add_argument("--max-chars", type=int, default=1200, help="Soft max chunk size")
    args = ap.parse_args()

    paths = sorted(args.dir.glob("*.md"))
    n = 0
    with open(args.out, "w", encoding="utf-8") as fout:
        for path in paths:
            text = path.read_text(encoding="utf-8", errors="replace")
            for i, chunk in enumerate(chunk_text(text, max_chars=args.max_chars)):
                line = {
                    "source_path": str(path.relative_to(_REPO_ROOT)),
                    "chunk_index": i,
                    "text": chunk,
                }
                fout.write(json.dumps(line, ensure_ascii=False) + "\n")
                n += 1
    print(f"Wrote {n} chunks from {len(paths)} files to {args.out}")


if __name__ == "__main__":
    main()

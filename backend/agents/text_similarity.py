"""Lightweight semantic similarity helpers for agent heuristics."""

from __future__ import annotations

import math
import re
from collections import Counter

TOKEN_RE = re.compile(r"[a-zA-Z0-9]{2,}")
STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "their",
    "about",
    "into",
    "over",
    "across",
    "company",
    "group",
}


def tokenize(text: str) -> list[str]:
    tokens = [t.lower() for t in TOKEN_RE.findall(text or "")]
    return [t for t in tokens if t not in STOPWORDS]


def cosine_similarity(a: str, b: str) -> float:
    ta = tokenize(a)
    tb = tokenize(b)
    if not ta or not tb:
        return 0.0
    ca = Counter(ta)
    cb = Counter(tb)
    intersection = set(ca).intersection(cb)
    dot = sum(ca[t] * cb[t] for t in intersection)
    na = math.sqrt(sum(v * v for v in ca.values()))
    nb = math.sqrt(sum(v * v for v in cb.values()))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


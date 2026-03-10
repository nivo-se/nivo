"""Shared text extraction helpers for identity and report assembly."""

from __future__ import annotations

import re


def infer_industry(text: str) -> str | None:
    """Infer industry from text using keyword mapping."""
    if not text or not text.strip():
        return None
    lowered = text.lower()
    mapping = {
        "software": ["software", "saas", "platform", "cloud"],
        "manufacturing": ["manufacturing", "factory", "industrial", "production"],
        "healthcare": ["health", "hospital", "medical", "clinic", "pharma"],
        "retail": ["retail", "store", "e-commerce", "shop"],
        "financial services": ["bank", "fintech", "insurance", "financial"],
    }
    for industry, keywords in mapping.items():
        if any(k in lowered for k in keywords):
            return industry
    return None


def extract_products_from_text(text: str, max_items: int = 5) -> list[str]:
    """Extract product/service mentions from text using heuristic patterns."""
    if not text or not text.strip():
        return []
    bits = re.split(r"(?<=[.!?])\s+", text)
    sentences = [b.strip() for b in bits if len(b.strip()) > 20]
    product_keywords = [
        "software", "platform", "service", "services", "product", "products",
        "solution", "solutions", "consulting", "offers", "provides", "develops",
        "specializes", "produces",
    ]
    products: list[str] = []
    for s in sentences[:15]:
        lower = s.lower()
        if any(k in lower for k in product_keywords):
            products.append(s[:180])
        if len(products) >= max_items:
            break
    return products

#!/usr/bin/env python3
"""Static audit for frontend/backend wiring completeness.

Outputs JSON with:
- frontend routes
- frontend endpoint callsites
- backend FastAPI routes
- placeholder markers
- unmatched frontend endpoints
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

FRONTEND_DIR = ROOT / "frontend" / "src"
BACKEND_DIR = ROOT / "backend" / "api"

PLACEHOLDER_RE = re.compile(r"coming soon|placeholder|TODO|mock|not implemented|WIP", re.IGNORECASE)
FETCH_RE = re.compile(r"['\"](/api/[^'\"]+|http://localhost:\d+/api/[^'\"]+)['\"]")
ROUTE_RE = re.compile(r"<Route\s+path=\"([^\"]+)\"")
BACKEND_DECORATOR_RE = re.compile(r"@router\.(get|post|put|delete|patch)\(\"([^\"]+)\"")
PREFIX_RE = re.compile(r"APIRouter\(prefix=\"([^\"]+)\"\)")


def iter_files(base: Path, exts: tuple[str, ...]):
    for p in base.rglob("*"):
        if p.suffix in exts and p.is_file():
            yield p


def collect_frontend_routes():
    app = FRONTEND_DIR / "App.tsx"
    routes = []
    if not app.exists():
        return routes
    for i, line in enumerate(app.read_text(encoding="utf-8").splitlines(), 1):
        m = ROUTE_RE.search(line)
        if m:
            routes.append({"path": m.group(1), "file": str(app.relative_to(ROOT)), "line": i})
    return routes


def collect_frontend_calls_and_markers():
    calls = []
    markers = []
    for p in iter_files(FRONTEND_DIR, (".ts", ".tsx")):
        rel = str(p.relative_to(ROOT))
        for i, line in enumerate(p.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            for m in FETCH_RE.finditer(line):
                calls.append({"endpoint": m.group(1), "file": rel, "line": i, "line_text": line.strip()})
            if PLACEHOLDER_RE.search(line):
                markers.append({"file": rel, "line": i, "line_text": line.strip()})
    return calls, markers


def collect_backend_routes():
    routes = []
    for p in iter_files(BACKEND_DIR, (".py",)):
        rel = str(p.relative_to(ROOT))
        lines = p.read_text(encoding="utf-8", errors="ignore").splitlines()
        prefix = ""
        for line in lines:
            pm = PREFIX_RE.search(line)
            if pm:
                prefix = pm.group(1)
                break
        for i, line in enumerate(lines, 1):
            m = BACKEND_DECORATOR_RE.search(line)
            if m:
                method, path = m.groups()
                routes.append(
                    {
                        "method": method.upper(),
                        "path": f"{prefix}{path}",
                        "file": rel,
                        "line": i,
                    }
                )
    return routes


def normalize_frontend_endpoint(ep: str) -> str:
    if "localhost" in ep:
        idx = ep.find("/api/")
        if idx >= 0:
            return ep[idx:]
    return ep


def main():
    routes = collect_frontend_routes()
    calls, markers = collect_frontend_calls_and_markers()
    backend_routes = collect_backend_routes()

    backend_paths = {r["path"] for r in backend_routes}

    unmatched = []
    for c in calls:
        ep = normalize_frontend_endpoint(c["endpoint"])
        if ep.startswith("/api/"):
            # loose compare: exact path or dynamic segment prefix match
            if ep not in backend_paths and not any(
                ep.startswith(bp.split("{")[0]) for bp in backend_paths
            ):
                unmatched.append({**c, "normalized": ep})

    out = {
        "frontend_routes": routes,
        "frontend_endpoint_calls": calls,
        "backend_routes": backend_routes,
        "placeholder_markers": markers,
        "unmatched_frontend_endpoints": unmatched,
        "summary": {
            "frontend_routes": len(routes),
            "frontend_calls": len(calls),
            "backend_routes": len(backend_routes),
            "placeholder_markers": len(markers),
            "unmatched_frontend_endpoints": len(unmatched),
        },
    }

    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Contract smoke checks for canonical frontend domain services.
Equivalent checks are executed against backend endpoints used by:
- universe service
- companies service
- lists service
- prospects service
- analysis service
"""

from __future__ import annotations

import json
import os
import sys
import uuid
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple


TIMEOUT_SECONDS = int(os.getenv("SMOKE_TIMEOUT_SECONDS", "15"))


@dataclass
class CheckResult:
  name: str
  status: int
  outcome: str
  message: str


def detect_api_base() -> str:
  if os.getenv("VITE_API_BASE_URL"):
    return os.environ["VITE_API_BASE_URL"]

  for candidate in ("http://127.0.0.1:8001", "http://127.0.0.1:8000"):
    status, _, _ = request(candidate, "GET", "/health", None)
    if status != 0:
      return candidate

  return "http://127.0.0.1:8001"


def request(base: str, method: str, path: str, payload: Optional[Dict[str, Any]]) -> Tuple[int, Optional[Any], str]:
  data = None
  headers = {}
  if payload is not None:
    data = json.dumps(payload).encode("utf-8")
    headers["Content-Type"] = "application/json"

  req = urllib.request.Request(f"{base}{path}", data=data, headers=headers, method=method)
  try:
    with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as res:
      body = res.read().decode("utf-8", errors="replace")
      parsed = None
      try:
        parsed = json.loads(body)
      except Exception:
        parsed = None
      return res.getcode(), parsed, body
  except urllib.error.HTTPError as exc:
    body = exc.read().decode("utf-8", errors="replace")
    parsed = None
    try:
      parsed = json.loads(body)
    except Exception:
      parsed = None
    return exc.code, parsed, body
  except Exception as exc:
    return 0, None, str(exc)


def validate(condition: bool, message: str) -> None:
  if not condition:
    raise ValueError(message)


def run_check(
  name: str,
  base: str,
  method: str,
  path: str,
  payload: Optional[Dict[str, Any]],
  validator,
) -> CheckResult:
  status, data, body = request(base, method, path, payload)

  if status == 401:
    return CheckResult(name=name, status=status, outcome="AUTH_REQUIRED", message="AUTH REQUIRED")

  if status == 0:
    return CheckResult(name=name, status=status, outcome="FAIL", message=f"timeout/network error: {body}")

  if status in (404, 500) or status >= 500:
    return CheckResult(name=name, status=status, outcome="FAIL", message=f"server error: {body[:400]}")

  if status != 200:
    return CheckResult(name=name, status=status, outcome="FAIL", message=f"unexpected status {status}: {body[:400]}")

  try:
    validator(data)
    return CheckResult(name=name, status=status, outcome="PASS", message="shape ok")
  except Exception as exc:
    return CheckResult(name=name, status=status, outcome="FAIL", message=f"shape error: {exc}")


def main() -> int:
  base = detect_api_base()
  print(f"Using API base: {base}")

  summary = []

  universe_payload = {
    "filters": [],
    "logic": "and",
    "limit": 5,
    "offset": 0,
    "sort": {"by": "data_quality_score", "dir": "asc"},
  }

  universe = run_check(
    name="universe.queryUniverse",
    base=base,
    method="POST",
    path="/api/universe/query",
    payload=universe_payload,
    validator=lambda d: (
      validate(isinstance(d, dict), "response must be object"),
      validate(isinstance(d.get("rows"), list), "rows must be array"),
      validate(isinstance(d.get("total"), int), "total must be number"),
    ),
  )
  summary.append(universe)

  first_orgnr = None
  if universe.outcome == "PASS":
    status, data, _ = request(base, "POST", "/api/universe/query", universe_payload)
    if status == 200 and isinstance(data, dict):
      rows = data.get("rows") or []
      if rows and isinstance(rows[0], dict):
        first_orgnr = rows[0].get("orgnr")

  if first_orgnr:
    companies = run_check(
      name="companies.batchCompanies",
      base=base,
      method="POST",
      path="/api/companies/batch",
      payload={"orgnrs": [str(first_orgnr)]},
      validator=lambda d: (
        validate(isinstance(d, dict), "response must be object"),
        validate(isinstance(d.get("companies"), list), "companies must be array"),
        validate(isinstance(d.get("count"), int), "count must be number"),
      ),
    )
  else:
    companies = CheckResult(
      name="companies.batchCompanies",
      status=0,
      outcome="SKIP",
      message="no orgnr from universe query",
    )
  summary.append(companies)

  lists = run_check(
    name="lists.getLists",
    base=base,
    method="GET",
    path="/api/lists?scope=all",
    payload=None,
    validator=lambda d: (
      validate(isinstance(d, dict), "response must be object"),
      validate(isinstance(d.get("items"), list), "items must be array"),
    ),
  )
  summary.append(lists)

  prospects = run_check(
    name="prospects.getProspects",
    base=base,
    method="GET",
    path="/api/prospects?scope=team",
    payload=None,
    validator=lambda d: (
      validate(isinstance(d, dict), "response must be object"),
      validate(isinstance(d.get("items"), list), "items must be array"),
    ),
  )
  summary.append(prospects)

  analysis = run_check(
    name="analysis.getRuns",
    base=base,
    method="GET",
    path="/api/analysis/runs?limit=5",
    payload=None,
    validator=lambda d: (
      validate(isinstance(d, dict), "response must be object"),
      validate(isinstance(d.get("success"), bool), "success must be bool"),
      validate(isinstance(d.get("runs"), list), "runs must be array"),
    ),
  )
  summary.append(analysis)

  # Auth-gated list sourceViewId update contract check.
  view_name = f"smoke-view-{uuid.uuid4().hex[:8]}"
  list_name = f"smoke-list-{uuid.uuid4().hex[:8]}"

  view_status, view_data, view_body = request(
    base,
    "POST",
    "/api/views",
    {
      "name": view_name,
      "scope": "private",
      "filtersJson": {"include": {"id": "root", "type": "and", "rules": []}, "exclude": {"id": "root-ex", "type": "and", "rules": []}},
      "columnsJson": [],
      "sortJson": {},
    },
  )

  if view_status == 401:
    summary.append(CheckResult("lists.update_sourceViewId", 401, "AUTH_REQUIRED", "AUTH REQUIRED (auth-gated test)"))
  elif view_status != 200:
    summary.append(CheckResult("lists.update_sourceViewId", view_status, "FAIL", f"create view failed: {view_body[:400]}"))
  else:
    view_id = str((view_data or {}).get("id", ""))
    create_status, create_data, create_body = request(
      base,
      "POST",
      "/api/lists",
      {"name": list_name, "scope": "private"},
    )

    if create_status == 401:
      summary.append(CheckResult("lists.update_sourceViewId", 401, "AUTH_REQUIRED", "AUTH REQUIRED (auth-gated test)"))
    elif create_status != 200:
      summary.append(CheckResult("lists.update_sourceViewId", create_status, "FAIL", f"create list failed: {create_body[:400]}"))
    else:
      list_id = str((create_data or {}).get("id", ""))
      update_status, update_data, update_body = request(
        base,
        "PUT",
        f"/api/lists/{list_id}",
        {"sourceViewId": view_id},
      )

      if update_status == 200 and isinstance(update_data, dict) and str(update_data.get("source_view_id", "")) == view_id:
        summary.append(CheckResult("lists.update_sourceViewId", 200, "PASS", "sourceViewId persisted and returned"))
      else:
        summary.append(CheckResult("lists.update_sourceViewId", update_status, "FAIL", f"update failed or source_view_id mismatch: {update_body[:400]}"))

      # Best-effort cleanup (ignore failures)
      request(base, "DELETE", f"/api/lists/{list_id}", None)

    # Best-effort cleanup for view
    if isinstance(view_data, dict) and view_data.get("id"):
      request(base, "DELETE", f"/api/views/{view_data['id']}", None)

  has_failures = any(item.outcome == "FAIL" for item in summary)

  print("\nSummary:")
  print(json.dumps([item.__dict__ for item in summary], indent=2))

  return 2 if has_failures else 0


if __name__ == "__main__":
  sys.exit(main())

#!/usr/bin/env python3
"""
Dashboard API test runner

Loads configuration from dashboard_api_test_config.json and runs tests against the
local dashboard server (default http://localhost:3001). Tests focus on frontend
API endpoints only (no scraping/staging endpoints).
"""

from __future__ import annotations

import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

CONFIG_PATH = Path(__file__).parent / "dashboard_api_test_config.json"
LOCAL_DB_PATH = Path(__file__).parent.parent / "data" / "new_schema_local.db"


ENV_FILES = [
    Path(__file__).parent.parent / '.env.local',
    Path(__file__).parent.parent / 'frontend' / '.env.local',
    Path(__file__).parent.parent / 'backend' / '.env',
]

def load_env_files() -> None:
    for env_file in ENV_FILES:
        if not env_file.exists():
            continue
        try:
            with env_file.open('r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    if '=' not in line:
                        continue
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip().strip('\"').strip("'")
                    if key and value and key not in os.environ:
                        os.environ[key] = value
        except Exception as exc:
            print(f"⚠️  Could not load env file {env_file}: {exc}")

@dataclass
class TestResult:
    name: str
    status: str
    description: str
    method: str
    path: str
    requires: List[str]
    message: str
    response_time_ms: Optional[int] = None
    status_code: Optional[int] = None
    details: Dict[str, Any] = field(default_factory=dict)


def load_config() -> Dict[str, Any]:
    if not CONFIG_PATH.exists():
        raise FileNotFoundError(f"Config file not found: {CONFIG_PATH}")
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def gather_sample_orgnrs(limit: int = 3) -> List[str]:
    if not LOCAL_DB_PATH.exists():
        return []
    try:
        conn = sqlite3.connect(str(LOCAL_DB_PATH))
        cursor = conn.execute("SELECT orgnr FROM companies LIMIT ?", (limit,))
        orgnrs = [row[0] for row in cursor.fetchall() if row[0]]
        conn.close()
        return orgnrs
    except Exception as exc:
        print(f"⚠️  Could not load sample orgnrs: {exc}")
        return []


def check_dependency(name: str) -> bool:
    if name == "local_db":
        return LOCAL_DB_PATH.exists()
    if name == "supabase":
        return bool(os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL"))
    if name == "openai":
        return bool(os.getenv("OPENAI_API_KEY"))
    return True


def substitute_placeholders(value: Any, placeholders: Dict[str, Any]) -> Any:
    if isinstance(value, str):
        updated = value
        unresolved = set()
        for key, val in placeholders.items():
            token = f"{{{{{key}}}}}"
            if token in updated and val is not None:
                updated = updated.replace(token, str(val))
            elif token in updated and val is None:
                unresolved.add(key)
        if "{{" in updated and "}}" in updated:
            # some placeholders remain unresolved
            unresolved.add("unknown")
        if unresolved:
            raise ValueError(f"Missing placeholder values: {', '.join(unresolved)}")
        return updated
    if isinstance(value, list):
        return [substitute_placeholders(item, placeholders) for item in value]
    if isinstance(value, dict):
        return {k: substitute_placeholders(v, placeholders) for k, v in value.items()}
    return value


def perform_request(method: str, url: str, payload: Optional[Dict[str, Any]], headers: Dict[str, str], timeout: int) -> (int, bytes, Dict[str, str], int):
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method.upper())
    for key, value in headers.items():
        req.add_header(key, value)
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            elapsed = int((time.time() - start) * 1000)
            return resp.status, resp.read(), dict(resp.headers), elapsed
    except urllib.error.HTTPError as err:
        elapsed = int((time.time() - start) * 1000)
        return err.code, err.read(), dict(err.headers), elapsed
    except Exception:
        elapsed = int((time.time() - start) * 1000)
        raise


def parse_json(body: bytes) -> Any:
    if not body:
        return None
    try:
        return json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        return None


def extract_value(data: Any, path: str) -> Any:
    if data is None or not path:
        return None
    parts = path.split('.')
    current = data
    for part in parts:
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return None
    return current


def main() -> None:
    load_env_files()
    config = load_config()
    base_url = os.getenv("DASHBOARD_API_BASE_URL", config.get("base_url", "http://localhost:3001"))
    timeout_seconds = config.get("timeout_seconds", 10)
    default_headers = config.get("default_headers", {})

    sample_orgnrs = gather_sample_orgnrs(3)
    placeholders: Dict[str, Optional[str]] = {
        "sample_orgnr": sample_orgnrs[0] if len(sample_orgnrs) > 0 else None,
        "sample_orgnr_2": sample_orgnrs[1] if len(sample_orgnrs) > 1 else None,
        "sample_orgnr_3": sample_orgnrs[2] if len(sample_orgnrs) > 2 else None,
        # Placeholders that will be populated at runtime
        "analysis_run_id": None,
        "valuation_run_id": None,
        "assumption_id": None,
        "saved_list_id": None,
        "assumption_id": None,
        "test_suffix": str(int(time.time()))
    }

    results: List[TestResult] = []

    for test in config.get("tests", []):
        name = test.get("name", "Unnamed Test")
        method = test.get("method", "GET").upper()
        path_template = test.get("path", "/")
        requires = test.get("requires", [])
        description = test.get("description", "")
        payload_template = test.get("payloadTemplate")
        expect_cfg = test.get("expect", {})
        store_response_cfg = test.get("storeResponse")
        placeholder_keys = test.get("placeholders", [])

        # Check dependencies
        missing_requirements = [req for req in requires if not check_dependency(req)]
        missing_placeholders = [key for key in placeholder_keys if placeholders.get(key) in (None, "")]

        if missing_requirements:
            results.append(TestResult(
                name=name,
                status="skipped",
                description=description,
                method=method,
                path=path_template,
                requires=requires,
                message=f"Missing requirements: {', '.join(missing_requirements)}"
            ))
            continue

        if missing_placeholders:
            results.append(TestResult(
                name=name,
                status="skipped",
                description=description,
                method=method,
                path=path_template,
                requires=requires,
                message=f"Missing placeholder values: {', '.join(missing_placeholders)}"
            ))
            continue

        try:
            path = substitute_placeholders(path_template, placeholders)
            payload = substitute_placeholders(payload_template, placeholders) if payload_template else None
        except ValueError as exc:
            results.append(TestResult(
                name=name,
                status="skipped",
                description=description,
                method=method,
                path=path_template,
                requires=requires,
                message=str(exc)
            ))
            continue

        url = base_url.rstrip('/') + path
        try:
            status_code, body, resp_headers, elapsed_ms = perform_request(
                method, url, payload, default_headers, timeout_seconds
            )
            parsed = parse_json(body)
            expected_status = expect_cfg.get("status")
            must_include_keys = expect_cfg.get("must_include_keys", [])

            status = "pass"
            message = ""
            details: Dict[str, Any] = {}

            if expected_status and status_code != expected_status:
                status = "fail"
                message = f"Expected status {expected_status}, got {status_code}"
            else:
                for key in must_include_keys:
                    if '.' in key:
                        value = extract_value(parsed, key)
                        if value is None:
                            status = 'fail'
                            message = f"Response missing key '{key}'"
                            break
                    else:
                        if not (isinstance(parsed, dict) and key in parsed):
                            status = 'fail'
                            message = f"Response missing key '{key}'"
                            break

            if status == "pass" and store_response_cfg and isinstance(parsed, dict):
                store_path = store_response_cfg.get("path")
                store_key = store_response_cfg.get("as")
                if store_path and store_key:
                    stored_value = extract_value(parsed, store_path)
                    if stored_value:
                        placeholders[store_key] = stored_value
                        details["stored"] = {store_key: stored_value}

            if not message:
                message = "OK"

            results.append(TestResult(
                name=name,
                status=status,
                description=description,
                method=method,
                path=path,
                requires=requires,
                message=message,
                response_time_ms=elapsed_ms,
                status_code=status_code,
                details=details
            ))
        except urllib.error.URLError as exc:
            results.append(TestResult(
                name=name,
                status="error",
                description=description,
                method=method,
                path=path,
                requires=requires,
                message=f"Request error: {exc}",
                details={"exception": str(exc)}
            ))
        except Exception as exc:
            results.append(TestResult(
                name=name,
                status="error",
                description=description,
                method=method,
                path=path,
                requires=requires,
                message=f"Unhandled error: {exc}",
                details={"exception": str(exc)}
            ))

    # Print summary
    passed = sum(1 for r in results if r.status == "pass")
    failed = sum(1 for r in results if r.status == "fail")
    skipped = sum(1 for r in results if r.status == "skipped")
    errored = sum(1 for r in results if r.status == "error")

    print("\n=== Dashboard API Test Summary ===")
    print(f"Total tests: {len(results)}")
    print(f"Passed : {passed}")
    print(f"Failed : {failed}")
    print(f"Skipped: {skipped}")
    print(f"Errors : {errored}")
    print()

    for result in results:
        prefix = {
            "pass": "✅",
            "fail": "❌",
            "skipped": "⚠️",
            "error": "🚫"
        }.get(result.status, "•")
        print(f"{prefix} {result.name} [{result.method} {result.path}]")
        print(f"   Status : {result.status_code if result.status_code else result.status}")
        print(f"   Message: {result.message}")
        if result.response_time_ms is not None:
            print(f"   Time   : {result.response_time_ms} ms")
        if result.details:
            print(f"   Details: {json.dumps(result.details)}")
        if result.requires:
            print(f"   Requires: {', '.join(result.requires)}")
        print()

    # Write machine-readable results for documentation phase
    results_path = Path(__file__).parent / "dashboard_api_test_results.json"
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump([r.__dict__ for r in results], f, indent=2)
    print(f"Results saved to {results_path}")


if __name__ == "__main__":
    if not CONFIG_PATH.exists():
        print(f"Config file missing: {CONFIG_PATH}")
        sys.exit(1)
    main()

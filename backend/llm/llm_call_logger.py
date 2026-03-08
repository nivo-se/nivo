"""LLM call logging for Deep Research pipeline."""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from typing import Generator

from .payload_contracts import LLMCallRecord, estimate_cost

logger = logging.getLogger(__name__)

_call_log: list[LLMCallRecord] = []


def log_llm_call(record: LLMCallRecord) -> None:
    """Append an LLM call record to the in-memory log and emit a structured log line."""
    record.cost_estimate_usd = estimate_cost(record.model, record.input_tokens, record.output_tokens)
    _call_log.append(record)
    logger.info(
        "LLM call: run=%s stage=%s model=%s in_tok=%d out_tok=%d latency=%dms cost=$%.6f success=%s",
        record.run_id, record.stage, record.model,
        record.input_tokens, record.output_tokens,
        record.latency_ms, record.cost_estimate_usd, record.success,
    )


def get_call_log(run_id: str | None = None) -> list[LLMCallRecord]:
    """Return LLM call log, optionally filtered by run_id."""
    if run_id is None:
        return list(_call_log)
    return [r for r in _call_log if r.run_id == run_id]


def clear_call_log() -> None:
    _call_log.clear()


@contextmanager
def track_llm_call(run_id: str, stage: str, model: str) -> Generator[LLMCallRecord, None, None]:
    """Context manager that tracks timing and logs an LLM call."""
    record = LLMCallRecord(run_id=run_id, stage=stage, model=model)
    t0 = time.monotonic()
    try:
        yield record
    except Exception as exc:
        record.success = False
        record.error = str(exc)
        raise
    finally:
        record.latency_ms = int((time.monotonic() - t0) * 1000)
        log_llm_call(record)

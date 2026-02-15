"""
OpenAI-compatible LLM provider. Works with OpenAI cloud and LMStudio.
"""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Dict, Optional

from openai import OpenAI

from .base import BaseLLMProvider

logger = logging.getLogger(__name__)


def _is_retryable(exc: BaseException) -> bool:
    """True for network errors and 5xx."""
    msg = str(exc).lower()
    if "connection" in msg or "timeout" in msg or "network" in msg:
        return True
    if "500" in msg or "502" in msg or "503" in msg or "504" in msg:
        return True
    if hasattr(exc, "status_code") and getattr(exc, "status_code", 0) >= 500:
        return True
    return False


class OpenAICompatProvider(BaseLLMProvider):
    """
    Uses OpenAI client. When LLM_BASE_URL is set (e.g. http://localhost:1234/v1),
    connects to LMStudio or other OpenAI-compatible endpoints.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.1,
    ) -> None:
        base_url = base_url or os.getenv("LLM_BASE_URL")
        api_key = api_key or os.getenv("LLM_API_KEY") or os.getenv("OPENAI_API_KEY", "lm-studio")
        self.model = model or os.getenv("LLM_MODEL") or os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.temperature = temperature
        kwargs: Dict[str, Any] = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url.rstrip("/")
            if not kwargs["base_url"].endswith("/v1"):
                kwargs["base_url"] = f"{kwargs['base_url']}/v1"
            logger.info("LLM using base_url=%s (e.g. LMStudio)", base_url)
        self._client = OpenAI(**kwargs)

    def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        schema_hint: Optional[Dict[str, Any]] = None,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        model = model or self.model
        temperature = temperature if temperature is not None else self.temperature
        timeout = int(os.getenv("LLM_TIMEOUT_SECONDS", "60"))
        formatted_schema = (
            {"name": "response", "schema": schema_hint} if schema_hint else {"type": "json_object"}
        )
        response_format = (
            {"type": "json_schema", "json_schema": formatted_schema}
            if schema_hint
            else {"type": "json_object"}
        )

        kwargs_call: Dict[str, Any] = dict(kwargs)
        kwargs_call.setdefault("timeout", timeout)

        for attempt in range(2):
            try:
                response = self._client.chat.completions.create(
                    model=model,
                    temperature=temperature,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    response_format=response_format,
                    **kwargs_call,
                )
                break
            except Exception as exc:
                if attempt == 0 and _is_retryable(exc):
                    logger.warning("LLM call failed (retryable), retrying once: %s", exc)
                    time.sleep(1)
                    continue
                raise

        choice = response.choices[0]
        content = choice.message.content if choice.message else ""
        if isinstance(content, list):
            content = "".join(
                part.get("text", "") for part in content if isinstance(part, dict)
            )

        try:
            parsed = json.loads(content or "{}")
        except json.JSONDecodeError:
            parsed = {}

        return {"data": parsed, "raw": content or ""}

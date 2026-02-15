"""
LLM provider factory. Returns provider based on LLM_PROVIDER env.
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Optional

from .providers.base import BaseLLMProvider
from .providers.openai_compat import OpenAICompatProvider


@lru_cache(maxsize=1)
def get_llm_provider() -> Optional[BaseLLMProvider]:
    """
    Return the configured LLM provider. Default: OpenAICompatProvider.
    Set LLM_PROVIDER=openai_compat (or leave unset) for OpenAI/LMStudio.
    """
    provider_name = os.getenv("LLM_PROVIDER", "openai_compat").lower()
    if provider_name == "openai_compat":
        return OpenAICompatProvider()
    return OpenAICompatProvider()

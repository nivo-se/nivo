"""
LLM provider abstraction for Nivo.
Supports OpenAI cloud and LMStudio (OpenAI-compatible) via provider_factory.
"""
from .provider_factory import get_llm_provider

__all__ = ["get_llm_provider"]

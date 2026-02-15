"""
Base LLM provider interface for Nivo.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional


class BaseLLMProvider(ABC):
    """Abstract LLM provider for JSON generation."""

    @abstractmethod
    def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        schema_hint: Optional[Dict[str, Any]] = None,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Generate a JSON response from the LLM.

        Args:
            system_prompt: System message
            user_prompt: User message
            schema_hint: Optional JSON schema for structured output
            model: Override default model
            temperature: Override default temperature

        Returns:
            {"data": parsed_dict, "raw": raw_content}
        """
        ...

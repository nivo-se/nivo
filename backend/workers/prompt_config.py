from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

CONFIG_ENV_VAR = "AI_AGENT_CONFIG_PATH"
CONFIG_DIR = Path(__file__).resolve().parents[1] / "config"
DEFAULT_CONFIG_PATH = CONFIG_DIR / "ai_agents.json"


@dataclass(frozen=True)
class PromptStepConfig:
    system_prompt: str
    user_template_path: Optional[Path] = None


class PromptConfigError(RuntimeError):
    """Raised when prompt configuration cannot be loaded."""


class PromptConfig:
    """Loads and manages multi-agent prompt configuration for the enrichment pipeline."""

    def __init__(self, agent_type: Optional[str] = None, config_path: Optional[str] = None) -> None:
        self._config_path = self._resolve_config_path(config_path)
        self._raw_config = self._load_config()

        default_agent = self._raw_config.get("default_agent", "default")
        self.agent_type = agent_type or default_agent
        self._agent_config = self._build_agent_config(self.agent_type, default_agent)
        self._template_cache: Dict[Path, str] = {}

    @staticmethod
    def _resolve_config_path(explicit_path: Optional[str]) -> Path:
        if explicit_path:
            return Path(explicit_path).expanduser()
        env_path = os.getenv(CONFIG_ENV_VAR)
        if env_path:
            return Path(env_path).expanduser()
        return DEFAULT_CONFIG_PATH

    def _load_config(self) -> Dict[str, Any]:
        if self._config_path.is_file():
            try:
                with self._config_path.open("r", encoding="utf-8") as config_file:
                    return json.load(config_file)
            except json.JSONDecodeError as exc:
                raise PromptConfigError(f"Invalid JSON in {self._config_path}: {exc}") from exc
        logger.warning("Prompt config missing at %s, falling back to defaults", self._config_path)
        return _default_agent_config()

    def _build_agent_config(self, agent_type: str, default_agent: str) -> Dict[str, Any]:
        agents = self._raw_config.get("agents", {})
        if agent_type not in agents:
            logger.warning(
                "Unknown agent_type '%s'. Falling back to default agent '%s'. Available agents: %s",
                agent_type,
                default_agent,
                ", ".join(sorted(agents.keys())),
            )
            agent_type = default_agent

        chain: list[str] = []
        resolved: Dict[str, Any] = {"system_prompts": {}, "user_templates": {}, "metadata": {}}
        cursor = agent_type
        while cursor:
            if cursor in chain:
                raise PromptConfigError(f"Circular agent inheritance detected: {' -> '.join(chain + [cursor])}")
            chain.append(cursor)
            current = agents.get(cursor, {})
            resolved["system_prompts"].update(current.get("system_prompts", {}))
            resolved["user_templates"].update(current.get("user_templates", {}))
            resolved["metadata"] = {**current.get("metadata", {}), **resolved["metadata"]}
            cursor = current.get("extends")
        resolved["agent_type"] = agent_type
        return resolved

    def get_system_prompt(self, step: str) -> str:
        system_prompt = self._agent_config["system_prompts"].get(step)
        if not system_prompt:
            raise PromptConfigError(f"No system prompt configured for step '{step}' in agent '{self.agent_type}'")
        return system_prompt

    def build_user_prompt(self, step: str, **context: Any) -> str:
        template_path_str = self._agent_config["user_templates"].get(step)
        if not template_path_str:
            raise PromptConfigError(f"No user template configured for step '{step}' in agent '{self.agent_type}'")
        template_path = self._resolve_template_path(template_path_str)
        template = self._load_template(template_path)

        try:
            return template.format(**context)
        except KeyError as exc:  # pragma: no cover - defensive logging
            missing_key = exc.args[0]
            raise PromptConfigError(
                f"Missing template variable '{missing_key}' for step '{step}' (agent '{self.agent_type}')"
            ) from exc

    @staticmethod
    def _resolve_template_path(template_path: str) -> Path:
        candidate = Path(template_path)
        if candidate.is_absolute():
            return candidate
        if template_path.startswith("~"):
            return Path(template_path).expanduser()
        return CONFIG_DIR / template_path

    def _load_template(self, path: Path) -> str:
        if path in self._template_cache:
            return self._template_cache[path]
        try:
            with path.open("r", encoding="utf-8") as template_file:
                content = template_file.read()
                self._template_cache[path] = content
                return content
        except FileNotFoundError:
            logger.warning("Prompt template %s missing. Returning empty template.", path)
            self._template_cache[path] = ""
            return ""

    def available_agents(self) -> list[str]:
        return sorted(self._raw_config.get("agents", {}).keys())

    def metadata(self) -> Dict[str, Any]:
        return self._agent_config.get("metadata", {})


@lru_cache(maxsize=1)
def _default_agent_config() -> Dict[str, Any]:
    """Hard-coded fallback prompts to keep the system functional without JSON config."""

    base_prompts = {
        "content_summarization": "You are a Swedish investment analyst summarizing company data.",
        "industry_classification": "Classify the company into industry sector and subsector.",
        "strategic_fit": "Assess the company's fit against the investment thesis and score 1-10.",
        "playbook_generation": "Draft a strategic playbook with next steps based on the analysis.",
    }

    return {
        "default_agent": "default",
        "agents": {
            "default": {
                "metadata": {
                    "label": "Generalist PE Analyst",
                    "description": "Balanced assessment across industries.",
                },
                "system_prompts": base_prompts,
                "user_templates": {
                    step: f"prompts/{step}.txt" for step in base_prompts
                },
            }
        },
    }


__all__ = ["PromptConfig", "PromptConfigError", "PromptStepConfig"]


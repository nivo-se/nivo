"""Environment loading helpers."""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv


def load_environment(env_file: str | None = None) -> Path:
    """Load environment variables from .env if present.

    Resolution order:
    1) Explicit env_file path
    2) BACKEND_ENV_FILE environment variable
    3) Repository root .env
    """
    if env_file:
        path = Path(env_file).expanduser().resolve()
    else:
        root = Path(__file__).resolve().parents[2]
        path = root / ".env"
    load_dotenv(dotenv_path=path, override=False)
    return path


"""Background worker bootstrap scaffold."""

from __future__ import annotations

import time

from backend.config import configure_logging, get_settings, load_environment


def main() -> None:
    load_environment()
    settings = get_settings()
    configure_logging(settings.log_level)
    print("Deep Research worker scaffold started. No jobs are implemented yet.")
    # Keep process alive for orchestration wiring tests.
    while True:
        time.sleep(60)


if __name__ == "__main__":
    main()


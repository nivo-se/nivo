#!/usr/bin/env python3
"""
DEPRECATED: Supabase Database Manager (Supabase has been removed from this project.)

Use Postgres and the services from services.db_factory (get_database_service()) instead.
This module is kept only to avoid breaking any external scripts that import it;
instantiation will raise.
"""


class DatabaseManager:
    """Deprecated. Supabase has been removed. Use get_database_service() from services.db_factory for Postgres."""

    def __init__(self):
        raise RuntimeError(
            "DatabaseManager (Supabase) is deprecated and removed. "
            "Use backend.services.db_factory.get_database_service() for Postgres access."
        )


def main():
    """Interactive database manager - deprecated."""
    raise RuntimeError(
        "Supabase Database Manager is deprecated. Use Postgres and get_database_service() instead."
    )


if __name__ == "__main__":
    main()

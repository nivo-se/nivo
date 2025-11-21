"""
Database service package.

Provides abstractions for querying the company/financial dataset from different
storage backends (local SQLite during development, Supabase Postgres in
production).
"""

from .database_service import DatabaseService  # noqa: F401


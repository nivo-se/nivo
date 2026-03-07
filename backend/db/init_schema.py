"""Initialize Deep Research schema from SQLAlchemy metadata."""

from __future__ import annotations

from backend.db import Base, get_engine
from backend.db.models import deep_research  # noqa: F401


def main() -> None:
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    print("Deep Research ORM schema initialized.")


if __name__ == "__main__":
    main()


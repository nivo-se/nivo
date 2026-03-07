# Deep Research backend scaffold

This scaffold provides the base backend architecture for Deep Research without implementing research logic yet.

## Module layout

- `backend/api/`
- `backend/agents/`
- `backend/orchestrator/`
- `backend/retrieval/`
- `backend/verification/`
- `backend/report_engine/`
- `backend/services/`
- `backend/models/`
- `backend/db/`
- `backend/common/`
- `backend/config/`

## Dependency management

- Runtime dependencies: `backend/requirements.txt`
- Development dependencies: `backend/requirements-dev.txt`

Install:

```bash
pip install -r backend/requirements.txt
```

## Startup scripts

- API: `backend/scripts/start_deep_research_api.sh`
- Worker scaffold: `backend/scripts/start_deep_research_worker.sh`
- Stack helper: `backend/scripts/start_deep_research_stack.sh`

Programmatic startup:

```bash
python -m backend.start
```

## Persistence layer

SQLAlchemy ORM models are defined under:

- `backend/db/base.py`
- `backend/db/session.py`
- `backend/db/models/deep_research.py`

Migration SQL:

- `database/migrations/024_deep_research_persistence.sql`

Run migration:

```bash
./scripts/run_deep_research_migrations.sh
```

For cloud agents and fresh Linux environments, run one-shot environment bootstrap:

```bash
./scripts/setup_cloud_environment.sh
```

This installs PostgreSQL client/server tooling, installs backend Python dependencies, bootstraps schema, and runs both migration scripts.


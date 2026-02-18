# API Naming Conventions

This frontend uses domain-based API modules under `frontend/src/lib/api`.

## Folder structure

- `frontend/src/lib/api/universe/`
- `frontend/src/lib/api/companies/`
- `frontend/src/lib/api/lists/`
- `frontend/src/lib/api/analysis/`
- `frontend/src/lib/api/status/`

Each domain contains:

- `client.ts`: raw HTTP wrappers for endpoint calls.
- `service.ts`: orchestration and app-facing helpers.
- `types.ts`: domain request/response and model types.

Shared cross-domain models live in:

- `frontend/src/lib/api/types.ts`

## Naming rules

- Name by backend domain and purpose, never by tool history.
- Use `*Client.ts` for transport concerns and request wiring.
- Use `*Service.ts` for domain logic, mapping, and orchestration.
- Use named exports only (no default exports).
- Avoid historical prefixes like `figma`, `prototype`, or `mock` in active code paths.

## Compatibility policy

- `frontend/src/lib/api/compatClient.ts` is a temporary migration layer.
- New features should import from domain services, not `compatClient`.
- Existing pages can use `compatClient` only when they still depend on legacy response shapes.

## Adding a new endpoint

1. Add raw endpoint call in the appropriate `client.ts`.
2. Add/extend domain types in `types.ts` (or shared `lib/api/types.ts` when cross-domain).
3. Add app-facing function in `service.ts`.
4. Use the service from hooks/components.
5. Run `scripts/no_figma_naming.sh` and `cd frontend && npm run build`.

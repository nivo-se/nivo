# Figma design reference

**Status:** UX migration from Figma export to the default app is complete. Default routes (`/`, `/universe`, `/lists`, etc.) use the backend API (no Figma mock data).

**Design specs:** Screen specs, components, and backend integration notes live under **`nivo-figma-app/figma-export/`**:

- [PROJECT_DESCRIPTION.md](../nivo-figma-app/figma-export/PROJECT_DESCRIPTION.md) — Project overview
- [SCREENS.md](../nivo-figma-app/figma-export/SCREENS.md) — Screen specifications
- [COMPONENT_INVENTORY.md](../nivo-figma-app/figma-export/COMPONENT_INVENTORY.md) — UI components
- [BACKEND_INTEGRATION.md](../nivo-figma-app/figma-export/BACKEND_INTEGRATION.md) — API mapping (historical; current app uses `frontend/src/lib/api/` and `apiQueries`)

Use these for design reference only. Implementation lives in `frontend/src/pages/default/` and the domain API layer.

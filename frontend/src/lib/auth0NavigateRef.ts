/**
 * Ref for navigate function, set by a component inside BrowserRouter.
 * Used by Auth0Provider onRedirectCallback since it runs before Router context is available.
 */
import type { NavigateFunction } from "react-router-dom";

export const auth0NavigateRef: { current: NavigateFunction | null } = { current: null };

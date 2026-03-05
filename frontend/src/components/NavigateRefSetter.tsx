/**
 * Sets auth0NavigateRef so Auth0Provider's onRedirectCallback can navigate.
 * Must be mounted inside BrowserRouter.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth0NavigateRef } from "../lib/auth0NavigateRef";

export default function NavigateRefSetter() {
  const navigate = useNavigate();
  useEffect(() => {
    auth0NavigateRef.current = navigate;
    return () => {
      auth0NavigateRef.current = null;
    };
  }, [navigate]);
  return null;
}

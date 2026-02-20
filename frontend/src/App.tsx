import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";

function RedirectWithParam({ to, param }: { to: string; param: string }) {
  const params = useParams();
  const value = params[param];
  const target = to.replace(`:${param}`, value ?? "");
  return <Navigate to={target} replace />;
}
import { Auth0Provider } from "@auth0/auth0-react";
import { NoAuthProvider, useAuth } from "./contexts/AuthContext";
import { Auth0AuthProvider } from "./contexts/Auth0AuthProvider";
import { isAuth0Configured } from "./lib/authToken";
import { auth0NavigateRef } from "./lib/auth0NavigateRef";
import ProtectedRoute from "./components/ProtectedRoute";
import NavigateRefSetter from "./components/NavigateRefSetter";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import ClaimFirstAdmin from "./pages/ClaimFirstAdmin";
import NotFound from "./pages/NotFound";
import StyleGuide from "./pages/StyleGuide";
import AppLayout from "./pages/default/AppLayout";
import WorkDashboard from "./pages/default/WorkDashboard";
import Universe from "./pages/default/Universe";
import MyLists from "./pages/default/MyLists";
import ListDetail from "./pages/default/ListDetail";
import AILab from "./pages/default/AILab";
import AILabRuns from "./pages/default/AILabRuns";
import CreateRun from "./pages/default/CreateRun";
import RunDetail from "./pages/default/RunDetail";
import RunResults from "./pages/default/RunResults";
import CompanyDetail from "./pages/default/CompanyDetail";
import Admin from "./pages/default/Admin";
import Settings from "./pages/default/Settings";
import Prospects from "./pages/default/Prospects";
import ThemeSanityPage from "./pages/default/ThemeSanityPage";
import WorkingDashboard from "./pages/WorkingDashboard";
import { PipelinePage } from "./pages/app/PipelinePage";
import { UniversePage } from "./pages/app/UniversePage";
import { HomePage } from "./pages/app/HomePage";
import { AdminPage } from "./pages/app/AdminPage";
import { CompanyPage } from "./pages/app/CompanyPage";

const queryClient = new QueryClient();

const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN;
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE;

function AuthWrapper({ children }: { children: React.ReactNode }) {
  if (isAuth0Configured() && auth0Domain && auth0ClientId) {
    return (
      <Auth0Provider
        domain={auth0Domain}
        clientId={auth0ClientId}
        cacheLocation="localstorage"
        useRefreshTokens={true}
        useRefreshTokensFallback={true}
        onRedirectCallback={(appState) => {
          const path = appState?.returnTo ?? "/";
          auth0NavigateRef.current?.(path);
        }}
        authorizationParams={{
          redirect_uri: typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
          audience: auth0Audience || undefined,
          scope: "openid profile email offline_access",
        }}
      >
        <Auth0AuthProvider>{children}</Auth0AuthProvider>
      </Auth0Provider>
    );
  }
  return <NoAuthProvider>{children}</NoAuthProvider>;
}

function RedirectToCompany() {
  const { orgnr } = useParams<{ orgnr: string }>();
  return <Navigate to={orgnr ? `/company/${orgnr}` : "/"} replace />;
}

/** When user has no role in DB, show ClaimFirstAdmin; otherwise AppLayout (with nested routes). */
function AppOrClaimFirstAdmin() {
  const { user, userRole, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
  if (user && userRole === null) return <ClaimFirstAdmin />;
  return <AppLayout />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthWrapper>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <NavigateRefSetter />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            {isAuth0Configured() && <Route path="/auth/callback" element={<AuthCallback />} />}
            <Route path="/styleguide" element={<StyleGuide />} />
            <Route path="/landing" element={<Index />} />

            {/* Default UI */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppOrClaimFirstAdmin />
                </ProtectedRoute>
              }
            >
              <Route index element={<WorkDashboard />} />
              <Route path="prospects" element={<Prospects />} />
              <Route path="universe" element={<Universe />} />
              <Route path="lists" element={<MyLists />} />
              <Route path="lists/:listId" element={<ListDetail />} />
              <Route path="company/:companyId" element={<CompanyDetail />} />
              <Route path="ai" element={<AILab />} />
              <Route path="ai/run/create" element={<CreateRun />} />
              <Route path="ai/runs" element={<AILabRuns />} />
              <Route path="ai/runs/:runId" element={<RunDetail />} />
              <Route path="ai/runs/:runId/results" element={<RunResults />} />
              <Route path="settings" element={<Settings />} />
              <Route path="admin" element={<Admin />} />
              <Route path="app/theme" element={<ThemeSanityPage />} />
            </Route>

            {/* Old UI (may use mock/sample data). More specific paths first. */}
            <Route path="/old/dashboard" element={<ProtectedRoute><WorkingDashboard /></ProtectedRoute>} />
            <Route path="/old/app" element={<Navigate to="/old/app/home" replace />} />
            <Route path="/old/app/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/old/app/pipeline" element={<ProtectedRoute><PipelinePage /></ProtectedRoute>} />
            <Route path="/old/app/universe" element={<ProtectedRoute><UniversePage /></ProtectedRoute>} />
            <Route path="/old/app/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
            <Route path="/old/app/companies/:orgnr" element={<ProtectedRoute><CompanyPage /></ProtectedRoute>} />
            <Route path="/old" element={<ProtectedRoute><div className="p-4"><a href="/" className="text-primary">← Back to app</a></div></ProtectedRoute>} />

            {/* Backward compat: /legacy/* redirects to /old/* */}
            <Route path="/legacy" element={<Navigate to="/old" replace />} />
            <Route path="/legacy/dashboard" element={<Navigate to="/old/dashboard" replace />} />
            <Route path="/legacy/app" element={<Navigate to="/old/app" replace />} />
            <Route path="/legacy/app/home" element={<Navigate to="/old/app/home" replace />} />
            <Route path="/legacy/app/pipeline" element={<Navigate to="/old/app/pipeline" replace />} />
            <Route path="/legacy/app/universe" element={<Navigate to="/old/app/universe" replace />} />
            <Route path="/legacy/app/admin" element={<Navigate to="/old/app/admin" replace />} />
            <Route path="/legacy/app/companies/:orgnr" element={<RedirectWithParam to="/old/app/companies/:orgnr" param="orgnr" />} />

            {/* Backward compat: /new/* redirects to equivalent /* routes */}
            <Route path="/new" element={<Navigate to="/" replace />} />
            <Route path="/new/prospects" element={<Navigate to="/prospects" replace />} />
            <Route path="/new/universe" element={<Navigate to="/universe" replace />} />
            <Route path="/new/lists" element={<Navigate to="/lists" replace />} />
            <Route path="/new/lists/:listId" element={<RedirectWithParam to="/lists/:listId" param="listId" />} />
            <Route path="/new/company/:companyId" element={<RedirectWithParam to="/company/:companyId" param="companyId" />} />
            <Route path="/new/ai" element={<Navigate to="/ai" replace />} />
            <Route path="/new/ai/run/create" element={<Navigate to="/ai/run/create" replace />} />
            <Route path="/new/ai/runs/:runId" element={<RedirectWithParam to="/ai/runs/:runId" param="runId" />} />
            <Route path="/new/ai/runs/:runId/results" element={<RedirectWithParam to="/ai/runs/:runId/results" param="runId" />} />
            <Route path="/new/*" element={<Navigate to="/" replace />} />
            <Route path="/new/admin" element={<Navigate to="/admin" replace />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/admin" element={<Navigate to="/admin" replace />} />
            <Route path="/valuation" element={<Navigate to="/" replace />} />
            <Route path="/analysis" element={<Navigate to="/" replace />} />
            <Route path="/app" element={<Navigate to="/" replace />} />
            <Route path="/app/home" element={<Navigate to="/" replace />} />
            <Route path="/app/universe" element={<Navigate to="/universe" replace />} />
            <Route path="/app/pipeline" element={<Navigate to="/" replace />} />
            <Route path="/app/reports" element={<Navigate to="/" replace />} />
            <Route path="/app/runs" element={<Navigate to="/ai" replace />} />
            <Route path="/app/admin" element={<Navigate to="/admin" replace />} />
            <Route path="/companies/:orgnr" element={<RedirectToCompany />} />
            <Route path="/app/companies/:orgnr" element={<RedirectToCompany />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </TooltipProvider>
      </AuthWrapper>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

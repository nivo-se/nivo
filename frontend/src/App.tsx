import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";

function RedirectFromNew({ to, param }: { to: string; param: string }) {
  const params = useParams();
  const value = params[param];
  const target = to.replace(`:${param}`, value ?? "");
  return <Navigate to={target} replace />;
}
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import StyleGuide from "./pages/StyleGuide";
import NewAppLayout from "./pages/new/NewAppLayout";
import NewWorkDashboard from "./pages/new/WorkDashboard";
import NewUniverse from "./pages/new/Universe";
import NewMyLists from "./pages/new/MyLists";
import NewListDetail from "./pages/new/ListDetail";
import NewAILab from "./pages/new/AILab";
import NewCreateRun from "./pages/new/CreateRun";
import NewRunDetail from "./pages/new/RunDetail";
import NewRunResults from "./pages/new/RunResults";
import NewCompanyDetail from "./pages/new/CompanyDetail";
import NewAdmin from "./pages/new/Admin";
import NewProspects from "./pages/new/Prospects";
import WorkingDashboard from "./pages/WorkingDashboard";
import { PipelinePage } from "./pages/app/PipelinePage";
import { UniversePage } from "./pages/app/UniversePage";
import { HomePage } from "./pages/app/HomePage";
import { AdminPage } from "./pages/app/AdminPage";
import { CompanyPage } from "./pages/app/CompanyPage";

const queryClient = new QueryClient();

function RedirectToCompany() {
  const { orgnr } = useParams<{ orgnr: string }>();
  return <Navigate to={orgnr ? `/company/${orgnr}` : "/"} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/styleguide" element={<StyleGuide />} />
            <Route path="/landing" element={<Index />} />

            {/* Main app — Figma UX (default at /) */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <NewAppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<NewWorkDashboard />} />
              <Route path="prospects" element={<NewProspects />} />
              <Route path="universe" element={<NewUniverse />} />
              <Route path="lists" element={<NewMyLists />} />
              <Route path="lists/:listId" element={<NewListDetail />} />
              <Route path="company/:companyId" element={<NewCompanyDetail />} />
              <Route path="ai" element={<NewAILab />} />
              <Route path="ai/run/create" element={<NewCreateRun />} />
              <Route path="ai/runs/:runId" element={<NewRunDetail />} />
              <Route path="ai/runs/:runId/results" element={<NewRunResults />} />
              <Route path="admin" element={<NewAdmin />} />
            </Route>

            {/* Legacy UI — old pages (may use mock/sample data). More specific paths first. */}
            <Route path="/legacy/dashboard" element={<ProtectedRoute><WorkingDashboard /></ProtectedRoute>} />
            <Route path="/legacy/app" element={<Navigate to="/legacy/app/home" replace />} />
            <Route path="/legacy/app/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/legacy/app/pipeline" element={<ProtectedRoute><PipelinePage /></ProtectedRoute>} />
            <Route path="/legacy/app/universe" element={<ProtectedRoute><UniversePage /></ProtectedRoute>} />
            <Route path="/legacy/app/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
            <Route path="/legacy/app/companies/:orgnr" element={<ProtectedRoute><CompanyPage /></ProtectedRoute>} />
            <Route path="/legacy" element={<ProtectedRoute><div className="p-4"><a href="/" className="text-blue-600">← Back to app</a></div></ProtectedRoute>} />

            {/* Backward compat: /new/* redirects to equivalent /* routes */}
            <Route path="/new" element={<Navigate to="/" replace />} />
            <Route path="/new/prospects" element={<Navigate to="/prospects" replace />} />
            <Route path="/new/universe" element={<Navigate to="/universe" replace />} />
            <Route path="/new/lists" element={<Navigate to="/lists" replace />} />
            <Route path="/new/lists/:listId" element={<RedirectFromNew to="/lists/:listId" param="listId" />} />
            <Route path="/new/company/:companyId" element={<RedirectFromNew to="/company/:companyId" param="companyId" />} />
            <Route path="/new/ai" element={<Navigate to="/ai" replace />} />
            <Route path="/new/ai/run/create" element={<Navigate to="/ai/run/create" replace />} />
            <Route path="/new/ai/runs/:runId" element={<RedirectFromNew to="/ai/runs/:runId" param="runId" />} />
            <Route path="/new/ai/runs/:runId/results" element={<RedirectFromNew to="/ai/runs/:runId/results" param="runId" />} />
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
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

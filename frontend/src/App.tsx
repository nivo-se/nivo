import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import { AppLayout } from "@/app/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AISourcingDashboard from "./pages/AISourcingDashboard";
import AnalysisPage from "./pages/AnalysisPage";
import CompanyDetail from "./pages/CompanyDetail";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import StyleGuide from "./pages/StyleGuide";
import Valuation from "./pages/Valuation";
import { HomePage } from "@/pages/app/HomePage";
import { UniversePage } from "@/pages/app/UniversePage";
import { PipelinePage } from "@/pages/app/PipelinePage";
import { CompanyPage } from "@/pages/app/CompanyPage";
import { ReportsPage } from "@/pages/app/ReportsPage";
import { RunsPage } from "@/pages/app/RunsPage";
import { AdminPage } from "@/pages/app/AdminPage";
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

const queryClient = new QueryClient();

function RedirectToAppCompany() {
  const { orgnr } = useParams<{ orgnr: string }>();
  return <Navigate to={orgnr ? `/app/companies/${orgnr}` : "/app/home"} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/styleguide" element={<StyleGuide />} />

            {/* Legacy routes — redirect to new backend app */}
            <Route path="/dashboard" element={<Navigate to="/app/home" replace />} />
            <Route path="/admin" element={<Navigate to="/app/admin" replace />} />
            <Route path="/valuation" element={<Navigate to="/app/reports" replace />} />
            <Route path="/analysis" element={<Navigate to="/app/pipeline" replace />} />

            {/* New backend app shell */}
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/app/home" replace />} />
              <Route path="home" element={<HomePage />} />
              <Route path="universe" element={<UniversePage />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="companies/:orgnr" element={<CompanyPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="runs" element={<RunsPage />} />
              <Route path="admin" element={<AdminPage />} />
            </Route>

            {/* Legacy companies route — redirect to app */}
            <Route
              path="/companies/:orgnr"
              element={<RedirectToAppCompany />}
            />

            {/* New Figma UX — parallel under /new/* */}
            <Route
              path="/new"
              element={
                <ProtectedRoute>
                  <NewAppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<NewWorkDashboard />} />
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

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

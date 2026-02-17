import { createBrowserRouter, Navigate } from "react-router";
import Root from "./pages/Root";
import WorkDashboard from "./pages/WorkDashboard";
import Universe from "./pages/Universe";
import MyLists from "./pages/MyLists";
import ListDetail from "./pages/ListDetail";
import Prospects from "./pages/Prospects";
import CompanyDetail from "./pages/CompanyDetail";
import AILab from "./pages/AILab";
import CreateRun from "./pages/CreateRun";
import RunDetail from "./pages/RunDetail";
import RunResults from "./pages/RunResults";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: WorkDashboard },
      { path: "universe", Component: Universe },
      { path: "lists", Component: MyLists },
      { path: "lists/:listId", Component: ListDetail },
      { path: "prospects", Component: Prospects },
      { path: "company/:companyId", Component: CompanyDetail },
      { path: "ai", Component: AILab },
      { path: "ai/run/create", Component: CreateRun },
      { path: "ai/runs/:runId", Component: RunDetail },
      { path: "ai/runs/:runId/results", Component: RunResults },
      // Redirect old AI Lab route to new one
      { path: "ai-lab", element: <Navigate to="/ai" replace /> },
      { path: "admin", Component: Admin },
      { path: "*", Component: NotFound },
    ],
  },
]);
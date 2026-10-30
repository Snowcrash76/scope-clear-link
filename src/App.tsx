import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import ClientProjectView from "./pages/ClientProjectView";
import DemoProjectView from "./pages/DemoProjectView";
import ClientQuote from "./pages/ClientQuote";
import TradeDashboard from "./pages/TradeDashboard";
import ProjectManage from "./pages/ProjectManage";
import ProjectsPage from "./pages/ProjectsPage";
import QuotesPage from "./pages/QuotesPage";
import InvoicesPage from "./pages/InvoicesPage";
import ClientsPage from "./pages/ClientsPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AdminDashboard from "./pages/AdminDashboard";
import { Navigate } from "react-router-dom";
import NotFound from "./pages/NotFound";
import ProfitabilityPage from "./components/job-costing/ProfitabilityPage";
import { EmployeeAccept, EmployeeGate, EmployeeHome, EmployeeJob, EmployeeLogin, EmployeeNotifications, EmployeeTimesheets } from "./components/EmployeePortalUI";
import { TeamHome } from "./components/TeamPortalUI";
import { AppShell } from "./components/AppShell";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/demo" element={<DemoProjectView />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <TradeDashboard />
              </ProtectedRoute>
            } />
            <Route path="/manage/:id" element={
              <ProtectedRoute>
                <ProjectManage />
              </ProtectedRoute>
            } />
            <Route path="/projects" element={
              <ProtectedRoute>
                <ProjectsPage />
              </ProtectedRoute>
            } />
            <Route path="/profitability" element={
              <ProtectedRoute>
                <ProfitabilityPage />
              </ProtectedRoute>
            } />
            <Route path="/quotes" element={
              <ProtectedRoute>
                <QuotesPage />
              </ProtectedRoute>
            } />
            <Route path="/invoices" element={
              <ProtectedRoute>
                <InvoicesPage />
              </ProtectedRoute>
            } />
            <Route path="/clients" element={
              <ProtectedRoute>
                <ClientsPage />
              </ProtectedRoute>
            } />
            <Route path="/project/:id" element={<ClientProjectView />} />
            <Route path="/quote/:token" element={<ClientQuote />} />
            <Route path="/admin" element={
              <ProtectedRoute>
                <AppShell><AdminDashboard /></AppShell>
              </ProtectedRoute>
            } />
            <Route path="/admin/invites" element={<Navigate to="/admin?tab=invites" replace />} />
            <Route path="/employee/login" element={<EmployeeLogin />} />
            <Route path="/employee/accept" element={<EmployeeAccept />} />
            <Route path="/employee" element={<EmployeeGate><EmployeeHome /></EmployeeGate>} />
            <Route path="/employee/week" element={<EmployeeGate><EmployeeHome week /></EmployeeGate>} />
            <Route path="/employee/jobs/:jobId" element={<EmployeeGate><EmployeeJob /></EmployeeGate>} />
            <Route path="/employee/timesheets" element={<EmployeeGate><EmployeeTimesheets /></EmployeeGate>} />
            <Route path="/employee/notifications" element={<EmployeeGate><EmployeeNotifications /></EmployeeGate>} />
            <Route path="/team" element={<ProtectedRoute teamOnly><AppShell><TeamHome /></AppShell></ProtectedRoute>} />
            <Route path="/team/assignments" element={<ProtectedRoute teamOnly><AppShell><TeamHome /></AppShell></ProtectedRoute>} />
            <Route path="/team/timesheets" element={<ProtectedRoute teamOnly><AppShell><TeamHome /></AppShell></ProtectedRoute>} />
            <Route path="/team/permissions" element={<ProtectedRoute teamOnly><AppShell><TeamHome /></AppShell></ProtectedRoute>} />
            <Route path="/team/jobs/:id/:panel" element={<ProtectedRoute teamOnly><AppShell><TeamHome /></AppShell></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;

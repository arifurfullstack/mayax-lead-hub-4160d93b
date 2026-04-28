import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Pending from "./pages/Pending";
import Rejected from "./pages/Rejected";
import Suspended from "./pages/Suspended";
import Dashboard from "./pages/Dashboard";
import Subscription from "./pages/Subscription";
import Wallet from "./pages/Wallet";
import Marketplace from "./pages/Marketplace";
import Orders from "./pages/Orders";
import Settings from "./pages/Settings";
import AutoPay from "./pages/AutoPay";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";
import AdminEmails from "./pages/AdminEmails";
import AdminWebhookTester from "./pages/AdminWebhookTester";
import AdminRejectedLeads from "./pages/AdminRejectedLeads";
import AdminWebhookTemplates from "./pages/AdminWebhookTemplates";
import AdminMakeComGuide from "./pages/AdminMakeComGuide";
import SubmitLead from "./pages/SubmitLead";
import ApplyNow from "./pages/ApplyNow";
import RequestLead from "./pages/RequestLead";
import Unsubscribe from "./pages/Unsubscribe";
import DynamicHead from "./components/DynamicHead";
import { useApplyTheme } from "./hooks/useApplyTheme";

const queryClient = new QueryClient();

const ThemeApplicator = ({ children }: { children: React.ReactNode }) => {
  useApplyTheme();
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeApplicator>
      <DynamicHead />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/apply" element={<SubmitLead />} />
          <Route path="/applynow" element={<ApplyNow />} />
          <Route path="/submit-lead" element={<Navigate to="/apply" replace />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/pending" element={<Pending />} />
          <Route path="/rejected" element={<Rejected />} />
          <Route path="/suspended" element={<Suspended />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/autopay" element={<AutoPay />} />
            <Route path="/request-lead" element={<RequestLead />} />
            <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/emails" element={<ProtectedRoute requireAdmin><AdminEmails /></ProtectedRoute>} />
            <Route path="/admin/webhook-tester" element={<ProtectedRoute requireAdmin><AdminWebhookTester /></ProtectedRoute>} />
            <Route path="/admin/webhook-templates" element={<ProtectedRoute requireAdmin><AdminWebhookTemplates /></ProtectedRoute>} />
            <Route path="/admin/makecom-guide" element={<ProtectedRoute requireAdmin><AdminMakeComGuide /></ProtectedRoute>} />
            <Route path="/admin/rejected-leads" element={<ProtectedRoute requireAdmin><AdminRejectedLeads /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </ThemeApplicator>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

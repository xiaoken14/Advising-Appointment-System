import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import AuthPage from "@/pages/AuthPage";
import StudentDashboard from "@/pages/StudentDashboard";
import AdvisorDashboard from "@/pages/AdvisorDashboard";
import BookAppointmentPage from "@/pages/BookAppointmentPage";
import MyAppointmentsPage from "@/pages/MyAppointmentsPage";
import AvailabilityPage from "@/pages/AvailabilityPage";
import AdvisorAppointmentsPage from "@/pages/AdvisorAppointmentsPage";
import AdvisorQueuePage from "@/pages/AdvisorQueuePage";
import WalkInStudentPage from "@/pages/WalkInStudentPage";
import CaseNotesPage from "@/pages/CaseNotesPage";
import ReferralsPage from "@/pages/ReferralsPage";
import NotificationsPage from "@/pages/NotificationsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRole }: { children: React.ReactNode; allowedRole?: "student" | "advisor" }) {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (allowedRole && role !== allowedRole) return <Navigate to="/" replace />;
  return <DashboardLayout>{children}</DashboardLayout>;
}

function DashboardRouter() {
  const { role } = useAuth();
  if (role === "advisor") return <AdvisorDashboard />;
  return <StudentDashboard />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
      {/* Student routes */}
      <Route path="/book" element={<ProtectedRoute allowedRole="student"><BookAppointmentPage /></ProtectedRoute>} />
      <Route path="/my-appointments" element={<ProtectedRoute allowedRole="student"><MyAppointmentsPage /></ProtectedRoute>} />
      <Route path="/walk-in" element={<ProtectedRoute allowedRole="student"><WalkInStudentPage /></ProtectedRoute>} />
      {/* Advisor routes */}
      <Route path="/availability" element={<ProtectedRoute allowedRole="advisor"><AvailabilityPage /></ProtectedRoute>} />
      <Route path="/appointments" element={<ProtectedRoute allowedRole="advisor"><AdvisorAppointmentsPage /></ProtectedRoute>} />
      <Route path="/queue" element={<ProtectedRoute allowedRole="advisor"><AdvisorQueuePage /></ProtectedRoute>} />
      <Route path="/case-notes" element={<ProtectedRoute allowedRole="advisor"><CaseNotesPage /></ProtectedRoute>} />
      <Route path="/referrals" element={<ProtectedRoute allowedRole="advisor"><ReferralsPage /></ProtectedRoute>} />
      {/* Shared routes */}
      <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

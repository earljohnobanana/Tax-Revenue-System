import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppLayout from "../layouts/AppLayout";
import LoginPage from "../pages/LoginPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import OwnersPage from "../pages/owners/OwnersPage";
import BusinessesPage from "../pages/businesses/BusinessesPage";
import PaymentsPage from "../pages/payments/PaymentsPage";
import RegulatoryFeesPage from "../pages/regulatory/RegulatoryFeesPage";
import AssessmentPage from "../pages/assessment/AssessmentPage";
import DelinquentPage from "../pages/delinquent/DelinquentPage";
import ReceiptsPage from "../pages/receipts/ReceiptsPage";
import ReportsPage from "../pages/reports/ReportsPage";
import AuditLogsPage from "../pages/auditlogs/AuditLogsPage";
import UserManagementPage from "../pages/usermgmt/UserManagementPage";
import SettingsPage from "../pages/settings/SettingsPage";

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"       element={<DashboardPage />} />
        <Route path="owners"          element={<OwnersPage />} />
        <Route path="businesses"      element={<BusinessesPage />} />
        <Route path="payments"        element={<PaymentsPage />} />
        <Route path="regulatory-fees" element={<RegulatoryFeesPage />} />
        <Route path="assessment"      element={<AssessmentPage />} />
        <Route path="delinquent"      element={<DelinquentPage />} />
        <Route path="receipts"        element={<ReceiptsPage />} />
        <Route path="reports"         element={<ReportsPage />} />
        <Route path="audit-logs"      element={<AuditLogsPage />} />
        <Route path="user-management" element={<UserManagementPage />} />
        <Route path="settings"        element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

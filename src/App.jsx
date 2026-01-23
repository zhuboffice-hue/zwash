import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import Bookings from './pages/Bookings';
import Calendar from './pages/Calendar';
import Services from './pages/Services';
import Customers from './pages/Customers';
import Employees from './pages/Employees';
import Expenses from './pages/Expenses';
import Invoices from './pages/Invoices';
import Materials from './pages/Materials';
import MaterialUsageAnalytics from './pages/MaterialUsageAnalytics';
import Payroll from './pages/Payroll';
import Attendance from './pages/Attendance';
import Settings from './pages/Settings';
import CRMHistory from './pages/CRMHistory';
import AMCPlans from './pages/AMCPlans';
import AuditLog from './pages/AuditLog';
import './styles/index.css';

// Protected Route wrapper
const ProtectedRoute = ({ children, permission }) => {
  const { user, userProfile, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="page-loader">
        <div className="loader"></div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return <Navigate to="/login" replace />;
  }

  if (userProfile.needsOnboarding) {
    return <Navigate to="/login" replace />;
  }

  if (userProfile.status === 'pending') {
    return (
      <div className="pending-approval">
        <h2>Account Pending Approval</h2>
        <p>Your account is waiting for admin approval. Please check back later.</p>
      </div>
    );
  }

  if (permission && !hasPermission(permission, 'view') && !hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />

        <Route path="superadmin" element={
          <ProtectedRoute permission="superadmin"><SuperAdminDashboard /></ProtectedRoute>
        } />

        <Route path="calendar" element={
          <ProtectedRoute permission="bookings"><Calendar /></ProtectedRoute>
        } />
        <Route path="bookings" element={
          <ProtectedRoute permission="bookings"><Bookings /></ProtectedRoute>
        } />
        <Route path="services" element={
          <ProtectedRoute permission="services"><Services /></ProtectedRoute>
        } />
        <Route path="customers" element={
          <ProtectedRoute permission="customers"><Customers /></ProtectedRoute>
        } />
        <Route path="employees" element={
          <ProtectedRoute permission="employees"><Employees /></ProtectedRoute>
        } />
        <Route path="expenses" element={
          <ProtectedRoute permission="expenses"><Expenses /></ProtectedRoute>
        } />
        <Route path="invoices" element={
          <ProtectedRoute permission="invoices"><Invoices /></ProtectedRoute>
        } />
        <Route path="payroll" element={
          <ProtectedRoute permission="payroll"><Payroll /></ProtectedRoute>
        } />
        <Route path="materials" element={
          <ProtectedRoute permission="expenses"><Materials /></ProtectedRoute>
        } />
        <Route path="material-usage" element={
          <ProtectedRoute permission="expenses"><MaterialUsageAnalytics /></ProtectedRoute>
        } />
        <Route path="attendance" element={
          <ProtectedRoute permission="attendance"><Attendance /></ProtectedRoute>
        } />        <Route path="audit-log" element={
          <ProtectedRoute permission="audit"><AuditLog /></ProtectedRoute>
        } />        <Route path="settings" element={
          <ProtectedRoute permission="settings"><Settings /></ProtectedRoute>
        } />
        <Route path="crm-history" element={
          <ProtectedRoute permission="customers"><CRMHistory /></ProtectedRoute>
        } />

        <Route path="amc-plans" element={
          <ProtectedRoute permission="services"><AMCPlans /></ProtectedRoute>
        } />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <AppRoutes />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

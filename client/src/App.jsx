import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import { ROLE_HOME, ROLES } from './auth/roles.js';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import StateAdminDashboard from './pages/StateAdminDashboard.jsx';
import DistrictOfficerDashboard from './pages/DistrictOfficerDashboard.jsx';
import PhcStaffDashboard from './pages/PhcStaffDashboard.jsx';
import ManageResourcesPage from './pages/ManageResourcesPage.jsx';

function HomeRedirect() {
  const { ready, isAuthenticated, user } = useAuth();
  if (!ready) {
    return null;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/national"
        element={(
          <ProtectedRoute roles={[ROLES.NATIONAL_ADMIN]}>
            <DashboardPage audience="national" />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/state"
        element={(
          <ProtectedRoute roles={[ROLES.STATE_ADMIN]}>
            <StateAdminDashboard />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/district"
        element={(
          <ProtectedRoute roles={[ROLES.DISTRICT_OFFICER]}>
            <DistrictOfficerDashboard />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/phc/resources"
        element={(
          <ProtectedRoute roles={[ROLES.PHC_STAFF]}>
            <ManageResourcesPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/phc"
        element={(
          <ProtectedRoute roles={[ROLES.PHC_STAFF]}>
            <PhcStaffDashboard />
          </ProtectedRoute>
        )}
      />
      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}

export default App;

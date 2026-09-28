import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import AccessDeniedPage from '../pages/AccessDeniedPage.jsx';

function ProtectedRoute({ roles, children }) {
  const { ready, isAuthenticated, user } = useAuth();
  if (!ready) {
    return null;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <AccessDeniedPage />;
  }
  return children;
}

export default ProtectedRoute;

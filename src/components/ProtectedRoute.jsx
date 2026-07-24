import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Wrap any route element: <ProtectedRoute><Dashboard /></ProtectedRoute>
// Pass allowedRoles={['agent']} to additionally restrict by role.
export function ProtectedRoute({ children, allowedRoles }) {
  const { session, profile, loading } = useAuth();
  

  if (loading) return <div>Loading...</div>;

  if (!session) return <Navigate to="/login" replace />;

  // Profile hasn't loaded yet, or a Google signup never finished picking a role
  if (!profile) return <Navigate to="/select-role" replace />;

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}


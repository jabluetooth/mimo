import { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') {
    return (
      <div className="card">
        <h1>Admins only</h1>
        <p className="subtitle">
          Your account ({user.email}) doesn't have admin access. This page is restricted to admins.
        </p>
        <Link to="/chat" className="secondary-button cta-button">
          Back to chat
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}

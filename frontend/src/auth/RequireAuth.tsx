import { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from './AuthContext';
import { secondaryButtonClass } from '../components/ui';

function Loading() {
  return <div className="py-24 font-mono text-xs text-muted">Loading…</div>;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user.role !== 'admin') {
    return (
      <div className="max-w-2xl py-8">
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-muted">
          <ShieldAlert className="size-4 text-accent" aria-hidden="true" /> admins only
        </p>
        <h1 className="mt-5 text-[clamp(2rem,4.5vw,3.75rem)] font-semibold leading-[0.95] tracking-[-0.04em]">
          This page is for admins.
        </h1>
        <p className="mt-5 max-w-[52ch] leading-relaxed text-muted">
          Your account (<span className="font-mono text-foreground">{user.email}</span>) is a member. Members can chat
          and browse the library; uploading and the dashboard are granted separately.
        </p>
        <Link to="/chat" className={secondaryButtonClass + ' mt-8'}>
          Back to chat
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}

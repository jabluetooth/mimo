import { lazy, Suspense } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { RequireAdmin, RequireAuth } from './auth/RequireAuth';

// Code-split each route so no page pays for another's dependency weight.
const LandingPage = lazy(() => import('./pages/LandingPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));

function AuthNav() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <>
        <NavLink to="/login" className={({ isActive }) => (isActive ? 'active' : '')}>
          Log in
        </NavLink>
        <NavLink to="/signup" className={({ isActive }) => (isActive ? 'active' : '')}>
          Sign up
        </NavLink>
      </>
    );
  }

  return (
    <>
      <NavLink to="/chat" className={({ isActive }) => (isActive ? 'active' : '')}>
        Chat
      </NavLink>
      <NavLink to="/library" className={({ isActive }) => (isActive ? 'active' : '')}>
        Library
      </NavLink>
      {user.role === 'admin' && (
        <>
          <NavLink to="/upload" className={({ isActive }) => (isActive ? 'active' : '')}>
            Upload
          </NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
            Dashboard
          </NavLink>
        </>
      )}
      <button type="button" className="nav-account" title={`${user.email} (${user.role})`} onClick={logout}>
        Log out
      </button>
    </>
  );
}

function AppShell() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          Mimo
        </Link>
        <nav className="app-nav" aria-label="Primary">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Home
          </NavLink>
          <AuthNav />
        </nav>
      </header>

      <main className="app-main">
        <Suspense fallback={<div className="page-loading">Loading…</div>}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route
              path="/chat"
              element={
                <RequireAuth>
                  <ChatPage />
                </RequireAuth>
              }
            />
            <Route
              path="/library"
              element={
                <RequireAuth>
                  <LibraryPage />
                </RequireAuth>
              }
            />
            <Route
              path="/upload"
              element={
                <RequireAdmin>
                  <UploadPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/dashboard"
              element={
                <RequireAdmin>
                  <DashboardPage />
                </RequireAdmin>
              }
            />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

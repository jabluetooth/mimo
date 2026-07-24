import { lazy, Suspense } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';

// Code-split each route so /upload never pays for the chat widget's (Vue-based)
// dependency tree, and /chat never pays for the landing page, and vice versa.
const LandingPage = lazy(() => import('./pages/LandingPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));

export default function App() {
  // The chat widget wants to fill the whole viewport below the header; every
  // other page wants its content vertically centered. Rather than smuggling
  // that decision into every page component, decide it once here from the
  // route and toggle a single modifier class on the shared layout shell.
  const { pathname } = useLocation();
  const isFullBleed = pathname === '/chat';

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
          <NavLink to="/chat" className={({ isActive }) => (isActive ? 'active' : '')}>
            Chat
          </NavLink>
          <NavLink to="/upload" className={({ isActive }) => (isActive ? 'active' : '')}>
            Upload
          </NavLink>
          <NavLink to="/library" className={({ isActive }) => (isActive ? 'active' : '')}>
            Library
          </NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
            Dashboard
          </NavLink>
        </nav>
      </header>

      <main className={`app-main${isFullBleed ? ' app-main--full' : ''}`}>
        <Suspense fallback={<div className="page-loading">Loading…</div>}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

import { lazy, Suspense } from 'react';
import { NavLink, Route, Routes, Navigate } from 'react-router-dom';

// Code-split each route so /upload never pays for the chat widget's (Vue-based)
// dependency tree, and vice versa.
const ChatPage = lazy(() => import('./pages/ChatPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          Mimo <span>Internal Knowledge Assistant — RAG portfolio project</span>
        </div>
        <nav className="app-nav" aria-label="Primary">
          <NavLink to="/chat" className={({ isActive }) => (isActive ? 'active' : '')}>
            Chat
          </NavLink>
          <NavLink to="/upload" className={({ isActive }) => (isActive ? 'active' : '')}>
            Upload
          </NavLink>
        </nav>
      </header>

      <main className="app-main">
        <Suspense fallback={<div className="page-loading">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/upload" element={<UploadPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

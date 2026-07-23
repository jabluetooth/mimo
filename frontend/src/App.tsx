import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import ChatPage from './pages/ChatPage';
import UploadPage from './pages/UploadPage';

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          Mimo <span>Internal Knowledge Assistant — RAG portfolio project</span>
        </div>
        <nav className="app-nav">
          <NavLink to="/chat" className={({ isActive }) => (isActive ? 'active' : '')}>
            Chat
          </NavLink>
          <NavLink to="/upload" className={({ isActive }) => (isActive ? 'active' : '')}>
            Upload
          </NavLink>
        </nav>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/upload" element={<UploadPage />} />
        </Routes>
      </main>
    </div>
  );
}

import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAdmin, RequireAuth } from './auth/RequireAuth';
import { AppLayout, MarketingLayout } from './components/Layouts';

// Code-split each route so no page pays for another's dependency weight.
const LandingPage = lazy(() => import('./pages/LandingPage'));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage'));
const SecurityPage = lazy(() => import('./pages/SecurityPage'));
const RunYourOwnPage = lazy(() => import('./pages/RunYourOwnPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* The public site keeps its own header and footer. */}
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/run-your-own" element={<RunYourOwnPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* The product keeps a persistent app bar. */}
        <Route element={<AppLayout />}>
          <Route path="/chat" element={<RequireAuth><ChatPage /></RequireAuth>} />
          <Route path="/library" element={<RequireAuth><LibraryPage /></RequireAuth>} />
          <Route path="/upload" element={<RequireAdmin><UploadPage /></RequireAdmin>} />
          <Route path="/dashboard" element={<RequireAdmin><DashboardPage /></RequireAdmin>} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

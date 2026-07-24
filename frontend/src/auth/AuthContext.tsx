import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

const SIGNUP_URL = import.meta.env.VITE_AUTH_SIGNUP_URL;
const LOGIN_URL = import.meta.env.VITE_AUTH_LOGIN_URL;
const STORAGE_KEY = 'mimo_auth';

type Role = 'admin' | 'member';
type User = { token: string; email: string; role: Role };

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const user: User = JSON.parse(raw);
    // A JWT's payload is base64url in the middle segment; decode just far
    // enough to drop an expired token proactively rather than waiting for
    // the backend to reject it.
    const payload = JSON.parse(atob(user.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return user;
  } catch {
    return null;
  }
}

async function callAuthEndpoint(url: string, email: string, password: string): Promise<User> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return { token: payload.token, email: payload.email, role: payload.role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(loadStoredUser());
    setLoading(false);
  }, []);

  function persist(u: User) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
  }

  async function login(email: string, password: string) {
    if (!LOGIN_URL) throw new Error('VITE_AUTH_LOGIN_URL is not set.');
    persist(await callAuthEndpoint(LOGIN_URL, email, password));
  }

  async function signup(email: string, password: string) {
    if (!SIGNUP_URL) throw new Error('VITE_AUTH_SIGNUP_URL is not set.');
    persist(await callAuthEndpoint(SIGNUP_URL, email, password));
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }

  const value = useMemo(() => ({ user, loading, login, signup, logout }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

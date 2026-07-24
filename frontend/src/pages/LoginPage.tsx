import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'submitting' | 'error'; message?: string }>({
    kind: 'idle',
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus({ kind: 'submitting' });
    try {
      await login(email, password);
      const from = (location.state as { from?: string } | null)?.from || '/chat';
      navigate(from, { replace: true });
    } catch (err) {
      setStatus({ kind: 'error', message: (err as Error).message });
    }
  }

  return (
    <div className="card">
      <h1>Log in</h1>
      <p className="subtitle">Sign in to chat with the knowledge assistant.</p>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="form-field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <button type="submit" className="primary-button" disabled={status.kind === 'submitting'}>
          {status.kind === 'submitting' ? 'Logging in…' : 'Log in'}
        </button>
        {status.kind === 'error' && <p className="status-message error">{status.message}</p>}
      </form>
      <p className="hint">
        No account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}

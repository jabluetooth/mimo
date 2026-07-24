import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'submitting' | 'error'; message?: string }>({
    kind: 'idle',
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setStatus({ kind: 'error', message: 'Password must be at least 8 characters.' });
      return;
    }
    setStatus({ kind: 'submitting' });
    try {
      await signup(email, password);
      navigate('/chat', { replace: true });
    } catch (err) {
      setStatus({ kind: 'error', message: (err as Error).message });
    }
  }

  return (
    <div className="card">
      <h1>Sign up</h1>
      <p className="subtitle">
        New accounts start as a <strong>member</strong> — enough to chat and browse the library. Admin access
        (upload, dashboard) is granted separately.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="form-field">
          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <button type="submit" className="primary-button" disabled={status.kind === 'submitting'}>
          {status.kind === 'submitting' ? 'Signing up…' : 'Sign up'}
        </button>
        {status.kind === 'error' && <p className="status-message error">{status.message}</p>}
      </form>
      <p className="hint">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}

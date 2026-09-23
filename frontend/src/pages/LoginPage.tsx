import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import Tag from '../components/marketing/Tag';
import { LineReveal, Rise } from '../components/marketing/Reveal';
import { Field, Notice, Spinner, inputClass, primaryButtonClass } from '../components/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'submitting' | 'error'; message?: string }>({
    kind: 'idle',
  });

  useEffect(() => {
    document.title = 'Log in · Mimo';
  }, []);

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
    <section className="px-[5vw] pt-[clamp(2.5rem,6vw,6rem)]">
      <div className="grid gap-[clamp(2.5rem,5vw,5rem)] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
        <div>
          <Rise inView={false}>
            <Tag>log in</Tag>
          </Rise>
          <LineReveal
            as="h1"
            inView={false}
            delay={0.1}
            className="mt-6 text-[clamp(2.5rem,6vw,6.5rem)] font-semibold leading-[0.95] tracking-[-0.04em]"
            lines={['Back to the', 'handbook.']}
          />
          <Rise inView={false} delay={0.4}>
            <p className="mt-8 max-w-[46ch] leading-relaxed text-muted">
              Sign in to chat with the knowledge assistant. Answers only draw on documents your role is allowed to see.
            </p>
          </Rise>
        </div>

        <Rise inView={false} delay={0.3} y={20}>
          <form onSubmit={handleSubmit} className="space-y-5 rounded border border-border bg-surface p-5 sm:p-7">
            <Field id="login-email" label="Email">
              <input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={inputClass} />
            </Field>
            <Field id="login-password" label="Password">
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className={inputClass}
              />
            </Field>
            <button type="submit" className={primaryButtonClass + ' w-full'} disabled={status.kind === 'submitting'}>
              {status.kind === 'submitting' ? <Spinner /> : null}
              {status.kind === 'submitting' ? 'Logging in' : 'Log in'}
              {status.kind !== 'submitting' && <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />}
            </button>
            <div aria-live="polite">
              {status.kind === 'error' && (
                <Notice tone="error" title="Couldn't log in" role="alert">
                  {status.message}
                </Notice>
              )}
            </div>
            <p className="text-sm text-muted">
              No account?{' '}
              <Link to="/signup" className="text-foreground underline decoration-border underline-offset-4 hover:decoration-accent">
                Sign up free
              </Link>
            </p>
          </form>
        </Rise>
      </div>
    </section>
  );
}

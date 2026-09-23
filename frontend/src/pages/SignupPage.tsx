import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import Tag from '../components/marketing/Tag';
import { LineReveal, Rise } from '../components/marketing/Reveal';
import { Field, Notice, Spinner, inputClass, primaryButtonClass } from '../components/ui';

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'submitting' | 'error'; message?: string }>({
    kind: 'idle',
  });

  useEffect(() => {
    document.title = 'Sign up · Mimo';
  }, []);

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
    <section className="px-[5vw] pt-[clamp(2.5rem,6vw,6rem)]">
      <div className="grid gap-[clamp(2.5rem,5vw,5rem)] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
        <div>
          <Rise inView={false}>
            <Tag>sign up</Tag>
          </Rise>
          <LineReveal
            as="h1"
            inView={false}
            delay={0.1}
            className="mt-6 text-[clamp(2.5rem,6vw,6.5rem)] font-semibold leading-[0.95] tracking-[-0.04em]"
            lines={['Ask your first', 'question.']}
          />
          <Rise inView={false} delay={0.4}>
            <p className="mt-8 max-w-[48ch] leading-relaxed text-muted">
              New accounts start as <strong className="font-medium text-foreground">members</strong>: enough to chat and
              browse the library. Uploading and the dashboard are admin access, granted separately.
            </p>
          </Rise>
        </div>

        <Rise inView={false} delay={0.3} y={20}>
          <form onSubmit={handleSubmit} className="space-y-5 rounded border border-border bg-surface p-5 sm:p-7">
            <Field id="signup-email" label="Email">
              <input id="signup-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={inputClass} />
            </Field>
            <Field id="signup-password" label="Password" hint="At least 8 characters.">
              <input
                id="signup-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                aria-describedby="signup-password-hint"
                className={inputClass}
              />
            </Field>
            <button type="submit" className={primaryButtonClass + ' w-full'} disabled={status.kind === 'submitting'}>
              {status.kind === 'submitting' ? <Spinner /> : null}
              {status.kind === 'submitting' ? 'Signing up' : 'Create account'}
              {status.kind !== 'submitting' && <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />}
            </button>
            <div aria-live="polite">
              {status.kind === 'error' && (
                <Notice tone="error" title="Couldn't sign up" role="alert">
                  {status.message}
                </Notice>
              )}
            </div>
            <p className="text-sm text-muted">
              Already have an account?{' '}
              <Link to="/login" className="text-foreground underline decoration-border underline-offset-4 hover:decoration-accent">
                Log in
              </Link>
            </p>
          </form>
        </Rise>
      </div>
    </section>
  );
}

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import Wordmark from '../Wordmark';
import { useAuth } from '../../auth/AuthContext';
import { REPO_URL } from '../../lib/site';

const LINKS = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/security', label: 'Security' },
  { to: '/run-your-own', label: 'Run your own' },
] as const;

export default function SiteHeader() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  // The hairline only appears once content slides under the bar.
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 8));

  return (
    <header
      className={
        'sticky top-0 z-40 bg-background transition-[border-color] duration-200 ' +
        (scrolled || open ? 'border-b border-border' : 'border-b border-transparent')
      }
    >
      <div className="flex items-center justify-between gap-6 px-[5vw] py-4">
        <Link to="/" aria-label="Mimo home">
          <Wordmark />
        </Link>

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-8">
            {LINKS.map(({ to, label }) => {
              const active = pathname === to;
              return (
                <li key={to} className="relative">
                  <Link
                    to={to}
                    aria-current={active ? 'page' : undefined}
                    className={
                      'py-1 font-mono text-xs uppercase tracking-[0.1em] transition-colors ' +
                      (active ? 'text-foreground' : 'text-muted hover:text-foreground')
                    }
                  >
                    {label}
                  </Link>
                  {active && (
                    <motion.span
                      layoutId="site-nav-underline"
                      className="absolute -bottom-0.5 left-0 h-0.5 w-full bg-accent"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          {!user && (
            <Link
              to="/login"
              className="hidden px-2 font-mono text-xs uppercase tracking-[0.1em] text-muted transition-colors hover:text-foreground md:inline"
            >
              Log in
            </Link>
          )}
          <Link
            to={user ? '/chat' : '/signup'}
            className="inline-flex items-center gap-1.5 rounded bg-accent px-3.5 py-2 font-mono text-xs font-medium uppercase tracking-[0.08em] text-accent-foreground transition-transform hover:-translate-y-px active:scale-95"
          >
            {user ? 'Open chat' : 'Try it free'}
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="inline-flex size-9 items-center justify-center rounded border border-border text-muted md:hidden"
          >
            {open ? <X className="size-4" aria-hidden="true" /> : <Menu className="size-4" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-nav"
            aria-label="Mobile"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="border-t border-border bg-background px-[5vw] pb-6 pt-2 md:hidden"
          >
            <ul>
              {[...LINKS, user ? { to: '/chat', label: 'Chat' } : { to: '/login', label: 'Log in' }].map(({ to, label }) => (
                <li key={to} className="border-b border-border">
                  <Link
                    to={to}
                    onClick={() => setOpen(false)}
                    aria-current={pathname === to ? 'page' : undefined}
                    className="block py-4 text-2xl font-semibold tracking-tight"
                  >
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <a href={REPO_URL} target="_blank" rel="noreferrer" className="block py-4 text-2xl font-semibold tracking-tight">
                  GitHub
                </a>
              </li>
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

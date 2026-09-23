import { Suspense, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion, MotionConfig } from 'framer-motion';
import { MessageSquare, Library, Upload, Activity, LogOut } from 'lucide-react';
import SiteHeader from './marketing/SiteHeader';
import SiteFooter from './marketing/SiteFooter';
import Wordmark from './Wordmark';
import { useAuth } from '../auth/AuthContext';

const EASE = [0.16, 1, 0.3, 1] as const;

function PageLoading() {
  return <div className="px-[5vw] py-24 font-mono text-xs text-muted">Loading…</div>;
}

// A single-page app keeps the scroll position between routes; a new page
// should start at the top, like a real navigation.
function useScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
}

function SkipLink({ target }: { target: string }) {
  return (
    <a
      href={`#${target}`}
      className="sr-only z-50 rounded bg-accent px-3 py-2 font-mono text-xs text-accent-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    >
      Skip to content
    </a>
  );
}

/** The public site: header, grain, footer, and a short fade between pages. */
export function MarketingLayout() {
  const { pathname } = useLocation();
  useScrollToTop();
  return (
    <MotionConfig reducedMotion="user">
      <SkipLink target="main" />
      <div className="site-noise" aria-hidden="true" />
      <SiteHeader />
      <main id="main" className="flex-1">
        <Suspense fallback={<PageLoading />}>
          <motion.div key={pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
            <Outlet />
          </motion.div>
        </Suspense>
      </main>
      <SiteFooter />
    </MotionConfig>
  );
}

const APP_NAV = [
  { to: '/chat', label: 'Chat', icon: MessageSquare, admin: false },
  { to: '/library', label: 'Library', icon: Library, admin: false },
  { to: '/upload', label: 'Upload', icon: Upload, admin: true },
  { to: '/dashboard', label: 'Dashboard', icon: Activity, admin: true },
] as const;

/** The product: a persistent app bar with role-aware navigation. */
export function AppLayout() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  useScrollToTop();
  const items = APP_NAV.filter((n) => !n.admin || user?.role === 'admin');

  return (
    <MotionConfig reducedMotion="user">
      <SkipLink target="app-main" />
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-surface px-4 py-2.5 sm:px-6">
        <Link to="/" aria-label="Mimo home">
          <Wordmark />
        </Link>

        <nav aria-label="App" className="min-w-0">
          <ul className="flex items-center gap-0.5 rounded border border-border bg-background p-0.5">
            {items.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  aria-label={label}
                  className={({ isActive }) =>
                    'relative flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors sm:px-3 ' +
                    (isActive ? 'text-accent-foreground' : 'text-muted hover:text-foreground')
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="app-nav-active"
                          className="absolute inset-0 rounded bg-accent"
                          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                        />
                      )}
                      <Icon className="relative z-10 size-3.5 shrink-0" aria-hidden="true" />
                      <span className="relative z-10 hidden sm:inline">{label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {user ? (
          <div className="flex items-center gap-3">
            <span className="hidden text-right font-mono text-[11px] leading-tight text-muted lg:block">
              <span className="block max-w-[16rem] truncate text-foreground">{user.email}</span>
              {user.role}
            </span>
            <button
              type="button"
              onClick={logout}
              title={`Log out ${user.email}`}
              className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 font-mono text-xs uppercase tracking-[0.08em] text-muted transition-colors hover:text-foreground"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        ) : (
          <span />
        )}
      </header>

      <main id="app-main" className="min-w-0 flex-1 px-[5vw] pb-[clamp(4rem,8vw,8rem)] pt-[clamp(2rem,4vw,4rem)]">
        <Suspense fallback={<PageLoading />}>
          <motion.div key={pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: EASE }}>
            <Outlet />
          </motion.div>
        </Suspense>
      </main>
    </MotionConfig>
  );
}

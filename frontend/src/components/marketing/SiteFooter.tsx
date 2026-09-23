import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import Tag from './Tag';
import { Rise } from './Reveal';
import { REPO_URL } from '../../lib/site';

const SITE = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/security', label: 'Security' },
  { to: '/run-your-own', label: 'Run your own' },
] as const;

const APP = [
  { to: '/chat', label: 'Chat' },
  { to: '/library', label: 'Library' },
  { to: '/upload', label: 'Upload' },
  { to: '/dashboard', label: 'Dashboard' },
] as const;

const PEOPLE = [
  { href: 'https://www.filheinzrelatorre.com/', label: 'Portfolio' },
  { href: 'https://ph.linkedin.com/in/filheinzrelatorre', label: 'LinkedIn' },
  { href: 'https://github.com/jabluetooth', label: 'GitHub' },
] as const;

// The closing statement: one big call to action, two plain link rows, and an
// oversized wordmark cropped by the page edge.
export default function SiteFooter() {
  return (
    <footer className="relative mt-[clamp(6rem,14vw,14rem)] overflow-hidden border-t border-border">
      <div className="px-[5vw] pt-[clamp(3rem,7vw,7rem)]">
        <Rise>
          <Tag>next</Tag>
          <Link
            to="/signup"
            className="group mt-5 flex items-end gap-[0.15em] text-[clamp(2.5rem,8vw,8rem)] font-semibold leading-[0.95] tracking-[-0.04em]"
          >
            <span>
              Ask it <span className="whitespace-nowrap">something</span>
            </span>
            <ArrowUpRight
              className="mb-[0.12em] size-[0.7em] shrink-0 text-accent transition-transform duration-300 group-hover:-translate-y-2 group-hover:translate-x-2"
              aria-hidden="true"
            />
          </Link>
        </Rise>

        <div className="mt-[clamp(3rem,6vw,6rem)] grid gap-8 font-mono text-xs uppercase tracking-[0.1em] sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-3">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {SITE.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-muted transition-colors hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-muted transition-colors hover:text-foreground">
                  Source ↗
                </a>
              </li>
            </ul>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {APP.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-muted/80 transition-colors hover:text-foreground">
                    app / {l.label.toLowerCase()}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <p className="max-w-md text-[11px] normal-case leading-relaxed tracking-normal text-muted">
            Built by Fil Heinz O. Re La Torre ·{' '}
            {PEOPLE.map((p, i) => (
              <span key={p.href}>
                <a href={p.href} target="_blank" rel="noreferrer" className="underline decoration-border underline-offset-4 hover:text-foreground">
                  {p.label}
                </a>
                {i < PEOPLE.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </p>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none mt-[clamp(2rem,4vw,4rem)] select-none whitespace-nowrap px-[2vw] font-mono text-[26vw] leading-[0.78] tracking-[-0.06em] text-foreground/[0.05]"
        style={{ transform: 'translateY(16%)' }}
      >
        mimo[1]
      </div>
    </footer>
  );
}

import { Link } from 'react-router-dom';

interface FooterLink {
  label: string;
  to: string;
  external?: boolean;
}

const SITE_LINKS: FooterLink[] = [
  { label: 'Start a chat', to: '/chat' },
  { label: 'Upload a document', to: '/upload' },
  { label: 'Library', to: '/library' },
  { label: 'Sign in', to: '/login' },
];

const SOCIAL_LINKS = [
  { label: 'GitHub', href: 'https://github.com/jabluetooth', Icon: GitHubIcon },
  { label: 'LinkedIn', href: 'https://ph.linkedin.com/in/filheinzrelatorre', Icon: LinkedInIcon },
  { label: 'Instagram', href: 'https://www.instagram.com/fil.tower', Icon: InstagramIcon },
  { label: 'Portfolio', href: 'https://www.filheinzrelatorre.com/', Icon: PortfolioIcon },
];

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h2 className="footer-col-title">{title}</h2>
      <ul className="footer-col-list">
        {links.map((link) => (
          <li key={link.to}>
            {link.external ? (
              <a href={link.to} target="_blank" rel="noopener noreferrer">
                {link.label}
              </a>
            ) : (
              <Link to={link.to}>{link.label}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * App-wide footer, rendered once from AppShell. Same two-panel format as
 * this project's siblings (Insight, Bonny AI) — an accent brand panel plus
 * a glass links panel, both rounded on the top corners only and flush at
 * the bottom instead of floating as closed rectangles — rebuilt against
 * Mimo's own warm-cream/glassmorphism tokens rather than copied wholesale.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand-panel">
          <span className="footer-wordmark">Mimo</span>

          <div className="footer-brand-foot">
            <p className="footer-tagline">Answers with receipts, not guesses.</p>

            <div className="footer-icon-row">
              {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="footer-icon-link"
                >
                  <Icon />
                </a>
              ))}
            </div>

            <p className="footer-copyright">&copy; {year} Mimo by Fil Heinz Re La Torre</p>
          </div>
        </div>

        <nav aria-label="Footer" className="footer-links-panel">
          <FooterColumn title="Site" links={SITE_LINKS} />
        </nav>
      </div>
    </footer>
  );
}

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="18" height="18" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PortfolioIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.4 2.4 3.6 5.4 3.6 9s-1.2 6.6-3.6 9c-2.4-2.4-3.6-5.4-3.6-9s1.2-6.6 3.6-9Z" />
    </svg>
  );
}

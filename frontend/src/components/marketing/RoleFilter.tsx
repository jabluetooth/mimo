import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';

type Role = 'member' | 'admin';

// Illustrative: eight retrieved candidates for "What access do contractors
// get?" with made-up scores. The mechanism is real (Build Grounded Context in
// n8n/mimo-workflow.json): chunks whose visibility the requester's role can't
// see are dropped on the server before ranking, then the top 4 are kept.
const CANDIDATES = [
  { id: 'c1', source: 'security-access-policy.md', score: 0.71, admin: true },
  { id: 'c2', source: 'vendor-onboarding-notes.md', score: 0.63, admin: false },
  { id: 'c3', source: 'security-access-policy.md', score: 0.6, admin: true },
  { id: 'c4', source: 'vendor-contract-changes.md', score: 0.54, admin: false },
  { id: 'c5', source: 'vendor-onboarding-notes.md', score: 0.49, admin: false },
  { id: 'c6', source: 'support-tickets.md', score: 0.33, admin: false },
  { id: 'c7', source: 'pto-policy.md', score: 0.21, admin: false },
  { id: 'c8', source: 'refund-policy.md', score: 0.18, admin: false },
];

export default function RoleFilter() {
  const [role, setRole] = useState<Role>('member');
  const visible = CANDIDATES.filter((c) => role === 'admin' || !c.admin);
  const keep = new Set(visible.slice(0, 4).map((c) => c.id));

  return (
    <figure className="rounded border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="font-mono text-xs text-muted">asked as</span>
        <div role="radiogroup" aria-label="Requester role" className="flex gap-0.5 rounded border border-border bg-background p-0.5">
          {(['member', 'admin'] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={role === r}
              onClick={() => setRole(r)}
              className={
                'relative px-3 py-1 font-mono text-xs uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
                (role === r ? 'text-accent-foreground' : 'text-muted hover:text-foreground')
              }
            >
              {role === r && (
                <motion.span layoutId="role-pill" className="absolute inset-0 rounded bg-accent" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
              )}
              <span className="relative">{r}</span>
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-1.5 p-4" aria-live="polite">
        {CANDIDATES.map((c) => {
          const hidden = c.admin && role === 'member';
          const kept = keep.has(c.id);
          return (
            <motion.li
              key={c.id}
              layout
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className={
                'flex items-center justify-between gap-3 rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ' +
                (hidden ? 'border-dashed border-border text-muted/50' : kept ? 'border-foreground/25' : 'border-border text-muted')
              }
            >
              <span className={'flex min-w-0 items-center gap-2 ' + (hidden ? 'line-through' : '')}>
                {c.admin && <Lock className="size-3 shrink-0 text-accent" aria-label="admin-only" />}
                <span className="truncate">{c.source}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3 tabular-nums">
                <span>{c.score.toFixed(2)}</span>
                <span className={'w-14 text-right ' + (hidden ? '' : kept ? 'text-success' : '')}>
                  {hidden ? 'filtered' : kept ? 'keep' : 'drop'}
                </span>
              </span>
            </motion.li>
          );
        })}
      </ul>
      <figcaption className="border-t border-border px-4 py-3 font-mono text-[11px] leading-relaxed text-muted">
        Illustrative scores. The filter runs in the workflow after retrieval and before ranking, so an admin-only
        passage never reaches the model when a member asks.
      </figcaption>
    </figure>
  );
}

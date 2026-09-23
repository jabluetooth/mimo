import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, TriangleAlert, Info } from 'lucide-react';

// Shared pieces for the product pages (forms, notices, headings), so chat,
// library, upload and the dashboard share one set of controls with the site.

export const inputClass =
  'w-full rounded border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/70 transition-colors hover:border-foreground/25 focus:border-accent focus:outline-none aria-[invalid=true]:border-danger disabled:opacity-60';

export const primaryButtonClass =
  'group inline-flex items-center justify-center gap-2 rounded bg-accent px-5 py-3 font-mono text-sm font-medium uppercase tracking-[0.06em] text-accent-foreground transition-transform hover:-translate-y-0.5 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded border border-border px-3.5 py-2 font-mono text-xs uppercase tracking-[0.08em] text-muted transition-colors hover:border-foreground/30 hover:text-foreground disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

export const monoLabelClass = 'font-mono text-[11px] uppercase tracking-[0.12em] text-muted';

export function PageHead({ tag, title, children, action }: { tag: string; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <span className="inline-block font-mono text-xs uppercase tracking-[0.12em] text-muted">[&nbsp;{tag}&nbsp;]</span>
        <h1 className="mt-4 text-[clamp(2.25rem,5vw,4.5rem)] font-semibold leading-[0.95] tracking-[-0.04em]">{title}</h1>
        {children && <div className="mt-4 max-w-[56ch] leading-relaxed text-muted">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className={'block ' + monoLabelClass}>
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="max-w-[60ch] text-xs leading-relaxed text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

const TONES = {
  error: { Icon: CircleAlert, className: 'border-danger/40 border-l-danger bg-danger/[0.06]', title: 'text-danger' },
  warning: { Icon: TriangleAlert, className: 'border-warning/40 border-l-warning bg-warning/[0.07]', title: 'text-warning' },
  success: { Icon: CircleCheck, className: 'border-success/40 border-l-success bg-success/[0.07]', title: 'text-success' },
  info: { Icon: Info, className: 'border-border border-l-accent bg-surface', title: 'text-accent' },
} as const;

/** A notice with a left rule, an icon and a mono title: state is never colour alone. */
export function Notice({
  tone,
  title,
  children,
  role,
}: {
  tone: keyof typeof TONES;
  title: string;
  children?: ReactNode;
  role?: 'alert' | 'status';
}) {
  const t = TONES[tone];
  return (
    <div role={role} className={'flex gap-3 rounded border border-l-4 p-4 sm:p-5 ' + t.className}>
      <t.Icon className={'mt-0.5 size-4 shrink-0 ' + t.title} aria-hidden="true" />
      <div className="min-w-0 space-y-1.5">
        <p className={'font-mono text-xs uppercase tracking-[0.1em] ' + t.title}>{title}</p>
        {children && <div className="text-sm leading-relaxed text-foreground/90">{children}</div>}
      </div>
    </div>
  );
}

export function Spinner() {
  return <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />;
}

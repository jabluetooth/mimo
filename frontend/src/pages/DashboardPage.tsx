import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/apiFetch';
import { ArrowDown, ArrowUp, TriangleAlert } from 'lucide-react';
import { Notice, PageHead } from '../components/ui';

const DASHBOARD_STATS_URL = import.meta.env.VITE_DASHBOARD_STATS_URL;

type Summary = {
  total: number;
  answered: number;
  refused: number;
  refusalRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  avgConfidence: number;
  borderlineCount: number;
};

type DailyPoint = { day: string; total: number; refused: number };

type RecentQuery = {
  created_at: string;
  question: string;
  outcome: 'answered' | 'refused' | string;
  confidence_score: number;
  latency_ms: number;
};

type Stats = { summary: Summary; daily: DailyPoint[]; recent: RecentQuery[] };

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; stats: Stats };

const TIME_RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'All', days: null as number | null },
];

type SortKey = 'time' | 'confidence' | 'latency';

function formatDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Custom SVG bar chart — two stacked series (answered/refused) per day, 2px
// gap between segments, rounded outer caps, hover+focus tooltip. See dataviz
// notes: status color, not a cycled categorical palette, since these are two
// fixed named states.
function DailyVolumeChart({ daily }: { daily: DailyPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 640;
  const height = 200;
  const padding = { top: 12, right: 12, bottom: 28, left: 12 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const maxTotal = Math.max(...daily.map((d) => d.total), 1);
  // Each day gets an equal-width slot spanning the full chart width (so axis
  // labels stay evenly spaced regardless of how many days there are), but the
  // bar itself is centered within its slot and width-capped — otherwise a
  // sparse range (1-2 days) stretches each slot so wide the bar ends up
  // stranded near one edge with a large dead gap after it, which is what
  // "uneven spacing" was pointing at.
  const slotWidth = daily.length > 0 ? plotWidth / daily.length : 0;
  const barWidth = Math.max(6, Math.min(56, slotWidth * 0.55));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Daily query volume, split into answered and refused"
      className="h-auto w-full max-w-[56rem] overflow-visible"
    >
      <line
        x1={padding.left}
        x2={width - padding.right}
        y1={padding.top + plotHeight}
        y2={padding.top + plotHeight}
        className="stroke-border"
      />
      {daily.map((d, i) => {
        const answered = d.total - d.refused;
        const x = padding.left + i * slotWidth + (slotWidth - barWidth) / 2;
        const answeredHeight = (answered / maxTotal) * plotHeight;
        const refusedHeight = (d.refused / maxTotal) * plotHeight;
        const gap = answered > 0 && d.refused > 0 ? 2 : 0;
        const baseY = padding.top + plotHeight;
        const answeredY = baseY - answeredHeight;
        const refusedY = answeredY - gap - refusedHeight;
        const isHovered = hoverIndex === i;

        return (
          <g
            key={d.day}
            tabIndex={0}
            role="button"
            aria-label={`${formatDay(d.day)}: ${answered} answered, ${d.refused} refused`}
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex(null)}
            onFocus={() => setHoverIndex(i)}
            onBlur={() => setHoverIndex(null)}
            style={{ cursor: 'pointer', outline: 'none' }}
          >
            <rect
              x={padding.left + i * slotWidth}
              y={padding.top}
              width={slotWidth}
              height={plotHeight}
              fill="transparent"
            />
            {answered > 0 && (
              <rect
                x={x}
                y={answeredY}
                width={barWidth}
                height={answeredHeight}
                rx={4}
                className="fill-success"
                opacity={isHovered ? 1 : 0.9}
              />
            )}
            {d.refused > 0 && (
              <rect
                x={x}
                y={refusedY}
                width={barWidth}
                height={refusedHeight}
                rx={4}
                className="fill-muted"
                opacity={isHovered ? 1 : 0.9}
              />
            )}
            <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" className="fill-muted font-mono text-[11px]">
              {formatDay(d.day)}
            </text>
            {isHovered && (
              <g transform={`translate(${x + barWidth / 2}, ${Math.min(refusedY, answeredY) - 8})`}>
                <foreignObject x={-70} y={-46} width={140} height={40}>
                  <div className="rounded border border-border bg-surface px-2 py-1 text-center font-mono text-[11px] leading-snug text-foreground">
                    <strong className="block font-medium">{formatDay(d.day)}</strong>
                    <span>
                      {answered} answered · {d.refused} refused
                    </span>
                  </div>
                </foreignObject>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// A second lens on the same daily data: refusal rate as a percentage over
// time. The PRD calls this out explicitly (§6.5) — "a rising trend signals a
// knowledge-base gap" — which a stacked-volume view doesn't show directly
// once absolute volume also changes day to day.
function RefusalRateChart({ daily }: { daily: DailyPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 640;
  const height = 200;
  const padding = { top: 12, right: 12, bottom: 28, left: 32 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const points = daily.map((d, i) => {
    const rate = d.total > 0 ? d.refused / d.total : 0;
    const x = padding.left + (daily.length === 1 ? plotWidth / 2 : (i / (daily.length - 1)) * plotWidth);
    const y = padding.top + plotHeight - rate * plotHeight;
    return { ...d, rate, x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Refusal rate over time" className="h-auto w-full max-w-[56rem] overflow-visible">
      {[0, 0.5, 1].map((frac) => {
        const y = padding.top + plotHeight - frac * plotHeight;
        return (
          <g key={frac}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="stroke-border" />
            <text x={padding.left - 8} y={y + 3} textAnchor="end" className="fill-muted font-mono text-[11px]">
              {Math.round(frac * 100)}%
            </text>
          </g>
        );
      })}
      <path d={pathD} className="stroke-accent" strokeWidth={2} fill="none" />
      {points.map((p, i) => (
        <g
          key={p.day}
          tabIndex={0}
          role="button"
          aria-label={`${formatDay(p.day)}: ${Math.round(p.rate * 100)}% refusal rate`}
          onMouseEnter={() => setHoverIndex(i)}
          onMouseLeave={() => setHoverIndex(null)}
          onFocus={() => setHoverIndex(i)}
          onBlur={() => setHoverIndex(null)}
          style={{ cursor: 'pointer', outline: 'none' }}
        >
          <rect x={p.x - 10} y={padding.top} width={20} height={plotHeight} fill="transparent" />
          <circle cx={p.x} cy={p.y} r={hoverIndex === i ? 5 : 4} className="fill-accent" />
          <text x={p.x} y={height - 8} textAnchor="middle" className="fill-muted font-mono text-[11px]">
            {formatDay(p.day)}
          </text>
          {hoverIndex === i && (
            <g transform={`translate(${p.x}, ${p.y - 8})`}>
              <foreignObject x={-70} y={-46} width={140} height={40}>
                <div className="rounded border border-border bg-surface px-2 py-1 text-center font-mono text-[11px] leading-snug text-foreground">
                  <strong className="block font-medium">{formatDay(p.day)}</strong>
                  <span>
                    {Math.round(p.rate * 100)}% ({p.refused}/{p.total})
                  </span>
                </div>
              </foreignObject>
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}

function StatTile({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="border-b border-border py-6 pr-6 sm:border-b-0 sm:border-r sm:last:border-r-0 sm:pl-6 sm:first:pl-0">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-2 font-mono text-3xl font-medium tabular-nums tracking-tight">{value}</p>
      {sublabel && <p className="mt-1 font-mono text-xs text-muted">{sublabel}</p>}
    </div>
  );
}

function Segment({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'rounded px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
        (active ? 'bg-accent text-accent-foreground' : 'text-muted hover:text-foreground')
      }
    >
      {children}
    </button>
  );
}

function SortHeader({
  label,
  sortKey,
  activeSort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeSort: { key: SortKey; dir: 'asc' | 'desc' };
  onSort: (key: SortKey) => void;
}) {
  const isActive = activeSort.key === sortKey;
  const Arrow = isActive && activeSort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={isActive ? (activeSort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className="py-3 pr-4 font-normal">
      <button type="button" className="inline-flex items-center gap-1 uppercase hover:text-foreground" onClick={() => onSort(sortKey)}>
        {label}
        <Arrow className={'size-3 ' + (isActive ? 'text-accent' : 'opacity-30')} aria-hidden="true" />
      </button>
    </th>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [rangeDays, setRangeDays] = useState<number | null>(30);
  const [chartView, setChartView] = useState<'volume' | 'refusalRate'>('volume');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'answered' | 'refused'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'time', dir: 'desc' });

  useEffect(() => {
    document.title = 'Dashboard · Mimo';
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => (prev.kind === 'loaded' ? prev : { kind: 'loading' }));

    async function load() {
      if (!DASHBOARD_STATS_URL) {
        setState({
          kind: 'error',
          message:
            'VITE_DASHBOARD_STATS_URL is not set. Copy .env.example to .env and paste in the dashboard-stats webhook URL.',
        });
        return;
      }

      try {
        const url = rangeDays ? `${DASHBOARD_STATS_URL}?days=${rangeDays}` : DASHBOARD_STATS_URL;
        const stats = await apiFetch<Stats>(url, { token: user?.token });
        if (!cancelled) setState({ kind: 'loaded', stats });
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: `Could not reach the dashboard-stats workflow: ${(err as Error).message}`,
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [rangeDays, user]);

  const refusalRatePct = useMemo(() => {
    if (state.kind !== 'loaded') return null;
    return `${Math.round(state.stats.summary.refusalRate * 1000) / 10}%`;
  }, [state]);

  const visibleRows = useMemo(() => {
    if (state.kind !== 'loaded') return [];
    let rows = state.stats.recent;
    if (outcomeFilter !== 'all') rows = rows.filter((r) => r.outcome === outcomeFilter);
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      rows = rows.filter((r) => r.question.toLowerCase().includes(needle));
    }
    const dir = sort.dir === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      if (sort.key === 'time') return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      if (sort.key === 'confidence') return dir * (a.confidence_score - b.confidence_score);
      return dir * (a.latency_ms - b.latency_ms);
    });
    return rows;
  }, [state, outcomeFilter, search, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  }

  const segGroup = 'flex flex-wrap gap-0.5 rounded border border-border bg-background p-0.5';

  return (
    <div className="space-y-[clamp(2.5rem,5vw,4rem)]">
      <PageHead
        tag="dashboard"
        title="Production traffic"
        action={
          <div className={segGroup} role="group" aria-label="Time range">
            {TIME_RANGES.map((r) => (
              <Segment key={r.label} active={rangeDays === r.days} onClick={() => setRangeDays(r.days)}>
                {r.label}
              </Segment>
            ))}
          </div>
        }
      >
        Query volume, latency and refusal rate from real questions, read from the query log.
      </PageHead>

      {state.kind === 'loading' && (
        <p className="border-y border-border py-6 font-mono text-xs text-muted" role="status" aria-live="polite">
          Loading stats…
        </p>
      )}

      {state.kind === 'error' && (
        <Notice tone="error" title="Couldn't load the dashboard" role="status">
          <p>{state.message}</p>
          <p className="mt-2 text-muted">
            This page reads from a separate n8n workflow (<code className="font-mono text-xs">GET /webhook/dashboard-stats</code>) that
            needs to be imported, activated, and published in n8n before it can return real data.
          </p>
        </Notice>
      )}

      {state.kind === 'loaded' && (
        <>
          <section aria-label="Summary" className="grid border-y border-border sm:grid-cols-5">
            <StatTile label="Total queries" value={String(state.stats.summary.total)} />
            <StatTile label="Refusal rate" value={refusalRatePct ?? '—'} sublabel={`${state.stats.summary.refused} of ${state.stats.summary.total}`} />
            <StatTile label="Avg latency" value={`${(state.stats.summary.avgLatencyMs / 1000).toFixed(1)}s`} />
            <StatTile
              label="p95 latency"
              value={`${(state.stats.summary.p95LatencyMs / 1000).toFixed(1)}s`}
              sublabel={`p50 ${(state.stats.summary.p50LatencyMs / 1000).toFixed(1)}s`}
            />
            <StatTile label="Borderline" value={String(state.stats.summary.borderlineCount)} sublabel="confidence 35–55%" />
          </section>

          <section aria-labelledby="daily-heading">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <h2 id="daily-heading" className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                Daily volume
              </h2>
              <div className={segGroup} role="group" aria-label="Chart view">
                <Segment active={chartView === 'volume'} onClick={() => setChartView('volume')}>
                  Volume
                </Segment>
                <Segment active={chartView === 'refusalRate'} onClick={() => setChartView('refusalRate')}>
                  Refusal rate
                </Segment>
              </div>
            </div>

            {state.stats.daily.length === 0 ? (
              <p className="border-y border-border py-6 text-sm text-muted">No queries logged yet.</p>
            ) : (
              <div className="rounded border border-border bg-surface p-5">
                <div className="mb-3 flex gap-5 font-mono text-xs text-muted" aria-hidden="true">
                  {chartView === 'volume' ? (
                    <>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2.5 rounded-sm bg-success" /> answered
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2.5 rounded-sm bg-muted" /> refused
                      </span>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-0.5 w-3 bg-accent" /> % of queries refused
                    </span>
                  )}
                </div>
                {chartView === 'volume' ? <DailyVolumeChart daily={state.stats.daily} /> : <RefusalRateChart daily={state.stats.daily} />}
              </div>
            )}
          </section>

          <section aria-labelledby="recent-heading">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <h2 id="recent-heading" className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                Recent queries · {visibleRows.length} of {state.stats.recent.length}
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <div className={segGroup} role="group" aria-label="Outcome">
                  {(['all', 'answered', 'refused'] as const).map((f) => (
                    <Segment key={f} active={outcomeFilter === f} onClick={() => setOutcomeFilter(f)}>
                      {f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}
                    </Segment>
                  ))}
                </div>
                <input
                  type="search"
                  className="w-56 rounded border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
                  placeholder="Search questions…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search questions"
                />
              </div>
            </div>

            {state.stats.recent.length === 0 ? (
              <p className="border-y border-border py-6 text-sm text-muted">No queries logged yet.</p>
            ) : visibleRows.length === 0 ? (
              <p className="border-y border-border py-6 text-sm text-muted">No queries match this filter.</p>
            ) : (
              <div className="max-h-[36rem] overflow-auto border-t border-border">
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b border-border font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                      <SortHeader label="Time" sortKey="time" activeSort={sort} onSort={toggleSort} />
                      <th scope="col" className="py-3 pr-4 font-normal">Question</th>
                      <th scope="col" className="py-3 pr-4 font-normal">Outcome</th>
                      <SortHeader label="Confidence" sortKey="confidence" activeSort={sort} onSort={toggleSort} />
                      <SortHeader label="Latency" sortKey="latency" activeSort={sort} onSort={toggleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((q, i) => (
                      <tr key={i} className="border-b border-border align-baseline">
                        <td className="whitespace-nowrap py-3 pr-4 font-mono text-xs text-muted">{formatTimestamp(q.created_at)}</td>
                        <td className="py-3 pr-4">{q.question}</td>
                        <td className={'py-3 pr-4 font-mono text-xs ' + (q.outcome === 'answered' ? 'text-success' : 'text-foreground')}>
                          {q.outcome === 'answered' ? '● ' : '○ '}
                          {q.outcome}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4 font-mono text-xs tabular-nums">
                          {Math.round(q.confidence_score * 100)}%
                          {q.confidence_score >= 0.35 && q.confidence_score <= 0.55 && (
                            <span className="ml-1.5 inline-flex translate-y-0.5 text-warning" title="Borderline confidence (35–55%)">
                              <TriangleAlert className="size-3.5" aria-label="borderline" />
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap py-3 font-mono text-xs tabular-nums text-muted">{(q.latency_ms / 1000).toFixed(1)}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="max-w-[80ch] font-mono text-[11px] leading-relaxed text-muted">
            Cost per query and error/retry rate aren&apos;t shown: token cost isn&apos;t logged by the query workflow yet,
            and only executions that reach the logging step are captured, so a hard n8n failure upstream wouldn&apos;t
            appear here.
          </p>
        </>
      )}
    </div>
  );
}

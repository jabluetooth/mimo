import { useEffect, useMemo, useState } from 'react';

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
      className="daily-chart"
    >
      <line
        x1={padding.left}
        x2={width - padding.right}
        y1={padding.top + plotHeight}
        y2={padding.top + plotHeight}
        className="chart-baseline"
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
                className="bar-segment bar-segment--answered"
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
                className="bar-segment bar-segment--refused"
                opacity={isHovered ? 1 : 0.9}
              />
            )}
            <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" className="chart-axis-label">
              {formatDay(d.day)}
            </text>
            {isHovered && (
              <g transform={`translate(${x + barWidth / 2}, ${Math.min(refusedY, answeredY) - 8})`}>
                <foreignObject x={-70} y={-46} width={140} height={40}>
                  <div className="chart-tooltip">
                    <strong>{formatDay(d.day)}</strong>
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
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Refusal rate over time" className="daily-chart">
      {[0, 0.5, 1].map((frac) => {
        const y = padding.top + plotHeight - frac * plotHeight;
        return (
          <g key={frac}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="chart-gridline" />
            <text x={padding.left - 8} y={y + 3} textAnchor="end" className="chart-axis-label">
              {Math.round(frac * 100)}%
            </text>
          </g>
        );
      })}
      <path d={pathD} className="rate-line" fill="none" />
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
          <circle cx={p.x} cy={p.y} r={hoverIndex === i ? 5 : 4} className="rate-dot" />
          <text x={p.x} y={height - 8} textAnchor="middle" className="chart-axis-label">
            {formatDay(p.day)}
          </text>
          {hoverIndex === i && (
            <g transform={`translate(${p.x}, ${p.y - 8})`}>
              <foreignObject x={-70} y={-46} width={140} height={40}>
                <div className="chart-tooltip">
                  <strong>{formatDay(p.day)}</strong>
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
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sublabel && <span className="stat-sublabel">{sublabel}</span>}
    </div>
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
  return (
    <th>
      <button type="button" className="sort-header" onClick={() => onSort(sortKey)}>
        {label}
        <span className={`sort-arrow${isActive ? ' sort-arrow--active' : ''}`}>
          {isActive && activeSort.dir === 'asc' ? '↑' : '↓'}
        </span>
      </button>
    </th>
  );
}

export default function DashboardPage() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [rangeDays, setRangeDays] = useState<number | null>(30);
  const [chartView, setChartView] = useState<'volume' | 'refusalRate'>('volume');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'answered' | 'refused'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'time', dir: 'desc' });

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
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const stats: Stats = await response.json();
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
  }, [rangeDays]);

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

  return (
    <div className="dashboard-page">
      <div className="library-header">
        <h1>Dashboard</h1>
        <p className="subtitle">Query volume, latency, and refusal rate from real production traffic.</p>
      </div>

      <div className="library-panel">
        <div className="dashboard-block dashboard-block--controls">
          <div className="filter-row" role="group" aria-label="Time range">
            <span className="filter-row-label">Time range</span>
            {TIME_RANGES.map((r) => (
              <button
                key={r.label}
                type="button"
                className={`segment${rangeDays === r.days ? ' segment--active' : ''}`}
                onClick={() => setRangeDays(r.days)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {state.kind === 'loading' && (
          <p className="library-status" role="status" aria-live="polite">
            Loading stats...
          </p>
        )}

        {state.kind === 'error' && (
          <div className="library-status library-status--error" role="status" aria-live="polite">
            <p>{state.message}</p>
            <p className="hint">
              This page reads from a separate n8n workflow (<code>GET /webhook/dashboard-stats</code>)
              that needs to be imported, activated, and published in n8n before it can return real data.
            </p>
          </div>
        )}

        {state.kind === 'loaded' && (
          <>
            <div className="dashboard-block">
              <div className="stat-grid">
                <StatTile label="Total queries" value={String(state.stats.summary.total)} />
                <StatTile
                  label="Refusal rate"
                  value={refusalRatePct ?? '—'}
                  sublabel={`${state.stats.summary.refused} of ${state.stats.summary.total}`}
                />
                <StatTile label="Avg latency" value={`${(state.stats.summary.avgLatencyMs / 1000).toFixed(1)}s`} />
                <StatTile
                  label="p95 latency"
                  value={`${(state.stats.summary.p95LatencyMs / 1000).toFixed(1)}s`}
                  sublabel={`p50 ${(state.stats.summary.p50LatencyMs / 1000).toFixed(1)}s`}
                />
                <StatTile
                  label="Borderline calls"
                  value={String(state.stats.summary.borderlineCount)}
                  sublabel="confidence 35-55%"
                />
              </div>
            </div>

            <div className="dashboard-block">
              <div className="section-head-row">
                <h2 className="dashboard-section-title">Daily volume</h2>
                <div className="filter-row filter-row--compact" role="group" aria-label="Chart view">
                  <button
                    type="button"
                    className={`segment segment--sm${chartView === 'volume' ? ' segment--active' : ''}`}
                    onClick={() => setChartView('volume')}
                  >
                    Volume
                  </button>
                  <button
                    type="button"
                    className={`segment segment--sm${chartView === 'refusalRate' ? ' segment--active' : ''}`}
                    onClick={() => setChartView('refusalRate')}
                  >
                    Refusal rate
                  </button>
                </div>
              </div>

              {state.stats.daily.length === 0 ? (
                <p className="library-status">No queries logged yet.</p>
              ) : (
                <div className="chart-wrap">
                  {chartView === 'volume' ? (
                    <div className="chart-legend" aria-hidden="true">
                      <span className="legend-item">
                        <span className="legend-swatch legend-swatch--answered" /> Answered
                      </span>
                      <span className="legend-item">
                        <span className="legend-swatch legend-swatch--refused" /> Refused
                      </span>
                    </div>
                  ) : (
                    <div className="chart-legend" aria-hidden="true">
                      <span className="legend-item">
                        <span className="legend-swatch legend-swatch--refused" /> % of queries refused
                      </span>
                    </div>
                  )}
                  {chartView === 'volume' ? (
                    <DailyVolumeChart daily={state.stats.daily} />
                  ) : (
                    <RefusalRateChart daily={state.stats.daily} />
                  )}
                </div>
              )}
            </div>

            <div className="dashboard-block">
              <div className="section-head-row">
                <h2 className="dashboard-section-title">Recent queries</h2>
                <span className="table-count">
                  {visibleRows.length} of {state.stats.recent.length}
                </span>
              </div>

              <div className="filter-row">
                {(['all', 'answered', 'refused'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`segment segment--sm${outcomeFilter === f ? ' segment--active' : ''}`}
                    onClick={() => setOutcomeFilter(f)}
                  >
                    {f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}
                  </button>
                ))}
                <input
                  type="search"
                  className="filter-search"
                  placeholder="Search questions…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search questions"
                />
              </div>

              {state.stats.recent.length === 0 ? (
                <p className="library-status">No queries logged yet.</p>
              ) : visibleRows.length === 0 ? (
                <p className="library-status">No queries match this filter.</p>
              ) : (
                <div className="table-scroll table-scroll--tall">
                <table className="recent-table">
                  <thead>
                    <tr>
                      <SortHeader label="Time" sortKey="time" activeSort={sort} onSort={toggleSort} />
                      <th>Question</th>
                      <th>Outcome</th>
                      <SortHeader label="Confidence" sortKey="confidence" activeSort={sort} onSort={toggleSort} />
                      <SortHeader label="Latency" sortKey="latency" activeSort={sort} onSort={toggleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((q, i) => (
                      <tr key={i}>
                        <td className="cell-muted">{formatTimestamp(q.created_at)}</td>
                        <td className="cell-question">{q.question}</td>
                        <td>
                          <span className={`outcome-badge outcome-badge--${q.outcome}`}>{q.outcome}</span>
                        </td>
                        <td className="cell-muted">
                          {Math.round(q.confidence_score * 100)}%
                          {q.confidence_score >= 0.35 && q.confidence_score <= 0.55 && (
                            <span className="borderline-flag" title="Borderline confidence (35-55%)">
                              !
                            </span>
                          )}
                        </td>
                        <td className="cell-muted">{(q.latency_ms / 1000).toFixed(1)}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </div>

            <p className="hint">
              Cost-per-query and error/retry rate aren't shown — token cost isn't currently logged by the
              ingestion/query workflow, and only executions that reach the logging step are captured (a
              hard n8n execution failure upstream wouldn't appear here). See{' '}
              <a href="https://github.com/jabluetooth/mimo/blob/master/SCORECARD.md">SCORECARD.md</a> for
              known gaps.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

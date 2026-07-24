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

// Custom SVG bar chart rather than a charting library — two stacked series
// (answered/refused) per day, 2px gap between segments, rounded outer caps,
// hover+focus tooltip. See dataviz notes: sequential/status color, not a
// cycled categorical palette, since these are two fixed named states.
function DailyVolumeChart({ daily }: { daily: DailyPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 640;
  const height = 200;
  const padding = { top: 12, right: 12, bottom: 28, left: 12 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const maxTotal = Math.max(...daily.map((d) => d.total), 1);
  const barGap = 8;
  const barWidth = daily.length > 0 ? Math.min(48, plotWidth / daily.length - barGap) : 0;

  return (
    <div className="chart-wrap">
      <div className="chart-legend" aria-hidden="true">
        <span className="legend-item">
          <span className="legend-swatch legend-swatch--answered" /> Answered
        </span>
        <span className="legend-item">
          <span className="legend-swatch legend-swatch--refused" /> Refused
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Daily query volume, split into answered and refused"
        className="daily-chart"
      >
        {daily.map((d, i) => {
          const answered = d.total - d.refused;
          const x = padding.left + i * (plotWidth / daily.length) + barGap / 2;
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
              {/* Wider invisible hit target, easier than the thin bar itself to hover/focus */}
              <rect x={x - 4} y={padding.top} width={barWidth + 8} height={plotHeight} fill="transparent" />
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
                      <span>{answered} answered · {d.refused} refused</span>
                    </div>
                  </foreignObject>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
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

export default function DashboardPage() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

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
        const response = await fetch(DASHBOARD_STATS_URL);
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
  }, []);

  const refusalRatePct = useMemo(() => {
    if (state.kind !== 'loaded') return null;
    return `${Math.round(state.stats.summary.refusalRate * 1000) / 10}%`;
  }, [state]);

  return (
    <div className="dashboard-page">
      <div className="library-header">
        <h1>Dashboard</h1>
        <p className="subtitle">Query volume, latency, and refusal rate from real production traffic.</p>
      </div>

      <div className="library-panel">
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
            </div>

            <h2 className="dashboard-section-title">Daily volume</h2>
            {state.stats.daily.length === 0 ? (
              <p className="library-status">No queries logged yet.</p>
            ) : (
              <DailyVolumeChart daily={state.stats.daily} />
            )}

            <h2 className="dashboard-section-title">Recent queries</h2>
            {state.stats.recent.length === 0 ? (
              <p className="library-status">No queries logged yet.</p>
            ) : (
              <div className="table-scroll">
                <table className="recent-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Question</th>
                      <th>Outcome</th>
                      <th>Confidence</th>
                      <th>Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.stats.recent.map((q, i) => (
                      <tr key={i}>
                        <td className="cell-muted">{formatTimestamp(q.created_at)}</td>
                        <td className="cell-question">{q.question}</td>
                        <td>
                          <span className={`outcome-badge outcome-badge--${q.outcome}`}>{q.outcome}</span>
                        </td>
                        <td className="cell-muted">{Math.round(q.confidence_score * 100)}%</td>
                        <td className="cell-muted">{(q.latency_ms / 1000).toFixed(1)}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

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

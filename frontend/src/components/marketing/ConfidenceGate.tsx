import { motion } from 'framer-motion';
import { EASE } from './Reveal';

const MIN = 0.3;
const MAX = 0.9;
const GATE = 0.45;
const OLD_GATE = 0.5;

const pos = (v: number) => ((v - MIN) / (MAX - MIN)) * 100;

// The top relevance score of every answered question in the 30-question eval
// run against the live deployment (seed/eval/results-baseline.json), after
// the threshold moved from 0.50 to 0.45. `refuse` marks questions the eval
// expected Mimo to refuse. Refused replies don't report a score, so those six
// are counted, not plotted: four the eval expected, two false refusals.
const ANSWERED: { v: number; refuse?: boolean }[] = [
  { v: 0.75 }, { v: 0.69 }, { v: 0.51 }, { v: 0.64 }, { v: 0.65 }, { v: 0.71 }, { v: 0.76 }, { v: 0.66 },
  { v: 0.68 }, { v: 0.68 }, { v: 0.52 }, { v: 0.71 }, { v: 0.65 }, { v: 0.82 }, { v: 0.72 }, { v: 0.68 },
  { v: 0.7 }, { v: 0.71 }, { v: 0.71 }, { v: 0.49 }, { v: 0.5 }, { v: 0.59 }, { v: 0.56 }, { v: 0.47, refuse: true },
];
const REFUSED = { expected: 4, falseRefusals: 2 };

// Stack equal scores upward so every point stays visible.
const seen = new Map<number, number>();
const POINTS = [...ANSWERED]
  .sort((a, b) => a.v - b.v)
  .map((p) => {
    const n = seen.get(p.v) ?? 0;
    seen.set(p.v, n + 1);
    return { ...p, stack: n };
  });

const TICKS = [0.3, 0.45, 0.6, 0.75, 0.9];

export default function ConfidenceGate() {
  return (
    <figure>
      <div className="relative h-60 select-none">
        {/* zones */}
        <div className="absolute inset-y-0 left-0 bg-foreground/[0.04]" style={{ width: `${pos(GATE)}%` }} />
        <div className="absolute inset-y-0 right-0 bg-success/[0.06]" style={{ width: `${100 - pos(GATE)}%` }} />
        <span className="absolute left-3 top-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">refuses</span>
        <span className="absolute right-3 top-3 font-mono text-[11px] uppercase tracking-[0.12em] text-success">answers + cites</span>

        {/* refused questions don't report a score: counted, not plotted */}
        <motion.div
          className="absolute left-3 top-[42%] flex flex-wrap gap-1"
          style={{ width: `calc(${pos(GATE)}% - 1.5rem)` }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-15% 0px' }}
          transition={{ delay: 0.6 }}
        >
          {Array.from({ length: REFUSED.expected }).map((_, i) => (
            <span key={`e${i}`} className="block size-2.5 rounded-sm border-2 border-accent" />
          ))}
          {Array.from({ length: REFUSED.falseRefusals }).map((_, i) => (
            <span key={`f${i}`} className="block size-2.5 rounded-sm bg-success" />
          ))}
          <span className="basis-full pt-1.5 font-mono text-[10px] leading-tight text-muted">
            {REFUSED.expected + REFUSED.falseRefusals} refused, no score reported · {REFUSED.falseRefusals} should have answered
          </span>
        </motion.div>

        {/* the old line, and the gate it moved to */}
        <div className="absolute inset-y-0 w-px border-l border-dashed border-foreground/40" style={{ left: `${pos(OLD_GATE)}%` }} />
        <span className="absolute top-9 -translate-x-1/2 whitespace-nowrap bg-background px-1 font-mono text-[10px] text-muted" style={{ left: `${pos(OLD_GATE)}%` }}>
          was 0.50
        </span>
        <motion.div
          aria-hidden="true"
          className="absolute inset-y-0 w-px origin-top bg-foreground"
          style={{ left: `${pos(GATE)}%` }}
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true, margin: '-15% 0px' }}
          transition={{ duration: 0.8, ease: EASE }}
        />
        <span className="absolute bottom-3 -translate-x-1/2 whitespace-nowrap bg-background px-1.5 font-mono text-[11px]" style={{ left: `${pos(GATE)}%` }}>
          gate 0.45
        </span>

        {/* axis */}
        <div className="absolute inset-x-0 top-[72%] h-px bg-border" />
        {TICKS.filter((t) => t !== GATE).map((t) => (
          <span key={t} className="absolute top-[72%] -translate-x-1/2 pt-2 font-mono text-[11px] text-muted" style={{ left: `${pos(t)}%` }}>
            {t.toFixed(2)}
          </span>
        ))}

        {/* scores: filled = should answer, hollow = eval expected a refusal */}
        {POINTS.map((p, i) => (
          <motion.div
            key={`${p.v}-${p.stack}`}
            role="img"
            aria-label={`Score ${p.v}${p.refuse ? ', should have been refused' : ''}`}
            tabIndex={0}
            className="group absolute -ml-[6px] focus-visible:outline-none"
            style={{ left: `${pos(p.v)}%`, top: `calc(72% - 6px - ${p.stack * 14}px)` }}
            initial={{ opacity: 0, y: -60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-15% 0px' }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.4 + i * 0.03 }}
          >
            <span
              className={
                'block size-3 rounded-full border-2 transition-transform group-hover:scale-125 group-focus-visible:scale-125 group-focus-visible:ring-2 group-focus-visible:ring-accent ' +
                (p.refuse ? 'border-accent bg-background' : 'border-success bg-success')
              }
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-surface px-2 py-1 font-mono text-[11px] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {p.v.toFixed(2)}
              {p.refuse ? ' · should have refused' : ''}
            </span>
          </motion.div>
        ))}
      </div>
      <figcaption className="mt-4 max-w-[70ch] font-mono text-xs leading-relaxed text-muted">
        Top relevance score of each answered question in the 30-question eval, against the live system. Filled: the
        eval expected an answer. Hollow: it expected a refusal, and that one at 0.47 slipped through once the line moved.
        One person&apos;s test set, not a benchmark.
      </figcaption>
    </figure>
  );
}

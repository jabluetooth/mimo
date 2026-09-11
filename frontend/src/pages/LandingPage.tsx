import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';

// Shared eyebrow-label treatment (small-caps accent tag), reused across the
// hero and the two content sections below it instead of three near-duplicate
// class strings.
const EYEBROW = 'text-[13px] font-bold uppercase tracking-[0.6px] text-accent';

type PipelineStep = { n: string; title: string; body: string };

// Grounded in the retrieval pipeline described in the project README
// (Ingestion/Query flowchart) — not invented marketing steps.
const PIPELINE_STEPS: PipelineStep[] = [
  {
    n: '01',
    title: 'Retrieve',
    body: 'Your question is embedded and matched against the private knowledge base in Qdrant.',
  },
  {
    n: '02',
    title: 'Rerank',
    body: 'A cross-encoder reranks the top candidates so the most relevant passage rises to #1.',
  },
  {
    n: '03',
    title: 'Confidence gate',
    body: 'Below the confidence threshold, Mimo refuses instead of guessing — and logs the gap.',
  },
  {
    n: '04',
    title: 'Answer',
    body: 'Above it, Mimo generates a grounded answer with per-claim citations back to the source.',
  },
];

type ResultStat = { label: string; value: string; sublabel: string };

// Pulled directly from the README's "Results" table (measured against the
// live production system) — no numbers here are invented.
const RESULT_STATS: ResultStat[] = [
  { label: 'Retrieval accuracy', value: '100%', sublabel: '25/25 — expected doc in top-4 reranked chunks' },
  { label: 'Prompt-injection resistance', value: '12/12', sublabel: 'adversarial suite, fully blocked' },
  { label: 'False-refusal rate', value: '12% → 8%', sublabel: 'after a diagnosed threshold fix' },
  { label: 'Citation coverage', value: '88% → 92%', sublabel: 'answers with a source citation present' },
];

export default function LandingPage() {
  const heroRef = useRef<HTMLElement>(null);

  // One deliberate entrance moment: the hero content and sample-answer card
  // stagger in on load. Respects prefers-reduced-motion by skipping the
  // animation entirely (elements simply render in their final state).
  useLayoutEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !heroRef.current) return;

    const targets = heroRef.current.querySelectorAll<HTMLElement>('[data-hero-in]');
    if (targets.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.set(targets, { opacity: 0, y: 18 });
      gsap.to(targets, {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.09,
        delay: 0.05,
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="flex w-full max-w-[880px] flex-col gap-16 py-6 pb-12 sm:py-8">
      {/* Hero */}
      <section ref={heroRef} className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <p className={`${EYEBROW} mb-3`} data-hero-in>
            RAG internal knowledge assistant
          </p>
          <h1 className="m-0 mb-4 text-balance text-[clamp(2rem,4.2vw,3rem)] leading-[1.1]" data-hero-in>
            Ask your internal docs a question. Get an answer with receipts.
          </h1>
          <p className="m-0 max-w-[52ch] text-base leading-relaxed text-muted" data-hero-in>
            Mimo is a retrieval-augmented generation assistant: it answers questions from a private knowledge base
            and cites where each answer came from, or says so plainly when it doesn&apos;t know.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start" data-hero-in>
            <Link to="/chat" className="primary-button cta-button">
              Start a chat
            </Link>
            <Link to="/upload" className="secondary-button cta-button">
              Upload a document
            </Link>
          </div>
        </div>

        <figure
          className="m-0 w-full rounded-[20px] border border-[var(--glass-border-warm)] bg-white/70 p-6 shadow-[var(--shadow-glass)] [-webkit-backdrop-filter:var(--glass-blur)] [backdrop-filter:var(--glass-blur)] sm:p-7"
          data-hero-in
        >
          <span className={`${EYEBROW} mb-4 block`}>Sample interaction</span>
          <div className="flex flex-col gap-5">
            <div className="turn">
              <span className="turn-label">You</span>
              <p className="turn-body turn-body--question">How many vacation days carry over into next year?</p>
            </div>
            <div className="turn">
              <span className="turn-label">Mimo</span>
              <div className="turn-body">
                <span className="status-pill status-pill--grounded">Grounded · 94% confidence</span>
                <div className="answer-text">
                  <p>
                    Up to 5 unused vacation days carry over into the next calendar year — anything beyond that is
                    forfeited on January 1.<sup className="citation-marker">[1]</sup>
                  </p>
                </div>
                <div className="sources-list" aria-label="Sources">
                  <span className="source-chip">
                    <span className="citation-marker">[1]</span> pto-policy
                    <span className="source-chip-meta">Carryover · updated Aug 2026</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <figcaption className="mt-5 text-xs text-muted">Illustrative example — not a live query.</figcaption>
        </figure>
      </section>

      {/* How it works */}
      <section
        aria-labelledby="pipeline-heading"
        className="flex flex-col gap-8 border-t border-[var(--glass-border-warm)] pt-10"
      >
        <div className="max-w-prose">
          <p className={EYEBROW}>How it works</p>
          <h2 id="pipeline-heading" className="m-0 mt-2 text-2xl sm:text-3xl">
            Retrieval you can audit, not a black box.
          </h2>
        </div>
        <ol className="m-0 grid grid-cols-1 list-none gap-8 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {PIPELINE_STEPS.map((step) => (
            <li key={step.n} className="flex flex-col gap-2">
              <span aria-hidden="true" className="font-display text-4xl italic leading-none text-accent-raw/35">
                {step.n}
              </span>
              <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-text">{step.title}</h3>
              <p className="m-0 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Results */}
      <section
        aria-labelledby="results-heading"
        className="flex flex-col gap-6 border-t border-[var(--glass-border-warm)] pt-10"
      >
        <div className="max-w-prose">
          <p className={EYEBROW}>Measured, not guessed</p>
          <h2 id="results-heading" className="m-0 mt-2 text-2xl sm:text-3xl">
            Results from the live production system.
          </h2>
          <p className="m-0 mt-3 text-base leading-relaxed text-muted">
            These numbers come from a 30-question ground-truth eval plus a 12-case adversarial suite, run against
            the live deployment — not a local mock.
          </p>
        </div>
        <div className="stat-grid">
          {RESULT_STATS.map((stat) => (
            <div className="stat-tile" key={stat.label}>
              <span className="stat-label">{stat.label}</span>
              <span className="stat-value">{stat.value}</span>
              <span className="stat-sublabel">{stat.sublabel}</span>
            </div>
          ))}
        </div>
        <a
          href="https://github.com/jabluetooth/mimo"
          target="_blank"
          rel="noopener noreferrer"
          className="self-start text-sm font-semibold text-accent-2 hover:underline"
        >
          Read the eval methodology on GitHub →
        </a>
      </section>
    </div>
  );
}

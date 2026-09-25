import { useEffect } from 'react';
import Tag from '../components/marketing/Tag';
import { LineReveal, Rise } from '../components/marketing/Reveal';
import Pipeline from '../components/marketing/Pipeline';

const ABLATION = [
  ['False refusals', '12%', '8%'],
  ['Correct refusals', '100%', '80%'],
  ['Citation present', '88%', '92%'],
  ['Expected facts covered', '78%', '84%'],
  ['Expected document retrieved', '100%', '100%'],
] as const;

const RELIABILITY = [
  ['Empty replies', '23%', '0%'],
  ['Expected document retrieved', '64%', '92%'],
  ['Citation present', '64%', '92%'],
  ['p95 latency', '4.9 s', '11.5 s'],
] as const;

const NOT_MEASURED = [
  ['Cost per query', 'Token cost isn’t logged by the workflow yet'],
  ['Errors on the dashboard', 'The eval measures error rate, but the live dashboard only counts executions that reach the logging step'],
  ['Hybrid search', 'Retrieval is vector-only; keyword matching would help exact terms like policy codes'],
  ['Scheduled sync', 'Documents arrive by upload, not from a watched Drive folder'],
] as const;

export default function HowItWorksPage() {
  useEffect(() => {
    document.title = 'How it works · Mimo';
  }, []);

  return (
    <>
      <section className="px-[5vw] pb-[clamp(2rem,4vw,4rem)] pt-[clamp(2.5rem,6vw,6rem)]">
        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-16">
          <div>
            <Rise inView={false}>
              <Tag>pipeline</Tag>
            </Rise>
            <LineReveal
              as="h1"
              inView={false}
              delay={0.1}
              className="mt-6 text-[clamp(2.75rem,8vw,8.5rem)] font-semibold leading-[0.93] tracking-[-0.045em]"
              lines={['From a file', 'to a footnote.']}
            />
          </div>
          <Rise inView={false} delay={0.45}>
            <p className="max-w-[40ch] leading-relaxed text-muted">
              Eight stages, all in one n8n workflow. Scroll and each lights up with what it does and the numbers it
              runs on, read from the workflow itself.
            </p>
          </Rise>
        </div>
      </section>

      <section className="px-[5vw] pt-[clamp(1rem,3vw,3rem)]">
        <Pipeline />
      </section>

      <section className="px-[5vw] pt-[clamp(5rem,11vw,11rem)]">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Tag>the fix</Tag>
            <LineReveal
              className="mt-5 text-[clamp(2rem,4.4vw,4.25rem)] font-semibold leading-[1] tracking-[-0.035em]"
              lines={['0.50 to 0.45,', 'and what', 'it cost.']}
            />
            <Rise delay={0.2}>
              <p className="mt-6 max-w-[38ch] text-sm leading-relaxed text-muted">
                The first eval run refused answerable questions. Reading the raw reranker scores from the workflow&apos;s
                execution history, not the final answer text, showed every false refusal pointed at the same document:
                retrieved and ranked first each time, scoring just under 0.50. Moving the line fixed those, and let one
                question that should be refused through at 0.47.
              </p>
            </Rise>
          </div>
          <Rise>
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Eval results before and after the threshold change</caption>
              <thead>
                <tr className="border-b border-border font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                  <th scope="col" className="py-3 pr-4 font-normal">Measure</th>
                  <th scope="col" className="py-3 pr-4 font-normal">At 0.50</th>
                  <th scope="col" className="py-3 font-normal">At 0.45</th>
                </tr>
              </thead>
              <tbody>
                {ABLATION.map(([name, before, after]) => (
                  <tr key={name} className="border-b border-border align-baseline">
                    <th scope="row" className="py-4 pr-4 font-medium">{name}</th>
                    <td className="py-4 pr-4 font-mono tabular-nums text-muted">{before}</td>
                    <td className="py-4 font-mono tabular-nums text-accent">{after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 font-mono text-xs leading-relaxed text-muted">
              30 questions, 25 answerable and 5 that should be refused, run against the live deployment. Raw results in
              seed/eval.
            </p>
          </Rise>
        </div>
      </section>

      <section className="px-[5vw] pt-[clamp(5rem,11vw,11rem)]">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Tag>the second fix</Tag>
            <LineReveal
              className="mt-5 text-[clamp(2rem,4.4vw,4.25rem)] font-semibold leading-[1] tracking-[-0.035em]"
              lines={['Silent failures,', 'made loud.']}
            />
            <Rise delay={0.2}>
              <p className="mt-6 max-w-[38ch] text-sm leading-relaxed text-muted">
                A September re-run found seven of thirty questions coming back empty when asked back to back, and the
                old scorer had counted them as answers. Asked twenty seconds apart, all seven were answered correctly,
                which pinned it on the model&apos;s per-minute rate limit. Answer generation now retries, and if it
                still fails the chat says it is busy instead of going quiet.
              </p>
            </Rise>
          </div>
          <Rise>
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Back-to-back eval before and after adding retries</caption>
              <thead>
                <tr className="border-b border-border font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                  <th scope="col" className="py-3 pr-4 font-normal">Measure</th>
                  <th scope="col" className="py-3 pr-4 font-normal">Before</th>
                  <th scope="col" className="py-3 font-normal">With retries</th>
                </tr>
              </thead>
              <tbody>
                {RELIABILITY.map(([name, before, after]) => (
                  <tr key={name} className="border-b border-border align-baseline">
                    <th scope="row" className="py-4 pr-4 font-medium">{name}</th>
                    <td className="py-4 pr-4 font-mono tabular-nums text-muted">{before}</td>
                    <td className="py-4 font-mono tabular-nums text-accent">{after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 font-mono text-xs leading-relaxed text-muted">
              Same 30 questions, fired back to back at the live deployment. Slower at the tail because retries wait out
              the limit instead of failing.
            </p>
          </Rise>
        </div>
      </section>

      <section className="px-[5vw] pt-[clamp(6rem,13vw,13rem)]">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Tag>not yet</Tag>
            <LineReveal
              className="mt-5 text-[clamp(2rem,4.4vw,4.25rem)] font-semibold leading-[1] tracking-[-0.035em]"
              lines={['What it', 'doesn’t do', 'or track.']}
            />
          </div>
          <Rise>
            <dl className="divide-y divide-border border-y border-border text-sm">
              {NOT_MEASURED.map(([k, v]) => (
                <div key={k} className="grid gap-2 py-4 sm:grid-cols-[12rem_1fr] sm:gap-6">
                  <dt className="font-mono text-xs uppercase tracking-[0.08em] text-muted">{k}</dt>
                  <dd className="max-w-[62ch] leading-relaxed text-muted">{v}</dd>
                </div>
              ))}
            </dl>
          </Rise>
        </div>
      </section>
    </>
  );
}

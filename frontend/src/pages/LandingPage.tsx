import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import Tag from '../components/marketing/Tag';
import { LineReveal, Rise, DrawLine } from '../components/marketing/Reveal';
import ChatDemo from '../components/marketing/ChatDemo';
import ConfidenceGate from '../components/marketing/ConfidenceGate';
import RoleFilter from '../components/marketing/RoleFilter';

const APP_ROWS = [
  {
    to: '/chat',
    name: 'Chat',
    who: 'everyone',
    text: 'Ask in plain language. Every claim carries a [n] that maps to a source chip with the document and its date.',
  },
  {
    to: '/library',
    name: 'Library',
    who: 'everyone',
    text: 'Every document the assistant can search, with how many chunks and sections each one became.',
  },
  {
    to: '/upload',
    name: 'Upload',
    who: 'admins',
    text: 'Add a PDF, DOCX, TXT or Markdown file and decide whether members can see it or only admins.',
  },
  {
    to: '/dashboard',
    name: 'Dashboard',
    who: 'admins',
    text: 'Query volume, refusal rate over time, latency percentiles, borderline calls and a searchable log.',
  },
] as const;

const MEASURED = [
  ['Expected document retrieved', '25/25', 'In the top four passages, on every answerable question'],
  ['Prompt injections resisted', '12/12', 'Direct jailbreaks, planted instructions, obfuscated extraction, meta-manipulation'],
  ['False refusals', '12% → 8%', 'After moving the gate from 0.50 to 0.45'],
  ['Correct refusals', '100% → 80%', 'The cost of that move: one question that should be refused now gets an answer'],
  ['Citation present', '88% → 92%', 'Answers that cite at least one source'],
  ['Empty replies under load', '23% → 0%', 'A September re-run caught answers failing silently when asked back to back; retries fixed it'],
  ['Automated tests', '85', 'Every route’s token and role check, bound SQL and the confidence gate, run in CI on each change'],
] as const;

const TRUST = [
  ['auth', 'HS256 JWT, 7-day expiry'],
  ['passwords', 'salted HMAC-SHA256 + pepper'],
  ['roles', 'filtered at retrieval, server-side'],
  ['limits', '10 logins / 15 min per email'],
  ['gaps', 'every refusal pinged to Slack'],
] as const;

export default function LandingPage() {
  return (
    <>
      {/* HERO — asymmetric 7/5 split, the demo offset lower */}
      <section className="px-[5vw] pb-[clamp(4rem,9vw,9rem)] pt-[clamp(2.5rem,6vw,6rem)]">
        <div className="grid items-start gap-[clamp(2.5rem,5vw,5rem)] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div>
            <Rise inView={false}>
              <Tag>internal docs · cited</Tag>
            </Rise>
            <LineReveal
              as="h1"
              inView={false}
              delay={0.1}
              className="mt-6 text-[clamp(2.5rem,5.6vw,6.5rem)] font-semibold leading-[0.96] tracking-[-0.04em]"
              lines={[
                'Ask the handbook.',
                'Get the page it',
                'came from.',
                <span key="c" className="text-muted">
                  Or a plain no.
                </span>,
              ]}
            />
            <Rise inView={false} delay={0.55}>
              <p className="mt-8 max-w-[52ch] text-lg leading-relaxed text-muted">
                Mimo answers questions from your company&apos;s own documents and cites the passage behind every claim.
                When nothing in the knowledge base supports an answer, it says so and flags the gap, instead of guessing.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
                <Link
                  to="/signup"
                  className="group inline-flex items-center gap-2 rounded bg-accent px-5 py-3 font-mono text-sm font-medium uppercase tracking-[0.06em] text-accent-foreground transition-transform hover:-translate-y-0.5 active:scale-[0.97]"
                >
                  Try it free
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </Link>
                <Link
                  to="/how-it-works"
                  className="font-mono text-sm uppercase tracking-[0.06em] text-muted underline decoration-border decoration-1 underline-offset-8 transition-colors hover:text-foreground hover:decoration-accent"
                >
                  How it works
                </Link>
              </div>
              <p className="mt-6 font-mono text-xs text-muted">Free account · member access to chat and the library</p>
            </Rise>
          </div>

          <Rise inView={false} delay={0.4} y={28} className="lg:mt-20">
            <ChatDemo />
          </Rise>
        </div>
      </section>

      {/* THE GATE — real scores, given the biggest gap */}
      <section className="px-[5vw] pt-[clamp(5rem,12vw,12rem)]">
        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <div>
            <Tag>the gate</Tag>
            <LineReveal
              className="mt-5 text-[clamp(2.25rem,5.6vw,5.5rem)] font-semibold leading-[0.98] tracking-[-0.04em]"
              lines={['“I don’t know” is', 'a feature, with', 'a price.']}
            />
          </div>
          <Rise delay={0.15}>
            <p className="max-w-[44ch] leading-relaxed text-muted">
              Every answer starts with a relevance score for the best passage found. Under 0.45, Mimo refuses. The line
              used to sit at 0.50. Lowering it fixed real false refusals, and let one question through that should
              have been refused. Both are on the chart.
            </p>
          </Rise>
        </div>
        <div className="mt-[clamp(2.5rem,5vw,5rem)]">
          <ConfidenceGate />
        </div>
      </section>

      {/* ROLES — the interactive filter */}
      <section className="px-[5vw] pt-[clamp(6rem,13vw,13rem)]">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-16">
          <div>
            <Tag>roles</Tag>
            <LineReveal
              className="mt-5 text-[clamp(2rem,4.4vw,4.25rem)] font-semibold leading-[1] tracking-[-0.035em]"
              lines={['Admin-only', 'stays admin-only.']}
            />
            <Rise delay={0.2}>
              <p className="mt-6 max-w-[42ch] leading-relaxed text-muted">
                Hiding a document in the interface isn&apos;t access control. Mimo drops passages a member can&apos;t
                see before ranking, so the model never reads them. Switch the role and watch what reaches it.
              </p>
            </Rise>
          </div>
          <Rise delay={0.1}>
            <RoleFilter />
          </Rise>
        </div>
      </section>

      {/* MEASURED — a table, not stat tiles */}
      <section className="px-[5vw] pt-[clamp(6rem,13vw,13rem)]">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Tag>measured</Tag>
            <LineReveal
              className="mt-5 text-[clamp(2rem,4.4vw,4.25rem)] font-semibold leading-[1] tracking-[-0.035em]"
              lines={['Checked', 'against the', 'live system.']}
            />
            <Rise delay={0.2}>
              <p className="mt-6 max-w-[36ch] text-sm leading-relaxed text-muted">
                A 30-question ground-truth set and a 12-case adversarial suite, run against production rather than a
                local mock in July 2026 and again in September. A small suite on a sample handbook: read it as a
                regression guard, not a benchmark. Alongside it, automated tests check the workflow itself.
              </p>
            </Rise>
          </div>
          <Rise>
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Results from the eval suite</caption>
              <tbody>
                {MEASURED.map(([name, value, note]) => (
                  <tr key={name} className="border-b border-border align-baseline first:border-t">
                    <th scope="row" className="w-[34%] py-4 pr-4 font-medium">{name}</th>
                    <td className="w-32 py-4 pr-4 font-mono text-lg tabular-nums text-accent">{value}</td>
                    <td className="py-4 text-muted">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Rise>
        </div>
      </section>

      {/* INSIDE THE APP — editorial rows, each a real route */}
      <section className="px-[5vw] pt-[clamp(5rem,11vw,11rem)]">
        <div className="mb-8">
          <Tag>inside the app</Tag>
        </div>
        <ul className="border-t border-border">
          {APP_ROWS.map((row, i) => (
            <li key={row.to} className="border-b border-border">
              <Rise delay={i * 0.06}>
                <Link
                  to={row.to}
                  className="group grid items-baseline gap-x-6 gap-y-2 py-7 md:grid-cols-[5rem_minmax(0,0.9fr)_minmax(0,0.5fr)_minmax(0,1.1fr)_2rem]"
                >
                  <span className="font-mono text-xs text-muted">0{i + 1}</span>
                  <span className="text-[clamp(1.75rem,3.6vw,3.25rem)] font-semibold leading-none tracking-[-0.03em] transition-transform duration-300 group-hover:translate-x-2">
                    {row.name}
                  </span>
                  <span className="font-mono text-xs text-accent">{row.who}</span>
                  <span className="max-w-[52ch] leading-relaxed text-muted">{row.text}</span>
                  <ArrowUpRight
                    className="hidden size-5 place-self-center text-muted transition-all duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-accent md:block"
                    aria-hidden="true"
                  />
                </Link>
              </Rise>
            </li>
          ))}
        </ul>
      </section>

      {/* TRUST — big statement left, mono facts right */}
      <section className="px-[5vw] pt-[clamp(6rem,14vw,14rem)]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <LineReveal
            as="h2"
            className="text-[clamp(2.5rem,7vw,7rem)] font-semibold leading-[0.95] tracking-[-0.045em]"
            lines={['Your docs.', 'Your roles.', 'Cited, or no.']}
          />
          <div className="self-end">
            <dl className="font-mono text-sm">
              {TRUST.map(([k, v], i) => (
                <div key={k}>
                  <DrawLine delay={i * 0.08} />
                  <Rise delay={i * 0.08} y={8}>
                    <div className="flex gap-6 py-4">
                      <dt className="w-24 shrink-0 text-muted">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  </Rise>
                </div>
              ))}
              <DrawLine delay={0.45} />
            </dl>
            <Rise delay={0.2}>
              <p className="mt-6 max-w-[46ch] text-sm leading-relaxed text-muted">
                Passages you ask about go to Hugging Face to be scored and to Groq to be answered. The security page
                lists exactly what goes where, and what is still weak.
              </p>
              <Link
                to="/security"
                className="group mt-5 inline-flex items-center gap-2 font-mono text-sm uppercase tracking-[0.06em] underline decoration-border underline-offset-8 transition-colors hover:decoration-accent"
              >
                Read the security model
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </Rise>
          </div>
        </div>
      </section>
    </>
  );
}

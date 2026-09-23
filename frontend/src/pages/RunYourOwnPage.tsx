import { useEffect, type ReactNode } from 'react';
import Tag from '../components/marketing/Tag';
import { LineReveal, Rise } from '../components/marketing/Reveal';
import SectionNav from '../components/marketing/SectionNav';
import CodeBlock from '../components/marketing/CodeBlock';
import Disclosure from '../components/marketing/Disclosure';
import { REPO_URL } from '../lib/site';

const NAV = [
  { id: 'need', label: 'What you need' },
  { id: 'workflow', label: 'Import the workflow' },
  { id: 'database', label: 'The database' },
  { id: 'frontend', label: 'The frontend' },
  { id: 'eval', label: 'Seed and eval' },
  { id: 'trouble', label: 'If it breaks' },
];

const NEEDS = [
  ['n8n', 'Self-hosted, where the whole backend runs as one workflow'],
  ['Qdrant', 'The vector store, in the collection company_knowledge_base'],
  ['Postgres', 'Accounts, sign-in attempts and query logs (the live one uses Neon)'],
  ['Hugging Face', 'A token for embeddings and re-scoring'],
  ['Groq', 'An API key for answers'],
  ['Slack', 'Optional: a bot for knowledge-gap alerts'],
] as const;

const CREDENTIALS = [
  ['RAG', 'Groq, Hugging Face, Qdrant and Slack API credentials'],
  ['RAG Qdrant', 'Header auth for the Qdrant REST calls'],
  ['RAG Neon', 'Postgres connection'],
  ['RAG JWT', 'The JWT signing secret'],
  ['RAG Password Pepper', 'The HMAC key for password hashing'],
] as const;

const FAQ = [
  {
    q: 'Every login fails after an update',
    a: 'Accounts created before the password pepper was configured were hashed without it and no longer match. Those accounts need their password reset in the database.',
  },
  {
    q: 'Sign-in returns 429',
    a: 'The rate limit: 10 attempts per email in 15 minutes, 5 sign-ups per email per hour. Wait, or clear old rows from auth_attempts.',
  },
  {
    q: 'The auth nodes error about a missing table',
    a: 'Run n8n/migrations/001_create_auth_attempts.sql before activating the workflow. The rate-limit nodes query that table.',
  },
  {
    q: 'Chat says the knowledge base is empty',
    a: 'Nothing has been uploaded yet, or the list-documents webhook isn’t active. Upload a document as an admin, then reload.',
  },
  {
    q: 'Everything is refused',
    a: 'Check that documents were embedded with the same model the query side uses (all-mpnet-base-v2 on both), and look at the top score in the n8n execution for the refused question.',
  },
];

function Step({ id, n, title, children }: { id: string; n: number; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-border pb-[clamp(3.5rem,7vw,7rem)] pt-8">
      <p className="font-mono text-xs text-muted">0{n}</p>
      <LineReveal className="mt-3 text-[clamp(1.9rem,3.8vw,3.5rem)] font-semibold leading-[1] tracking-[-0.035em]" lines={[title]} />
      <div className="mt-8 space-y-6">{children}</div>
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="max-w-[64ch] leading-relaxed text-muted">{children}</p>;
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-foreground">{children}</span>;
}

function KV({ rows, caption }: { rows: readonly (readonly [string, string])[]; caption: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-border align-baseline first:border-t">
              <th scope="row" className="w-44 py-3 pr-6 font-mono text-xs font-normal">{k}</th>
              <td className="py-3 text-muted">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RunYourOwnPage() {
  useEffect(() => {
    document.title = 'Run your own · Mimo';
  }, []);

  return (
    <>
      <section className="px-[5vw] pb-[clamp(3rem,6vw,6rem)] pt-[clamp(2.5rem,6vw,6rem)]">
        <Rise inView={false}>
          <Tag>run your own</Tag>
        </Rise>
        <LineReveal
          as="h1"
          inView={false}
          delay={0.1}
          className="mt-6 text-[clamp(2.75rem,8vw,8.5rem)] font-semibold leading-[0.93] tracking-[-0.045em]"
          lines={['Your documents,', 'your stack.']}
        />
        <Rise inView={false} delay={0.45}>
          <p className="mt-8 max-w-[54ch] text-lg leading-relaxed text-muted">
            The hosted Mimo is a shared demo. To use it on your own documents, run the backend yourself: one
            n8n workflow, a vector store, a database and a static frontend.
          </p>
        </Rise>
      </section>

      <div className="grid gap-10 px-[5vw] lg:grid-cols-[minmax(0,3fr)_minmax(0,9fr)] lg:gap-16">
        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <SectionNav items={NAV} label="run-your-own" />
          </div>
        </aside>

        <div>
          <Step id="need" n={1} title="What you need">
            <KV rows={NEEDS} caption="Services Mimo depends on" />
          </Step>

          <Step id="workflow" n={2} title="Import the workflow">
            <P>
              In n8n, import <Mono>n8n/mimo-workflow.json</Mono>. It holds every route: sign-up, login, chat, upload,
              library and dashboard stats. Create these credentials, then activate the workflow:
            </P>
            <KV rows={CREDENTIALS} caption="n8n credentials the workflow expects" />
            <P>Generate the two secrets locally, so they never pass through chat or a log:</P>
            <CodeBlock prompt label="terminal" code="node n8n/generate-secrets.js" />
          </Step>

          <Step id="database" n={3} title="The database">
            <CodeBlock prompt label="rate-limit table" code="psql $DATABASE_URL -f n8n/migrations/001_create_auth_attempts.sql" />
            <P>
              The repository ships a migration for <Mono>auth_attempts</Mono> only. The <Mono>users</Mono> table (id,
              email, password_hash, password_salt, role) and <Mono>query_logs</Mono> (session_id, question, outcome,
              confidence_score, citations, latency_ms, execution_id, created_at) need creating from the columns the
              workflow reads and writes.
            </P>
          </Step>

          <Step id="frontend" n={4} title="The frontend">
            <CodeBlock prompt label="terminal" code={`git clone ${REPO_URL} mimo\ncd mimo/frontend\ncp .env.example .env\nnpm install\nnpm run dev`} />
            <P>
              Point each <Mono>VITE_*</Mono> variable in <Mono>.env</Mono> at your own n8n webhooks. The build is a
              static site; the live one is on Vercel, with a rewrite so every route serves the app.
            </P>
          </Step>

          <Step id="eval" n={5} title="Seed and eval">
            <P>
              <Mono>seed/</Mono> has a standalone chunk, embed and query sandbox against a local Qdrant, the sample
              handbook in <Mono>seed/docs</Mono>, and the eval harness behind the numbers on this site.
            </P>
            <CodeBlock
              prompt
              label="terminal"
              code={'docker run -d -p 6333:6333 qdrant/qdrant\ncd seed\nnpm install\nnode ingest.js\nnode query.js'}
            />
          </Step>

          <section id="trouble" className="scroll-mt-28 border-t border-border pt-8">
            <p className="font-mono text-xs text-muted">06</p>
            <LineReveal className="mt-3 text-[clamp(1.9rem,3.8vw,3.5rem)] font-semibold leading-[1] tracking-[-0.035em]" lines={['If it breaks']} />
            <div className="mt-8">
              <Disclosure items={FAQ} />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useInView, useScroll, useSpring } from 'framer-motion';
import { EASE } from './Reveal';

type StageId = 'upload' | 'chunk' | 'embed' | 'retrieve' | 'rank' | 'gate' | 'generate' | 'log';

interface Stage {
  id: StageId;
  title: string;
  body: string;
  specs: [string, string][];
}

// Every number below is read from n8n/mimo-workflow.json, the workflow that
// actually runs, not from marketing copy.
const STAGES: Stage[] = [
  {
    id: 'upload',
    title: 'Upload',
    body: 'An admin drops in a PDF, DOCX, TXT or Markdown file and says who may see it. The webhook verifies the JWT and checks the admin role before anything is read.',
    specs: [
      ['who', 'admins only'],
      ['formats', 'pdf · docx · txt · md'],
      ['visibility', 'everyone, or admins only'],
    ],
  },
  {
    id: 'chunk',
    title: 'Chunk',
    body: 'The text is split recursively, by paragraph, then sentence, then word, with neighbouring chunks overlapping so a fact on a boundary survives in one piece. Each chunk carries its source, date and visibility.',
    specs: [
      ['splitter', 'recursive character'],
      ['overlap', '150 characters'],
      ['metadata', 'source · updated · visibility'],
    ],
  },
  {
    id: 'embed',
    title: 'Embed and store',
    body: 'Each chunk becomes a vector through Hugging Face and is written to Qdrant in batches. Questions are embedded with the same model, so they land in the same space.',
    specs: [
      ['model', 'all-mpnet-base-v2'],
      ['store', 'Qdrant · company_knowledge_base'],
      ['batch', '50 chunks'],
    ],
  },
  {
    id: 'retrieve',
    title: 'Retrieve',
    body: 'A question arrives with the asker’s token. The JWT is verified, the question is embedded, and vector search casts a wide net.',
    specs: [
      ['auth', 'HS256 JWT, verified'],
      ['candidates', '8'],
      ['search', 'vector similarity'],
    ],
  },
  {
    id: 'rank',
    title: 'Rerank and filter',
    body: 'Each candidate is re-scored against the question directly. Chunks the asker’s role can’t see are dropped here, on the server, then the best four are kept.',
    specs: [
      ['rescore', 'sentence similarity'],
      ['filter', 'visibility by role'],
      ['keep', 'top 4'],
    ],
  },
  {
    id: 'gate',
    title: 'Gate',
    body: 'The best score is the confidence. Under 0.45 Mimo refuses, says so plainly, and posts the question to Slack as a gap in the knowledge base. The line moved down from 0.50 after the eval, for reasons on this page.',
    specs: [
      ['threshold', '0.45'],
      ['below', 'refuse + Slack alert'],
      ['above', 'answer'],
    ],
  },
  {
    id: 'generate',
    title: 'Generate',
    body: 'The four passages go to the model as numbered, untrusted data. Every claim must cite its [n]. Instructions found inside a document are quoted, never followed, and chunks that contradict each other are called out rather than silently picked.',
    specs: [
      ['model', 'openai/gpt-oss-120b on Groq'],
      ['temperature', '0.2'],
      ['max tokens', '1,024'],
    ],
  },
  {
    id: 'log',
    title: 'Log',
    body: 'Every question, answered or refused, becomes a row: outcome, top score, citations and latency. That table is what the dashboard reads.',
    specs: [
      ['store', 'Postgres · query_logs'],
      ['fields', 'outcome · score · latency'],
      ['feeds', 'the admin dashboard'],
    ],
  },
];

function VizBox({ children }: { children: ReactNode }) {
  return <div className="relative flex min-h-44 flex-col justify-center overflow-hidden rounded border border-border bg-surface p-4">{children}</div>;
}

function Chip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={'w-fit rounded border border-border px-2 py-1 font-mono text-[11px] ' + className}>{children}</span>;
}

function UploadViz({ active }: { active: boolean }) {
  return (
    <VizBox>
      <div className="flex items-center gap-3">
        <motion.div animate={{ y: active ? 0 : -10, opacity: active ? 1 : 0.3 }} transition={{ duration: 0.5, ease: EASE }}>
          <Chip>refund-policy.md</Chip>
        </motion.div>
        <motion.span className="h-px flex-1 origin-left bg-accent" animate={{ scaleX: active ? 1 : 0 }} transition={{ duration: 0.5, delay: 0.3, ease: EASE }} />
        <div className="space-y-1.5">
          {['jwt ✓', 'role: admin ✓'].map((c, i) => (
            <motion.div key={c} animate={{ opacity: active ? 1 : 0.2 }} transition={{ delay: 0.5 + i * 0.2 }}>
              <Chip className="text-success">{c}</Chip>
            </motion.div>
          ))}
        </div>
      </div>
    </VizBox>
  );
}

function ChunkViz({ active }: { active: boolean }) {
  const chunks = [
    { left: 0, width: 40 },
    { left: 33, width: 40 },
    { left: 66, width: 34 },
  ];
  return (
    <VizBox>
      <div className="flex flex-col gap-2.5">
        <div className="relative h-3 rounded-sm bg-border">
          {[33, 66].map((l) => (
            <motion.span key={l} className="absolute inset-y-0 bg-accent/60" style={{ left: `${l}%`, width: '7%' }} animate={{ opacity: active ? 1 : 0 }} transition={{ delay: 0.9 }} />
          ))}
        </div>
        {chunks.map((c, i) => (
          <div key={i} className="relative h-3">
            <motion.div
              className="absolute inset-y-0 origin-left rounded-sm border border-foreground/40 bg-foreground/10"
              style={{ left: `${c.left}%`, width: `${c.width}%` }}
              animate={{ scaleX: active ? 1 : 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.15 + i * 0.15 }}
            />
          </div>
        ))}
        <p className="font-mono text-[11px] text-muted">
          <span className="text-accent">▮</span> 150-character overlap between neighbours
        </p>
      </div>
    </VizBox>
  );
}

function EmbedViz({ active }: { active: boolean }) {
  return (
    <VizBox>
      <div className="grid grid-cols-8 content-center gap-2.5">
        {Array.from({ length: 32 }).map((_, i) => (
          <motion.span
            key={i}
            className={'size-2 rounded-full ' + (i === 13 ? 'bg-accent' : 'bg-muted/60')}
            animate={{ scale: active ? 1 : 0.2, opacity: active ? 1 : 0.2 }}
            transition={{ duration: 0.35, ease: EASE, delay: (i % 8) * 0.03 + Math.floor(i / 8) * 0.06 }}
          />
        ))}
      </div>
      <span className="absolute bottom-3 right-4 font-mono text-[11px] text-muted">768 dims</span>
    </VizBox>
  );
}

function RetrieveViz({ active }: { active: boolean }) {
  return (
    <VizBox>
      <p className="font-mono text-[11px] text-muted">
        <span className="text-accent">&gt;</span> refund policy for enterprise?
      </p>
      <div className="mt-4 grid grid-cols-4 gap-1.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.span
            key={i}
            className="h-6 rounded-sm border border-border bg-foreground/[0.06]"
            animate={{ opacity: active ? 1 : 0.15, y: active ? 0 : 6 }}
            transition={{ duration: 0.3, delay: 0.2 + i * 0.06 }}
          />
        ))}
      </div>
      <p className="mt-3 font-mono text-[11px] text-muted">8 candidates</p>
    </VizBox>
  );
}

function RankViz({ active }: { active: boolean }) {
  const [sorted, setSorted] = useState(false);
  // State only changes inside the timeout callback, after the effect body has run.
  useEffect(() => {
    const t = setTimeout(() => setSorted(active), active ? 900 : 0);
    return () => clearTimeout(t);
  }, [active]);

  // [label, vector rank, rescored rank, admin-only]
  const rows: [string, number, number, boolean][] = [
    ['chunk 41', 0, 2, false],
    ['chunk 07', 1, 0, false],
    ['chunk 23', 2, 1, true],
    ['chunk 12', 3, 3, false],
    ['chunk 30', 4, 4, false],
    ['chunk 18', 5, 5, false],
  ];
  const ordered = [...rows].sort((a, b) => (sorted ? a[2] - b[2] : a[1] - b[1]));

  return (
    <VizBox>
      <ul className="space-y-1.5">
        {ordered.map(([label, , , admin]) => {
          const kept = sorted && !admin && ordered.filter((r) => !r[3]).indexOf(ordered.find((r) => r[0] === label)!) < 4;
          return (
            <motion.li
              key={label}
              layout
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className={'flex items-center justify-between rounded border px-2.5 py-1 font-mono text-[11px] ' + (sorted && admin ? 'border-dashed border-border text-muted/60' : 'border-border')}
            >
              <span className={sorted && admin ? 'line-through' : ''}>
                {label}
                {admin ? ' · admin-only' : ''}
              </span>
              <span className={kept ? 'text-accent' : 'text-muted'}>{sorted ? (admin ? 'filtered' : kept ? 'keep' : 'drop') : '…'}</span>
            </motion.li>
          );
        })}
      </ul>
      <p className="mt-2 font-mono text-[10px] text-muted">asked as a member</p>
    </VizBox>
  );
}

function GateViz({ active }: { active: boolean }) {
  return (
    <VizBox>
      <div className="relative h-32">
        <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
        <div className="absolute inset-y-6 left-[38%] w-px bg-foreground" />
        <span className="absolute left-[38%] top-1 -translate-x-1/2 font-mono text-[11px]">0.45</span>
        <motion.span
          className="absolute top-1/2 size-3.5 -translate-y-1/2 rounded-sm border-2 border-accent bg-background"
          style={{ left: '14%' }}
          animate={{ scale: active ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.3 }}
        />
        <motion.span
          className="absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full border-2 border-success bg-success"
          style={{ left: '76%' }}
          animate={{ scale: active ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.5 }}
        />
        <span className="absolute bottom-1 left-[4%] font-mono text-[11px] text-muted">refuse → slack</span>
        <span className="absolute bottom-1 right-[4%] font-mono text-[11px] text-success">answer</span>
      </div>
    </VizBox>
  );
}

function GenerateViz({ active }: { active: boolean }) {
  const lines: [string, boolean][] = [
    ['50% of unearned fees in the first 30 days [2]', false],
    ['[3] says otherwise; the two conflict', true],
  ];
  return (
    <VizBox>
      <div className="space-y-2.5">
        {lines.map(([text, flag], i) => (
          <motion.p
            key={text}
            className={'font-mono text-[11px] ' + (flag ? 'text-warning' : '')}
            animate={{ opacity: active ? 1 : 0, x: active ? 0 : -6 }}
            transition={{ duration: 0.35, delay: 0.2 + i * 0.4 }}
          >
            {text}
          </motion.p>
        ))}
        <motion.span
          className="block h-3 w-1.5 bg-accent"
          animate={{ opacity: active ? [1, 1, 0, 0] : 0 }}
          transition={{ duration: 0.9, repeat: Infinity, times: [0, 0.5, 0.5, 1], ease: 'linear' }}
        />
      </div>
    </VizBox>
  );
}

function LogViz({ active }: { active: boolean }) {
  const rows = [
    ['answered', '0.75', '4.9s'],
    ['refused', '—', '2.1s'],
    ['answered', '0.82', '3.4s'],
  ];
  return (
    <VizBox>
      <div className="space-y-1.5 font-mono text-[11px]">
        {rows.map(([o, s, l], i) => (
          <motion.div
            key={i}
            className="grid grid-cols-3 rounded border border-border px-2.5 py-1"
            animate={{ opacity: active ? 1 : 0.15, y: active ? 0 : 4 }}
            transition={{ duration: 0.3, delay: 0.2 + i * 0.15 }}
          >
            <span className={o === 'answered' ? 'text-success' : 'text-muted'}>{o}</span>
            <span className="text-center tabular-nums">{s}</span>
            <span className="text-right tabular-nums text-muted">{l}</span>
          </motion.div>
        ))}
      </div>
    </VizBox>
  );
}

function Viz({ id, active }: { id: StageId; active: boolean }) {
  switch (id) {
    case 'upload':
      return <UploadViz active={active} />;
    case 'chunk':
      return <ChunkViz active={active} />;
    case 'embed':
      return <EmbedViz active={active} />;
    case 'retrieve':
      return <RetrieveViz active={active} />;
    case 'rank':
      return <RankViz active={active} />;
    case 'gate':
      return <GateViz active={active} />;
    case 'generate':
      return <GenerateViz active={active} />;
    case 'log':
      return <LogViz active={active} />;
  }
}

function StageRow({ stage, index }: { stage: Stage; index: number }) {
  const ref = useRef<HTMLLIElement>(null);
  // "Active" = the row is crossing the middle band of the viewport.
  const active = useInView(ref, { margin: '-42% 0px -42% 0px' });

  return (
    <li ref={ref} className="relative grid gap-x-10 gap-y-6 py-[clamp(3rem,7vw,6rem)] pl-12 md:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] md:pl-24">
      <span
        aria-hidden="true"
        className={
          'absolute left-[calc(0.725rem+0.5px)] top-[clamp(3.6rem,7.6vw,6.6rem)] size-3 rounded-full border-2 transition-colors duration-300 md:left-[calc(2.125rem+0.5px)] ' +
          (active ? 'border-accent bg-accent' : 'border-border bg-background')
        }
      />
      <div>
        <p className={'font-mono text-xs transition-colors duration-300 ' + (active ? 'text-accent' : 'text-muted')}>0{index + 1}</p>
        <h3
          className={
            'mt-3 text-[clamp(1.9rem,4vw,3.5rem)] font-semibold leading-none tracking-[-0.035em] transition-colors duration-300 ' +
            (active ? 'text-foreground' : 'text-foreground/45')
          }
        >
          {stage.title}
        </h3>
        <p className="mt-5 max-w-[56ch] leading-relaxed text-muted">{stage.body}</p>
        <dl className="mt-6 space-y-1.5 font-mono text-xs">
          {stage.specs.map(([k, v]) => (
            <div key={k} className="flex gap-4">
              <dt className="w-24 shrink-0 text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="md:pt-9" aria-hidden="true">
        <Viz id={stage.id} active={active} />
      </div>
    </li>
  );
}

export default function Pipeline() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 60%', 'end 60%'] });
  const fill = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 });

  return (
    <div ref={ref} className="relative">
      <div aria-hidden="true" className="absolute bottom-0 left-[1.1rem] top-0 w-px bg-border md:left-[2.5rem]">
        <motion.div className="h-full w-px origin-top bg-accent" style={{ scaleY: fill }} />
      </div>
      <ol>
        {STAGES.map((s, i) => (
          <StageRow key={s.id} stage={s} index={i} />
        ))}
      </ol>
    </div>
  );
}

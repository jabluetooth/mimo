import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUp, SearchX, ShieldCheck, Lock } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/apiFetch';
import { primaryButtonClass } from '../components/ui';

const CHAT_WEBHOOK_URL = import.meta.env.VITE_CHAT_WEBHOOK_URL;
const LIST_DOCUMENTS_URL = import.meta.env.VITE_LIST_DOCUMENTS_URL;

const WELCOME =
  'Ask me anything covered by the internal knowledge base — I will cite my sources, or tell you plainly when I do not know.';

const EASE = [0.16, 1, 0.3, 1] as const;

type LibraryDoc = { source: string; sectionCount: number; chunkCount: number; updatedAt: string | null };

type LibraryState =
  | { kind: 'checking' }
  | { kind: 'empty' }
  | { kind: 'ready'; documents: LibraryDoc[] }
  | { kind: 'unknown' }; // couldn't check — don't block chat over it, just skip suggestions

// A human-readable label from a filename: "refund-policy.md" -> "refund policy".
function labelForSource(source: string): string {
  return source
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

// Suggestions are generated from whatever is actually in the library, not a
// fixed list — a fixed list would suggest questions about documents that
// don't exist for anyone who hasn't uploaded the same eval corpus.
function suggestionsFromDocuments(documents: LibraryDoc[]): string[] {
  return documents.slice(0, 4).map((d) => `What does ${labelForSource(d.source)} cover?`);
}

type Citation = { marker: string; source: string; section: string; updatedAt: string };

type ParsedAnswer = {
  status: 'grounded' | 'refused' | 'unauthorized';
  confidence: number;
  body: string;
  citations: Citation[];
};

type Turn =
  | { role: 'assistant'; kind: 'welcome'; text: string }
  | { role: 'user'; text: string }
  | { role: 'assistant'; kind: 'answer'; parsed: ParsedAnswer }
  | { role: 'assistant'; kind: 'error'; text: string };

// The workflow replies with a structured JSON shape directly
// ({status, confidence, body, citationsJson}) rather than a formatted
// string the frontend has to regex-parse -- one seam, and a citation can't
// silently fail to match a line pattern.
type ChatReply = {
  status: 'grounded' | 'refused' | 'unauthorized';
  confidence: number;
  body: string;
  citationsJson: string;
};

function toParsedAnswer(data: ChatReply): ParsedAnswer {
  let citations: Citation[] = [];
  try {
    citations = JSON.parse(data.citationsJson || '[]');
  } catch {
    citations = [];
  }
  return {
    status: data.status,
    confidence: Math.round((data.confidence ?? 0) * 100),
    body: data.body ?? '',
    citations,
  };
}

// Minimal inline-markdown: **bold** and "- " bullet lines. The backend only
// ever emits these two constructs, so a full markdown parser would be
// dependency weight with no payoff. Rendered as React text, never as HTML.
function renderFormattedText(text: string) {
  const lines = text.split('\n');
  const nodes: JSX.Element[] = [];
  let listBuffer: string[] = [];

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return;
    nodes.push(
      <ul key={key} className="list-disc space-y-1 pl-5 marker:text-muted">
        {listBuffer.map((item, i) => (
          <li key={i}>{renderInline(item.replace(/^-\s+/, ''))}</li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  lines.forEach((line, i) => {
    if (/^-\s+/.test(line)) {
      listBuffer.push(line);
      return;
    }
    flushList(`list-${i}`);
    if (line.trim()) nodes.push(<p key={i}>{renderInline(line)}</p>);
  });
  flushList('list-end');

  return nodes;
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[\d+\])/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (/^\[\d+\]$/.test(part)) {
      return (
        <sup key={i} className="ml-0.5 font-mono text-[10px] text-accent">
          {part}
        </sup>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function StatusLine({ parsed }: { parsed: ParsedAnswer }) {
  if (parsed.status === 'grounded') {
    return (
      <p className="inline-flex items-center gap-1.5 font-mono text-xs text-success">
        <ShieldCheck className="size-3.5" aria-hidden="true" /> grounded · {parsed.confidence}% confidence
      </p>
    );
  }
  if (parsed.status === 'refused') {
    return (
      <p className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground">
        <SearchX className="size-3.5" aria-hidden="true" /> not found in the knowledge base
      </p>
    );
  }
  return (
    <p className="inline-flex items-center gap-1.5 font-mono text-xs text-warning">
      <Lock className="size-3.5" aria-hidden="true" /> sign-in required
    </p>
  );
}

function AnswerTurn({ parsed }: { parsed: ParsedAnswer }) {
  return (
    <div className="space-y-3">
      <StatusLine parsed={parsed} />
      <div
        className={
          'space-y-2 rounded border px-4 py-3 leading-relaxed ' +
          (parsed.status === 'grounded' ? 'border-border bg-surface' : 'border-dashed border-border text-muted')
        }
      >
        {renderFormattedText(parsed.body)}
      </div>
      {parsed.citations.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Sources">
          {parsed.citations.map((c) => (
            <li key={c.marker} className="rounded border border-border bg-surface px-2.5 py-1.5 font-mono text-xs">
              <span className="text-accent">{c.marker}</span> {c.source}
              <span className="ml-2 text-muted">
                {c.section} · updated {c.updatedAt}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TurnLabel({ children }: { children: string }) {
  return <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{children}</span>;
}

export default function ChatPage() {
  const { user } = useAuth();
  const [turns, setTurns] = useState<Turn[]>([{ role: 'assistant', kind: 'welcome', text: WELCOME }]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [library, setLibrary] = useState<LibraryState>({ kind: 'checking' });
  const transcriptRef = useRef<HTMLDivElement>(null);
  const sessionId = useMemo(() => crypto.randomUUID(), []);

  useEffect(() => {
    document.title = 'Chat · Mimo';
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkLibrary() {
      if (!LIST_DOCUMENTS_URL || !user) {
        if (!cancelled) setLibrary({ kind: 'unknown' });
        return;
      }
      try {
        const payload = await apiFetch<{ documents: LibraryDoc[] }>(LIST_DOCUMENTS_URL, { token: user.token });
        const documents = payload.documents ?? [];
        if (!cancelled) setLibrary(documents.length === 0 ? { kind: 'empty' } : { kind: 'ready', documents });
      } catch {
        if (!cancelled) setLibrary({ kind: 'unknown' });
      }
    }

    checkLibrary();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const suggestions = library.kind === 'ready' ? suggestionsFromDocuments(library.documents) : [];

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, isThinking]);

  async function sendQuestion(question: string) {
    if (!question || isThinking) return;

    if (!CHAT_WEBHOOK_URL) {
      setTurns((t) => [
        ...t,
        { role: 'user', text: question },
        {
          role: 'assistant',
          kind: 'error',
          text: 'VITE_CHAT_WEBHOOK_URL is not set. Copy .env.example to .env and paste in the Chat Trigger webhook URL from the n8n query workflow.',
        },
      ]);
      setInput('');
      return;
    }

    setTurns((t) => [...t, { role: 'user', text: question }]);
    setInput('');
    setIsThinking(true);

    try {
      const data = await apiFetch<ChatReply>(CHAT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The Chat Trigger node doesn't reliably expose custom headers, but
        // it does pass the full request body through -- so the token rides
        // alongside chatInput/sessionId here instead of an Authorization
        // header (which is what Upload/Library/Dashboard use instead).
        body: JSON.stringify({ chatInput: question, sessionId, token: user?.token }),
      });
      setTurns((t) => [...t, { role: 'assistant', kind: 'answer', parsed: toParsedAnswer(data) }]);
    } catch (err) {
      setTurns((t) => [...t, { role: 'assistant', kind: 'error', text: `Could not reach the assistant: ${(err as Error).message}` }]);
    } finally {
      setIsThinking(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void sendQuestion(input.trim());
  }

  if (library.kind === 'empty') {
    return (
      <div className="max-w-2xl py-8">
        <h1 className="sr-only">Chat with the knowledge assistant</h1>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">[&nbsp;nothing to chat about yet&nbsp;]</p>
        <h2 className="mt-5 text-[clamp(2rem,4.5vw,3.75rem)] font-semibold leading-[0.95] tracking-[-0.04em]">The knowledge base is empty.</h2>
        <p className="mt-5 max-w-[48ch] leading-relaxed text-muted">
          Mimo only answers from uploaded documents, and there aren&apos;t any yet, so there&apos;s nothing to ground an
          answer in. Upload one first, then come back and ask about it.
        </p>
        <Link to="/upload" className={primaryButtonClass + ' mt-8'}>
          Upload a document
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-12">
      <div className="flex h-[calc(100dvh-10rem)] min-h-[28rem] flex-col rounded border border-border bg-background">
        <h1 className="sr-only">Chat with the knowledge assistant</h1>

        <div className="flex-1 space-y-7 overflow-y-auto px-5 py-6 sm:px-8" ref={transcriptRef}>
          {turns.map((turn, i) => (
            <motion.div
              key={i}
              initial={i === 0 ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className={turn.role === 'user' ? 'ml-auto max-w-[85%] text-right' : 'max-w-[92%]'}
            >
              <TurnLabel>{turn.role === 'user' ? 'You' : 'Mimo'}</TurnLabel>
              {turn.role === 'user' && (
                <p className="inline-block rounded border border-foreground/15 bg-surface px-4 py-2.5 text-left font-medium">{turn.text}</p>
              )}
              {turn.role === 'assistant' && turn.kind === 'welcome' && <p className="leading-relaxed text-muted">{turn.text}</p>}
              {turn.role === 'assistant' && turn.kind === 'error' && (
                <p className="rounded border border-l-4 border-danger/40 border-l-danger bg-danger/[0.06] px-4 py-3 text-sm">{turn.text}</p>
              )}
              {turn.role === 'assistant' && turn.kind === 'answer' && <AnswerTurn parsed={turn.parsed} />}
            </motion.div>
          ))}

          {turns.length === 1 && !isThinking && suggestions.length > 0 && (
            <div className="flex flex-col items-start gap-2">
              {suggestions.map((s, i) => (
                <motion.button
                  key={s}
                  type="button"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.05, duration: 0.3, ease: EASE }}
                  className="rounded border border-border bg-surface px-3.5 py-2 text-left text-sm transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  onClick={() => sendQuestion(s)}
                >
                  {s}
                </motion.button>
              ))}
            </div>
          )}

          {isThinking && (
            <div aria-live="polite">
              <TurnLabel>Mimo</TurnLabel>
              <p className="sr-only">Thinking</p>
              <div aria-hidden="true" className="inline-flex items-center gap-1 rounded border border-border px-4 py-3">
                {[0, 1, 2].map((d) => (
                  <motion.span
                    key={d}
                    className="size-1.5 bg-muted"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: d * 0.15, ease: 'easeInOut' }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <form className="flex shrink-0 items-center gap-2 border-t border-border p-3" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            autoComplete="off"
            aria-label="Ask a question"
            disabled={isThinking}
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-foreground placeholder:text-muted focus:outline-none"
          />
          <button
            type="submit"
            className="grid size-10 shrink-0 place-items-center rounded bg-accent text-accent-foreground transition-transform hover:enabled:-translate-y-px active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            disabled={isThinking || !input.trim()}
            aria-label="Send"
          >
            <ArrowUp className="size-4" aria-hidden="true" />
          </button>
        </form>
      </div>

      <aside className="space-y-8 lg:pt-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">How answers work</p>
          <dl className="mt-4 border-t border-border font-mono text-xs">
            {[
              ['cites', 'every claim, as [n]'],
              ['refuses', 'below 0.45 relevance'],
              ['you see', `${user?.role === 'admin' ? 'all documents' : 'member documents'}`],
              ['session', 'this tab only'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-6 border-b border-border py-3">
                <dt className="w-16 shrink-0 text-muted">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        {library.kind === 'ready' && (
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
              In the knowledge base · {library.documents.length}
            </p>
            <ul className="mt-4 space-y-1.5">
              {library.documents.slice(0, 8).map((d) => (
                <li key={d.source} className="truncate font-mono text-xs">
                  {d.source}
                </li>
              ))}
            </ul>
            <Link to="/library" className="mt-4 inline-block font-mono text-xs text-muted underline decoration-border underline-offset-4 hover:text-foreground">
              Open the library
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}

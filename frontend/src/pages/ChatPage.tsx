import { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/apiFetch';

const CHAT_WEBHOOK_URL = import.meta.env.VITE_CHAT_WEBHOOK_URL;
const LIST_DOCUMENTS_URL = import.meta.env.VITE_LIST_DOCUMENTS_URL;

const WELCOME =
  'Ask me anything covered by the internal knowledge base — I will cite my sources, or tell you plainly when I do not know.';

// Shared glass-card shell, matching the treatment LandingPage's sample-answer
// card already established (`border-[var(--glass-border-warm)]` +
// `bg-white/70` + the CSS-variable backdrop blur/shadow tokens) so the chat
// page and its landing-page preview read as the same surface.
const CHAT_SHELL =
  'flex w-full max-w-[700px] flex-col rounded-[24px] border border-[var(--glass-border-warm)] bg-white/70 shadow-[var(--shadow-glass)] [-webkit-backdrop-filter:var(--glass-blur)] [backdrop-filter:var(--glass-blur)]';

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
// dependency weight with no payoff.
function renderFormattedText(text: string) {
  const lines = text.split('\n');
  const nodes: JSX.Element[] = [];
  let listBuffer: string[] = [];

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return;
    nodes.push(
      <ul key={key}>
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
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (/^\[\d+\]$/.test(part)) {
      return (
        <sup key={i} className="citation-marker">
          {part}
        </sup>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function AnswerTurn({ parsed }: { parsed: ParsedAnswer }) {
  const pillLabel =
    parsed.status === 'grounded'
      ? `Grounded · ${parsed.confidence}% confidence`
      : parsed.status === 'refused'
        ? 'Not found in knowledge base'
        : 'Sign-in required';

  return (
    <div className="turn-body">
      <span className={`status-pill status-pill--${parsed.status}`}>{pillLabel}</span>
      <div className="answer-text">{renderFormattedText(parsed.body)}</div>
      {parsed.citations.length > 0 && (
        <div className="sources-list" aria-label="Sources">
          {parsed.citations.map((c) => (
            <span className="source-chip" key={c.marker}>
              <span className="citation-marker">{c.marker}</span> {c.source}
              <span className="source-chip-meta">
                {c.section} · updated {c.updatedAt}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const { user } = useAuth();
  const [turns, setTurns] = useState<Turn[]>([{ role: 'assistant', kind: 'welcome', text: WELCOME }]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [library, setLibrary] = useState<LibraryState>({ kind: 'checking' });
  const transcriptRef = useRef<HTMLDivElement>(null);
  const prevTurnCount = useRef(turns.length);
  const sessionId = useMemo(() => crypto.randomUUID(), []);

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

  // A single restrained cue when a new turn (question or answer) lands, so
  // the transcript doesn't just snap new content into place. Skipped for the
  // initial welcome turn and entirely under prefers-reduced-motion — and
  // kept independent from the auto-scroll effect above and the thinking
  // ellipsis animation, which both keep working exactly as before.
  // useLayoutEffect (not useEffect) so the from-state is applied before the
  // browser paints the newly-appended turn — otherwise it would flash fully
  // visible for a frame before GSAP hides and re-reveals it.
  useLayoutEffect(() => {
    const grew = turns.length > prevTurnCount.current;
    prevTurnCount.current = turns.length;
    if (!grew) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const nodes = transcriptRef.current?.querySelectorAll<HTMLElement>('.turn');
    const lastTurn = nodes && nodes[nodes.length - 1];
    if (!lastTurn) return;

    gsap.fromTo(lastTurn, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
  }, [turns]);

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
      setTurns((t) => [
        ...t,
        { role: 'assistant', kind: 'error', text: `Could not reach the assistant: ${(err as Error).message}` },
      ]);
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
      <div className={`${CHAT_SHELL} items-center justify-center overflow-hidden p-8 h-[min(680px,78vh)]`}>
        <h1 className="visually-hidden">Chat with the knowledge assistant</h1>
        <div className="flex max-w-[40ch] flex-col items-center text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-accent">Nothing to chat about yet</p>
          <h2 className="mb-3 text-[26px]">Your knowledge base is empty</h2>
          <p className="mb-6 text-sm leading-[1.6] text-muted">
            Mimo answers questions from documents that have been uploaded — there aren't any yet, so there's
            nothing to ground an answer in. Upload one first, then come back here to ask about it.
          </p>
          <Link to="/upload" className="primary-button cta-button">
            Upload a document
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`${CHAT_SHELL} h-[min(680px,78vh)] overflow-hidden`}>
      <h1 className="visually-hidden">Chat with the knowledge assistant</h1>

      <div className="flex flex-1 flex-col gap-[22px] overflow-y-auto px-8 py-7" ref={transcriptRef}>
        {turns.map((turn, i) => (
          <div className="turn" key={i}>
            <span className="turn-label">{turn.role === 'user' ? 'You' : 'Mimo'}</span>
            {turn.role === 'user' && <p className="turn-body turn-body--question">{turn.text}</p>}
            {turn.role === 'assistant' && turn.kind === 'welcome' && <p className="turn-body">{turn.text}</p>}
            {turn.role === 'assistant' && turn.kind === 'error' && (
              <p className="turn-body text-error">{turn.text}</p>
            )}
            {turn.role === 'assistant' && turn.kind === 'answer' && <AnswerTurn parsed={turn.parsed} />}
          </div>
        ))}

        {turns.length === 1 && !isThinking && suggestions.length > 0 && (
          <div className="-mt-1.5 flex flex-col items-start gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="cursor-pointer rounded-full border border-[var(--glass-border-warm)] bg-white/50 px-3.5 py-2 text-left font-body text-[13px] text-text transition-[background-color,border-color,transform] duration-150 hover:-translate-y-px hover:border-accent hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                onClick={() => sendQuestion(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {isThinking && (
          <div className="turn" aria-live="polite">
            <span className="turn-label">Mimo</span>
            <p className="turn-body chat-thinking italic text-muted">Thinking</p>
          </div>
        )}
      </div>

      <form
        className="m-4 flex shrink-0 items-center gap-2.5 rounded-full border border-[var(--glass-border-warm)] bg-white/[0.86] py-1.5 pl-[18px] pr-1.5 shadow-[var(--shadow-sm)] transition-colors duration-150 [-webkit-backdrop-filter:var(--glass-blur-sm)] [backdrop-filter:var(--glass-blur-sm)] focus-within:border-accent"
        onSubmit={handleSubmit}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          autoComplete="off"
          aria-label="Ask a question"
          disabled={isThinking}
          className="min-w-0 flex-1 border-0 bg-transparent font-body text-sm text-text outline-none [caret-color:var(--accent-raw)] placeholder:text-muted focus:outline-none focus:placeholder:opacity-0"
        />
        <button
          type="submit"
          className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-accent text-white transition-[background-color,transform,opacity] duration-150 hover:enabled:-translate-y-px hover:enabled:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          disabled={isThinking || !input.trim()}
          aria-label="Send"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </div>
  );
}

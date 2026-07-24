import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const CHAT_WEBHOOK_URL = import.meta.env.VITE_CHAT_WEBHOOK_URL;
const LIST_DOCUMENTS_URL = import.meta.env.VITE_LIST_DOCUMENTS_URL;

const WELCOME =
  'Ask me anything covered by the internal knowledge base — I will cite my sources, or tell you plainly when I do not know.';

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
  status: 'grounded' | 'refused' | 'plain';
  confidence?: number;
  body: string;
  citations: Citation[];
};

type Turn =
  | { role: 'assistant'; kind: 'welcome'; text: string }
  | { role: 'user'; text: string }
  | { role: 'assistant'; kind: 'answer'; parsed: ParsedAnswer }
  | { role: 'assistant'; kind: 'error'; text: string };

// The workflow's reply is plain text with a light convention baked in by the
// backend's own formatting step — a leading "✅ **Grounded answer** —
// confidence NN%" or "⚠️ **Not found...**" line, then the answer body, then
// an optional "Sources:\n[n] doc.md (Section, updated date)" block. Parsing
// it client-side turns that into real UI (a status pill, structured source
// chips) instead of just dumping raw markdown-ish text into a bubble.
function parseAnswer(raw: string): ParsedAnswer {
  const sourcesSplit = raw.split(/\n\nSources:\n/);
  const main = sourcesSplit[0];
  const citations: Citation[] = [];

  if (sourcesSplit[1]) {
    const lineRe = /^\[(\d+)\]\s+(.+?)\s+\((.+?),\s*updated\s+(.+?)\)\s*$/gm;
    let m: RegExpExecArray | null;
    while ((m = lineRe.exec(sourcesSplit[1])) !== null) {
      citations.push({ marker: `[${m[1]}]`, source: m[2], section: m[3], updatedAt: m[4] });
    }
  }

  const groundedMatch = main.match(/^✅\s*\*\*Grounded answer\*\*\s*—\s*confidence\s*(\d+)%\s*\n\n([\s\S]*)$/);
  if (groundedMatch) {
    return { status: 'grounded', confidence: Number(groundedMatch[1]), body: groundedMatch[2].trim(), citations };
  }

  const refusedMatch = main.match(/^⚠️\s*\*\*[^*]+\*\*\s*\n\n([\s\S]*)$/);
  if (refusedMatch) {
    return { status: 'refused', body: refusedMatch[1].trim(), citations };
  }

  return { status: 'plain', body: main.trim(), citations };
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
  return (
    <div className="turn-body">
      {parsed.status !== 'plain' && (
        <span className={`status-pill status-pill--${parsed.status}`}>
          {parsed.status === 'grounded' ? `Grounded · ${parsed.confidence}% confidence` : 'Not found in knowledge base'}
        </span>
      )}
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
  const [turns, setTurns] = useState<Turn[]>([{ role: 'assistant', kind: 'welcome', text: WELCOME }]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [library, setLibrary] = useState<LibraryState>({ kind: 'checking' });
  const transcriptRef = useRef<HTMLDivElement>(null);
  const sessionId = useMemo(() => crypto.randomUUID(), []);

  useEffect(() => {
    let cancelled = false;

    async function checkLibrary() {
      if (!LIST_DOCUMENTS_URL) {
        if (!cancelled) setLibrary({ kind: 'unknown' });
        return;
      }
      try {
        const response = await fetch(LIST_DOCUMENTS_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload: { documents: LibraryDoc[] } = await response.json();
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
  }, []);

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
      const response = await fetch(CHAT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatInput: question, sessionId }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const raw = typeof data.output === 'string' ? data.output : JSON.stringify(data);
      setTurns((t) => [...t, { role: 'assistant', kind: 'answer', parsed: parseAnswer(raw) }]);
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
      <div className="chat-shell chat-shell--empty">
        <h1 className="visually-hidden">Chat with the knowledge assistant</h1>
        <div className="chat-empty-state">
          <p className="chat-empty-eyebrow">Nothing to chat about yet</p>
          <h2>Your knowledge base is empty</h2>
          <p className="chat-empty-body">
            Mimo answers questions from documents you've uploaded — there aren't any yet, so there's nothing to
            ground an answer in. Upload a document first, then come back here to ask about it.
          </p>
          <Link to="/upload" className="primary-button cta-button">
            Upload a document
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-shell">
      <h1 className="visually-hidden">Chat with the knowledge assistant</h1>

      <div className="chat-transcript" ref={transcriptRef}>
        {turns.map((turn, i) => (
          <div className="turn" key={i}>
            <span className="turn-label">{turn.role === 'user' ? 'You' : 'Mimo'}</span>
            {turn.role === 'user' && <p className="turn-body turn-body--question">{turn.text}</p>}
            {turn.role === 'assistant' && turn.kind === 'welcome' && <p className="turn-body">{turn.text}</p>}
            {turn.role === 'assistant' && turn.kind === 'error' && (
              <p className="turn-body turn-body--error">{turn.text}</p>
            )}
            {turn.role === 'assistant' && turn.kind === 'answer' && <AnswerTurn parsed={turn.parsed} />}
          </div>
        ))}

        {turns.length === 1 && !isThinking && suggestions.length > 0 && (
          <div className="suggestion-chips">
            {suggestions.map((s) => (
              <button key={s} type="button" className="suggestion-chip" onClick={() => sendQuestion(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {isThinking && (
          <div className="turn" aria-live="polite">
            <span className="turn-label">Mimo</span>
            <p className="turn-body chat-thinking">Thinking</p>
          </div>
        )}
      </div>

      <form className="chat-input-bar" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          autoComplete="off"
          aria-label="Ask a question"
          disabled={isThinking}
        />
        <button type="submit" className="chat-send-btn" disabled={isThinking || !input.trim()} aria-label="Send">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </div>
  );
}

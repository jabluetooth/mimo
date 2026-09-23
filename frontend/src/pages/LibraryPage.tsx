import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/apiFetch';
import { Lock, Upload } from 'lucide-react';
import { Notice, PageHead, primaryButtonClass, secondaryButtonClass } from '../components/ui';
import { motion } from 'framer-motion';

const LIST_DOCUMENTS_URL = import.meta.env.VITE_LIST_DOCUMENTS_URL;

type Document = {
  source: string;
  sectionCount: number;
  chunkCount: number;
  updatedAt: string | null;
};

type ListResponse = { documents: Document[]; count: number };

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; documents: Document[] };

function formatUpdatedAt(value: string | null): string {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function LibraryPage() {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    document.title = 'Library · Mimo';
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!LIST_DOCUMENTS_URL) {
        setState({
          kind: 'error',
          message:
            'VITE_LIST_DOCUMENTS_URL is not set. Copy .env.example to .env and paste in the list-documents webhook URL.',
        });
        return;
      }

      try {
        const payload = await apiFetch<ListResponse>(LIST_DOCUMENTS_URL, { token: user?.token });
        if (!cancelled) {
          setState({ kind: 'loaded', documents: payload.documents ?? [] });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: `Could not reach the knowledge base list workflow: ${(err as Error).message}`,
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const docs = state.kind === 'loaded' ? state.documents : [];
  const totalChunks = docs.reduce((n, d) => n + d.chunkCount, 0);

  return (
    <div className="space-y-[clamp(2.5rem,5vw,4rem)]">
      <PageHead
        tag="library"
        title="Knowledge base"
        action={
          user?.role === 'admin' && docs.length > 0 ? (
            <Link to="/upload" className={secondaryButtonClass}>
              <Upload className="size-3.5" aria-hidden="true" /> Upload document
            </Link>
          ) : undefined
        }
      >
        Documents currently ingested and searchable by the chat assistant. What you can ask about depends on your role.
      </PageHead>

      {state.kind === 'loading' && (
        <p className="border-y border-border py-6 font-mono text-xs text-muted" role="status" aria-live="polite">
          Loading documents…
        </p>
      )}

      {state.kind === 'error' && (
        <Notice tone="error" title="Couldn't load the library" role="status">
          <p>{state.message}</p>
          <p className="mt-2 text-muted">
            This page reads from a separate n8n workflow (<code className="font-mono text-xs">GET /webhook/list-documents</code>) that
            needs to be activated and configured with the right credentials in n8n before it can return real data.
          </p>
        </Notice>
      )}

      {state.kind === 'loaded' && docs.length === 0 && (
        <div className="border-y border-border py-[clamp(2.5rem,5vw,4rem)]" role="status" aria-live="polite">
          <p className="text-[clamp(1.75rem,3.5vw,3rem)] font-semibold leading-none tracking-[-0.03em]">Nothing ingested yet.</p>
          <p className="mt-4 max-w-[52ch] leading-relaxed text-muted">Upload a document and it becomes searchable, with every answer citing it.</p>
          {user?.role === 'admin' ? (
            <Link to="/upload" className={primaryButtonClass + ' mt-8'}>
              Upload the first document
            </Link>
          ) : (
            <p className="mt-6 flex items-center gap-2 font-mono text-xs text-muted">
              <Lock className="size-3.5" aria-hidden="true" /> Uploading is for admins.
            </p>
          )}
        </div>
      )}

      {state.kind === 'loaded' && docs.length > 0 && (
        <section aria-labelledby="doc-list-heading">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 id="doc-list-heading" className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
              {docs.length} {docs.length === 1 ? 'document' : 'documents'} · {totalChunks} chunks
            </h2>
          </div>
          <ul className="border-t border-border" aria-label="Ingested documents">
            {docs.map((doc, i) => (
              <motion.li
                key={doc.source}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i, 10) * 0.04, ease: [0.16, 1, 0.3, 1] }}
                className="grid items-baseline gap-x-6 gap-y-1 border-b border-border py-5 md:grid-cols-[3rem_minmax(0,1fr)_10rem_9rem]"
              >
                <span className="hidden font-mono text-xs text-muted md:block">{String(i + 1).padStart(2, '0')}</span>
                <span className="truncate text-lg font-semibold tracking-[-0.01em]">{doc.source}</span>
                <span className="font-mono text-xs text-muted">
                  {doc.chunkCount} {doc.chunkCount === 1 ? 'chunk' : 'chunks'} · {doc.sectionCount} {doc.sectionCount === 1 ? 'section' : 'sections'}
                </span>
                <span className="font-mono text-xs text-muted md:text-right">updated {formatUpdatedAt(doc.updatedAt)}</span>
              </motion.li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

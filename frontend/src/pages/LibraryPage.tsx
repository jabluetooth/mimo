import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

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
        const response = await fetch(LIST_DOCUMENTS_URL, {
          headers: user ? { Authorization: `Bearer ${user.token}` } : {},
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error('Unexpected response from the list-documents workflow.');
        }

        const payload: ListResponse = await response.json();
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

  return (
    <div className="library-page">
      <div className="library-header">
        <h1>Knowledge base</h1>
        <p className="subtitle">
          Documents currently ingested and searchable by the chat assistant.
        </p>
      </div>

      <div className="library-panel">
        {state.kind === 'loading' && (
          <p className="library-status" role="status" aria-live="polite">
            Loading documents...
          </p>
        )}

        {state.kind === 'error' && (
          <div className="library-status library-status--error" role="status" aria-live="polite">
            <p>{state.message}</p>
            <p className="hint">
              This page reads from a separate n8n workflow (
              <code>GET /webhook/list-documents</code>) that needs to be activated and configured
              with the right credentials in n8n before it can return real data.
            </p>
          </div>
        )}

        {state.kind === 'loaded' && state.documents.length === 0 && (
          <div className="library-empty" role="status" aria-live="polite">
            <p>No documents have been ingested yet.</p>
            {user?.role === 'admin' && (
              <Link to="/upload" className="primary-button cta-button">
                Upload the first document
              </Link>
            )}
          </div>
        )}

        {state.kind === 'loaded' && state.documents.length > 0 && (
          <>
            <p className="library-count">
              {state.documents.length} {state.documents.length === 1 ? 'document' : 'documents'}{' '}
              in the knowledge base
            </p>
            <ul className="doc-list" aria-label="Ingested documents">
              {state.documents.map((doc) => (
                <li key={doc.source} className="doc-row">
                  <div className="doc-row-main">
                    <span className="doc-source">{doc.source}</span>
                    <span className="doc-updated">Updated {formatUpdatedAt(doc.updatedAt)}</span>
                  </div>
                  <div className="doc-row-stats">
                    <span>
                      {doc.chunkCount} {doc.chunkCount === 1 ? 'chunk' : 'chunks'}
                    </span>
                    <span>
                      {doc.sectionCount} {doc.sectionCount === 1 ? 'section' : 'sections'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

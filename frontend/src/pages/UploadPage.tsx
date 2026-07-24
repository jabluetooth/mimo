import { useEffect, useId, useRef, useState, DragEvent, ChangeEvent } from 'react';
import { useAuth } from '../auth/AuthContext';

const UPLOAD_WEBHOOK_URL = import.meta.env.VITE_UPLOAD_WEBHOOK_URL;
const BINARY_FIELD_NAME = 'data'; // must match the ingestion webhook node's binaryPropertyName
const ACCEPTED_TYPES =
  '.pdf,.docx,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/*
  The ingestion webhook is a single synchronous request/response — n8n doesn't
  emit real progress events mid-request — so there is no true step-by-step
  status to report. What follows is a *simulated* sequence that roughly
  mirrors what the ingestion workflow actually does behind that one request
  (webhook receive -> Default Data Loader chunking -> HuggingFace embeddings
  -> Qdrant upsert), advanced on a timer purely to give the user a sense of
  progress instead of a single frozen "Uploading..." line. It is reconciled
  with the real result the moment the fetch settles:
    - if the response arrives before the simulated sequence finishes, we jump
      straight to the real success/error state rather than waiting out the
      rest of the timer;
    - if the response takes longer than the simulated sequence, we hold on
      the last step rather than looping or going blank.
*/
const STEPS = [
  'Uploading file',
  'Chunking document',
  'Generating embeddings',
  'Indexing in knowledge base',
] as const;

const STEP_INTERVAL_MS = 1100;

type Status = { kind: 'idle' | 'uploading' | 'success' | 'error'; message: string };
type StepState = 'pending' | 'active' | 'done' | 'error';

export default function UploadPage() {
  const { user } = useAuth();
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stepTimerRef = useRef<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [visibility, setVisibility] = useState<'member' | 'admin'>('member');
  const [status, setStatus] = useState<Status>({ kind: 'idle', message: '' });
  const [stepIndex, setStepIndex] = useState(0);

  // Guard against setting state after unmount if the component goes away
  // mid-upload (the fetch itself isn't aborted — it's fire-and-forget from
  // n8n's perspective — but we shouldn't touch React state after unmount).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopStepTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopStepTimer() {
    if (stepTimerRef.current !== null) {
      window.clearInterval(stepTimerRef.current);
      stepTimerRef.current = null;
    }
  }

  function pickFile(f: File | null) {
    setFile(f);
    setStatus({ kind: 'idle', message: '' });
    setStepIndex(0);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) pickFile(dropped);
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    pickFile(e.target.files?.[0] ?? null);
  }

  async function upload() {
    if (!file) return;

    if (!UPLOAD_WEBHOOK_URL) {
      setStatus({
        kind: 'error',
        message:
          'VITE_UPLOAD_WEBHOOK_URL is not set. Copy .env.example to .env and paste in the ingestion webhook URL.',
      });
      return;
    }

    setStepIndex(0);
    setStatus({ kind: 'uploading', message: `Uploading ${file.name}...` });

    stopStepTimer();
    stepTimerRef.current = window.setInterval(() => {
      setStepIndex((current) => {
        const next = Math.min(current + 1, STEPS.length - 1);
        if (mountedRef.current) {
          setStatus({ kind: 'uploading', message: `${STEPS[next]}...` });
        }
        // Hold on the last step rather than looping once we reach it — the
        // real response may still be pending.
        if (next === STEPS.length - 1) stopStepTimer();
        return next;
      });
    }, STEP_INTERVAL_MS);

    try {
      const formData = new FormData();
      formData.append(BINARY_FIELD_NAME, file, file.name);
      formData.append('visibility', visibility);

      const response = await fetch(UPLOAD_WEBHOOK_URL, {
        method: 'POST',
        headers: user ? { Authorization: `Bearer ${user.token}` } : {},
        body: formData,
      });

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json()
        : { message: await response.text() };

      stopStepTimer();
      if (!mountedRef.current) return;

      if (response.ok) {
        setStepIndex(STEPS.length - 1);
        setStatus({
          kind: 'success',
          message: payload?.message || 'Document ingested successfully.',
        });
        // Clear the selected file directly (not via pickFile, which also
        // resets `status` back to idle — that would wipe out the success
        // message and step list we just set, in the same tick).
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setStatus({
          kind: 'error',
          message: payload?.message || `Upload failed (HTTP ${response.status}).`,
        });
      }
    } catch (err) {
      stopStepTimer();
      if (!mountedRef.current) return;
      setStatus({
        kind: 'error',
        message: `Could not reach the ingestion workflow: ${(err as Error).message}`,
      });
    }
  }

  const isUploading = status.kind === 'uploading';
  const showSteps = status.kind === 'uploading' || status.kind === 'success' || status.kind === 'error';

  function stepState(i: number): StepState {
    if (status.kind === 'success') return 'done';
    if (status.kind === 'error') {
      if (i < stepIndex) return 'done';
      if (i === stepIndex) return 'error';
      return 'pending';
    }
    if (i < stepIndex) return 'done';
    if (i === stepIndex) return 'active';
    return 'pending';
  }

  return (
    <div className="card">
      <h1>Upload a document</h1>
      <p className="subtitle">
        Adds this file to the internal knowledge base (PDF, DOCX, TXT, or Markdown).
      </p>

      {/*
        A <label> wrapping a real <input type="file"> gets native click-to-open,
        keyboard focus, and Enter/Space-to-open behavior for free — no
        role/tabIndex/keydown polyfilling needed. The input is nested inside the
        label (so :focus-within on .dropzone reacts to it) and visually hidden
        (not display:none) so it stays focusable and reachable by keyboard.
      */}
      <label
        htmlFor={fileInputId}
        className={`dropzone${dragOver ? ' dragover' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <input
          ref={fileInputRef}
          id={fileInputId}
          type="file"
          accept={ACCEPTED_TYPES}
          className="visually-hidden"
          onChange={onInputChange}
        />
        <p>{file ? 'Selected:' : 'Click to choose a file, or drag one here'}</p>
        <div className="filename">{file?.name ?? ''}</div>
      </label>

      <fieldset className="visibility-picker" disabled={isUploading}>
        <legend>Who can see this document?</legend>
        <label>
          <input
            type="radio"
            name="visibility"
            value="member"
            checked={visibility === 'member'}
            onChange={() => setVisibility('member')}
          />
          Everyone (members and admins)
        </label>
        <label>
          <input
            type="radio"
            name="visibility"
            value="admin"
            checked={visibility === 'admin'}
            onChange={() => setVisibility('admin')}
          />
          Admins only
        </label>
      </fieldset>

      <button className="primary-button" disabled={!file || isUploading} onClick={upload}>
        {isUploading ? 'Uploading...' : 'Upload'}
      </button>

      {/*
        This step list is a visual echo of the same progress already announced
        by the aria-live status message below — marking it aria-hidden avoids
        screen reader users hearing every step twice (once from this list,
        once from the live region) while sighted users still get the richer
        step-by-step feedback.
      */}
      {showSteps && (
        <ol className="upload-steps" aria-hidden="true">
          {STEPS.map((label, i) => {
            const state = stepState(i);
            return (
              <li key={label} className={`upload-step upload-step--${state}`}>
                <span className="upload-step-marker">
                  {state === 'done' ? '✓' : state === 'error' ? '!' : i + 1}
                </span>
                <span className="upload-step-label">{label}</span>
              </li>
            );
          })}
        </ol>
      )}

      <div
        className={`status-message ${status.kind === 'error' ? 'error' : status.kind === 'success' ? 'success' : ''}`}
        role="status"
        aria-live="polite"
      >
        {status.message}
      </div>

      <div className="hint">
        Posts to <code>{UPLOAD_WEBHOOK_URL || 'VITE_UPLOAD_WEBHOOK_URL (not set)'}</code>.
        Requires the ingestion workflow to be activated in n8n.
      </div>
    </div>
  );
}

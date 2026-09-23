import { useEffect, useId, useRef, useState, DragEvent, ChangeEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiFetch, ApiError } from '../lib/apiFetch';
import { Check, FileText, Lock, Upload, Users, X } from 'lucide-react';
import { Notice, PageHead, Spinner, monoLabelClass, primaryButtonClass } from '../components/ui';

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
    document.title = 'Upload · Mimo';
  }, []);
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

      const payload = await apiFetch<{ message?: string }>(UPLOAD_WEBHOOK_URL, {
        method: 'POST',
        token: user?.token,
        body: formData,
      });

      stopStepTimer();
      if (!mountedRef.current) return;

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
    } catch (err) {
      stopStepTimer();
      if (!mountedRef.current) return;
      const message =
        err instanceof ApiError ? err.message : `Could not reach the ingestion workflow: ${(err as Error).message}`;
      setStatus({ kind: 'error', message });
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

  const VISIBILITY = [
    { value: 'member' as const, label: 'Everyone', hint: 'members and admins', Icon: Users },
    { value: 'admin' as const, label: 'Admins only', hint: 'filtered out for members', Icon: Lock },
  ];

  return (
    <div className="grid gap-[clamp(2.5rem,5vw,5rem)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <PageHead tag="upload" title={<>Add to the<br />knowledge base.</>}>
          The file is chunked, embedded and indexed in one request. From then on answers can cite it, for whoever its
          visibility allows.
        </PageHead>
        <dl className="mt-8 max-w-sm border-t border-border font-mono text-xs">
          {[
            ['formats', 'pdf · docx · txt · md'],
            ['chunks', 'recursive, 150 overlap'],
            ['embeds', 'all-mpnet-base-v2'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-6 border-b border-border py-3">
              <dt className="w-16 shrink-0 text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="space-y-6">
        <div className="space-y-6 rounded border border-border bg-surface p-5 sm:p-7">
          {/*
            A <label> wrapping a real <input type="file"> gets native click-to-open,
            keyboard focus, and Enter/Space-to-open behavior for free — no
            role/tabIndex/keydown polyfilling needed. The input is nested inside the
            label (so focus-within reacts to it) and visually hidden (not
            display:none) so it stays focusable and reachable by keyboard.
          */}
          <label
            htmlFor={fileInputId}
            className={
              'flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded border border-dashed px-6 py-8 text-center transition-colors focus-within:border-accent ' +
              (dragOver ? 'border-accent bg-accent/[0.06]' : 'border-border hover:border-foreground/30')
            }
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <input ref={fileInputRef} id={fileInputId} type="file" accept={ACCEPTED_TYPES} className="sr-only" onChange={onInputChange} />
            {file ? (
              <>
                <FileText className="size-6 text-accent" aria-hidden="true" />
                <span className="font-mono text-sm">{file.name}</span>
                <span className="font-mono text-xs text-muted">selected · click to replace</span>
              </>
            ) : (
              <>
                <Upload className="size-6 text-muted" aria-hidden="true" />
                <span className="text-sm">
                  Drop a file here, or <span className="text-accent underline underline-offset-4">choose one</span>
                </span>
                <span className="font-mono text-xs text-muted">pdf · docx · txt · md</span>
              </>
            )}
          </label>

          <fieldset disabled={isUploading} className="space-y-3">
            <legend className={monoLabelClass}>Who can see this document?</legend>
            <div className="grid gap-2 pt-3 sm:grid-cols-2">
              {VISIBILITY.map(({ value, label, hint, Icon }) => (
                <label
                  key={value}
                  className={
                    'flex cursor-pointer items-start gap-3 rounded border px-4 py-3 transition-colors focus-within:ring-2 focus-within:ring-accent ' +
                    (visibility === value ? 'border-accent bg-accent/[0.05]' : 'border-border hover:border-foreground/30')
                  }
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={value}
                    checked={visibility === value}
                    onChange={() => setVisibility(value)}
                    className="sr-only"
                  />
                  <Icon className={'mt-0.5 size-4 shrink-0 ' + (visibility === value ? 'text-accent' : 'text-muted')} aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block font-mono text-xs text-muted">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <button className={primaryButtonClass} disabled={!file || isUploading} onClick={upload}>
            {isUploading ? <Spinner /> : <Upload className="size-4" aria-hidden="true" />}
            {isUploading ? 'Uploading' : 'Upload'}
          </button>
        </div>

        {/*
          This step list is a visual echo of the same progress already announced
          by the aria-live status message below — marking it aria-hidden avoids
          screen reader users hearing every step twice.
        */}
        {showSteps && (
          <ol className="space-y-2.5 rounded border border-border bg-surface p-5 font-mono text-xs" aria-hidden="true">
            {STEPS.map((label, i) => {
              const state = stepState(i);
              return (
                <li key={label} className="flex items-center gap-3">
                  <span
                    className={
                      'grid size-5 place-items-center rounded-full border text-[10px] transition-colors duration-300 ' +
                      (state === 'done'
                        ? 'border-success bg-success text-background'
                        : state === 'active'
                          ? 'border-accent text-accent'
                          : state === 'error'
                            ? 'border-danger bg-danger text-background'
                            : 'border-border text-muted')
                    }
                  >
                    {state === 'done' ? <Check className="size-3" /> : state === 'error' ? <X className="size-3" /> : i + 1}
                  </span>
                  <span className={state === 'pending' ? 'text-muted' : ''}>{label}</span>
                  {state === 'active' && <Spinner />}
                </li>
              );
            })}
          </ol>
        )}

        <div role="status" aria-live="polite">
          {status.kind === 'success' && <Notice tone="success" title="Ingested">{status.message}</Notice>}
          {status.kind === 'error' && <Notice tone="error" title="Upload failed">{status.message}</Notice>}
          {status.kind === 'uploading' && <p className="sr-only">{status.message}</p>}
        </div>

        <p className="font-mono text-[11px] leading-relaxed text-muted">
          Posts to {UPLOAD_WEBHOOK_URL || 'VITE_UPLOAD_WEBHOOK_URL (not set)'}. Requires the ingestion workflow to be active in n8n.
        </p>
      </div>
    </div>
  );
}

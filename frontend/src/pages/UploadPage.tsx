import { useRef, useState, DragEvent, ChangeEvent } from 'react';

const UPLOAD_WEBHOOK_URL = import.meta.env.VITE_UPLOAD_WEBHOOK_URL;
const BINARY_FIELD_NAME = 'data'; // must match the ingestion webhook node's binaryPropertyName
const ACCEPTED_TYPES =
  '.pdf,.docx,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type Status = { kind: 'idle' | 'uploading' | 'success' | 'error'; message: string };

export default function UploadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle', message: '' });

  function pickFile(f: File | null) {
    setFile(f);
    setStatus({ kind: 'idle', message: '' });
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
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

    setStatus({ kind: 'uploading', message: `Uploading ${file.name}...` });

    try {
      const formData = new FormData();
      formData.append(BINARY_FIELD_NAME, file, file.name);

      const response = await fetch(UPLOAD_WEBHOOK_URL, {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json()
        : { message: await response.text() };

      if (response.ok) {
        setStatus({
          kind: 'success',
          message: payload?.message || 'Document ingested successfully.',
        });
        pickFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setStatus({
          kind: 'error',
          message: payload?.message || `Upload failed (HTTP ${response.status}).`,
        });
      }
    } catch (err) {
      setStatus({
        kind: 'error',
        message: `Could not reach the ingestion workflow: ${(err as Error).message}`,
      });
    }
  }

  const isUploading = status.kind === 'uploading';

  return (
    <div className="card">
      <h1>Upload a document</h1>
      <p className="subtitle">
        Adds this file to the internal knowledge base (PDF, DOCX, TXT, or Markdown).
      </p>

      <div
        className={`dropzone${dragOver ? ' dragover' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <p>{file ? 'Selected:' : 'Click to choose a file, or drag one here'}</p>
        <div className="filename">{file?.name ?? ''}</div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        style={{ display: 'none' }}
        onChange={onInputChange}
      />

      <button className="primary-button" disabled={!file || isUploading} onClick={upload}>
        {isUploading ? 'Uploading...' : 'Upload'}
      </button>

      {status.message && (
        <div className={`status-message ${status.kind === 'error' ? 'error' : status.kind === 'success' ? 'success' : ''}`}>
          {status.message}
        </div>
      )}

      <div className="hint">
        Posts to <code>{UPLOAD_WEBHOOK_URL || 'VITE_UPLOAD_WEBHOOK_URL (not set)'}</code>.
        Requires the ingestion workflow to be activated in n8n.
      </div>
    </div>
  );
}

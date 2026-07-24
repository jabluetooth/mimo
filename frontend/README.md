# Mimo — Web

Frontend for Mimo, the RAG Internal Knowledge Assistant portfolio project (see `../PRD-RAG-Internal-Assistant.md`):

- **/login**, **/signup** — email/password auth against the "Mimo Auth" n8n workflow (`../n8n/auth-workflow.json`); stores the returned JWT in localStorage.
- **/chat** — a bespoke transcript UI (no chat-widget library) that POSTs directly to the query workflow's Chat Trigger webhook and parses its reply into a status pill + formatted answer + source chips. Requires login.
- **/upload** — drag-and-drop upload form that POSTs documents to the ingestion workflow's webhook, with a visibility picker (everyone / admins-only). Requires the `admin` role.
- **/library** — lists ingested documents via the "List Documents" n8n workflow. Requires login.
- **/dashboard** — query volume, refusal rate, and latency stats via the "Dashboard Stats" n8n workflow (`../n8n/dashboard-stats-workflow.json`), which reads the `query_logs` table in Neon. Requires the `admin` role.

All pages just call n8n webhooks directly; there is no backend of its own here. Auth state and route guards live in `src/auth/` (`AuthContext.tsx`, `RequireAuth.tsx`).

## Setup

```bash
cp .env.example .env   # then verify the chat URL against the n8n editor (see note in .env.example)
npm install
npm run dev
```

## Build / deploy

```bash
npm run build      # outputs to dist/
npm run preview    # sanity-check the production build locally
```

Deploying to Vercel: set the project root to this `frontend/` directory, and set all six
`VITE_*` variables from `.env.example` (chat, upload, list-documents, dashboard-stats,
auth-signup, auth-login) as environment variables in the Vercel project settings.
`vercel.json` handles the SPA rewrite so every route resolves on direct load/refresh.

## Known gaps

- The Chat Trigger webhook URL is a best guess based on the node's `webhookId` —
  confirm it against the exact URL n8n shows in the Chat Trigger node panel.
- The ingestion webhook requires the "RAG Ingestion Workflow" to be **activated**
  in n8n; otherwise only the `webhook-test/upload-document` path responds, and
  only once per manual "Listen for test event" click.

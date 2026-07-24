# Mimo — Web

Two-page frontend for Mimo, the RAG Internal Knowledge Assistant portfolio project (see `../PRD-RAG-Internal-Assistant.md`):

- **/chat** — embeds n8n's `@n8n/chat` widget, wired to the query workflow's Chat Trigger.
- **/upload** — drag-and-drop upload form that POSTs documents to the ingestion workflow's webhook.
- **/library** — lists ingested documents via the "List Documents" n8n workflow.
- **/dashboard** — query volume, refusal rate, and latency stats via the "Dashboard Stats" n8n workflow (`../n8n/dashboard-stats-workflow.json`), which reads the `query_logs` table in Neon.

All pages just call n8n webhooks directly; there is no backend of its own here.

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

Deploying to Vercel: set the project root to this `frontend/` directory, and set
`VITE_CHAT_WEBHOOK_URL` / `VITE_UPLOAD_WEBHOOK_URL` as environment variables in the
Vercel project settings (values from `.env.example`). `vercel.json` handles the
SPA rewrite so `/chat` and `/upload` resolve on direct load/refresh.

## Known gaps

- The Chat Trigger webhook URL is a best guess based on the node's `webhookId` —
  confirm it against the exact URL n8n shows in the Chat Trigger node panel.
- The ingestion webhook requires the "RAG Ingestion Workflow" to be **activated**
  in n8n; otherwise only the `webhook-test/upload-document` path responds, and
  only once per manual "Listen for test event" click.

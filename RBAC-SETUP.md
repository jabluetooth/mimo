# RBAC Setup Guide

This is the manual n8n-side setup required to activate the role-based access control implemented in this commit. All of the code (frontend, workflow JSON) is done — these are the steps that have to happen inside your own n8n instance, since I don't have API write access to create credentials or import workflows there.

## 1. Generate the two secrets

```bash
node n8n/generate-secrets.js
```

Run this yourself — it generates fresh random secrets locally and only prints them to your own terminal, so they never pass through chat or any log. It also saves them to `n8n/rbac-secrets.local` (already git-ignored via the repo's `*.local` rule) in case you need to come back to them before both credentials below are set up. **Delete that file once both credentials exist** — no reason to keep plaintext secrets on disk after that.

## 2. Create two credentials in n8n

**Credential 1 — "RAG JWT"**
- Type: **JWT Auth**
- Key Type: Passphrase
- Secret: the "JWT secret" value from step 1
- Algorithm: HS256

**Credential 2 — "RAG Password Pepper"**
- Type: **Crypto**
- HMAC Secret: the "Password pepper" value from step 1
- (leave other fields at their defaults)

## 3. Import the workflow

- Workflows → Import from File → `n8n/mimo-workflow.json`. This is the single workflow that handles auth (signup/login), chat, upload, library listing, and the dashboard stats endpoint — all under one webhook-bearing canvas.
- Remap credentials where n8n prompts for them:
  - JWT nodes (`Sign JWT (Signup)`, `Sign JWT (Login)`, `JWT Verify (Chat)`, `JWT Verify (Upload)`, `JWT Verify (List Documents)`, `JWT` on the dashboard branch) → **RAG JWT**.
  - Crypto nodes (`Hash Password (Signup)`, `Hash Submitted Password (Login)`, `Generate Salt (Signup)`) → **RAG Password Pepper**.
  - Postgres/Qdrant/HuggingFace/Groq nodes → your existing credentials of those types.
- Activate the workflow, then **Publish** — Save alone does not push changes live; publishing is a separate, explicit step, and only the published version serves webhook traffic.

## 4. Sign up and get promoted to admin

- Once the workflow is live, sign up for an account through the actual app at `/signup`.
- Tell me the email you used and I'll run one SQL command against the `users` table in Neon to set your account's role to `admin` (new accounts default to `member`).

## What this gets you

- No more anonymous access anywhere — chat and the library require login; upload and the dashboard require the `admin` role.
- Retrieval itself is role-aware: documents uploaded as "Admins only" never surface in a member's answers or citations, enforced server-side in the retrieval code, not just hidden in the UI.
- Existing documents (uploaded before this change) default to `member`-visible, so nothing already in the knowledge base disappears.

## Known limitations (being upfront about them)

- Password hashing is salted HMAC-SHA256 with a server-side pepper, not bcrypt/scrypt/argon2 — real cryptographic practice, but without the deliberate slowness those functions add against offline brute-forcing of a stolen database. Reasonable for this project's scale; would want upgrading for a real production deployment with many users.
- No password reset flow, no email verification, no rate-limiting on login attempts.
- Roles are just `admin`/`member` — no per-document custom ACLs beyond the one visibility bit.
- Promoting a user to admin is a manual SQL step for now, not an admin UI.
- Auth, chat/upload/library, and the dashboard all live on one workflow canvas rather than three separate workflows — n8n's "Import from File" adds nodes to whatever canvas is open rather than replacing it, so keeping this as one file avoids that trap. Functionally equivalent either way, since webhook routing is per-trigger-node, not per-workflow.

# RBAC Setup Guide

This is the manual n8n-side setup required to activate the role-based access control implemented in this commit. All of the code (frontend, workflow JSON) is done — these are the steps that have to happen inside your own n8n instance, since I don't have API write access to create credentials or import workflows there.

**Do not commit the two secrets below anywhere.** They were generated for you in chat, not in this file, on purpose.

## 1. Create two credentials in n8n

**Credential 1 — "RAG JWT"**
- Type: **JWT Auth**
- Key Type: Passphrase
- Secret: the JWT secret provided in chat
- Algorithm: HS256

**Credential 2 — "RAG Password Pepper"**
- Type: **Crypto**
- HMAC Secret: the pepper secret provided in chat
- (leave other fields at their defaults)

## 2. Import the Auth workflow

- Workflows → Import from File → `n8n/auth-workflow.json`
- It has two JWT nodes ("Sign JWT (Signup)", "Sign JWT (Login)") referencing a placeholder credential ID — n8n should prompt you to pick a real credential of the same type; choose **RAG JWT** for both.
- It also has two Crypto nodes ("Hash Password (Signup)", "Hash Submitted Password (Login)") that need **RAG Password Pepper**.
- The Postgres nodes should already point at your existing **RAG Neon** credential (same ID reused from your other workflows) — confirm they show as connected, not blank.
- Activate the workflow, then **Publish** (Save alone isn't enough for an active workflow, as we found out earlier).

## 3. Replace the combined workflow

- Open the existing **Mimo RAG - Combined Workflow** (the one already running your chat/upload/library traffic).
- Use its **Import from File** option (not "create new") and select `n8n/combined-workflow-rbac.json` — this replaces the canvas contents of that *same* workflow (same ID, same webhook paths), rather than creating a duplicate. A duplicate would collide on webhook paths since the trigger nodes' IDs are unchanged.
- Remap credentials the same way: the new JWT nodes ("JWT Verify (Chat)", "JWT Verify (Upload)", "JWT Verify (List Documents)") → **RAG JWT**.
- Save, confirm it's still Active, then **Publish**.

## 4. Update the Dashboard Stats workflow

- Same idea: open **Mimo RAG - Dashboard Stats**, Import from File → `n8n/dashboard-stats-workflow.json` (already updated in place — it now includes a JWT gate).
- Remap the new "JWT Verify (Dashboard)" node → **RAG JWT**.
- Save, Activate if needed, **Publish**.

## 5. Sign up and get promoted to admin

- Once the Auth workflow is live, sign up for an account through the actual app at `/signup`.
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

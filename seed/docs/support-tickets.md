---
title: Resolved Support Tickets - Knowledge Base Excerpts
last_updated: 2026-07-01
owner: support-team
---

## Ticket #4821 - Export button returns 500 error for large date ranges

Client reported that exporting usage reports for a date range longer than 90 days consistently returned a 500 error, while shorter ranges worked fine. Root cause: the export job was timing out at the 30-second worker limit when the query spanned more than ~90 days of row-level data. Resolution: added pagination to the export job so it streams results in 30-day chunks and stitches them into the final file, rather than running one large query. Also added a user-facing warning when a client selects a range over 180 days, suggesting they split the export. Fixed in release 4.12.0.

## Ticket #5103 - SSO login loop for a client using Okta

Client using Okta as their SSO provider reported being redirected back to the login page in a loop after successfully authenticating. Root cause: our SAML assertion consumer service was rejecting the assertion because the client's Okta configuration sent group attributes in a format our parser didn't expect (nested arrays instead of flat strings). Resolution: updated the SAML attribute parser to handle both flat and nested group attribute formats. This same root cause was later found in two additional Okta-based clients and proactively patched before they reported it.

## Ticket #5390 - Duplicate invoice emails sent to enterprise client

An enterprise client reported receiving the same monthly invoice email three times. Root cause: a retry-on-timeout mechanism in the billing notification job did not check whether the email had already been successfully sent before retrying, so transient network delays (not actual failures) triggered duplicate sends. Resolution: added an idempotency key per invoice-send event, checked before each send attempt. This is the same class of bug to watch for in any workflow with automatic retries — always pair retries with an idempotency check, not just a raw retry-with-backoff.

## Ticket #5602 - Refund not processed within stated SLA for enterprise account

Enterprise client asked why a refund approved two weeks earlier had not appeared on their statement, despite the refund policy stating requests are typically resolved within 5 business days. Root cause: the refund had been approved by Finance but the Account Manager sign-off step (required for enterprise refunds per policy) was never completed because the approval request email had gone to an inactive AM account after a personnel change. Resolution: processed the refund immediately and added an automated check that reassigns pending AM approvals if the assigned AM is marked inactive in the HR system, rather than leaving the request stuck silently.

---
title: Data Access & Security Policy
last_updated: 2026-04-18
owner: security-team
---

## Access Tiers

Company systems use three access tiers: Standard (default for all employees), Elevated (client financial data, granted per-engagement), and Restricted (production infrastructure credentials, granted only to on-call engineers). Elevated and Restricted access both expire automatically after 90 days and must be re-requested.

## Requesting Elevated Access

Elevated access requests go through the IT portal and require sign-off from your manager and the data owner for the specific client account. Approval typically takes 1-2 business days. Emergency same-day access can be granted by the on-call security lead but is automatically reviewed within 48 hours.

## Device and Password Requirements

All company devices must have full-disk encryption and a screen lock timeout of 5 minutes or less. Passwords must be at least 14 characters and are rotated every 180 days for Restricted-tier accounts; Standard-tier accounts use passwordless SSO and are not subject to rotation.

## Reporting a Security Incident

Suspected security incidents (lost device, phishing attempt, suspicious account activity) must be reported to security@company.com within 1 hour of discovery, not at end of day. The security team's target is to acknowledge within 30 minutes and contain within 4 hours for confirmed incidents.

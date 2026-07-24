// Generates the two secrets RBAC-SETUP.md asks you to paste into n8n
// credentials. Run it yourself so the values never pass through chat or any
// log -- this script never sends them anywhere, it only prints them and (if
// you keep the file) writes them to n8n/rbac-secrets.local, which is
// git-ignored via the repo's existing `*.local` rule.
//
// Usage: node n8n/generate-secrets.js

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const jwtSecret = crypto.randomBytes(32).toString('hex');
const pepperSecret = crypto.randomBytes(32).toString('hex');

const output = `Mimo RBAC secrets -- generated ${new Date().toISOString()}
Paste each value into the matching n8n credential (see RBAC-SETUP.md).
Do not commit this file or paste these values anywhere else.

JWT secret (n8n credential "RAG JWT" -> Secret field):
${jwtSecret}

Password pepper (n8n credential "RAG Password Pepper" -> HMAC Secret field):
${pepperSecret}
`;

console.log(output);

const outPath = path.join(__dirname, 'rbac-secrets.local');
fs.writeFileSync(outPath, output);
console.log(`Also saved to ${outPath} (git-ignored) in case you need it again before both credentials are set up.`);
console.log('Delete that file once both credentials are created -- there is no reason to keep plaintext secrets on disk after that.');

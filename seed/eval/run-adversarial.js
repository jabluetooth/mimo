// Sends each adversarial prompt to the production Chat webhook and checks
// that none of the forbidden strings (system-prompt fragments, injected
// claims) leaked into the answer.
//
// Chat requires an authenticated (member-role is enough) JWT -- pass one via
// MIMO_EVAL_TOKEN, e.g.:
//   MIMO_EVAL_TOKEN=<token> node run-adversarial.js
const fs = require("fs");
const path = require("path");
const { scoreAdversarial, summarizeAdversarial } = require("./score");

const CHAT_URL = "https://n8n.filheinzrelatorre.com/webhook/3d0b43af-45fb-436b-ace4-c668bdf7c8a5/chat";

const TOKEN = process.env.MIMO_EVAL_TOKEN;
if (!TOKEN) {
  console.error("Missing MIMO_EVAL_TOKEN -- chat requires a signed-in JWT. Sign up/log in and export the token.");
  process.exit(1);
}

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "adversarial.json"), "utf8"));

async function askCase(c) {
  const sessionId = `eval-adv-${c.id}-${Date.now()}`;
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatInput: c.prompt, sessionId, token: TOKEN }),
  });
  const payload = await res.json().catch(() => ({}));
  return scoreAdversarial(c, payload);
}

async function main() {
  const results = [];
  for (const c of cases) {
    process.stdout.write(`${c.id} [${c.category}]: ${c.prompt.slice(0, 55)}... `);
    const r = await askCase(c);
    results.push(r);
    console.log(r.errored ? "ERROR (empty reply)" : r.resisted ? "RESISTED" : `LEAKED (${r.leaked.join(", ")})`);
  }

  const summary = summarizeAdversarial(results);

  fs.writeFileSync(
    path.join(__dirname, "results-adversarial.json"),
    JSON.stringify({ summary, results }, null, 2)
  );

  console.log("\n=== Summary ===");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

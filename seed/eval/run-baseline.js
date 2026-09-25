// Runs the ground-truth question set against the production Chat webhook.
// Citations come straight from the structured JSON reply
// (status/confidence/body/citationsJson), so this no longer needs to dig
// through n8n's execution history via psql to find them.
//
// Chat requires an authenticated (member-role is enough) JWT -- pass one via
// MIMO_EVAL_TOKEN, e.g.:
//   MIMO_EVAL_TOKEN=<token> node run-baseline.js
const fs = require("fs");
const path = require("path");
const { scoreAnswer, summarize } = require("./score");

const CHAT_URL = "https://n8n.filheinzrelatorre.com/webhook/3d0b43af-45fb-436b-ace4-c668bdf7c8a5/chat";

const TOKEN = process.env.MIMO_EVAL_TOKEN;
if (!TOKEN) {
  console.error("Missing MIMO_EVAL_TOKEN -- chat requires a signed-in JWT. Sign up/log in and export the token.");
  process.exit(1);
}

const questions = JSON.parse(fs.readFileSync(path.join(__dirname, "questions.json"), "utf8"));

async function askQuestion(q) {
  const sessionId = `eval-${q.id}-${Date.now()}`;
  const start = Date.now();
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatInput: q.question, sessionId, token: TOKEN }),
  });
  const latencyMs = Date.now() - start;
  const payload = await res.json().catch(() => ({}));
  return scoreAnswer(q, payload, latencyMs);
}

async function main() {
  const results = [];
  for (const q of questions) {
    process.stdout.write(`${q.id}: ${q.question.slice(0, 60)}... `);
    const r = await askQuestion(q);
    results.push(r);
    console.log(
      r.outcome === "error"
        ? `ERROR (empty reply) | ${r.latencyMs}ms`
        : r.should_refuse
          ? r.correctRefusalBehavior ? "OK (refused)" : "FAIL (should have refused)"
          : `${r.retrievalHit ? "hit" : "MISS"} | facts ${r.factsHit}/${r.factsTotal} | ${r.latencyMs}ms`
    );
  }

  const summary = summarize(results);

  fs.writeFileSync(
    path.join(__dirname, "results-baseline.json"),
    JSON.stringify({ summary, results }, null, 2)
  );

  console.log("\n=== Summary ===");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

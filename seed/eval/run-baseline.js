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
  const payload = await res.json();
  const answer = payload.body || "";

  let citations = [];
  try {
    citations = JSON.parse(payload.citationsJson || "[]");
  } catch {
    citations = [];
  }

  const retrievedSources = citations.map((c) => c.source);
  const refused = payload.status === "refused";
  const citationPresent = /\[\d+\]/.test(answer);
  const factsHit = q.expected_facts.filter((f) => answer.toLowerCase().includes(f.toLowerCase())).length;

  return {
    id: q.id,
    question: q.question,
    answer,
    latencyMs,
    should_refuse: q.should_refuse,
    refused,
    correctRefusalBehavior: q.should_refuse ? refused : !refused,
    expected_source: q.expected_source,
    retrievedSources,
    retrievalHit: q.expected_source ? retrievedSources.includes(q.expected_source) : null,
    citationPresent,
    factsHit,
    factsTotal: q.expected_facts.length,
  };
}

async function main() {
  const results = [];
  for (const q of questions) {
    process.stdout.write(`${q.id}: ${q.question.slice(0, 60)}... `);
    const r = await askQuestion(q);
    results.push(r);
    console.log(
      r.should_refuse
        ? r.correctRefusalBehavior ? "OK (refused)" : "FAIL (should have refused)"
        : `${r.retrievalHit ? "hit" : "MISS"} | facts ${r.factsHit}/${r.factsTotal} | ${r.latencyMs}ms`
    );
  }

  const answerable = results.filter((r) => !r.should_refuse);
  const refusalCases = results.filter((r) => r.should_refuse);
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)];

  const summary = {
    total: results.length,
    retrievalAccuracy: answerable.filter((r) => r.retrievalHit).length / answerable.length,
    citationRate: answerable.filter((r) => r.citationPresent).length / answerable.length,
    factsCoverage:
      answerable.reduce((s, r) => s + r.factsHit / Math.max(r.factsTotal, 1), 0) / answerable.length,
    refusalCorrectness: refusalCases.filter((r) => r.correctRefusalBehavior).length / refusalCases.length,
    falseRefusalRate: answerable.filter((r) => r.refused).length / answerable.length,
    avgLatencyMs: Math.round(latencies.reduce((s, l) => s + l, 0) / latencies.length),
    p95LatencyMs: p95,
  };

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

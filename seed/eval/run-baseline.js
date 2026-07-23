// Runs the ground-truth question set against the production Chat webhook,
// then cross-references each execution in n8n's Postgres history to check
// whether the expected source doc was actually in the top reranked chunks
// (Build Grounded Context node) — not just whether the final answer sounds
// right.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { parse } = require("flatted");

const CHAT_URL = "https://n8n.filheinzrelatorre.com/webhook/3d0b43af-45fb-436b-ace4-c668bdf7c8a5/chat";
const WORKFLOW_ID = "2NRRzQ65Z3wyJ4Lv";

const questions = JSON.parse(fs.readFileSync(path.join(__dirname, "questions.json"), "utf8"));

// Uses execFileSync (argv array, no shell) so the query string's double
// quotes around n8n's camelCase Postgres columns don't get mangled by
// cmd.exe/sh quoting rules.
function psql(query) {
  const out = execFileSync(
    "docker",
    ["exec", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n", "-t", "-A", "-c", query],
    { maxBuffer: 1024 * 1024 * 20 }
  );
  return out.toString();
}

function latestExecutionId() {
  const out = psql(
    `SELECT id FROM execution_entity WHERE "workflowId" = '${WORKFLOW_ID}' ORDER BY "startedAt" DESC LIMIT 1;`
  );
  return out.trim();
}

function fetchExecutionRunData(execId) {
  const raw = psql(`SELECT data FROM execution_data WHERE "executionId" = ${execId};`);
  const data = parse(raw);
  return data.resultData.runData;
}

function extractCitations(runData) {
  try {
    const node = runData["Build Grounded Context"][0];
    return node.data.main[0][0].json.citations || [];
  } catch {
    return [];
  }
}

async function askQuestion(q) {
  const sessionId = `eval-${q.id}-${Date.now()}`;
  const start = Date.now();
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatInput: q.question, sessionId }),
  });
  const latencyMs = Date.now() - start;
  const body = await res.json();
  const answer = body.output || "";

  await new Promise((r) => setTimeout(r, 400)); // let n8n finish writing execution_entity/data

  let citations = [];
  try {
    const execId = latestExecutionId();
    const runData = fetchExecutionRunData(execId);
    citations = extractCitations(runData);
  } catch (err) {
    console.error(`  (warning: couldn't fetch execution data for ${q.id}: ${err.message})`);
  }

  const retrievedSources = citations.map((c) => c.source);
  const refused = /don't have information|not found in knowledge base/i.test(answer);
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

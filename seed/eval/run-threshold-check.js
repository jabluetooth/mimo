// Targeted re-test after lowering the Confidence Check threshold from 0.5 to
// 0.45: re-runs the 3 previously false-refused security-policy questions
// (expecting recovery) plus the 5 designed-refusal questions (expecting no
// regression / no new false positives).
const fs = require("fs");
const path = require("path");

const CHAT_URL = "https://n8n.filheinzrelatorre.com/webhook/3d0b43af-45fb-436b-ace4-c668bdf7c8a5/chat";

const allQuestions = JSON.parse(fs.readFileSync(path.join(__dirname, "questions.json"), "utf8"));
const targetIds = ["q20", "q21", "q22", "q26", "q27", "q28", "q29", "q30"];
const questions = allQuestions.filter((q) => targetIds.includes(q.id));

async function ask(q) {
  const sessionId = `eval-threshold-${q.id}-${Date.now()}`;
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatInput: q.question, sessionId }),
  });
  const body = await res.json();
  const answer = body.output || "";
  const refused = /don't have information|not found in knowledge base/i.test(answer);
  return { id: q.id, question: q.question, should_refuse: q.should_refuse, refused, answer };
}

async function main() {
  const results = [];
  for (const q of questions) {
    process.stdout.write(`${q.id} (should_refuse=${q.should_refuse}): `);
    const r = await ask(q);
    results.push(r);
    const ok = q.should_refuse ? r.refused : !r.refused;
    console.log(`${r.refused ? "refused" : "answered"} -> ${ok ? "OK" : "REGRESSION"}`);
  }
  fs.writeFileSync(
    path.join(__dirname, "results-threshold-recheck.json"),
    JSON.stringify(results, null, 2)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

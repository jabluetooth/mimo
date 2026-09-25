// Re-scores a stored results file with the current scorer (score.js),
// without calling production again: the answers, cited sources and
// latencies are all already in the file. Use it after a scoring fix, so the
// numbers reflect what the system actually did rather than the old scorer's
// blind spots.
//
//   node rescore.js                              # results-baseline.json, in place
//   node rescore.js results-adversarial.json     # the adversarial suite
//   node rescore.js results-baseline.json --dry  # print, don't write
const fs = require("fs");
const path = require("path");
const { scoreAnswer, summarize, scoreAdversarial, summarizeAdversarial } = require("./score");

/** Rebuilds the chat webhook's structured reply from one stored result row. */
function payloadFrom(row) {
  return {
    status: row.refused ? "refused" : "grounded",
    body: row.answer,
    citationsJson: JSON.stringify((row.retrievedSources || []).map((source) => ({ source }))),
  };
}

function rescoreBaseline(stored, questions) {
  const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
  const results = stored.results.map((row) => {
    const q = byId[row.id];
    if (!q) throw new Error(`Result ${row.id} has no matching question in questions.json`);
    return scoreAnswer(q, payloadFrom(row), row.latencyMs);
  });
  return { summary: summarize(results), results };
}

function rescoreAdversarial(stored, cases) {
  const byId = Object.fromEntries(cases.map((c) => [c.id, c]));
  const results = stored.results.map((row) => {
    const c = byId[row.id];
    if (!c) throw new Error(`Result ${row.id} has no matching case in adversarial.json`);
    return scoreAdversarial(c, { status: "grounded", body: row.answer });
  });
  return { summary: summarizeAdversarial(results), results };
}

function main() {
  const file = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "results-baseline.json";
  const dry = process.argv.includes("--dry");
  const filePath = path.join(__dirname, file);
  const stored = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const read = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, name), "utf8"));

  const isAdversarial = stored.results.some((r) => "leaked" in r);
  const rescored = isAdversarial
    ? rescoreAdversarial(stored, read("adversarial.json"))
    : rescoreBaseline(stored, read("questions.json"));

  console.log("Before:", JSON.stringify(stored.summary));
  console.log("After: ", JSON.stringify(rescored.summary));
  if (!dry) fs.writeFileSync(filePath, JSON.stringify(rescored, null, 2) + "\n");
}

if (require.main === module) main();

module.exports = { payloadFrom, rescoreBaseline, rescoreAdversarial };

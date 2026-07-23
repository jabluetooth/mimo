require("dotenv").config({ path: "../.env" });
const { QdrantClient } = require("@qdrant/js-client-rest");
const { embed } = require("./embed");

const COLLECTION = "company_docs";
const HF_TOKEN = process.env.HF;
const TOP_K = 3;
// FR-8: below this, the system should refuse rather than guess.
const RELEVANCE_THRESHOLD = 0.55;

const qdrant = new QdrantClient({ url: "http://localhost:6333" });

async function search(question) {
  const vector = await embed(question, HF_TOKEN);
  const results = await qdrant.search(COLLECTION, {
    vector,
    limit: TOP_K,
    with_payload: true,
  });
  return results;
}

function printResult(question, results) {
  console.log(`\nQ: ${question}`);
  const best = results[0];
  if (!best || best.score < RELEVANCE_THRESHOLD) {
    console.log(`  → REFUSED (best score ${best ? best.score.toFixed(3) : "n/a"} < threshold ${RELEVANCE_THRESHOLD})`);
    console.log(`  → "I don't have information on this."`);
    return;
  }
  results.forEach((r, i) => {
    console.log(
      `  [${i + 1}] score=${r.score.toFixed(3)}  source="${r.payload.source}"  section="${r.payload.section}"  updated=${r.payload.last_updated}`
    );
    console.log(`      ${r.payload.text.slice(0, 140).replace(/\n/g, " ")}...`);
  });
}

async function main() {
  const questions = process.argv.slice(2);
  const testSet = questions.length
    ? questions
    : [
        "What's our refund policy for enterprise clients?",
        "What's the process for requesting time off during a client engagement?",
        "Summarize what changed in the vendor contract from Q1 to Q2.",
        "Has this exact support issue come up before, and how was it resolved? Duplicate invoice emails.",
        "What is the CEO's home address?", // should be refused — not in corpus
      ];

  for (const q of testSet) {
    const results = await search(q);
    printResult(q, results);
  }
}

main().catch((err) => {
  console.error("Query failed:", err);
  process.exit(1);
});

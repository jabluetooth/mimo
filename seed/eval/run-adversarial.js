// Sends each adversarial prompt to the production Chat webhook and checks
// that none of the forbidden strings (system-prompt fragments, injected
// claims) leaked into the answer.
const fs = require("fs");
const path = require("path");

const CHAT_URL = "https://n8n.filheinzrelatorre.com/webhook/3d0b43af-45fb-436b-ace4-c668bdf7c8a5/chat";

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "adversarial.json"), "utf8"));

async function askCase(c) {
  const sessionId = `eval-adv-${c.id}-${Date.now()}`;
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatInput: c.prompt, sessionId }),
  });
  const body = await res.json();
  const answer = body.output || "";
  const leaked = c.must_not_contain.filter((s) => answer.toLowerCase().includes(s.toLowerCase()));
  return { id: c.id, category: c.category, prompt: c.prompt, answer, leaked, resisted: leaked.length === 0 };
}

async function main() {
  const results = [];
  for (const c of cases) {
    process.stdout.write(`${c.id} [${c.category}]: ${c.prompt.slice(0, 55)}... `);
    const r = await askCase(c);
    results.push(r);
    console.log(r.resisted ? "RESISTED" : `LEAKED (${r.leaked.join(", ")})`);
  }

  const summary = {
    total: results.length,
    resistanceRate: results.filter((r) => r.resisted).length / results.length,
    byCategory: {},
  };
  for (const cat of [...new Set(results.map((r) => r.category))]) {
    const inCat = results.filter((r) => r.category === cat);
    summary.byCategory[cat] = inCat.filter((r) => r.resisted).length + "/" + inCat.length;
  }

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

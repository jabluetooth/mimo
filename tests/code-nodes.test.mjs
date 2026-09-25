// The workflow's Code nodes, run from the real export (n8n/mimo-workflow.json)
// with n8n-shaped inputs. See helpers/n8n.mjs.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runCode } from "./helpers/n8n.mjs";

// ------------------------------------------------ Constant-Time Compare

describe("Constant-Time Compare (Login)", () => {
  const compare = (submitted, stored) =>
    runCode("Constant-Time Compare (Login)", {
      input: [{ passwordHash: submitted }],
      nodes: { "Fetch User (Login)": [{ password_hash: stored }] },
    })[0].json.passwordMatches;

  it("accepts the matching hash", () => assert.equal(compare("ab12cd", "ab12cd"), true));
  it("rejects a hash that differs in one character", () => assert.equal(compare("ab12cd", "ab12ce"), false));
  it("rejects a hash that differs only in the first character", () => assert.equal(compare("xb12cd", "ab12cd"), false));
  it("rejects a prefix of the stored hash", () => assert.equal(compare("ab12", "ab12cd"), false));
  it("rejects an empty or missing hash rather than matching it", () => {
    assert.equal(compare("", "ab12cd"), false);
    assert.equal(compare(undefined, "ab12cd"), false);
    assert.equal(compare("ab12cd", null), false);
  });
  it("is case-sensitive, like the hex digest it compares", () => assert.equal(compare("AB12CD", "ab12cd"), false));
});

// ------------------------------------------------ Build Grounded Context

const chunk = (content, metadata = {}) => ({ document: { pageContent: content, metadata } });

function build({ chunks, scores, role = "member", scoreShape = "array" }) {
  const input =
    scoreShape === "array"
      ? [scores] // HF returns one JSON array, which n8n hands over as one item
      : scoreShape === "data"
        ? [{ data: scores }]
        : scores.map((s) => ({ data: s })); // one item per score
  return runCode("Build Grounded Context", {
    input,
    nodes: {
      "Retrieve Candidate Chunks": chunks,
      "JWT Verify (Chat)": [{ payload: { role } }],
    },
  })[0].json;
}

describe("Build Grounded Context: ranking and citations", () => {
  const chunks = [
    chunk("PTO accrues monthly.", { source: "pto-policy.md", section: "Accrual", updated_at: "2026-06-01" }),
    chunk("Refunds within 30 days.", { source: "refund-policy.md", section: "Enterprise", updated_at: "2026-05-01" }),
    chunk("Tickets get a reply in 4h.", { source: "support-tickets.md" }),
  ];

  it("puts the highest reranker score first and reports it as the confidence", () => {
    const out = build({ chunks, scores: [0.2, 0.9, 0.5] });
    assert.equal(out.topScore, 0.9);
    assert.deepEqual(out.citations.map((c) => c.source), ["refund-policy.md", "support-tickets.md", "pto-policy.md"]);
  });

  it("numbers the context so the model's [n] markers map to citations", () => {
    const out = build({ chunks, scores: [0.2, 0.9, 0.5] });
    assert.ok(out.contextText.startsWith("[1] Source: refund-policy.md | Section: Enterprise | Last updated: 2026-05-01\nRefunds within 30 days."));
    assert.match(out.contextText, /\n\n\[2\] Source: support-tickets\.md \| Section: n\/a \| Last updated: n\/a\n/);
    assert.equal(out.citations[0].marker, "[1]");
    assert.equal(out.citationsFormatted.split("\n")[0], "[1] refund-policy.md (Enterprise, updated 2026-05-01)");
  });

  it("keeps at most the top 4 chunks", () => {
    const many = Array.from({ length: 8 }, (_, i) => chunk(`c${i}`, { source: `s${i}.md` }));
    const out = build({ chunks: many, scores: [0.1, 0.8, 0.3, 0.7, 0.2, 0.6, 0.5, 0.4] });
    assert.equal(out.chunkCount, 4);
    assert.deepEqual(out.citations.map((c) => c.source), ["s1.md", "s3.md", "s5.md", "s6.md"]);
  });

  it("reads HuggingFace scores in all three shapes n8n can hand over", () => {
    for (const scoreShape of ["array", "data", "items"]) {
      assert.equal(build({ chunks, scores: [0.2, 0.9, 0.5], scoreShape }).topScore, 0.9, scoreShape);
    }
  });

  it("scores a chunk with no matching reranker score as 0 rather than crashing", () => {
    const out = build({ chunks, scores: [0.6] });
    assert.equal(out.topScore, 0.6);
    assert.equal(out.citations.at(-1).relevanceScore, 0);
  });

  it("labels a chunk with no metadata as an unknown source", () => {
    const out = build({ chunks: [{ document: { pageContent: "x" } }], scores: [0.7] });
    assert.equal(out.citations[0].source, "unknown source");
  });

  it("reports zero confidence when retrieval found nothing (so the gate refuses)", () => {
    const out = runCode("Build Grounded Context", {
      input: [{ document: { pageContent: "" } }], // the "no candidates" branch skips the reranker
      nodes: { "Retrieve Candidate Chunks": [], "JWT Verify (Chat)": [{ payload: { role: "member" } }] },
    })[0].json;
    assert.equal(out.topScore, 0);
    assert.equal(out.chunkCount, 0);
    assert.equal(out.contextText, "");
  });
});

describe("Build Grounded Context: role-based retrieval", () => {
  const chunks = [
    chunk("Board salary bands.", { source: "comp-bands.md", visibility: "admin" }),
    chunk("PTO accrues monthly.", { source: "pto-policy.md", visibility: "member" }),
    chunk("Legacy doc, uploaded before RBAC.", { source: "legacy.md" }),
  ];
  const scores = [0.95, 0.6, 0.5];

  it("never gives a member an admin-only chunk, even when it scores highest", () => {
    const out = build({ chunks, scores, role: "member" });
    assert.ok(!out.contextText.includes("salary"), "admin content must not reach the prompt");
    assert.deepEqual(out.citations.map((c) => c.source), ["pto-policy.md", "legacy.md"]);
  });

  it("computes a member's confidence from visible chunks only", () => {
    // Otherwise a hidden admin document would push a member's weak question past the gate.
    assert.equal(build({ chunks, scores, role: "member" }).topScore, 0.6);
  });

  it("gives an admin every chunk", () => {
    const out = build({ chunks, scores, role: "admin" });
    assert.equal(out.topScore, 0.95);
    assert.equal(out.chunkCount, 3);
  });

  it("treats a missing or unknown role as a member", () => {
    for (const role of [undefined, "", "superuser", "Admin"]) {
      assert.ok(!build({ chunks, scores, role }).contextText.includes("salary"), String(role));
    }
  });

  it("keeps documents uploaded before RBAC visible to members", () => {
    assert.ok(build({ chunks, scores, role: "member" }).citations.some((c) => c.source === "legacy.md"));
  });
});

// ------------------------------------------------ Aggregate By Source

const point = (metadata) => ({ payload: { metadata } });
const listDocs = (points, role = "admin") =>
  runCode("Aggregate By Source", {
    input: [{ result: { points } }],
    nodes: { "JWT Verify (List Documents)": [{ payload: { role } }] },
  })[0].json;

describe("Aggregate By Source (document library)", () => {
  it("groups chunks by file and counts them", () => {
    const out = listDocs([
      point({ source: "a.md", section: "Intro", updated_at: "2026-01-01" }),
      point({ source: "a.md", section: "Terms", updated_at: "2026-03-01" }),
      point({ source: "a.md", section: "Terms", updated_at: "2026-02-01" }),
      point({ source: "b.md", section: "Only" }),
    ]);
    assert.equal(out.count, 2);
    const a = out.documents.find((d) => d.source === "a.md");
    assert.equal(a.chunkCount, 3);
    assert.equal(a.sectionCount, 2, "sections are counted once each");
    assert.equal(a.updatedAt, "2026-03-01", "the latest update wins");
  });

  it("lists the most recently updated document first, undated last", () => {
    const out = listDocs([
      point({ source: "old.md", updated_at: "2025-01-01" }),
      point({ source: "undated.md" }),
      point({ source: "new.md", updated_at: "2026-09-01" }),
    ]);
    assert.deepEqual(out.documents.map((d) => d.source), ["new.md", "old.md", "undated.md"]);
  });

  it("reads points stored without a metadata wrapper", () => {
    const out = listDocs([{ payload: { source: "flat.md", updated_at: "2026-01-01" } }]);
    assert.equal(out.documents[0].source, "flat.md");
  });

  it("returns an empty library for an empty or malformed Qdrant response", () => {
    assert.deepEqual(listDocs([]), { documents: [], count: 0 });
    const out = runCode("Aggregate By Source", {
      input: [{}],
      nodes: { "JWT Verify (List Documents)": [{ payload: { role: "admin" } }] },
    })[0].json;
    assert.equal(out.count, 0);
  });

  it("hides admin-only documents from members, including their file names", () => {
    const points = [
      point({ source: "layoff-plan.pdf", visibility: "admin" }),
      point({ source: "pto-policy.md", visibility: "member" }),
      point({ source: "legacy.md" }),
    ];
    const member = listDocs(points, "member");
    assert.deepEqual(member.documents.map((d) => d.source).sort(), ["legacy.md", "pto-policy.md"]);
    assert.ok(!JSON.stringify(member).includes("layoff"), "no trace of the admin document");

    const admin = listDocs(points, "admin");
    assert.equal(admin.count, 3);
    assert.equal(admin.documents.find((d) => d.source === "layoff-plan.pdf").visibility, "admin");
  });
});

// ------------------------------------------------ Reattach Upload Binary

describe("Reattach Upload Binary", () => {
  it("carries the uploaded file past the auth nodes, which drop binary data", () => {
    const file = { data0: { fileName: "policy.pdf", mimeType: "application/pdf" } };
    const out = runCode("Reattach Upload Binary", {
      input: [{ payload: { role: "admin" } }],
      nodes: { "Upload Document": [{}] },
      binary: { "Upload Document": file },
    });
    assert.deepEqual(out, [{ json: { payload: { role: "admin" } }, binary: file }]);
  });
});

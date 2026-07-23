require("dotenv").config({ path: "../.env" });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const matter = require("gray-matter");
const { QdrantClient } = require("@qdrant/js-client-rest");
const { embed, EMBED_MODEL, EMBED_DIM } = require("./embed");

const DOCS_DIR = path.join(__dirname, "docs");
const COLLECTION = "company_docs";
const HF_TOKEN = process.env.HF;

if (!HF_TOKEN) {
  console.error("Missing HF token — check .env has HF=<token>");
  process.exit(1);
}

const qdrant = new QdrantClient({ url: "http://localhost:6333" });

// Deterministic id so re-ingesting the same doc/section overwrites the same
// point instead of creating duplicates (stand-in for FR-3's incremental re-index).
function stableId(key) {
  const hash = crypto.createHash("sha256").update(key).digest("hex").slice(0, 32);
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join("-");
}

// Chunk by H2 (##) section headers — a stand-in for FR-4's context-preserving
// chunking. Each chunk keeps its heading text so citations can point at a
// section, not just a document.
function chunkBySection(body) {
  const lines = body.split("\n");
  const chunks = [];
  let currentHeading = "Introduction";
  let buffer = [];

  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text) chunks.push({ heading: currentHeading, text });
    buffer = [];
  };

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)/);
    if (match) {
      flush();
      currentHeading = match[1].trim();
    } else {
      buffer.push(line);
    }
  }
  flush();
  return chunks;
}

async function main() {
  const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));
  if (files.length === 0) {
    console.error(`No .md files found in ${DOCS_DIR}`);
    process.exit(1);
  }

  const collections = await qdrant.getCollections();
  const exists = collections.collections.some((c) => c.name === COLLECTION);
  if (!exists) {
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: EMBED_DIM, distance: "Cosine" },
    });
    console.log(`Created collection "${COLLECTION}" (dim=${EMBED_DIM}, model=${EMBED_MODEL})`);
  } else {
    console.log(`Collection "${COLLECTION}" already exists — upserting into it`);
  }

  let totalChunks = 0;

  for (const file of files) {
    const raw = fs.readFileSync(path.join(DOCS_DIR, file), "utf8");
    const { data: frontmatter, content } = matter(raw);
    const source = frontmatter.title || file;
    const lastUpdated = frontmatter.last_updated || null;
    const owner = frontmatter.owner || null;

    const chunks = chunkBySection(content);
    console.log(`\n${file} → "${source}": ${chunks.length} section(s)`);

    const points = [];
    for (const chunk of chunks) {
      const vector = await embed(chunk.text, HF_TOKEN);
      const id = stableId(`${file}::${chunk.heading}`);
      points.push({
        id,
        vector,
        payload: {
          text: chunk.text,
          source,
          section: chunk.heading,
          last_updated: lastUpdated,
          owner,
          doc_file: file,
        },
      });
      console.log(`  - embedded section "${chunk.heading}" (${chunk.text.length} chars)`);
    }

    await qdrant.upsert(COLLECTION, { wait: true, points });
    totalChunks += points.length;
  }

  console.log(`\nDone. Upserted ${totalChunks} chunks from ${files.length} documents into "${COLLECTION}".`);
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});

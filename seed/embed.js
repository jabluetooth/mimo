const EMBED_MODEL = "BAAI/bge-small-en-v1.5";
const EMBED_DIM = 384;
const EMBED_URL = `https://router.huggingface.co/hf-inference/models/${EMBED_MODEL}/pipeline/feature-extraction`;

async function embed(text, hfToken) {
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hfToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HF embedding request failed (${res.status}): ${body}`);
  }

  const vector = await res.json();
  if (!Array.isArray(vector) || vector.length !== EMBED_DIM) {
    throw new Error(
      `Unexpected embedding shape: got ${JSON.stringify(vector).slice(0, 120)}`
    );
  }
  return vector;
}

module.exports = { embed, EMBED_MODEL, EMBED_DIM };

// The frontend's single seam to the n8n webhooks (frontend/src/lib/apiFetch.ts).
// Node 22.18+/24 strips the TypeScript types natively, so this imports the
// real source file with no build step or test framework.
import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import { apiFetch, ApiError } from "../frontend/src/lib/apiFetch.ts";

const original = globalThis.fetch;
let seen;
function respond(response) {
  seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({ url, init });
    return response;
  };
}
afterEach(() => {
  globalThis.fetch = original;
});

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("apiFetch", () => {
  it("attaches the bearer token", async () => {
    respond(json({ ok: true }));
    await apiFetch("https://n8n/webhook/list-documents", { token: "jwt-123" });
    assert.equal(seen[0].init.headers.Authorization, "Bearer jwt-123");
    assert.equal(seen[0].init.method, "GET");
  });

  it("sends no Authorization header when signed out", async () => {
    respond(json({}));
    await apiFetch("https://n8n/webhook/auth-login", { method: "POST", body: "{}" });
    assert.equal("Authorization" in seen[0].init.headers, false);
  });

  it("keeps caller headers alongside the token", async () => {
    respond(json({}));
    await apiFetch("/x", { token: "t", headers: { "Content-Type": "application/json" } });
    assert.deepEqual(seen[0].init.headers, { "Content-Type": "application/json", Authorization: "Bearer t" });
  });

  it("returns parsed JSON, or text for a non-JSON reply", async () => {
    respond(json({ documents: [], count: 0 }));
    assert.deepEqual(await apiFetch("/x"), { documents: [], count: 0 });
    respond(new Response("plain ok", { status: 200, headers: { "content-type": "text/plain" } }));
    assert.equal(await apiFetch("/x"), "plain ok");
  });

  it("raises the workflow's own error message with its status", async () => {
    respond(json({ error: "Only admins can upload documents" }, 403));
    await assert.rejects(apiFetch("/x"), (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 403);
      assert.equal(err.message, "Only admins can upload documents");
      return true;
    });
  });

  it("falls back to a message field, then to the HTTP status", async () => {
    respond(json({ status: "error", message: "Document could not be processed." }, 500));
    await assert.rejects(apiFetch("/x"), /Document could not be processed/);
    respond(new Response("<html>Bad gateway</html>", { status: 502, headers: { "content-type": "text/html" } }));
    await assert.rejects(apiFetch("/x"), (err) => err.status === 502 && err.message === "HTTP 502");
  });

  it("does not crash on a JSON content-type with an empty body", async () => {
    respond(new Response("", { status: 401, headers: { "content-type": "application/json" } }));
    await assert.rejects(apiFetch("/x"), (err) => err.status === 401 && err.message === "HTTP 401");
  });
});

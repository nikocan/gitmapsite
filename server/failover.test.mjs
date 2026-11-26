import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const server = fileURLToPath(new URL("server.mjs", import.meta.url));
// Sahte sağlayıcı: yol ve davranış verilen işleve bırakılır
async function fake(handler) {
  const seen = [];
  const s = http.createServer(async (req, res) => {
    let body = ""; for await (const c of req) body += c;
    const j = body ? JSON.parse(body) : null; seen.push({ url: req.url, body: j, auth: req.headers.authorization });
    const [status, out] = handler(req.url, j);
    res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(out));
  });
  s.listen(0, "127.0.0.1"); await once(s, "listening");
  return { base: "http://127.0.0.1:" + s.address().port, seen, close: () => s.close() };
}
async function start(t, env) {
  const dir = mkdtempSync(join(tmpdir(), "gitmapp-failover-"));
  const child = spawn(process.execPath, [server], { env: { ...process.env, PORT: "0", DB_PATH: join(dir, "db"), SECRET: randomBytes(32).toString("hex"), GITHUB_CLIENT_ID: "", GOOGLE_CLIENT_ID: "", ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; child.stderr.on("data", (d) => { log += d; });
  t.after(async () => { if (child.exitCode === null) { const end = once(child, "exit"); child.kill(); await end; } rmSync(dir, { recursive: true, force: true }); });
  const ready = await Promise.race([once(child.stdout, "data").then(([b]) => b.toString()), once(child, "exit").then(() => { throw new Error("API başlamadı"); })]);
  return { port: ready.match(/API :(\d+)/)[1], log: () => log };
}

test("birincil sağlayıcı bakiye bitti (402) → istek yedek sağlayıcıya gider, Claude için istem önbelleği eklenir", async (t) => {
  const primary = await fake((url) => url.endsWith("/models") ? [404, {}] : [402, { error: { message: "insufficient credits" } }]);
  const backup = await fake((url) => url.endsWith("/models") ? [200, { data: [{ id: "anthropic/claude-sonnet-4.5" }, { id: "openai/gpt-5.2" }] }] : [200, { choices: [{ message: { content: "yedekten yanıt" }, finish_reason: "stop" }], usage: { total_tokens: 10 } }]);
  t.after(() => { primary.close(); backup.close(); });
  const api = await start(t, { AI_BASE: primary.base, AI_KEY: "k-primary", AI_MODELS: "claude-sonnet-4.5", COPILOT_MODEL: "claude-sonnet-4.5", OPENROUTER_API_KEY: "k-backup", AI_FALLBACKS: "openrouter", TEST_PROVIDER_BASE: backup.base });
  const r = await fetch("http://127.0.0.1:" + api.port + "/api/ai/copilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "merhaba" }] }) });
  const j = await r.json();
  assert.equal(r.status, 200, JSON.stringify(j));
  assert.equal(j.reply, "yedekten yanıt");
  const call = backup.seen.find((x) => x.url.endsWith("/chat/completions"));
  assert.equal(call.body.model, "anthropic/claude-sonnet-4.5");
  assert.equal(call.auth, "Bearer k-backup");
  assert.equal(call.body.messages[0].content[0].cache_control.type, "ephemeral");
  const health = await (await fetch("http://127.0.0.1:" + api.port + "/api/health")).json();
  assert.deepEqual(health.aiFallbacks, ["openrouter"]);
});

test("yedek tanımlı değilse birincilin anlaşılır hatası döner", async (t) => {
  const primary = await fake((url) => url.endsWith("/models") ? [404, {}] : [402, { error: { message: "insufficient credits" } }]);
  t.after(() => primary.close());
  const api = await start(t, { AI_BASE: primary.base, AI_KEY: "k-primary", AI_MODELS: "claude-sonnet-4.5", COPILOT_MODEL: "claude-sonnet-4.5", OPENROUTER_API_KEY: "", ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "", GEMINI_API_KEY: "", DEEPSEEK_API_KEY: "" });
  const r = await fetch("http://127.0.0.1:" + api.port + "/api/ai/copilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "merhaba" }] }) });
  const j = await r.json();
  assert.notEqual(r.status, 200);
  assert.match(j.error, /bakiye bitti \(402\)/);
});

test("çok modelli ana sağlayıcıda kullanıcıya yalnızca seçilen modeller gösterilir, Hostinger adları eşlenir", async (t) => {
  const many = Array.from({ length: 60 }, (_, i) => ({ id: "vendor" + i + "/model-" + i })).concat([{ id: "anthropic/claude-sonnet-4.5" }, { id: "anthropic/claude-opus-4.5" }]);
  const primary = await fake((url) => url.endsWith("/models") ? [200, { data: many }] : [200, { choices: [{ message: { content: "ok" } }] }]);
  t.after(() => primary.close());
  const api = await start(t, { AI_BASE: primary.base, AI_KEY: "k", AI_MODELS: "claude-sonnet-4.5,claude-opus-4.5", AI_MODEL: "claude-sonnet-4.5" });
  const j = await (await fetch("http://127.0.0.1:" + api.port + "/api/ai/models")).json();
  assert.deepEqual(j.platform.map((m) => m.id), ["anthropic/claude-sonnet-4.5", "anthropic/claude-opus-4.5"]);
  assert.equal(j.default, "anthropic/claude-sonnet-4.5");
});

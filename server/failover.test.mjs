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
  assert.match(j.error, /bakiye yetmedi \(402\)/);
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

test("seçkin sette takma ad ve :batch varyantları atlanır", async (t) => {
  const many = Array.from({ length: 50 }, (_, i) => ({ id: "v" + i + "/m-" + i })).concat([{ id: "~anthropic/claude-sonnet-latest" }, { id: "anthropic/claude-sonnet-4.5" }, { id: "openai/gpt-5:batch" }, { id: "openai/gpt-5" }]);
  const primary = await fake((url) => url.endsWith("/models") ? [200, { data: many }] : [200, { choices: [{ message: { content: "ok" } }] }]);
  t.after(() => primary.close());
  const api = await start(t, { AI_BASE: primary.base, AI_KEY: "k", AI_MODELS: "", AI_MODEL: "" });
  const ids = (await (await fetch("http://127.0.0.1:" + api.port + "/api/ai/models")).json()).platform.map((m) => m.id);
  assert.deepEqual(ids, ["anthropic/claude-sonnet-4.5", "openai/gpt-5"]);
});

test("tarayıcıda kalmış eski model adı (ör. claude-sonnet-4.5) hata vermez; en yakın açık modele geçilir", async (t) => {
  const seen = [];
  const primary = await fake((url, body) => { if (body) seen.push(body.model); return url.endsWith("/models") ? [200, { data: [{ id: "anthropic/claude-sonnet-5.5" }, { id: "anthropic/claude-opus-5.5" }, { id: "openai/gpt-5.4-mini" }] }] : [200, { choices: [{ message: { content: "Plan hazır" } }], usage: { total_tokens: 5 } }]; });
  t.after(() => primary.close());
  const api = await start(t, { AI_BASE: primary.base, AI_KEY: "k", AI_MODELS: "", AI_MODEL: "anthropic/claude-sonnet-5.5" });
  const u = await (await fetch("http://127.0.0.1:" + api.port + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "m@example.test", password: "sifre-12345", name: "M" }) })).json();
  const r = await fetch("http://127.0.0.1:" + api.port + "/api/ai/plan", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + u.token }, body: JSON.stringify({ prompt: "takvim uygulaması", model: "claude-sonnet-4.5" }) });
  const j = await r.json();
  assert.equal(r.status, 200, JSON.stringify(j));
  assert.equal(seen.at(-1), "anthropic/claude-sonnet-5.5");
});

test("OpenRouter 'can only afford' 402: aynı sağlayıcıda karşılanabilen uzunlukla tekrar denenir; olmazsa hata gerçek sağlayıcıyı ve denenenleri söyler", async (t) => {
  const seen = [];
  const primary = await fake((url, body) => { if (body) seen.push(body.max_tokens); return url.endsWith("/models") ? [200, { data: [{ id: "anthropic/claude-sonnet-5.5" }] }] : body.max_tokens > 2000 ? [402, { error: { message: "This request requires more credits, or fewer max_tokens. You requested up to 2200 tokens, but can only afford 2000." } }] : [200, { choices: [{ message: { content: JSON.stringify({ baslik: "a", metinler: { x: "kısa" } }) } }], usage: { total_tokens: 5 } }]; });
  const dead = await fake((url) => url.endsWith("/models") ? [200, { data: [{ id: "anthropic/claude-sonnet-5.5" }] }] : [402, { error: { message: "insufficient credits" } }]);
  t.after(() => { primary.close(); dead.close(); });
  const api = await start(t, { AI_BASE: primary.base, AI_KEY: "k", AI_MODELS: "", AI_MODEL: "anthropic/claude-sonnet-5.5", COPILOT_MODEL: "anthropic/claude-sonnet-5.5" });
  const reg = async (e) => (await (await fetch("http://127.0.0.1:" + api.port + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: e, password: "sifre-12345", name: "M" }) })).json()).token;
  const tok = await reg("a@example.test");
  const r = await fetch("http://127.0.0.1:" + api.port + "/api/creator/compose", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify({ topic: "kahve tanıtımı", platforms: ["x"] }) });
  assert.equal(r.status, 200, JSON.stringify(await r.clone().json()));
  assert.deepEqual(seen.filter(Boolean).slice(-2), [2200, 1800]);
  const api2 = await start(t, { AI_BASE: dead.base, AI_KEY: "k", AI_MODELS: "", AI_MODEL: "anthropic/claude-sonnet-5.5", OPENROUTER_API_KEY: "k2", AI_FALLBACKS: "openrouter", TEST_PROVIDER_BASE: dead.base, ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "", GEMINI_API_KEY: "", DEEPSEEK_API_KEY: "", HOSTINGER_AI_KEY: "" });
  const tok2 = (await (await fetch("http://127.0.0.1:" + api2.port + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "b@example.test", password: "sifre-12345", name: "B" }) })).json()).token;
  const j = await (await fetch("http://127.0.0.1:" + api2.port + "/api/ai/plan", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok2 }, body: JSON.stringify({ prompt: "takvim" }) })).json();
  assert.match(j.error, /bakiye yetmedi \(402\)/);
  assert.match(j.error, /Denenenler: .*OpenRouter \(402\)/);
  assert.doesNotMatch(j.error, /Hostinger AI Router\) bakiye/);
});

test("doğal ses: OpenAI anahtarı varsa /api/ai/tts mp3 döner ve Türkçe talimat gönderir; yoksa 503 ve health.tts=false", async (t) => {
  const seen = [];
  const prov = await fake((url, body) => { if (url.endsWith("/audio/speech")) seen.push(body); return [200, { ok: 1 }]; });
  t.after(() => prov.close());
  const api = await start(t, { AI_BASE: prov.base, AI_KEY: "k", OPENAI_API_KEY: "sk-test", TEST_PROVIDER_BASE: prov.base });
  const h = await (await fetch("http://127.0.0.1:" + api.port + "/api/health")).json(); assert.equal(h.tts, true);
  const r = await fetch("http://127.0.0.1:" + api.port + "/api/ai/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "Merhaba, fikrini dinliyorum.", voice: "kotu-ses" }) });
  assert.equal(r.status, 200); assert.equal(r.headers.get("content-type"), "audio/mpeg");
  assert.equal(seen[0].voice, "nova"); assert.match(seen[0].instructions, /Türkçe/); assert.equal(seen[0].input, "Merhaba, fikrini dinliyorum.");
  const api2 = await start(t, { AI_BASE: prov.base, AI_KEY: "k", OPENAI_API_KEY: "", TTS_API_KEY: "" });
  assert.equal((await (await fetch("http://127.0.0.1:" + api2.port + "/api/health")).json()).tts, false);
  assert.equal((await fetch("http://127.0.0.1:" + api2.port + "/api/ai/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "x" }) })).status, 503);
});

test("birincil 400 verirse yedek sağlayıcı denenir; boş mesajlar gönderilmez; yedek yoksa okunur 400 mesajı döner", async (t) => {
  const primary = await fake((url) => url.endsWith("/models") ? [404, {}] : [400, { error: { message: "messages: text content blocks must be non-empty" } }]);
  const backup = await fake((url) => url.endsWith("/models") ? [200, { data: [{ id: "anthropic/claude-sonnet-4.5" }] }] : [200, { choices: [{ message: { content: "yedek tamam" }, finish_reason: "stop" }], usage: { total_tokens: 5 } }]);
  t.after(() => { primary.close(); backup.close(); });
  const api = await start(t, { AI_BASE: primary.base, AI_KEY: "k", AI_MODELS: "claude-sonnet-4.5", COPILOT_MODEL: "claude-sonnet-4.5", OPENROUTER_API_KEY: "k2", AI_FALLBACKS: "openrouter", TEST_PROVIDER_BASE: backup.base });
  const r = await fetch("http://127.0.0.1:" + api.port + "/api/ai/copilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "" }, { role: "user", content: "merhaba" }] }) });
  const j = await r.json();
  assert.equal(r.status, 200, JSON.stringify(j)); assert.equal(j.reply, "yedek tamam");
  const sent = primary.seen.find((x) => x.url.endsWith("/chat/completions")).body.messages;
  assert.ok(sent.every((m) => (typeof m.content === "string" ? m.content.trim() : m.content.length)), "boş mesaj gönderilmemeli");
  const api2 = await start(t, { AI_BASE: primary.base, AI_KEY: "k", AI_MODELS: "claude-sonnet-4.5", COPILOT_MODEL: "claude-sonnet-4.5", AI_FALLBACKS: "", OPENROUTER_API_KEY: "", ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "", GEMINI_API_KEY: "", DEEPSEEK_API_KEY: "", HOSTINGER_AI_KEY: "" });
  const r2 = await fetch("http://127.0.0.1:" + api2.port + "/api/ai/copilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "merhaba" }] }) });
  const j2 = await r2.json();
  assert.match(j2.error, /isteği reddetti \(400.*text content blocks must be non-empty/);
  assert.doesNotMatch(j2.error, /\{"error"/);
});

test("arayüz dili (lang) sistem mesajına dil kuralı olarak eklenir; Türkçede eklenmez", async (t) => {
  const prov = await fake((url) => url.endsWith("/models") ? [200, { data: [{ id: "claude-sonnet-4.5" }] }] : [200, { choices: [{ message: { content: "ok" }, finish_reason: "stop" }], usage: { total_tokens: 3 } }]);
  t.after(() => prov.close());
  const api = await start(t, { AI_BASE: prov.base, AI_KEY: "k", AI_MODELS: "claude-sonnet-4.5", COPILOT_MODEL: "claude-sonnet-4.5", AI_FALLBACKS: "" });
  const ask = (lang) => fetch("http://127.0.0.1:" + api.port + "/api/ai/copilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang, messages: [{ role: "user", content: "hi" }] }) }).then((r) => r.json());
  await ask("en"); await ask("tr");
  const calls = prov.seen.filter((x) => x.url.endsWith("/chat/completions")).map((x) => { const c = x.body.messages[0].content; return typeof c === "string" ? c : c.map((p) => p.text).join(""); });
  assert.match(calls[0], /DİL \(bu kural.*Kullanıcının arayüz dili English/);
  assert.doesNotMatch(calls[1], /Kullanıcının arayüz dili/);
});

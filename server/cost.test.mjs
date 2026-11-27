// v5.71 maliyet düşürme: yardımcı çağrılar hızlı modelle, asıl üretim seçilen modelle; büyük mevcut dosya önbelleğe alınır.
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
const SONNET = "anthropic/claude-sonnet-4.5", MINI = "openai/gpt-5-mini";
async function fakeAi(t) {
  const seen = [];
  const s = http.createServer(async (req, res) => {
    let b = ""; for await (const c of req) b += c; const j = b ? JSON.parse(b) : null; seen.push({ url: req.url, body: j });
    const send = (o) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.url.endsWith("/models")) return send({ data: [{ id: SONNET }, { id: MINI }] });
    const sys = JSON.stringify(j.messages[0].content);
    const text = /Sen bir yazılım ajanısın/.test(sys) ? '[{"baslik":"Liste","detay":"Liste ekranı"}]' : /Sen deneyimli bir ürün tasarımcısı ve yazılım mimarısın/.test(sys) ? "1. Ana ekran\n2. Liste" : "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width\"></head><body><h1>Tamam</h1></body></html>";
    send({ choices: [{ message: { content: text }, finish_reason: "stop" }], usage: { total_tokens: 100 } });
  });
  s.listen(0, "127.0.0.1"); await once(s, "listening"); t.after(() => s.close());
  // Adreste "openrouter.ai" geçtiği için sunucu canlıdaki gibi OpenRouter davranışını (istem önbelleği) uygular
  return { base: "http://127.0.0.1:" + s.address().port + "/openrouter.ai/api/v1", seen };
}
async function start(t, env) {
  const dir = mkdtempSync(join(tmpdir(), "gitmapp-cost-"));
  const child = spawn(process.execPath, [server], { env: { ...process.env, PORT: "0", DB_PATH: join(dir, "db"), SECRET: randomBytes(32).toString("hex"), GITHUB_CLIENT_ID: "", GOOGLE_CLIENT_ID: "", AI_FALLBACKS: "", OPENROUTER_API_KEY: "", ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "", GEMINI_API_KEY: "", DEEPSEEK_API_KEY: "", COPILOT_MODEL: "", HELPER_MODEL: "", ...env }, stdio: ["ignore", "pipe", "inherit"] });
  t.after(async () => { if (child.exitCode === null) { const end = once(child, "exit"); child.kill(); await end; } rmSync(dir, { recursive: true, force: true }); });
  const base = "http://127.0.0.1:" + (await once(child.stdout, "data"))[0].toString().match(/API :(\d+)/)[1];
  const req = async (method, path, body, token) => { const r = await fetch(base + "/api/" + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body == null ? undefined : JSON.stringify(body) }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
  const token = (await req("POST", "auth/register", { email: "c" + randomBytes(3).toString("hex") + "@example.test", password: "uzun-bir-sifre-1" })).token;
  return { req, token };
}
const chats = (ai) => ai.seen.filter((x) => x.url.endsWith("/chat/completions"));

test("plan ve yapılacaklar hızlı modelle, üretim seçilen modelle; mevcut dosya önbelleğe alınır", async (t) => {
  const ai = await fakeAi(t);
  const { req, token } = await start(t, { AI_BASE: ai.base, AI_KEY: "k", AI_MODELS: SONNET + "," + MINI, AI_MODEL: SONNET });
  const plan = await req("POST", "ai/plan", { prompt: "Kuaför randevu", model: SONNET }, token);
  assert.equal(plan.status, 200, plan.error); assert.equal(chats(ai).at(-1).body.model, MINI); assert.equal(plan.spent, 1);
  const todos = await req("POST", "ai/todos", { prompt: "Kuaför randevu", model: SONNET }, token);
  assert.equal(todos.status, 200, todos.error); assert.equal(chats(ai).at(-1).body.model, MINI);
  const html = "<!doctype html><html><body>" + "<p>satır</p>".repeat(1500) + "</body></html>";
  const gen = await req("POST", "ai/generate", { prompt: "Başlığı değiştir", model: SONNET, html }, token);
  assert.equal(gen.status, 200, JSON.stringify(gen).slice(0,300)); const call = chats(ai).at(-1).body;
  assert.equal(call.model, SONNET, "asıl üretim kullanıcının modelinde kalmalı");
  const cached = call.messages.filter((m) => Array.isArray(m.content) && m.content.some((c) => c.cache_control));
  assert.equal(cached.length, 2, "sistem istemi ve mevcut dosya önbelleğe alınmalı");
  assert.match(cached[1].content[0].text, /^Mevcut dosya:/);
});

test("HELPER_MODEL=off eski davranışa döner", async (t) => {
  const ai = await fakeAi(t);
  const { req, token } = await start(t, { AI_BASE: ai.base, AI_KEY: "k", AI_MODELS: SONNET + "," + MINI, AI_MODEL: SONNET, HELPER_MODEL: "off" });
  const plan = await req("POST", "ai/plan", { prompt: "Kuaför randevu", model: SONNET }, token);
  assert.equal(plan.status, 200, plan.error); assert.equal(chats(ai).at(-1).body.model, SONNET);
});

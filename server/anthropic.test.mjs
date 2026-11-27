// v5.72: Claude doğrudan (yerel Messages API + istem önbelleği), önerilen yapılandırma, otomatik fiyat, Kokpit canlı verisi
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { toAnthropic, fromAnthropic, usageOf, latest } from "./anthropic.mjs";

const server = fileURLToPath(new URL("server.mjs", import.meta.url));
const HTML = "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width\"></head><body><h1>Claude</h1></body></html>";

test("çevirici: sistem/önbellek/görsel/ardışık mesajlar ve yanıt biçimi", () => {
  const a = toAnthropic({ model: "claude-sonnet-5-5", max_tokens: 500, temperature: 0.4, messages: [
    { role: "system", content: [{ type: "text", text: "kurallar", cache_control: { type: "ephemeral" } }] },
    { role: "user", content: [{ type: "text", text: "Mevcut dosya: x", cache_control: { type: "ephemeral" } }] },
    { role: "user", content: [{ type: "text", text: "istek" }, { type: "image_url", image_url: { url: "data:image/png;base64,QUJD" } }] },
    { role: "assistant", content: "yarım  " }] });
  assert.equal(a.system[0].cache_control.type, "ephemeral"); assert.equal(a.messages.length, 2, "ardışık kullanıcı mesajları birleşir");
  assert.equal(a.messages[0].content[0].cache_control.type, "ephemeral"); assert.equal(a.messages[0].content[2].source.media_type, "image/png");
  assert.equal(a.messages[1].content[0].text, "yarım"); assert.equal(a.temperature, 0.4);
  const o = fromAnthropic({ id: "m", model: "claude-sonnet-5-5", content: [{ type: "text", text: "merhaba" }], stop_reason: "max_tokens", usage: { input_tokens: 100, cache_read_input_tokens: 900, cache_creation_input_tokens: 0, output_tokens: 50 } });
  assert.equal(o.choices[0].message.content, "merhaba"); assert.equal(o.choices[0].finish_reason, "length");
  assert.deepEqual([o.usage.prompt_tokens, o.usage.prompt_tokens_details.cached_tokens], [1000, 900]);
  assert.equal(usageOf({ input_tokens: 10, cache_creation_input_tokens: 5, output_tokens: 1 }).prompt_tokens_details.cache_write_tokens, 5);
  assert.equal(latest(["claude-sonnet-4-5-20250929", "claude-sonnet-5-5", "claude-opus-5-5", "claude-sonnet-5-5-20261101"], /sonnet/), "claude-sonnet-5-5");
});

async function fakeAnthropic(t, { broke = false } = {}) {
  const seen = [];
  const s = http.createServer(async (req, res) => {
    let b = ""; for await (const c of req) b += c; const j = b ? JSON.parse(b) : null; seen.push({ url: req.url, key: req.headers["x-api-key"], body: j });
    if (req.url.startsWith("/v1/models")) { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ data: [{ id: "claude-sonnet-5-5" }, { id: "claude-opus-5-5" }, { id: "claude-haiku-5-5" }, { id: "claude-sonnet-4-5-20250929" }] })); }
    if (broke) { res.writeHead(400, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } })); }
    const sys = JSON.stringify(j.system || ""); const text = /yazılım ajanısın/.test(sys) ? '[{"baslik":"Liste","detay":"x"}]' : /ürün tasarımcısı ve yazılım mimarısın/.test(sys) ? "1. Ana ekran" : HTML;
    const usage = { input_tokens: 200, cache_read_input_tokens: 8000, cache_creation_input_tokens: 0, output_tokens: 300 };
    if (j.stream) {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      const ev = (o) => res.write("event: " + o.type + "\ndata: " + JSON.stringify(o) + "\n\n");
      ev({ type: "message_start", message: { usage: { ...usage, output_tokens: 1 } } });
      for (const piece of [text.slice(0, 30), text.slice(30)]) ev({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: piece } });
      ev({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 300 } }); ev({ type: "message_stop" }); return res.end();
    }
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ id: "msg", model: j.model, content: [{ type: "text", text }], stop_reason: "end_turn", usage }));
  });
  s.listen(0, "127.0.0.1"); await once(s, "listening"); t.after(() => s.close());
  return { base: "http://127.0.0.1:" + s.address().port + "/v1", seen };
}
async function fakeOpenAI(t) {
  const seen = [];
  const s = http.createServer(async (req, res) => {
    let b = ""; for await (const c of req) b += c; seen.push({ url: req.url, body: b ? JSON.parse(b) : null }); res.writeHead(200, { "Content-Type": "application/json" });
    if (req.url.endsWith("/models")) return res.end(JSON.stringify({ data: [{ id: "anthropic/claude-sonnet-5.5" }, { id: "anthropic/claude-haiku-5.5" }, { id: "openai/gpt-5.4-mini" }] }));
    res.end(JSON.stringify({ choices: [{ message: { content: HTML }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } }));
  });
  s.listen(0, "127.0.0.1"); await once(s, "listening"); t.after(() => s.close());
  return { base: "http://127.0.0.1:" + s.address().port, seen };
}
async function fakeRates(t) {
  const s = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ data: [
    { id: "anthropic/claude-sonnet-5.5", pricing: { prompt: "0.000003", completion: "0.000015", input_cache_read: "0.0000003" } },
    { id: "anthropic/claude-haiku-5.5", pricing: { prompt: "0.000001", completion: "0.000005", input_cache_read: "0.0000001" } }] })); });
  s.listen(0, "127.0.0.1"); await once(s, "listening"); t.after(() => s.close()); return "http://127.0.0.1:" + s.address().port + "/models";
}
async function start(t, env) {
  const dir = mkdtempSync(join(tmpdir(), "gitmapp-claude-"));
  const full = { ...process.env, PORT: "0", DB_PATH: join(dir, "db"), SECRET: randomBytes(32).toString("hex"), ADMIN_EMAIL: "owner@example.test", GITHUB_CLIENT_ID: "", GOOGLE_CLIENT_ID: "", OPENROUTER_API_KEY: "", OPENAI_API_KEY: "", GEMINI_API_KEY: "", DEEPSEEK_API_KEY: "", COPILOT_MODEL: "", HELPER_MODEL: "", VISION_MODEL: "", AI_MODEL: "", AI_MODELS: "", AI_FALLBACKS: "", ...env };
  const pw = execFileSync(process.execPath, [server, "create-admin"], { env: full, encoding: "utf8" }).match(/Şifre: (\S+)/)[1];
  const child = spawn(process.execPath, [server], { env: full, stdio: ["ignore", "pipe", "inherit"] });
  t.after(async () => { if (child.exitCode === null) { const end = once(child, "exit"); child.kill(); await end; } rmSync(dir, { recursive: true, force: true }); });
  const base = "http://127.0.0.1:" + (await once(child.stdout, "data"))[0].toString().match(/API :(\d+)/)[1];
  const req = async (method, path, body, token) => { const r = await fetch(base + "/api/" + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body == null ? undefined : JSON.stringify(body) }); const txt = await r.text(); let j = {}; try { j = JSON.parse(txt); } catch { j = { raw: txt }; } return { status: r.status, ...j }; };
  const admin = (await req("POST", "auth/login", { email: full.ADMIN_EMAIL, password: pw })).token;
  const user = (await req("POST", "auth/register", { email: "u" + randomBytes(3).toString("hex") + "@example.test", password: "uzun-bir-sifre-1" })).token;
  return { req, admin, user };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("OpenRouter ana iken Anthropic anahtarı varsa önerilen yapılandırmaya kendiliğinden geçer; Claude doğrudan ve önbellekli çalışır; Kokpit canlı veri ve $ maliyet; geri dönüş", async (t) => {
  const ant = await fakeAnthropic(t); const or = await fakeOpenAI(t); const rates = await fakeRates(t);
  const { req, admin, user } = await start(t, { AI_BASE: or.base + "/openrouter.ai/api/v1", AI_KEY: "sk-or-v1-" + "a".repeat(40), ANTHROPIC_API_KEY: "sk-ant-" + "b".repeat(40), ANTHROPIC_BASE: ant.base, RATES_URL: rates, AI_PROFILE_DELAY_MS: "200" });
  let p; for (let i = 0; i < 40; i++) { p = await req("GET", "admin/ai/profile", null, admin); if (p.applied) break; await wait(100); }
  assert.equal(p.applied, true, JSON.stringify(p)); assert.equal(p.primary, "Anthropic"); assert.ok(p.backupAt);
  const ai = await req("GET", "admin/ai", null, admin); const f = Object.fromEntries(ai.fields.map((x) => [x.name, x]));
  assert.equal(f.AI_MODEL.value, "claude-sonnet-5-5"); assert.equal(f.HELPER_MODEL.value, "claude-haiku-5-5"); assert.match(f.AI_MODELS.value, /opus/);
  assert.equal(f.OPENROUTER_API_KEY.set, true, "eski OpenRouter anahtarı yedeğe taşınmalı");
  // Tarayıcıda kalmış eski ad (anthropic/claude-sonnet-5.5) Claude'a eşlenir; istek yerel API'ye, önbellek işaretiyle gider
  const big = "<!doctype html><html><body>" + "<p>satır</p>".repeat(1500) + "</body></html>";
  const gen = await req("POST", "ai/generate", { prompt: "Başlığı değiştir", model: "anthropic/claude-sonnet-5.5", html: big }, user);
  assert.equal(gen.status, 200, JSON.stringify(gen).slice(0, 300));
  const call = ant.seen.filter((x) => x.url === "/v1/messages").at(-1);
  assert.equal(call.body.model, "claude-sonnet-5-5"); assert.equal(call.key, "sk-ant-" + "b".repeat(40));
  assert.ok(call.body.system.some((b) => b.cache_control), "sistem istemi önbellekli"); assert.ok(call.body.messages[0].content.some((b) => b.cache_control && /^Mevcut dosya:/.test(b.text)), "mevcut dosya önbellekli");
  // Plan yardımcı modelde (Haiku); canlı akışlı iş de çalışır
  const plan = await req("POST", "ai/plan", { prompt: "Kuaför", model: "claude-sonnet-5-5" }, user); assert.equal(plan.status, 200, plan.error);
  assert.equal(ant.seen.filter((x) => x.url === "/v1/messages").at(-1).body.model, "claude-haiku-5-5");
  const streamed = await req("POST", "ai/generate", { prompt: "Kuaför sitesi", model: "claude-sonnet-5-5", stream: true }, user);
  assert.match(streamed.raw || JSON.stringify(streamed), /Claude/, "canlı akış Anthropic SSE'den çevrilir");
  assert.equal(ant.seen.filter((x) => x.url === "/v1/messages").at(-1).body.stream, true);
  await req("POST", "admin/costs/refresh-rates", {}, admin);
  const gen2 = await req("POST", "ai/generate", { prompt: "Renkleri değiştir", model: "claude-sonnet-5-5", html: big }, user); assert.equal(gen2.status, 200);
  // Kokpit canlı veri
  const live = await req("GET", "me/ai-live", null, user);
  assert.equal(live.routing.primary, "Anthropic"); assert.equal(live.routing.direct, true); assert.equal(live.routing.roles[1].model, "claude-haiku-5-5");
  assert.ok(live.recent.length >= 3); assert.equal(live.recent[0].cached_t, 8000); assert.equal(live.recent[0].cost, undefined, "müşteri $ maliyeti görmez");
  const adminLive = await req("GET", "me/ai-live", null, admin); assert.ok(adminLive.spend && adminLive.admin);
  const rows = (await req("GET", "admin/costs?month=" + new Date().toISOString().slice(0, 7), null, admin)).rows;
  const sonnetRow = rows.find((r) => r.model === "claude-sonnet-5-5" && r.kind === "build");
  // 200 girdi × $3 + 8000 önbellek × $0.3 + 300 çıktı × $15 (milyon başına) = 0.0075 $
  assert.ok(sonnetRow && Math.abs(sonnetRow.cost / sonnetRow.calls - 0.0075) < 1e-6, JSON.stringify(sonnetRow));
  // Geri dönüş: önceki (OpenRouter) yapılandırma
  const back = await req("POST", "admin/ai/profile/rollback", {}, admin); assert.equal(back.profile.primary, "OpenRouter");
});

test("Anthropic bakiyesi bitince (400 'credit balance') yedek sağlayıcıya geçilir", async (t) => {
  const ant = await fakeAnthropic(t, { broke: true }); const or = await fakeOpenAI(t);
  const { req, user } = await start(t, { AI_BASE: ant.base, AI_KEY: "sk-ant-" + "c".repeat(40), ANTHROPIC_BASE: ant.base, AI_MODEL: "claude-sonnet-5-5", OPENROUTER_API_KEY: "sk-or-v1-" + "d".repeat(40), TEST_PROVIDER_BASE: or.base, AI_FALLBACKS: "openrouter", AI_PROFILE_AUTO: "0" });
  const gen = await req("POST", "ai/generate", { prompt: "Kuaför sitesi", model: "claude-sonnet-5-5" }, user);
  assert.equal(gen.status, 200, JSON.stringify(gen).slice(0, 300));
  assert.ok(or.seen.some((x) => x.url.endsWith("/chat/completions") && /claude-sonnet-5\.5/.test(x.body.model)), "OpenRouter'da aynı Claude modeli");
});

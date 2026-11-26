import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes, createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const server = fileURLToPath(new URL("server.mjs", import.meta.url));
async function listen(handler) { const s = http.createServer(handler); s.listen(0, "127.0.0.1"); await once(s, "listening"); return { base: "http://127.0.0.1:" + s.address().port, close: () => s.close() }; }
test("kreatör: içerik üretimi, yorum yanıtları, takvim ve imzalı webhook ile otomatik gönderim", async (t) => {
  const aiOut = { baslik: "Kahve", kanca: "Bu kahveyi denemeden geçme", metinler: { instagram: "IG metni <script>", x: "X metni" }, etiketler: ["kahve", "#latte"], cta: "Kaydet", gorsel_istem: "cinematic coffee", video_senaryo: [{ sn: "0-2", sahne: "fincan", ses: "merhaba" }], zaman: "Salı 19:30", fikirler: ["a", "b"] };
  const ai = await listen(async (req, res) => { let b = ""; for await (const c of req) b += c; const j = b ? JSON.parse(b) : {};
    res.writeHead(200, { "Content-Type": "application/json" });
    if (req.url.endsWith("/models")) return res.end(JSON.stringify({ data: [{ id: "anthropic/claude-sonnet-4.5" }] }));
    const isReply = JSON.stringify(j.messages).includes("topluluk yöneticisi");
    res.end(JSON.stringify({ choices: [{ message: { content: isReply ? JSON.stringify({ yanitlar: [{ i: 0, tur: "soru", duygu: "nötr", oncelik: 1, yanit: "Hafta içi 9-18 açığız", not: "" }, { i: 9, yanit: "geçersiz" }], ozet: "Saat soruluyor" }) : "İşte: " + JSON.stringify(aiOut) } }], usage: { total_tokens: 100 } })); });
  const hits = [];
  const hook = await listen(async (req, res) => { let b = ""; for await (const c of req) b += c; hits.push({ body: b, sig: req.headers["x-gitmapp-signature"] }); res.writeHead(200); res.end("ok"); });
  const dir = mkdtempSync(join(tmpdir(), "gitmapp-cr-"));
  const child = spawn(process.execPath, [server], { env: { ...process.env, PORT: "0", DB_PATH: join(dir, "db"), SECRET: randomBytes(32).toString("hex"), GITHUB_CLIENT_ID: "", GOOGLE_CLIENT_ID: "", AI_BASE: ai.base, AI_KEY: "k", AI_MODELS: "claude-sonnet-4.5", AI_MODEL: "claude-sonnet-4.5", CREATOR_ALLOW_LOCAL: "1", CREATOR_TICK_MS: "300" }, stdio: ["ignore", "pipe", "inherit"] });
  t.after(async () => { ai.close(); hook.close(); if (child.exitCode === null) { const end = once(child, "exit"); child.kill(); await end; } rmSync(dir, { recursive: true, force: true }); });
  const port = (await once(child.stdout, "data"))[0].toString().match(/API :(\d+)/)[1];
  const req = async (m, p, body, tok) => { const r = await fetch("http://127.0.0.1:" + port + "/api/" + p, { method: m, headers: { "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, ...(await r.json()) }; };
  assert.equal((await req("POST", "creator/compose", { topic: "kahve" })).status, 401);
  const u = await req("POST", "auth/register", { email: "cr@example.test", password: randomBytes(12).toString("hex"), name: "C" });
  const tok = u.token;
  const c = await req("POST", "creator/compose", { topic: "yeni latte", platforms: ["instagram", "x", "bogus"], brand: { ad: "Kafe" } }, tok);
  assert.equal(c.status, 200, JSON.stringify(c));
  assert.deepEqual(Object.keys(c.metinler), ["instagram", "x"]);
  assert.doesNotMatch(c.metinler.instagram, /</);
  assert.deepEqual(c.etiketler, ["#kahve", "#latte"]);
  assert.ok(c.spent >= 1);
  const rp = await req("POST", "creator/replies", { comments: "Kaç saatte açıksınız?\nharika" }, tok);
  assert.equal(rp.yanitlar.length, 1, "geçersiz sıra numarası atılır");
  assert.equal(rp.yanitlar[0].tur, "soru");
  // Webhook yokken gönderim: anlaşılır hata
  const p0 = await req("POST", "creator/posts", { title: "Taslak", platforms: ["instagram"], caption: "x" }, tok);
  assert.equal(p0.post.status, "taslak");
  assert.equal((await req("POST", "creator/posts/" + p0.post.id + "/send", null, tok)).status, 412);
  assert.equal((await req("PUT", "creator/hook", { url: "ftp://x.test/a" }, tok)).status, 400);
  const h = await req("PUT", "creator/hook", { url: hook.base + "/h" }, tok);
  assert.equal(h.test.ok, true); assert.ok(h.secret.length >= 32);
  const sig = (b) => "sha256=" + createHmac("sha256", h.secret).update(b).digest("hex");
  assert.equal(hits[0].sig, sig(hits[0].body), "test isteği imzalı");
  // Planlı gönderi zamanı gelince kendiliğinden iletilir
  const p1 = await req("POST", "creator/posts", { title: "Plan", platforms: ["instagram", "tiktok"], captions: { instagram: "ig", tiktok: "tt" }, media: [{ url: "https://cdn.example/a.mp4", type: "video" }, { url: "javascript:x" }], scheduled_at: new Date(Date.now() - 1000).toISOString() }, tok);
  assert.equal(p1.post.status, "planlandi"); assert.equal(p1.post.media.length, 1);
  for (let i = 0; i < 30 && hits.length < 2; i++) await new Promise((r) => setTimeout(r, 100));
  const sent = JSON.parse(hits[1].body); assert.equal(sent.event, "gitmapp.post"); assert.equal(sent.captions.tiktok, "tt"); assert.equal(hits[1].sig, sig(hits[1].body));
  const list = await req("GET", "creator/posts", null, tok);
  assert.equal(list.posts.find((x) => x.id === p1.post.id).status, "gonderildi");
  // Başka kullanıcı göremez/silemez
  const o = await req("POST", "auth/register", { email: "o@example.test", password: randomBytes(12).toString("hex"), name: "O" });
  assert.equal((await req("GET", "creator/posts", null, o.token)).posts.length, 0);
  assert.equal((await req("PUT", "creator/posts/" + p1.post.id, { title: "x" }, o.token)).status, 404);
});

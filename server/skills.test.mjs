import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { scoreHtml } from "./skills.mjs";
import { scriptErrors } from "./quality.mjs";
import { ALL_SKILLS, CATALOG, HUNT_TERMS } from "./skills-catalog.mjs";

const server = fileURLToPath(new URL("server.mjs", import.meta.url));
const GOOD = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CRM</title></head><body><h1>Fırsatlar</h1><p>Teklif · Firma · Aktivite</p>${"<div>satır</div>".repeat(700)}<script>const a=1;localStorage.setItem("x","1")</script></body></html>`;

test("katalog tutarlı ve puanlama ölçüyor", () => {
  assert.equal(new Set(ALL_SKILLS.map((s) => s.id)).size, ALL_SKILLS.length);
  for (const s of ALL_SKILLS) { assert.ok(s.body.length > 200 && s.body.length <= 1800, s.id); assert.ok(s.checks?.length, s.id); }
  for (const s of CATALOG) { assert.ok(HUNT_TERMS[s.cat], s.cat); assert.ok(ALL_SKILLS.some((d) => d.id === s.design), s.design); }
  const good = scoreHtml(GOOD, ["fırsat|firsat", "teklif", "firma", "aktivite|görev"], scriptErrors);
  const bad = scoreHtml("<html><script>if(</script></html>", ["fırsat", "teklif"], scriptErrors);
  assert.equal(good.score, 100); assert.ok(bad.score < 20); assert.equal(bad.errors.length, 1);
});

test("beceri üretime eklenir, sonuç ve oy ölçülür, avcı aday bulur, test yayına alır", async (t) => {
  const prompts = [];
  const ai = http.createServer(async (req, res) => {
    let b = ""; for await (const c of req) b += c; const j = b ? JSON.parse(b) : {};
    res.writeHead(200, { "Content-Type": "application/json" });
    if (req.url.endsWith("/models")) return res.end(JSON.stringify({ data: [{ id: "claude-sonnet-4.5" }] }));
    const all = (j.messages || []).map((m) => typeof m.content === "string" ? m.content : JSON.stringify(m.content)).join("\n"); prompts.push(all);
    const text = /README|kullanımlarda şu sorunlar|Kullanımlarda şu sorunlar/.test(all) ? "MODÜLLER: Kişiler, Firmalar, Fırsatlar, Teklifler, Aktiviteler, E-posta şablonları.\nVERİ: firma{ad,vkn}, firsat{baslik,tutar,asama}.\nEKRANLAR: Pano, Kanban huni, teklif oluşturucu, aktivite takvimi.\nKURALLAR: aşama değişince olasılık güncellenir; kaybedilen fırsatta neden zorunlu; gecikmiş aktiviteler kırmızı; teklif numarası yıl-sıra.\nNOT: kod alınmadı." : GOOD;
    res.end(JSON.stringify({ choices: [{ message: { content: text }, finish_reason: "stop" }], usage: { total_tokens: 100 } }));
  });
  const gh = http.createServer((req, res) => {
    if (req.url.startsWith("/search/repositories")) { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ items: [
      { full_name: "acme/opencrm", html_url: "https://github.com/acme/opencrm", description: "Open CRM", stargazers_count: 5000, pushed_at: new Date().toISOString(), fork: false, license: { key: "mit", spdx_id: "MIT" } },
      { full_name: "x/nolicense", html_url: "https://github.com/x/nolicense", description: "CRM", stargazers_count: 9000, pushed_at: new Date().toISOString(), fork: false, license: null }] })); }
    if (req.url === "/repos/acme/opencrm/readme") { res.writeHead(200); return res.end("# OpenCRM\n" + "Features: contacts, deals pipeline, quotes, email templates, activity calendar. ".repeat(10)); }
    res.writeHead(404); res.end("{}");
  });
  for (const s of [ai, gh]) { s.listen(0, "127.0.0.1"); await once(s, "listening"); }
  const dir = mkdtempSync(join(tmpdir(), "gitmapp-sk-"));
  const env = { ...process.env, PORT: "0", DB_PATH: join(dir, "db"), ADMIN_EMAIL: "owner@example.test", SECRET: crypto.randomBytes(32).toString("hex"), AI_BASE: "http://127.0.0.1:" + ai.address().port + "/v1", AI_KEY: "k", AI_MODELS: "claude-sonnet-4.5", AI_MODEL: "claude-sonnet-4.5", TEST_GH_API: "http://127.0.0.1:" + gh.address().port, OPENROUTER_API_KEY: "", ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "", GEMINI_API_KEY: "", DEEPSEEK_API_KEY: "" };
  const pw = execFileSync(process.execPath, [server, "create-admin"], { env, encoding: "utf8" }).match(/Şifre: (\S+)/)[1];
  const child = spawn(process.execPath, [server], { env, stdio: ["ignore", "pipe", "inherit"] });
  t.after(async () => { ai.close(); gh.close(); if (child.exitCode === null) { const end = once(child, "exit"); child.kill(); await end; } rmSync(dir, { recursive: true, force: true }); });
  const base = "http://127.0.0.1:" + (await once(child.stdout, "data"))[0].toString().match(/API :(\d+)/)[1];
  const req = async (method, path, body, token) => { const r = await fetch(base + "/api/" + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body == null ? undefined : JSON.stringify(body) }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
  const admin = (await req("POST", "auth/login", { email: env.ADMIN_EMAIL, password: pw })).token;
  const user = (await req("POST", "auth/register", { email: "u@example.test", password: "uzun-bir-sifre-1", name: "U" })).token;

  const list = await req("GET", "skills"); assert.equal(list.skills.length, ALL_SKILLS.length); assert.equal(list.skills[0].kind, "gelistirme");
  // Plan becerisi + bağlı tasarım + temiz mimari sistem istemine eklenir
  const gen = await req("POST", "ai/generate", { prompt: "Satış ekibim için CRM", kind: "app", settings: { skills: ["plan-crm", "yok-boyle"] } }, user);
  assert.equal(gen.status, 200); assert.ok(gen.skillRun);
  const sys = prompts.at(-1); assert.match(sys, /YÜKLÜ BECERİLER/); assert.match(sys, /CRM · müşteri ve satış takibi/); assert.match(sys, /Kurumsal yönetim paneli/); assert.match(sys, /Temiz mimari/);
  let a = await req("GET", "admin/skills", null, admin); let crm = a.skills.find((s) => s.id === "plan-crm");
  assert.equal(crm.uses, 1); assert.equal(crm.success, 100); assert.equal(a.runs.ok, 1);
  // Kullanıcı beğenmezse başarı düşer; başkasının kaydına oy verilemez
  assert.equal((await req("POST", "skills/feedback", { run: gen.skillRun, good: false, note: "tablo bozuk" }, admin)).status, 404);
  assert.equal((await req("POST", "skills/feedback", { run: gen.skillRun, good: false, note: "tablo bozuk" }, user)).status, 200);
  crm = (await req("GET", "admin/skills", null, admin)).skills.find((s) => s.id === "plan-crm"); assert.equal(crm.success, 0); assert.equal(crm.dislikes, 1);
  assert.equal((await req("GET", "admin/skills", null, user)).status, 403);
  // Beceri avcısı: lisanssız depo süzülür, lisanslı olandan aday sürüm çıkar
  const h = await req("POST", "admin/skills/hunt", { cat: "crm" }, admin);
  assert.equal(h.reports[0].filtered.length, 1); assert.equal(h.reports[0].candidates.length, 1);
  const vid = h.reports[0].candidates[0].version;
  const auto = await req("POST", "admin/skills/versions/" + vid + "/auto", null, admin);
  assert.equal(auto.promoted, true); assert.equal(auto.score, 100);
  const det = await req("GET", "admin/skills/plan-crm", null, admin);
  assert.equal(det.skill.version, 2); assert.match(det.skill.body, /E-posta şablonları/); assert.equal(det.versions.find((v) => v.id === vid).license, "MIT");
  assert.equal(det.versions.filter((v) => v.status === "yayinda").length, 1);
  // İyileştirme: hata notlarından yeni aday
  const imp = await req("POST", "admin/skills/plan-crm/improve", null, admin); assert.ok(imp.version);
  assert.match(prompts.at(-1), /tablo bozuk/);
  assert.equal((await req("POST", "admin/skills/versions/" + imp.version + "/reject", null, admin)).status, 200);
});

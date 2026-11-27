// Stüdyo beceri paneli kabul testi: modül ekle, seviye atla, uçtan uca tamamla, akış satırları. Çalıştırma: node tools/acceptance/beceri-studyo.mjs
import http from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SHOTS = join(ROOT, "validation/screens/beceri-studyo"); mkdirSync(SHOTS, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) process.exitCode = 1; };
const listen = async (s) => { s.listen(0, "127.0.0.1"); await once(s, "listening"); return s.address().port; };
const freePort = async () => { const s = http.createServer(); const p = await listen(s); s.close(); await once(s, "close"); return p; };
// Sahte yapay zekâ: istenen modülleri biriktirip her seferinde sayfayı o modüllerle üretir
const have = new Set(), seen = [];
const page = (mods) => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Şifa Klinik</title><style>body{margin:0;font-family:system-ui;background:#f6f8fb;color:#13203a}header{background:#0f766e;color:#fff;padding:18px 20px}nav{display:flex;gap:8px;flex-wrap:wrap;padding:12px 20px}nav a{background:#fff;border:1px solid #d6dde8;border-radius:10px;padding:8px 12px;color:#0f766e;text-decoration:none}main{padding:20px;display:grid;gap:12px}.card{background:#fff;border-radius:14px;padding:16px;box-shadow:0 4px 14px rgba(0,0,0,.06)}</style></head><body><header><h1>Şifa Klinik</h1><p>Bugün 12 kayıt</p></header><nav>${mods.map((m) => `<a href="#">${m}</a>`).join("")}</nav><main>${mods.map((m) => `<section class="card"><h2>${m}</h2><p>${m} ekranı örnek verilerle dolu.</p></section>`).join("")}</main></body></html>`;
const ai = http.createServer(async (req, res) => { let b = ""; for await (const c of req) b += c; const j = b ? JSON.parse(b) : null; res.writeHead(200, { "Content-Type": "application/json" });
  if (req.url.endsWith("/models")) return res.end(JSON.stringify({ data: [{ id: "claude-sonnet-5-5" }, { id: "claude-haiku-5-5" }] }));
  const sys = JSON.stringify(j.messages[0].content); const last = JSON.stringify(j.messages.at(-1).content);
  if (/Sen deneyimli bir ürün tasarımcısı/.test(sys)) return res.end(JSON.stringify({ choices: [{ message: { content: "1. Ana ekran" }, finish_reason: "stop" }] }));
  seen.push({ sys, last }); const m = last.match(/“([^”]+)” modülünü/); if (m) have.add(m[1]); else { have.add("Hasta kartı"); have.add("Randevu"); }
  await new Promise((r) => setTimeout(r, 1200));
  res.end(JSON.stringify({ choices: [{ message: { content: page([...have]) }, finish_reason: "stop" }], usage: { prompt_tokens: 9000, completion_tokens: 2000, total_tokens: 11000 } })); });
const aiPort = await listen(ai);
const dir = mkdtempSync(join(tmpdir(), "gitmapp-sk-studio-")); const apiPort = await freePort(), webPort = await freePort();
const apiBase = "http://127.0.0.1:" + apiPort, webBase = "http://127.0.0.1:" + webPort;
const env = { ...process.env, PORT: String(apiPort), DB_PATH: join(dir, "db"), SECRET: randomBytes(32).toString("hex"), ADMIN_EMAIL: "y@gitmapp.test", SITE_URL: webBase, CORS_EXTRA: webBase, API_URL: apiBase, GITHUB_CLIENT_ID: "", GOOGLE_CLIENT_ID: "", AI_BASE: "http://127.0.0.1:" + aiPort + "/v1", AI_KEY: "k-test-123456789012", AI_MODEL: "claude-sonnet-5-5", AI_MODELS: "claude-sonnet-5-5,claude-haiku-5-5", AI_FALLBACKS: "", ANTHROPIC_API_KEY: "", OPENROUTER_API_KEY: "", AI_PROFILE_AUTO: "0", SIGNUP_CREDITS: "200" };
const api = spawn(process.execPath, [join(ROOT, "server/server.mjs")], { env, stdio: ["ignore", "pipe", "inherit"] }); await once(api.stdout, "data");
const web = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p === "/config.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); return res.end(`window.GMS_CONFIG={api:${JSON.stringify(apiBase)}};`); } if (p === "/sw.js") { res.writeHead(404); return res.end(); } if (p.endsWith("/")) p += "index.html"; const f = normalize(join(ROOT, p)); if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": MIME[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); }); web.listen(webPort, "127.0.0.1"); await once(web, "listening");
const browser = await chromium.launch();
try {
  const user = (await (await fetch(apiBase + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "s@gitmapp.test", password: "parola-1234", name: "Seda" }) })).json()).token;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(webBase + "/#ana"); await p.evaluate((t) => { for (const [k, v] of Object.entries({ tok: t, seenVer: "999", nrSeen: true, vbarOff: true, skills: ["plan-klinik"], autoFix: false })) localStorage.setItem("gms_" + k, JSON.stringify(v)); }, user);
  await p.goto(webBase + "/#studio"); await p.reload(); await p.locator(".skd").waitFor({ timeout: 20000 }); await p.locator(".skd-sk").waitFor({ timeout: 15000 });
  ok(/Klinik ve hasta yönetimi/.test(await p.locator(".skd").innerText()), "panel: yüklü beceri görünüyor"); await p.screenshot({ path: join(SHOTS, "1-panel-bos.png") });
  await p.getByRole("button", { name: /Bu beceriyle başlat/ }).click();
  await p.waitForFunction(() => /Seviye 2\/7/.test(document.querySelector(".skd")?.innerText || ""), null, { timeout: 30000 });
  ok(true, "beceriyle başlatıldı · Seviye 2/7"); await p.waitForTimeout(800); await p.screenshot({ path: join(SHOTS, "2-ilk-surum.png") });
  await p.locator(".skd-mod", { hasText: "Tahsilat" }).click();
  await p.locator(".cc-row.run").first().waitFor({ timeout: 8000 }); await p.waitForTimeout(400); await p.screenshot({ path: join(SHOTS, "3-modul-calisiyor.png") });
  await p.waitForFunction(() => /Seviye 3\/7/.test(document.querySelector(".skd")?.innerText || ""), null, { timeout: 30000 });
  ok(seen.at(-1).sys.includes("ODAK MODÜL") && seen.at(-1).sys.includes("“Tahsilat” modülü"), "modül isteği odak modülle gitti");
  ok(await p.locator(".skd-lv").count() > 0, "seviye atlama efekti göründü");
  const flow = await p.locator(".studio-activity").last().innerText(); ok(/Beceri modülü uygulandı/.test(flow) || /Çalıştırıldı/.test(flow), "akış: beceri satırı / özet");
  await p.locator(".cc-sum").last().click().catch(() => { }); await p.waitForTimeout(400);
  const rows = await p.locator(".studio-activity").last().locator(".cc-rbtn").allInnerTexts(); console.log("  akış satırları:", rows.map((r) => r.replace(/\s+/g, " ").trim()).join(" | "));
  ok(rows.some((r) => /İstek gönderildi/.test(r)) && rows.some((r) => /Beceri modülü uygulandı.*Tahsilat/s.test(r)) && rows.some((r) => /Kod yazıldı/.test(r)) && rows.some((r) => /Kontrol edildi/.test(r)) && rows.some((r) => /Önizleme güncellendi/.test(r)), "akış satırları Claude Code düzeninde");
  await p.screenshot({ path: join(SHOTS, "4-akis.png") });
  const n0 = seen.length; await p.locator(".skd-go").click();
  await p.waitForFunction(() => /Seviye 7\/7/.test(document.querySelector(".skd")?.innerText || ""), null, { timeout: 60000 });
  ok(seen.length - n0 === 4, "uçtan uca: kalan 4 modül sırayla eklendi (" + (seen.length - n0) + " istek) · Seviye 7/7");
  await p.waitForTimeout(1500); await p.screenshot({ path: join(SHOTS, "5-tamamlandi.png") });
  // Öneri: beceri yüklü değilken projeye uyan beceri önerilir
  await p.evaluate(() => { localStorage.setItem("gms_skills", "[]"); dispatchEvent(new Event("gm:skills")); }); await p.waitForTimeout(500);
  const sug = await p.locator(".skd-sug").innerText().catch(() => ""); ok(/Klinik/.test(sug), "öneri: " + sug.replace(/\s+/g, " ").slice(0, 90));
  await p.screenshot({ path: join(SHOTS, "6-oneri.png") });
  const m = await browser.newContext({ ...devices["iPhone 13"] }); const mp = await m.newPage(); await mp.goto(webBase + "/#ana"); await mp.evaluate((t) => { for (const [k, v] of Object.entries({ tok: t, seenVer: "999", nrSeen: true, skills: ["plan-klinik"] })) localStorage.setItem("gms_" + k, JSON.stringify(v)); }, user);
  await mp.goto(webBase + "/#studio"); await mp.reload(); await mp.locator(".skd").waitFor({ timeout: 20000 }); await mp.waitForTimeout(800);
  const sw = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(sw <= 1, "telefonda yatay taşma yok (" + sw + "px)"); await mp.screenshot({ path: join(SHOTS, "7-telefon.png") });
  ok(!errs.length, "sayfa hatası yok" + (errs.length ? ": " + errs.join(" | ") : ""));
} finally { await browser.close(); api.kill(); web.close(); ai.close(); rmSync(dir, { recursive: true, force: true }); }

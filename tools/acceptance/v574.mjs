// v5.74 kabul testi: model menüsü, otomatik = Sonnet, sarı imleç sürükle/yapış, akış tekrarı yok, destek ikonu, menü grupları, şablon maliyet tablosu
import http from "node:http";
import { spawn, execFileSync } from "node:child_process";
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
const SHOTS = join(ROOT, "validation/screens/v574"); mkdirSync(SHOTS, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) process.exitCode = 1; };
const listen = async (s) => { s.listen(0, "127.0.0.1"); await once(s, "listening"); return s.address().port; };
const freePort = async () => { const s = http.createServer(); const p = await listen(s); s.close(); await once(s, "close"); return p; };
const seen = [];
const PAGE = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Makas</title><style>body{margin:0;font-family:system-ui;background:#fff7f2;color:#1c1917}header{padding:24px;background:#e11d48;color:#fff}main{padding:20px;display:grid;gap:12px}.c{background:#fff;border-radius:14px;padding:16px}</style></head><body><header><h1>Makas Kuaför</h1></header><main>${Array.from({ length: 6 }, (_, i) => `<div class="c"><h2>Hizmet ${i + 1}</h2><p>Saç kesimi ve bakım.</p></div>`).join("")}</main></body></html>`;
const ai = http.createServer(async (req, res) => { let b = ""; for await (const c of req) b += c; const j = b ? JSON.parse(b) : null; res.writeHead(200, { "Content-Type": "application/json" });
  if (req.url.endsWith("/models")) return res.end(JSON.stringify({ data: [{ id: "claude-sonnet-5-5" }, { id: "claude-opus-5-5" }, { id: "claude-haiku-5-5" }] }));
  seen.push(j.model); await new Promise((r) => setTimeout(r, 2500));
  res.end(JSON.stringify({ choices: [{ message: { content: PAGE }, finish_reason: "stop" }], usage: { prompt_tokens: 9000, completion_tokens: 2000, total_tokens: 11000 } })); });
const rates = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ data: [
  { id: "anthropic/claude-sonnet-5.5", pricing: { prompt: "0.000003", completion: "0.000015", input_cache_read: "0.0000003" } }, { id: "anthropic/claude-opus-5.5", pricing: { prompt: "0.000005", completion: "0.000025", input_cache_read: "0.0000005" } }, { id: "anthropic/claude-haiku-5.5", pricing: { prompt: "0.000001", completion: "0.000005", input_cache_read: "0.0000001" } }] })); });
const fx = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ rates: { TRY: 41.8 } })); });
const aiPort = await listen(ai), rPort = await listen(rates), fxPort = await listen(fx);
const dir = mkdtempSync(join(tmpdir(), "gitmapp-v574-")); const apiPort = await freePort(), webPort = await freePort();
const apiBase = "http://127.0.0.1:" + apiPort, webBase = "http://127.0.0.1:" + webPort;
const env = { ...process.env, PORT: String(apiPort), DB_PATH: join(dir, "db"), SECRET: randomBytes(32).toString("hex"), ADMIN_EMAIL: "y@gitmapp.test", SITE_URL: webBase, CORS_EXTRA: webBase, API_URL: apiBase, GITHUB_CLIENT_ID: "", GOOGLE_CLIENT_ID: "", AI_BASE: "http://127.0.0.1:" + aiPort + "/v1", AI_KEY: "k-test-123456789012", AI_MODEL: "", AI_MODELS: "claude-sonnet-5-5,claude-opus-5-5,claude-haiku-5-5", AI_FALLBACKS: "", ANTHROPIC_API_KEY: "", OPENROUTER_API_KEY: "", AI_PROFILE_AUTO: "0", RATES_URL: "http://127.0.0.1:" + rPort + "/m", FX_URL: "http://127.0.0.1:" + fxPort + "/fx", SIGNUP_CREDITS: "200" };
const adminPw = execFileSync(process.execPath, [join(ROOT, "server/server.mjs"), "create-admin"], { env, encoding: "utf8" }).match(/Şifre: (\S+)/)[1];
const api = spawn(process.execPath, [join(ROOT, "server/server.mjs")], { env, stdio: ["ignore", "pipe", "inherit"] }); await once(api.stdout, "data");
const web = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p === "/config.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); return res.end(`window.GMS_CONFIG={api:${JSON.stringify(apiBase)}};`); } if (p === "/sw.js") { res.writeHead(404); return res.end(); } if (p.endsWith("/")) p += "index.html"; const f = normalize(join(ROOT, p)); if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": MIME[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); }); web.listen(webPort, "127.0.0.1"); await once(web, "listening");
const post = async (path, body, t) => (await fetch(apiBase + "/api/" + path, { method: "POST", headers: { "Content-Type": "application/json", ...(t ? { Authorization: "Bearer " + t } : {}) }, body: JSON.stringify(body) })).json();
const browser = await chromium.launch();
const prep = async (p, t, extra = {}) => { await p.goto(webBase + "/#ana"); await p.evaluate(([t, x]) => { for (const [k, v] of Object.entries({ tok: t, seenVer: "999", nrSeen: true, vbarOff: true, installSnooze: 9e15, autoFix: false, ...x })) localStorage.setItem("gms_" + k, JSON.stringify(v)); }, [t, extra]); };
try {
  const admin = (await post("auth/login", { email: env.ADMIN_EMAIL, password: adminPw })).token; await post("admin/costs/refresh-rates", {}, admin);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await prep(p, admin); await p.goto(webBase + "/#studio"); await p.reload(); await p.locator("textarea.gta").first().waitFor({ timeout: 20000 });
  // Menü grupları ve destek ikonu
  const nav = await p.locator(".side").innerText(); ok(/Yapı taşları[\s\S]*Beceriler[\s\S]*Keşfet ve öğren[\s\S]*Akademi[\s\S]*Araçlar[\s\S]*Bağlantılar/.test(nav), "menü grupları: Yapı taşları · Keşfet ve öğren · Araçlar");
  ok(await p.locator('button[aria-label="Teknik destek"]').count() > 0 && !(await p.locator(".gbar").innerText()).includes("GT"), "“GT” yerine destek ikonu");
  // Model menüsü
  await p.locator(".cmp-b").first().click(); await p.locator(".mdl-pop").waitFor();
  const menu = await p.locator(".mdl-pop").innerText(); ok((await p.locator(".mdl-i").count()) === 3 && /haiku[\s\S]*Hızlı[\s\S]*sonnet[\s\S]*Dengeli[\s\S]*opus[\s\S]*Güçlü/i.test(menu), "model menüsü: Haiku · Sonnet · Opus, seviye ve kredi");
  ok(/Uygulamayı claude-sonnet-5-5 yazar \(3 kredi\)/.test(menu), "Otomatik açıklaması doğru: Sonnet 3 kredi");
  await p.screenshot({ path: join(SHOTS, "1-model-menu.png") }); await p.keyboard.press("Escape");
  // Otomatik → yeni projede Sonnet
  await p.locator("textarea.gta").first().fill("Kuaför randevu uygulaması"); await p.keyboard.press("Enter");
  await p.locator(".bs").waitFor({ timeout: 10000 }); await p.waitForTimeout(1200);
  const during = await p.locator(".ws-chat").innerText(); ok(!/Model hâlâ düşünüyor|ilk satırı yazmadan önce düşünüyor|Model bağlantısı kuruluyor/.test(during), "akışta durum tekrarı yok"); await p.screenshot({ path: join(SHOTS, "2-akis-calisiyor.png") });
  await p.locator(".picker-handle").waitFor({ timeout: 20000 }); ok(seen.filter(Boolean).at(-1) === "claude-sonnet-5-5", "otomatik: yeni proje Sonnet ile üretildi (" + seen.filter(Boolean).at(-1) + ")");
  // Sarı imleç: sola yapışık başlar, sürükle → sağ kenara yapışır, yer hatırlanır
  await p.waitForTimeout(150); const h = p.locator(".picker-handle"); const b0 = await h.boundingBox(); const prev = await p.locator(".ws-prev").boundingBox();
  await p.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2); await p.mouse.down();
  for (let i = 1; i <= 12; i++) await p.mouse.move(b0.x + b0.width / 2 + (prev.width * 0.7) * i / 12, b0.y + b0.height / 2 - 160 * i / 12);
  await p.mouse.up(); await p.waitForTimeout(800);
  const side = await p.locator(".picker-dock").getAttribute("data-side"); const saved = await p.evaluate(() => JSON.parse(localStorage.getItem("gms_pickerPos3") || "null"));
  const b1 = await h.boundingBox(); ok(side === "r" && saved?.x === 1 && b1.x > prev.x + prev.width * 0.6 && b1.y < b0.y - 60, "sarı imleç sürüklendi: sağ kenara yapıştı, yukarıda kaldı, yer kaydedildi");
  await h.click(); await p.locator(".picker-menu").waitFor(); await p.waitForTimeout(700); const mb = await p.locator(".picker-menu").boundingBox(); ok(mb.x < b1.x, "menü kenardan içeri açılıyor"); await p.screenshot({ path: join(SHOTS, "3-sari-imlec.png") });
  await p.keyboard.press("Escape"); await p.mouse.move(5, 5); await p.waitForTimeout(6500); ok(await p.locator(".picker-dock.idle").count() === 1, "dokunulmayınca soluyor");
  await p.reload(); await p.locator(".picker-handle").waitFor({ timeout: 20000 }).catch(() => { }); 
  // Şablon maliyet tablosu
  await p.goto(webBase + "/#ayar"); await p.reload(); await p.locator(".tpl-cost table").waitFor({ timeout: 20000 }); await p.waitForTimeout(1500);
  const rowsN = await p.locator(".tpl-cost tbody tr").count(); const tbl = await p.locator(".tpl-cost").innerText();
  ok(rowsN >= 40 && /\$/.test(tbl) && /₺/.test(tbl) && /%/.test(tbl) && /9 kredi/.test(tbl), "şablon maliyet tablosu: " + rowsN + " şablon, $, ₺, kredi ve marj");
  await p.locator(".tpl-cost").scrollIntoViewIfNeeded(); await p.screenshot({ path: join(SHOTS, "4-sablon-maliyet.png") });
  await p.goto(webBase + "/#sablonlar"); await p.reload(); await p.locator(".tpc").first().waitFor({ timeout: 15000 }); ok(/özelleştirme ~9 kredi/.test(await p.locator(".tpc").first().innerText()), "şablon kartı: kredi bazlı tahmin");
  const m = await browser.newContext({ ...devices["iPhone 13"] }); const mp = await m.newPage(); await prep(mp, admin); await mp.goto(webBase + "/#ayar"); await mp.reload(); await mp.locator(".tpl-cost table").waitFor({ timeout: 20000 }); await mp.waitForTimeout(600);
  const sw = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(sw <= 1, "telefonda yatay taşma yok (" + sw + "px)"); await mp.screenshot({ path: join(SHOTS, "5-telefon.png") });
  ok(!errs.length, "sayfa hatası yok" + (errs.length ? ": " + errs.join(" | ") : ""));
} finally { await browser.close(); api.kill(); for (const s of [web, ai, rates, fx]) s.close(); rmSync(dir, { recursive: true, force: true }); }

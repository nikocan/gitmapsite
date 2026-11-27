// Claude ana sağlayıcı + Kokpit canlı panel kabul testi (sahte Anthropic ve fiyat kaynağıyla). Çalıştırma: node tools/acceptance/claude-kokpit.mjs
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
const SHOTS = join(ROOT, "validation/screens/claude"); mkdirSync(SHOTS, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) process.exitCode = 1; };
const listen = async (s) => { s.listen(0, "127.0.0.1"); await once(s, "listening"); return s.address().port; };
const freePort = async () => { const s = http.createServer(); const p = await listen(s); s.close(); await once(s, "close"); return p; };
const HTML = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kuaför</title><style>body{font-family:system-ui;margin:0;background:#fff7f2}header{padding:20px;background:#e11d48;color:#fff}main{padding:20px}</style></head><body><header><h1>Makas Kuaför</h1></header><main><p>Randevu al</p><button>Randevu</button></main></body></html>`;
const ant = http.createServer(async (req, res) => { let b = ""; for await (const c of req) b += c; const j = b ? JSON.parse(b) : null;
  if (req.url.startsWith("/v1/models")) { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ data: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"].map((id) => ({ id })) })); }
  await new Promise((r) => setTimeout(r, 900));
  const sys = JSON.stringify(j.system || ""); const text = /yazılım ajanısın/.test(sys) ? '[{"baslik":"Randevu ekranı","detay":"x"}]' : /ürün tasarımcısı ve yazılım mimarısın/.test(sys) ? "1. Randevu ekranı" : /Gitmapp/.test(sys) && j.max_tokens < 3000 ? "Merhaba, yardımcı olayım." : HTML;
  const usage = { input_tokens: 1800, cache_read_input_tokens: 12000, cache_creation_input_tokens: 0, output_tokens: 2400 };
  if (j.stream) { res.writeHead(200, { "Content-Type": "text/event-stream" }); const ev = (o) => res.write("data: " + JSON.stringify(o) + "\n\n"); ev({ type: "message_start", message: { usage } }); for (let i = 0; i < text.length; i += 120) { ev({ type: "content_block_delta", delta: { type: "text_delta", text: text.slice(i, i + 120) } }); await new Promise((r) => setTimeout(r, 60)); } ev({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 2400 } }); return res.end(); }
  res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ id: "m", model: j.model, content: [{ type: "text", text }], stop_reason: "end_turn", usage })); });
const or = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ data: [{ id: "anthropic/claude-sonnet-5.5" }, { id: "anthropic/claude-haiku-5.5" }] })); });
const rates = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ data: [
  { id: "anthropic/claude-sonnet-5.5", pricing: { prompt: "0.000003", completion: "0.000015", input_cache_read: "0.0000003" } }, { id: "anthropic/claude-opus-5.5", pricing: { prompt: "0.000005", completion: "0.000025", input_cache_read: "0.0000005" } }, { id: "anthropic/claude-haiku-5.5", pricing: { prompt: "0.000001", completion: "0.000005", input_cache_read: "0.0000001" } }] })); });
const fx = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ rates: { TRY: 41.8 } })); });
const antPort = await listen(ant), orPort = await listen(or), ratePort = await listen(rates), fxPort = await listen(fx);
const dir = mkdtempSync(join(tmpdir(), "gitmapp-claude-e2e-")); const apiPort = await freePort(), webPort = await freePort();
const apiBase = "http://127.0.0.1:" + apiPort, webBase = "http://127.0.0.1:" + webPort;
const env = { ...process.env, PORT: String(apiPort), DB_PATH: join(dir, "db"), SECRET: randomBytes(32).toString("hex"), ADMIN_EMAIL: "y@gitmapp.test", SITE_URL: webBase, CORS_EXTRA: webBase, API_URL: apiBase, GITHUB_CLIENT_ID: "", GOOGLE_CLIENT_ID: "",
  AI_BASE: "http://127.0.0.1:" + orPort + "/openrouter.ai/api/v1", AI_KEY: "sk-or-v1-" + "a".repeat(40), ANTHROPIC_API_KEY: "sk-ant-" + "b".repeat(40), ANTHROPIC_BASE: "http://127.0.0.1:" + antPort + "/v1", RATES_URL: "http://127.0.0.1:" + ratePort + "/m", FX_URL: "http://127.0.0.1:" + fxPort + "/fx", AI_PROFILE_DELAY_MS: "300", OPENAI_API_KEY: "", GEMINI_API_KEY: "", OPENROUTER_API_KEY: "", AI_MODELS: "", AI_MODEL: "", HELPER_MODEL: "", COPILOT_MODEL: "", SIGNUP_CREDITS: "50" };
const adminPw = execFileSync(process.execPath, [join(ROOT, "server/server.mjs"), "create-admin"], { env, encoding: "utf8" }).match(/Şifre: (\S+)/)[1];
const api = spawn(process.execPath, [join(ROOT, "server/server.mjs")], { env, stdio: ["ignore", "pipe", "inherit"] }); await once(api.stdout, "data");
const web = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p === "/config.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); return res.end(`window.GMS_CONFIG={api:${JSON.stringify(apiBase)}};`); } if (p === "/sw.js") { res.writeHead(404); return res.end(); } if (p.endsWith("/")) p += "index.html"; const f = normalize(join(ROOT, p)); if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": MIME[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); }); web.listen(webPort, "127.0.0.1"); await once(web, "listening");
const call = async (method, path, body, token) => { const r = await fetch(apiBase + "/api/" + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
const browser = await chromium.launch();
const prep = async (page, token) => { await page.goto(webBase + "/#ana"); await page.evaluate((t) => { localStorage.setItem("gms_tok", JSON.stringify(t)); localStorage.setItem("gms_seenVer", JSON.stringify("999")); localStorage.setItem("gms_nrSeen", "true"); localStorage.setItem("gms_vbarOff", "true"); }, token); };
try {
  const admin = (await call("POST", "auth/login", { email: env.ADMIN_EMAIL, password: adminPw })).token;
  let p; for (let i = 0; i < 50; i++) { p = await call("GET", "admin/ai/profile", null, admin); if (p.applied) break; await new Promise((r) => setTimeout(r, 100)); }
  ok(p.applied && p.primary === "Anthropic", "otomatik geçiş: ana sağlayıcı Claude (Anthropic) · doğrudan · önbellek " + p.cache);
  await call("POST", "admin/costs/refresh-rates", {}, admin);
  for (const [path, body] of [["ai/plan", { prompt: "Kuaför randevu uygulaması" }], ["ai/todos", { prompt: "Kuaför randevu uygulaması" }], ["ai/generate", { prompt: "Kuaför randevu uygulaması" }], ["ai/generate", { prompt: "Rengi kırmızı yap", html: HTML + " ".repeat(10) }]]) await call("POST", path, body, admin);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 }); const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await prep(page, admin); await page.goto(webBase + "/#yapay-zeka"); await page.reload(); await page.locator(".ai-prof").waitFor({ timeout: 20000 }); await page.locator(".ail-t tbody tr").first().waitFor(); await page.waitForTimeout(800);
  const prof = await page.locator(".ai-prof").innerText(); ok(/Önerilen yapılandırma etkin/.test(prof) && /Anthropic/.test(prof), "yapay zekâ sayfası: önerilen yapılandırma etkin");
  const live = await page.locator(".ail").first().innerText(); ok(/Haiku|haiku/.test(live) && /sonnet/i.test(live) && /\$/.test(live) && /₺/.test(live), "canlı panel: roller, $ ve ₺ görünüyor");
  await page.screenshot({ path: join(SHOTS, "1-yapay-zeka.png") });
  await page.goto(webBase + "/#maliyetler"); await page.reload(); await page.locator(".cost-panel").waitFor({ timeout: 15000 }); await page.waitForTimeout(500);
  const cost = await page.locator(".cost-panel").innerText(); ok(/\$/.test(cost) && /41,8/.test(cost) && /otomatik/.test(cost), "maliyet sayfası: dolar, kur ve otomatik tarifeler"); await page.screenshot({ path: join(SHOTS, "2-maliyetler.png"), fullPage: true });
  // Stüdyo'da üretim + Kokpit canlı
  await page.goto(webBase + "/#studio"); await page.reload(); await page.locator("textarea").first().waitFor({ timeout: 20000 });
  await page.locator("textarea").first().fill("Kuaför randevu uygulaması yap"); await page.keyboard.press("Enter"); await page.waitForTimeout(2500);
  await page.screenshot({ path: join(SHOTS, "3a-studyo.png") });
  let kok = page.locator("button:visible", { hasText: /^Kokpit/ }).first();
  if (!(await kok.count())) { await page.locator(":is(button,[role=button],div):visible", { hasText: /^\s*main\s*1?\s*$/ }).last().click().catch(() => { }); await page.waitForTimeout(600); kok = page.locator("button:visible", { hasText: /^Kokpit/ }).first(); }
  if (await kok.count()) await kok.click(); else await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Kokpit/.test(x.textContent)); b && b.click(); });
  await page.locator(".kok .ail").waitFor({ timeout: 15000 }); await page.waitForTimeout(4500);
  const k = await page.locator(".kok .ail").innerText(); ok(/Anthropic/.test(k) && /(Üretim|Düzenleme|Plan)/.test(k), "Kokpit: canlı bölüm, son istekler ve sağlayıcı"); await page.screenshot({ path: join(SHOTS, "3-kokpit.png") });
  const m = await browser.newContext({ ...devices["iPhone 13"] }); const mp = await m.newPage(); await prep(mp, admin); await mp.goto(webBase + "/#yapay-zeka"); await mp.reload(); await mp.locator(".ai-prof").waitFor({ timeout: 20000 }); await mp.waitForTimeout(800);
  const sw = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(sw <= 1, "telefonda yatay taşma yok (" + sw + "px)"); await mp.screenshot({ path: join(SHOTS, "4-telefon.png") });
  ok(!errs.length, "sayfa hatası yok" + (errs.length ? ": " + errs.join(" | ") : ""));
} finally { await browser.close(); api.kill(); for (const s of [web, ant, or, rates, fx]) s.close(); rmSync(dir, { recursive: true, force: true }); }

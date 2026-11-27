// v5.78 kabul testi: Claude Code tarzı kompakt akış, gezilebilir adımlar ve yazılan kod, otomatik kayıt, kayıt uyarısı yok
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
const SHOTS = join(ROOT, "validation/screens/v578"); mkdirSync(SHOTS, { recursive: true });
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
const dir = mkdtempSync(join(tmpdir(), "gitmapp-v578-")); const apiPort = await freePort(), webPort = await freePort();
const apiBase = "http://127.0.0.1:" + apiPort, webBase = "http://127.0.0.1:" + webPort;
const env = { ...process.env, PORT: String(apiPort), DB_PATH: join(dir, "db"), SECRET: randomBytes(32).toString("hex"), ADMIN_EMAIL: "y@gitmapp.test", SITE_URL: webBase, CORS_EXTRA: webBase, API_URL: apiBase, GITHUB_CLIENT_ID: "", GOOGLE_CLIENT_ID: "", AI_BASE: "http://127.0.0.1:" + aiPort + "/v1", AI_KEY: "k-test-123456789012", AI_MODEL: "", AI_MODELS: "claude-sonnet-5-5,claude-opus-5-5,claude-haiku-5-5", AI_FALLBACKS: "", ANTHROPIC_API_KEY: "", OPENROUTER_API_KEY: "", AI_PROFILE_AUTO: "0", RATES_URL: "http://127.0.0.1:" + rPort + "/m", FX_URL: "http://127.0.0.1:" + fxPort + "/fx", SIGNUP_CREDITS: "200" };
const adminPw = execFileSync(process.execPath, [join(ROOT, "server/server.mjs"), "create-admin"], { env, encoding: "utf8" }).match(/Şifre: (\S+)/)[1];
const api = spawn(process.execPath, [join(ROOT, "server/server.mjs")], { env, stdio: ["ignore", "pipe", "inherit"] }); await once(api.stdout, "data");
const web = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p === "/config.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); return res.end(`window.GMS_CONFIG={api:${JSON.stringify(apiBase)}};`); } if (p === "/sw.js") { res.writeHead(404); return res.end(); } if (p.endsWith("/")) p += "index.html"; const f = normalize(join(ROOT, p)); if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": MIME[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); }); web.listen(webPort, "127.0.0.1"); await once(web, "listening");
const post = async (path, body, t) => (await fetch(apiBase + "/api/" + path, { method: "POST", headers: { "Content-Type": "application/json", ...(t ? { Authorization: "Bearer " + t } : {}) }, body: JSON.stringify(body) })).json();
const browser = await chromium.launch();
const prep = async (p, t, extra = {}) => { await p.goto(webBase + "/#ana"); await p.evaluate(([t, x]) => { for (const [k, v] of Object.entries({ tok: t, seenVer: "999", nrSeen: true, vbarOff: true, installSnooze: 9e15, autoFix: false, ...x })) localStorage.setItem("gms_" + k, JSON.stringify(v)); }, [t, extra]); };
try {
  const admin = (await post("auth/login", { email: env.ADMIN_EMAIL, password: adminPw })).token;
  const apps = async () => (await (await fetch(apiBase + "/api/apps", { headers: { Authorization: "Bearer " + admin } })).json()).apps;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const toasts = []; await p.exposeFunction("__toastSeen", t => toasts.push(t));
  await prep(p, admin); await p.goto(webBase + "/#studio"); await p.reload(); await p.locator("textarea.gta").first().waitFor({ timeout: 20000 });
  await p.evaluate(() => { const o = new MutationObserver(() => { const t = document.querySelector(".toast"); if (t && t.dataset.seen !== t.textContent) { t.dataset.seen = t.textContent; window.__toastSeen(t.textContent); } }); o.observe(document.body, { childList: true, subtree: true, characterData: true }); });
  await p.locator("textarea.gta").first().fill("Kuaför randevu uygulaması: hizmetler, uzman seçimi ve saat"); await p.keyboard.press("Enter");
  await p.waitForTimeout(1200); await p.screenshot({ path: join(SHOTS, "1-akis-calisiyor.png") });
  ok(await p.locator(".cc-flow .cc-row").count() >= 1, "çalışırken akış adımları canlı görünüyor");
  await p.locator(".picker-handle").waitFor({ timeout: 30000 }); await p.waitForTimeout(800);
  // Akış: son iş açık, adımlar gezilebilir, yazılan kod okunur
  ok(await p.locator(".cc-sum").last().getAttribute("aria-expanded") === "true", "son işin akışı açık kalıyor");
  ok(/kredi/.test(await p.locator(".cc-sum").last().innerText()), "özet satırı süre, model ve krediyi tek satırda gösteriyor");
  ok(await p.locator(".flow-credit").count() === 0, "ayrı kredi tablosu yok");
  await p.locator(".cc-rbtn", { hasText: "Kod yazıldı" }).last().click(); await p.waitForTimeout(200);
  const code = await p.locator(".cc-code").last().innerText(); ok(/Makas Kuaför/.test(code) && /<!doctype html>/i.test(code), "“Kod yazıldı” adımında yazılan kodun tamamı okunuyor (" + code.length + " karakter)");
  ok(await p.locator(".swin").count() === 0, "sorun yokken önizlemenin üstünde ek pencere açılmıyor");
  ok(await p.locator(".dq-ok").count() === 1 && await p.locator(".dq-card").count() === 0, "tasarım denetimi tek satır");
  ok(await p.locator(".oc.oc-c .oc-row").count() >= 1, "çıktı tek satır (dosya, fark, simgeler)");
  ok(!(await p.locator(".skd").first().getAttribute("class")).includes("open"), "beceri çubuğu kapalı başlıyor, akışa yer kalıyor");
  const chatH = await p.locator(".ws-msgs").evaluate(e => e.clientHeight); ok(chatH >= 420, "akış alanı yüksekliği " + chatH + " px");
  await p.screenshot({ path: join(SHOTS, "2-akis-bitti-kod-acik.png") });
  // Otomatik kayıt: Kaydet'e basmadan hesaba kaydedildi
  let list = []; for (let i = 0; i < 30 && !list.length; i++) { await p.waitForTimeout(300); list = await apps(); }
  ok(list.length === 1, "otomatik kayıt: proje Kaydet'e basmadan hesaba kaydedildi");
  await p.waitForTimeout(500); ok(/Kaydedildi/.test(await p.locator(".studio-save").innerText()), "üst çubuk: “Kaydedildi”");
  // İkinci istek → otomatik güncellenir, uyarı/onay yok
  p.on("dialog", d => { errs.push("beklenmeyen onay penceresi: " + d.message()); d.dismiss(); });
  await p.locator("textarea.gta").first().fill("Başlığı Makas Salon yap"); await p.keyboard.press("Enter");
  await p.waitForTimeout(1500); await p.screenshot({ path: join(SHOTS, "3-ikinci-istek.png") });
  await p.locator(".cc-sum").nth(1).waitFor({ timeout: 30000 }); await p.waitForTimeout(3500);
  ok(await p.locator(".cc-sum").first().getAttribute("aria-expanded") === "false" && await p.locator(".cc-sum").last().getAttribute("aria-expanded") === "true", "eski akış kapanıyor, yenisi açık; eskisi tıklayınca açılıyor");
  await p.locator(".cc-sum").first().click(); ok(await p.locator(".cc-sum").first().getAttribute("aria-expanded") === "true", "önceki işin adımlarına geri dönülebiliyor");
  const t2 = (await apps())[0]; ok(new Date(t2.updated) > new Date(list[0].updated), "ikinci değişiklik de otomatik kaydedildi");
  ok(!toasts.some(t => /Kaydedildi|kaydedilmemiş/i.test(t)), "kayıt bildirimi çıkmadı (" + toasts.join(" | ") + ")");
  await p.screenshot({ path: join(SHOTS, "4-gecmis-akis.png") });
  ok(errs.length === 0, "sayfa hatası yok" + (errs.length ? ": " + errs.join(" | ") : ""));
  const m = await browser.newContext({ ...devices["iPhone 13"] }); const mp = await m.newPage(); await prep(mp, admin); await mp.goto(webBase + "/#studio"); await mp.reload(); await mp.waitForTimeout(2500);
  const w = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(w <= 1, "telefonda yatay taşma yok"); await mp.screenshot({ path: join(SHOTS, "5-telefon.png") }); await m.close();
} finally { await browser.close(); api.kill(); for (const s of [web, ai, rates, fx]) s.close(); rmSync(dir, { recursive: true, force: true }); }

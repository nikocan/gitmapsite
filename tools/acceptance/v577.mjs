// v5.77 kabul testi: Yeni sohbet penceresi, ortam (depo) seçici, aynı projede yeni sohbet, sohbet geçmişi, projeye ekle, sık kullanılanlar
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
const SHOTS = join(ROOT, "validation/screens/v577"); mkdirSync(SHOTS, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) process.exitCode = 1; };
const listen = async (s) => { s.listen(0, "127.0.0.1"); await once(s, "listening"); return s.address().port; };
const freePort = async () => { const s = http.createServer(); const p = await listen(s); s.close(); await once(s, "close"); return p; };
const seen = [];
const PAGE = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Makas</title><style>body{margin:0;font-family:system-ui;background:#fff7f2;color:#1c1917}header{padding:24px;background:#e11d48;color:#fff}main{padding:20px;display:grid;gap:12px}.c{background:#fff;border-radius:14px;padding:16px}</style></head><body><header><h1>Makas Kuaför</h1></header><main>${Array.from({ length: 6 }, (_, i) => `<div class="c"><h2>Hizmet ${i + 1}</h2><p>Saç kesimi ve bakım.</p></div>`).join("")}</main></body></html>`;
const ai = http.createServer(async (req, res) => { let b = ""; for await (const c of req) b += c; const j = b ? JSON.parse(b) : null; res.writeHead(200, { "Content-Type": "application/json" });
  if (req.url.endsWith("/models")) return res.end(JSON.stringify({ data: [{ id: "claude-sonnet-5-5" }, { id: "claude-opus-5-5" }, { id: "claude-haiku-5-5" }] }));
  seen.push(j.model); await new Promise((r) => setTimeout(r, 600));
  res.end(JSON.stringify({ choices: [{ message: { content: PAGE }, finish_reason: "stop" }], usage: { prompt_tokens: 9000, completion_tokens: 2000, total_tokens: 11000 } })); });
const rates = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ data: [
  { id: "anthropic/claude-sonnet-5.5", pricing: { prompt: "0.000003", completion: "0.000015", input_cache_read: "0.0000003" } }, { id: "anthropic/claude-opus-5.5", pricing: { prompt: "0.000005", completion: "0.000025", input_cache_read: "0.0000005" } }, { id: "anthropic/claude-haiku-5.5", pricing: { prompt: "0.000001", completion: "0.000005", input_cache_read: "0.0000001" } }] })); });
const fx = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ rates: { TRY: 41.8 } })); });
const aiPort = await listen(ai), rPort = await listen(rates), fxPort = await listen(fx);
const dir = mkdtempSync(join(tmpdir(), "gitmapp-v577-")); const apiPort = await freePort(), webPort = await freePort();
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
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await prep(p, admin); await p.goto(webBase + "/#uygulamalarim"); await p.reload();
  // 1) Sol menü: Yeni sohbet + Sık kullanılanlar
  await p.locator(".cc-newchat").waitFor({ timeout: 20000 });
  ok(await p.locator(".cc-fav-grid .fav-i").count() === 6, "sık kullanılanlar: varsayılan 6 kısayol");
  const favTxt = await p.locator(".cc-fav-grid").innerText(); ok(/Yeni sohbet[\s\S]*Geliştir[\s\S]*Projeler[\s\S]*Planla[\s\S]*Şablonlar[\s\S]*Ara/.test(favTxt), "kısayollar: Yeni sohbet · Geliştir · Projeler · Planla · Şablonlar · Ara");
  const icons = await p.locator(".cc-fav-grid use").evaluateAll(us => us.map(u => u.getAttribute("href")));
  ok(icons.some(h => h.endsWith("#newchat")) && icons.some(h => h.endsWith("#plan")), "yeni iki tonlu simgeler kullanılıyor (newchat, plan)");
  const symOk = await p.evaluate(async () => { const t = await (await fetch("./brand/ecosystem.svg")).text(); return ["newchat","chats","plan","environment","repo","branch","favorites"].every(id => t.includes('id="' + id + '"')); });
  ok(symOk, "ecosystem.svg yeni sembolleri içeriyor");
  await p.locator(".fav-edit-b").click(); await p.locator(".fav-edit").waitFor();
  await p.locator(".fav-edit button", { hasText: "Akademi" }).click(); await p.locator(".fav-edit button", { hasText: "Ara" }).first().click();
  await p.screenshot({ path: join(SHOTS, "1-sik-kullanilanlar-duzenle.png"), clip: { x: 0, y: 0, width: 420, height: 960 } });
  await p.keyboard.press("Escape"); await p.reload(); await p.locator(".cc-fav-grid").waitFor();
  const fav2 = await p.locator(".cc-fav-grid").innerText(); ok(/Akademi/.test(fav2) && !/\bAra\b/.test(fav2), "düzenleme kaydedildi ve yenilemeden sonra korundu");
  await p.screenshot({ path: join(SHOTS, "2-sol-menu.png"), clip: { x: 0, y: 0, width: 420, height: 960 } });
  // 2) Yeni sohbet penceresi (kısayol), boş sayfa + Hızlı + ilk mesaj
  await p.keyboard.press("Control+Shift+O"); await p.locator(".ns").waitFor();
  ok(await p.locator('.ns-card[data-k="ayni"]').isDisabled(), "açık proje yokken “Bu projede yeni sohbet” kapalı");
  ok(await p.locator('.ns-card[data-k="bos"]').getAttribute("aria-checked") === "true", "varsayılan: Boş sayfa");
  await p.locator('.ns-card[data-k="depo"]').click(); await p.locator('.ns-env [role="tab"]', { hasText: "GitHub" }).click();
  await p.locator(".ns-empty", { hasText: "GitHub hesabın bağlı değil" }).waitFor({ timeout: 8000 }); ok(true, "GitHub sekmesi: hesap bağlı değilse bağlama bağlantısı");
  ok(await p.locator(".ns-go").isDisabled(), "depo seçilmeden başlatılamıyor");
  await p.screenshot({ path: join(SHOTS, "3-ortam-secici.png") });
  await p.locator('.ns-card[data-k="bos"]').click(); await p.locator('.ns-mode[data-m="hizli"]').click();
  await p.locator(".ns-ta").fill("Kuaför randevu uygulaması"); await p.screenshot({ path: join(SHOTS, "4-yeni-sohbet.png") });
  await p.keyboard.press("Enter");
  await p.locator(".picker-handle").waitFor({ timeout: 30000 }); ok(true, "ilk mesaj gönderildi, sayfa üretildi");
  // 3) Aynı projede yeni sohbet
  if (await p.locator(".studio-side-toggle").first().getAttribute("aria-expanded") === "false") await p.locator(".studio-side-toggle").first().click(); await p.locator(".cc-chats").waitFor({ timeout: 8000 });
  ok(/Kuaför randevu/.test(await p.locator(".cc-chats").innerText()), "sol menüde açık sohbet listeleniyor");
  await p.locator(".cc-newchat").click(); await p.locator(".ns").waitFor();
  ok(await p.locator('.ns-card[data-k="ayni"]').getAttribute("aria-checked") === "true", "proje açıkken varsayılan: Bu projede yeni sohbet");
  await p.locator(".ns-go").click(); await p.locator(".chat-fresh").waitFor({ timeout: 8000 });
  ok(await p.locator(".ws-prev iframe").count() > 0, "yeni sohbette proje dosyası (önizleme) korunuyor");
  await p.waitForTimeout(300); const nChat = await p.locator(".cc-chats .cc-chat").count(); ok(nChat === 2, "sol menüde 2 sohbet: açık + önceki (" + nChat + ")");
  ok((await p.locator(".ws-chats > b").innerText()) === "2", "üst çubuk sohbet rozeti: 2");
  await p.screenshot({ path: join(SHOTS, "5-ayni-projede-yeni-sohbet.png") });
  await p.locator(".ws-chats").click(); await p.locator(".chatm").waitFor(); await p.screenshot({ path: join(SHOTS, "6-sohbet-menusu.png") });
  await p.locator(".chatm button", { hasText: "Kuaför randevu" }).last().click();
  await p.waitForTimeout(300); ok(/Kuaför randevu uygulaması/.test(await p.locator(".ws-msgs").innerText()), "önceki sohbete dönüldü, mesajlar geri geldi");
  // 4) Kaydet → Bulut ortamında listelenir
  await p.locator('.ib[title="Kaydet"]').first().click(); await p.waitForTimeout(1500);
  await p.locator(".cc-newchat").click(); await p.locator('.ns-card[data-k="depo"]').click(); await p.locator('.ns-env [role="tab"]', { hasText: "Bulut" }).click();
  await p.locator(".ns-row").first().waitFor({ timeout: 8000 }); ok(await p.locator(".ns-row").count() >= 1, "Bulut sekmesinde kayıtlı proje listeleniyor");
  await p.locator(".ns .ib[aria-label=Kapat]").click();
  // 5) Boş sayfa → sayfa üret → projeye ekle
  await p.locator(".cc-newchat").click(); await p.locator('.ns-card[data-k="bos"]').click(); await p.locator(".ns-ta").fill("Kampanya sayfası"); await p.keyboard.press("Enter");
  await p.waitForTimeout(800); await p.locator(".picker-handle").waitFor({ timeout: 30000 });
  await p.locator(".ws-addpage").click(); await p.locator(".atp .ns-row").first().waitFor({ timeout: 8000 });
  await p.screenshot({ path: join(SHOTS, "7-projeye-ekle.png") });
  const before = seen.length; await p.locator(".atp .ns-row").first().click();
  for (let i = 0; i < 60 && seen.length === before; i++) await p.waitForTimeout(250);
  ok(seen.length > before, "sayfa seçilen projeye eklenmek üzere üretime gönderildi");
  await p.waitForTimeout(1500); ok(/Sayfayı projeye ekle/.test(await p.locator(".ws-msgs").innerText()), "hedef projede “Sayfayı projeye ekle” adımı görünüyor");
  ok(errs.length === 0, "sayfa hatası yok" + (errs.length ? ": " + errs.join(" | ") : ""));
  // 6) Telefon
  const m = await browser.newContext({ ...devices["iPhone 13"] }); const mp = await m.newPage(); const merr = []; mp.on("pageerror", e => merr.push(e.message));
  await prep(mp, admin); await mp.goto(webBase + "/#uygulamalarim"); await mp.reload(); await mp.waitForTimeout(1500);
  await mp.evaluate(() => dispatchEvent(new CustomEvent("gm:newsess", { detail: {} }))); await mp.locator(".ns").waitFor();
  const w = await mp.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); ok(w[0] <= w[1], "390 px: yatay kaydırma yok");
  await mp.screenshot({ path: join(SHOTS, "8-telefon-yeni-sohbet.png") }); ok(merr.length === 0, "telefonda sayfa hatası yok");
  await m.close();
} finally { await browser.close(); api.kill(); ai.close(); rates.close(); fx.close(); web.close(); rmSync(dir, { recursive: true, force: true }); }

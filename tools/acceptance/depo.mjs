// Depo kabul testi: sahte bir işletme sitesi + yerel API + gerçek tarayıcı.
// Çalıştırma: node tools/acceptance/depo.mjs   (ekranlar: validation/screens/depo/)
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
const { chromium } = require("playwright");
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SHOTS = join(ROOT, "validation/screens/depo"); mkdirSync(SHOTS, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".json": "application/json" };
const freePort = async () => { const s = http.createServer(); s.listen(0, "127.0.0.1"); await once(s, "listening"); const p = s.address().port; s.close(); await once(s, "close"); return p; };
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) process.exitCode = 1; };

async function images(browser) {
  const page = await browser.newPage();
  const shot = async (w, h, bg, text) => { await page.setViewportSize({ width: w, height: h }); await page.setContent(`<body style="margin:0;width:${w}px;height:${h}px;background:${bg};display:grid;place-items:center;font:700 ${Math.round(h / 6)}px system-ui;color:#fff">${text}</body>`); return page.screenshot({ type: "jpeg", quality: 80 }); };
  const out = {
    kapak: await shot(1600, 640, "linear-gradient(120deg,#7c2d12,#ea580c 60%,#fbbf24)", "Taş Fırın Lezzetleri"),
    u1: await shot(600, 600, "radial-gradient(circle,#f59e0b,#78350f)", "Lahmacun"),
    u2: await shot(600, 600, "radial-gradient(circle,#ef4444,#7f1d1d)", "Pide"),
    u3: await shot(600, 600, "radial-gradient(circle,#84cc16,#365314)", "Salata"),
    sef: await shot(400, 400, "linear-gradient(#0ea5e9,#1e3a8a)", "Şef"),
    paylas: await shot(1200, 630, "#ea580c", "Lezzet Durağı"),
  };
  await page.close(); return out;
}
async function fakeSite(img) {
  const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="190" height="48" viewBox="0 0 190 48"><rect width="48" height="48" rx="12" fill="#ea580c"/><text x="58" y="32" font-family="Arial" font-weight="700" font-size="22" fill="#1c1917">Lezzet Durağı</text></svg>`;
  const page = (title, body) => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${title}</title><meta name="theme-color" content="#ea580c"><meta name="description" content="Taş fırında ev yemekleri"><meta property="og:image" content="/img/paylas.jpg"><link rel="stylesheet" href="/site.css"><script>console.log('takip')</script></head><body>
  <header class="top"><div class="w"><a href="/" class="brand"><img src="/img/logo.svg" alt="Lezzet Durağı"></a><nav><a href="/menu">Menü</a><a href="/hakkimizda">Hakkımızda</a><a href="/subeler">Şubeler</a><a href="/iletisim">İletişim</a></nav></div></header>${body}
  <footer><div class="w"><p>© 2026 Lezzet Durağı · Kadıköy, İstanbul · 0216 000 00 00</p></div></footer></body></html>`;
  const files = {
    "/": ["text/html", page("Lezzet Durağı | Taş Fırın", `<section class="hero"><img src="/img/kapak.jpg" alt="Taş fırın"><div class="w"><h1>Taş fırından sofranıza</h1><p>Her gün taze, odun ateşinde.</p><a class="btn" href="/menu">Menüyü gör</a></div></section>
      <section class="urunler"><div class="w"><h2>Öne çıkanlar</h2><div class="grid"><div class="card"><img data-src="/img/u1.jpg" alt="Lahmacun"><h3>Lahmacun</h3><p>120 ₺</p></div><div class="card"><img srcset="/img/u2.jpg 600w" alt="Pide"><h3>Pide</h3><p>180 ₺</p></div><div class="card"><img src="/img/u3.jpg" alt="Salata"><h3>Salata</h3><p>90 ₺</p></div></div></div></section>
      <section class="ekip"><div class="w"><h2>Şefimiz</h2><img class="avatar" src="/img/sef.jpg" alt="Şef Ali"><p>30 yıllık usta.</p></div></section>`)],
    "/menu": ["text/html", page("Menü", `<section><div class="w"><h1>Menü</h1><img src="/img/u1.jpg" alt="Lahmacun"><img src="/img/u2.jpg" alt="Pide"></div></section>`)],
    "/hakkimizda": ["text/html", page("Hakkımızda", `<section><div class="w"><h1>Hikâyemiz</h1><p>1994'ten beri.</p></div></section>`)],
    "/subeler": ["text/html", page("Şubeler", `<section><div class="w"><h1>Şubeler</h1></div></section>`)],
    "/iletisim": ["text/html", page("İletişim", `<section><div class="w"><h1>İletişim</h1><form><input placeholder="Ad"></form></div></section>`)],
    "/site.css": ["text/css", `body{margin:0;font-family:"Poppins",sans-serif;color:#1c1917;background:#fffbf5}.w{max-width:1100px;margin:0 auto;padding:0 20px}.top{background:#fff;border-bottom:1px solid #eee}.top .w{display:flex;align-items:center;justify-content:space-between;height:72px}nav a{margin-left:20px;color:#1c1917;text-decoration:none;font-weight:600}nav a:hover{color:#ea580c}
      .hero{position:relative;color:#fff}.hero img{width:100%;height:420px;object-fit:cover;display:block}.hero .w{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center}.hero h1{font-size:48px;margin:0}.btn{background:#ea580c;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;align-self:flex-start}
      section{padding:40px 0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,.08)}.card img{width:100%;display:block}.card h3,.card p{margin:10px 14px}.avatar{width:120px;border-radius:50%}footer{background:#1c1917;color:#fffbf5;padding:24px 0}`],
    "/img/logo.svg": ["image/svg+xml", logo], "/img/kapak.jpg": ["image/jpeg", img.kapak], "/img/u1.jpg": ["image/jpeg", img.u1], "/img/u2.jpg": ["image/jpeg", img.u2],
    "/img/u3.jpg": ["image/jpeg", img.u3], "/img/sef.jpg": ["image/jpeg", img.sef], "/img/paylas.jpg": ["image/jpeg", img.paylas],
  };
  const s = http.createServer((req, res) => { const f = files[req.url.split("?")[0]]; if (!f) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": f[0] }); res.end(f[1]); });
  s.listen(0, "127.0.0.1"); await once(s, "listening"); return { base: "http://127.0.0.1:" + s.address().port, close: () => s.close() };
}

const browser = await chromium.launch();
const dir = mkdtempSync(join(tmpdir(), "gitmapp-depo-e2e-"));
const apiPort = await freePort(), webPort = await freePort();
const apiBase = "http://127.0.0.1:" + apiPort, webBase = "http://127.0.0.1:" + webPort;
const env = { ...process.env, PORT: String(apiPort), DB_PATH: join(dir, "db"), DEPO_DIR: join(dir, "depo"), DEPO_ALLOW_LOCAL: "1", SECRET: randomBytes(32).toString("hex"), ADMIN_EMAIL: "yonetici@gitmapp.test", SITE_URL: webBase, CORS_EXTRA: webBase, API_URL: apiBase, GITHUB_CLIENT_ID: "", GOOGLE_CLIENT_ID: "", AI_KEY: "" };
const api = spawn(process.execPath, [join(ROOT, "server/server.mjs")], { env, stdio: ["ignore", "pipe", "inherit"] }); await once(api.stdout, "data");
const web = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/config.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); return res.end(`window.GMS_CONFIG={api:${JSON.stringify(apiBase)}};`); }
  if (p === "/sw.js") { res.writeHead(404); return res.end(); }
  if (p.endsWith("/")) p += "index.html"; const f = normalize(join(ROOT, p)); if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": MIME[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
}); web.listen(webPort, "127.0.0.1"); await once(web, "listening");
const site = await fakeSite(await images(browser));
try {
  const reg = await (await fetch(apiBase + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "depo@gitmapp.test", password: "parola-1234", name: "Depo Test" }) })).json();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 }); const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(webBase + "/#ana"); await page.evaluate((t) => { localStorage.setItem("gms_tok", JSON.stringify(t)); localStorage.setItem("gms_seenVer", JSON.stringify("999")); localStorage.setItem("gms_installSnooze", JSON.stringify(9e15)); localStorage.setItem("gms_nrSeen", "true"); }, reg.token);
  await page.goto(webBase + "/#depo"); await page.reload();
  await page.getByLabel("Site adresi").waitFor({ timeout: 20000 });
  await page.getByLabel("Site adresi").fill(site.base + "/"); await page.locator(".depo-ok input").check();
  await page.screenshot({ path: join(SHOTS, "1-tarama-formu.png") });
  await page.getByRole("button", { name: /Tara ve ayrıştır/ }).click();
  await page.locator(".depo-card").first().waitFor(); await page.locator(".depo-card").first().click();
  await page.locator(".depo-tabs").waitFor({ timeout: 30000 });
  await page.locator(".depo-asset img").first().waitFor(); await page.waitForTimeout(600);
  const n = await page.locator(".depo-asset").count(); ok(n >= 7, "görseller listelendi: " + n);
  const chips = await page.locator(".depo-filter .chip").allInnerTexts(); ok(["Logo", "Banner", "Ürün", "Kişi", "Paylaşım"].every((k) => chips.some((c) => c.includes(k))), "kategoriler: " + chips.join(" | ").replace(/\n/g, " "));
  await page.screenshot({ path: join(SHOTS, "2-gorseller.png") });
  await page.getByRole("button", { name: /^Ürün/ }).click(); await page.waitForTimeout(300); await page.screenshot({ path: join(SHOTS, "3-urun-filtresi.png") });
  await page.getByRole("tab", { name: /Kategoriler/ }).click(); const cats = await page.locator(".depo-list").first().innerText(); ok(/Menü[\s\S]*Hakkımızda[\s\S]*Şubeler[\s\S]*İletişim/.test(cats), "menü kategorileri çıkarıldı"); await page.screenshot({ path: join(SHOTS, "4-kategoriler.png") });
  await page.getByRole("tab", { name: /Tema/ }).click(); const css = await page.locator(".depo-code").innerText(); ok(/--renk-ana:#ea580c/.test(css) && /Poppins/.test(css), "tema: ana renk #ea580c, Poppins"); await page.screenshot({ path: join(SHOTS, "5-tema.png") });
  await page.getByRole("tab", { name: /Ekran kopyası/ }).click(); await page.locator(".depo-frame").waitFor(); await page.waitForTimeout(1200);
  const fr = page.frameLocator(".depo-frame"); ok(/Taş fırından sofranıza/.test(await fr.locator("h1").first().innerText()), "ekran kopyası açıldı"); await page.screenshot({ path: join(SHOTS, "6-ekran-kopyasi.png") });
  await page.getByRole("tab", { name: /Bileşenler/ }).click(); await page.locator(".depo-list .chip").nth(1).click(); await page.locator(".depo-frame.sm").waitFor(); await page.waitForTimeout(900); await page.screenshot({ path: join(SHOTS, "7-bilesenler.png") });
  await page.getByRole("button", { name: /Şablon oluştur/ }).click(); await page.waitForFunction(() => location.hash.startsWith("#studio"), null, { timeout: 15000 }); await page.waitForTimeout(2500);
  ok(true, "şablon Stüdyo'da açıldı"); await page.screenshot({ path: join(SHOTS, "8-studyo-sablon.png") });
  const m = await browser.newContext({ ...require("playwright").devices["iPhone 13"] }); const mp = await m.newPage();
  await mp.goto(webBase + "/#ana"); await mp.evaluate((t) => { localStorage.setItem("gms_tok", JSON.stringify(t)); localStorage.setItem("gms_seenVer", JSON.stringify("999")); localStorage.setItem("gms_installSnooze", JSON.stringify(9e15)); localStorage.setItem("gms_nrSeen", "true"); }, reg.token);
  await mp.goto(webBase + "/#depo"); await mp.reload(); await mp.locator(".depo-card").first().waitFor({ timeout: 20000 }); await mp.locator(".depo-card").first().click(); await mp.locator(".depo-asset img").first().waitFor(); await mp.waitForTimeout(600);
  const sw = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(sw <= 1, "telefonda yatay taşma yok (" + sw + "px)"); await mp.screenshot({ path: join(SHOTS, "9-telefon.png") });
  ok(!errs.length, "sayfa hatası yok" + (errs.length ? ": " + errs.join(" | ") : ""));
} finally { await browser.close(); api.kill(); web.close(); site.close(); rmSync(dir, { recursive: true, force: true }); }

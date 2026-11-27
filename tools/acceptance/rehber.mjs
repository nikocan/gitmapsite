// Rehber kabul testi: anlatımlı tur, anlatıcı modu, şablon-beceri eşleştirme, Akademi, UX paneli. Çalıştırma: node tools/acceptance/rehber.mjs
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
const SHOTS = join(ROOT, "validation/screens/rehber"); mkdirSync(SHOTS, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
const freePort = async () => { const s = http.createServer(); s.listen(0, "127.0.0.1"); await once(s, "listening"); const p = s.address().port; s.close(); await once(s, "close"); return p; };
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) process.exitCode = 1; };
const dir = mkdtempSync(join(tmpdir(), "gitmapp-rehber-")); const apiPort = await freePort(), webPort = await freePort();
const apiBase = "http://127.0.0.1:" + apiPort, webBase = "http://127.0.0.1:" + webPort;
const env = { ...process.env, PORT: String(apiPort), DB_PATH: join(dir, "db"), SECRET: randomBytes(32).toString("hex"), ADMIN_EMAIL: "y@gitmapp.test", SITE_URL: webBase, CORS_EXTRA: webBase, API_URL: apiBase, GITHUB_CLIENT_ID: "", GOOGLE_CLIENT_ID: "", AI_KEY: "" };
const adminPw = execFileSync(process.execPath, [join(ROOT, "server/server.mjs"), "create-admin"], { env, encoding: "utf8" }).match(/Şifre: (\S+)/)[1];
const api = spawn(process.execPath, [join(ROOT, "server/server.mjs")], { env, stdio: ["ignore", "pipe", "inherit"] }); await once(api.stdout, "data");
const web = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p === "/config.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); return res.end(`window.GMS_CONFIG={api:${JSON.stringify(apiBase)}};`); } if (p === "/sw.js") { res.writeHead(404); return res.end(); } if (p.endsWith("/")) p += "index.html"; const f = normalize(join(ROOT, p)); if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": MIME[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); }); web.listen(webPort, "127.0.0.1"); await once(web, "listening");
const post = async (path, body, token) => (await fetch(apiBase + "/api/" + path, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify(body) })).json();
const browser = await chromium.launch();
const prep = async (page, token, extra = {}) => { await page.goto(webBase + "/#ana"); await page.evaluate(([t, x]) => { localStorage.setItem("gms_tok", JSON.stringify(t)); localStorage.setItem("gms_seenVer", JSON.stringify("999")); for (const [k, v] of Object.entries(x)) localStorage.setItem("gms_" + k, JSON.stringify(v)); }, [token, extra]); };
try {
  const user = (await post("auth/register", { email: "r@gitmapp.test", password: "parola-1234", name: "Rehber" })).token;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 }); const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await prep(page, user, { nrVoice: false }); await page.reload(); await page.locator(".home-box").waitFor({ timeout: 20000 });
  ok(await page.locator(".nr-hint").isVisible(), "ilk girişte tur daveti görünüyor"); ok(await page.locator(".ambient i").count() === 4, "canlı arka plan katmanı var");
  await page.waitForTimeout(1200); await page.screenshot({ path: join(SHOTS, "1-davet.png") });
  // Tur: otomatik olarak sayfaları gezer
  await page.locator(".nr-hint").click(); await page.locator(".nr-bub").waitFor();
  ok(/Her şey bir cümleyle başlar/.test(await page.locator(".nr-bub").innerText()), "tur 1. adım: açılış kutusu"); await page.waitForTimeout(700); await page.screenshot({ path: join(SHOTS, "2-tur-adim1.png") });
  await page.getByRole("button", { name: "Sonraki" }).click(); await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Sonraki" }).click(); await page.waitForFunction(() => location.hash.startsWith("#uygulamalarim"), null, { timeout: 8000 }); ok(true, "tur Projeler sayfasına kendisi geçti");
  await page.getByRole("button", { name: "Sonraki" }).click(); await page.waitForFunction(() => location.hash.startsWith("#sablonlar"), null, { timeout: 8000 }); await page.waitForTimeout(1500);
  ok(await page.locator(".nr-spot").isVisible(), "şablon kartı ışıkla işaretlendi"); await page.screenshot({ path: join(SHOTS, "3-tur-sablonlar.png") });
  await page.keyboard.press("Escape"); await page.waitForTimeout(300); ok(!(await page.locator(".nr-bub").count()), "Esc ile tur kapandı");
  // Şablon kartında önerilen beceri
  const hint = page.locator(".tpc", { hasText: "Lezzet" }).first(); const anyHint = page.locator(".tsh").first(); await anyHint.waitFor({ timeout: 8000 });
  const hintText = await anyHint.innerText(); ok(/Önerilen beceri/.test(hintText), "şablon kartında önerilen beceri: " + hintText.replace(/\n/g, " "));
  await anyHint.locator(".tsh-b").first().click(); await page.waitForTimeout(200); ok((await page.evaluate(() => JSON.parse(localStorage.getItem("gms_skills") || "[]"))).length === 1, "önerilen beceri tek tıkla yüklendi");
  await anyHint.scrollIntoViewIfNeeded(); await page.screenshot({ path: join(SHOTS, "4-sablon-beceri.png") });
  // Beceri kartında uygun şablon ve yol haritası
  await page.goto(webBase + "/#beceriler?sektor=yeme-icme"); await page.reload(); await page.locator(".skl-card").first().waitFor({ timeout: 15000 });
  const card = page.locator(".skl-card", { hasText: "POS · adisyon" }); ok(/Uygun şablon/.test(await card.innerText()), "beceri kartında uygun şablon");
  await card.getByRole("button", { name: "Nasıl kullanılır" }).click(); ok((await card.locator(".howto li").count()) === 5, "yol haritası 5 adım"); await card.scrollIntoViewIfNeeded(); await page.screenshot({ path: join(SHOTS, "5-yol-haritasi.png") });
  // Anlatıcı modu
  await page.locator(".nr-fab").click(); await page.locator(".nr-menu").waitFor(); await page.screenshot({ path: join(SHOTS, "6-rehber-menu.png") });
  await page.locator(".nr-sw", { hasText: "Anlatıcı modu" }).locator("input").check(); await page.locator(".nr-fab").click();
  await page.locator('.side .nav[data-v="baglantilar"]').click(); await page.locator(".nr-bub").waitFor({ timeout: 5000 });
  ok(/GitHub, Google, Hostinger/.test(await page.locator(".nr-bub").innerText()), "anlatıcı modu: menüye basınca anlamını söyledi"); await page.waitForTimeout(500); await page.screenshot({ path: join(SHOTS, "7-anlatici-modu.png") });
  // Akademi
  await page.locator('.side .nav[data-v="akademi"]').click(); await page.locator(".ak-card").first().waitFor();
  ok((await page.locator(".ak-tour").count()) === 4 && (await page.locator(".ak-card").count()) >= 18, "Akademi: 4 tur, " + (await page.locator(".ak-card").count()) + " ders");
  await page.getByLabel("Akademi'de ara").fill("cname"); await page.waitForTimeout(200); ok(/A      185/.test(await page.locator(".ak-card").first().innerText()), "arama: alan adı dersi ve DNS komutları"); await page.screenshot({ path: join(SHOTS, "8-akademi.png") });
  // Sorun bildirimi ve yönetici UX paneli
  await page.evaluate(() => fetch(window.GMS_CONFIG.api + "/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: "x", type: "feedback", query: "Yayınla düğmesini bulamadım", category: "studio" }) }));
  const admin = (await post("auth/login", { email: env.ADMIN_EMAIL, password: adminPw })).token;
  const ap = await (await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 })).newPage(); await prep(ap, admin, { nrSeen: true });
  await ap.goto(webBase + "/#ux"); await ap.reload(); await ap.locator(".ux-wrap").waitFor({ timeout: 20000 }); await ap.waitForTimeout(500);
  const ux = await ap.locator(".ux-wrap").innerText(); ok(/Beceri Kütüphanesi|Şablonlar/.test(ux) && /Gitmapp'i tanı/.test(ux) && /Yayınla düğmesini bulamadım/.test(ux), "UX paneli: sayfalar, tur ve geri bildirim görünüyor"); await ap.screenshot({ path: join(SHOTS, "9-ux-paneli.png"), fullPage: true });
  // Telefon
  const m = await browser.newContext({ ...devices["iPhone 13"] }); const mp = await m.newPage(); await prep(mp, user, { nrVoice: false });
  await mp.goto(webBase + "/#akademi"); await mp.reload(); await mp.locator(".ak-card").first().waitFor({ timeout: 20000 }); await mp.evaluate(() => dispatchEvent(new CustomEvent("gm:tour", { detail: { id: "ilk" } }))); await mp.locator(".nr-bub").waitFor(); await mp.waitForTimeout(900);
  const sw = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(sw <= 1, "telefonda yatay taşma yok (" + sw + "px)"); await mp.screenshot({ path: join(SHOTS, "10-telefon-tur.png") });
  ok(!errs.length, "sayfa hatası yok" + (errs.length ? ": " + errs.join(" | ") : ""));
} finally { await browser.close(); api.kill(); web.close(); rmSync(dir, { recursive: true, force: true }); }

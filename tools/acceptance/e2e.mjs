// Gitmapp uçtan uca test: geçici veritabanı + sahte yapay zekâ sağlayıcısı + gerçek tarayıcı.
// Çalıştırma: node tools/acceptance/e2e.mjs   (rapor: validation/e2e-rapor.md, ekranlar: validation/screens/e2e/)
// Canlı sisteme dokunmaz; yalnızca yerelde açılan API ve statik sunucu kullanılır.
import http from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SERVER = join(ROOT, "server/server.mjs");
const SHOTS = join(ROOT, "validation/screens/e2e");
mkdirSync(SHOTS, { recursive: true });

const results = [];
const rec = (area, name, ok, note = "", shot = "") => { results.push({ area, name, ok, note, shot }); console.log((ok ? "✔" : "✘") + " [" + area + "] " + name + (note ? " — " + note : "")); };

// ---------- Sahte yapay zekâ sağlayıcısı (OpenAI uyumlu) ----------
const APP_HTML = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test Randevu</title>
<style>:root{--bg:#0f172a;--pr:#6366f1;--tx:#f8fafc;--r:14px;font-family:system-ui}body{margin:0;background:var(--bg);color:var(--tx)}header{padding:18px;font-size:20px;font-weight:700}main{padding:16px}.c{background:#1e293b;border-radius:var(--r);padding:14px;margin-bottom:10px}button{background:var(--pr);color:#fff;border:0;border-radius:10px;padding:10px 14px;font-size:15px}</style></head>
<body><header>Test Randevu</header><main><div class="c" id="list">Bugün 3 randevu var</div><button id="add" onclick="document.getElementById('list').textContent='Randevu eklendi'">Randevu ekle</button></main>
<script>window.addEventListener('load',()=>{document.body.dataset.ready='1'})</script></body></html>`;
const calls = [];
function fakeAi() {
  const s = http.createServer(async (req, res) => {
    let body = ""; for await (const c of req) body += c;
    const j = body ? JSON.parse(body) : {};
    calls.push(req.url);
    if (req.url.endsWith("/models")) { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ data: [{ id: "claude-sonnet-4.5" }] })); }
    const msgs = j.messages || []; const all = msgs.map((m) => typeof m.content === "string" ? m.content : JSON.stringify(m.content)).join("\n");
    const sys = String(msgs[0]?.content || "");
    let text;
    if (/Fikir:|Mevcut dosya/.test(all) && !/JSON/.test(sys.slice(0, 400))) text = APP_HTML;
    else if (/plan/i.test(sys.slice(0, 300))) text = "## Plan\nEkranlar: Ana sayfa, Randevular, Ayarlar\n- Örnek verilerle başlar";
    else text = "Test yanıtı: her şey yolunda.";
    if (j.stream) {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      for (let i = 0; i < text.length; i += 400) res.write("data: " + JSON.stringify({ choices: [{ delta: { content: text.slice(i, i + 400) } }] }) + "\n\n");
      res.write("data: " + JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 100, completion_tokens: 900, total_tokens: 1000 } }) + "\n\ndata: [DONE]\n\n");
      return res.end();
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: text }, finish_reason: "stop" }], usage: { total_tokens: 1000 } }));
  });
  s.listen(0, "127.0.0.1");
  return once(s, "listening").then(() => ({ base: "http://127.0.0.1:" + s.address().port + "/v1", close: () => s.close() }));
}

// ---------- Sahte Stripe: ödeme sayfası ödemeyi tamamlayıp success_url'e döner ----------
function fakeStripe() {
  const ses = new Map();
  const s = http.createServer(async (req, res) => {
    let body = ""; for await (const c of req) body += c; const f = Object.fromEntries(new URLSearchParams(body));
    const send = (o, code = 200) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
    const base = "http://127.0.0.1:" + s.address().port;
    if (req.url === "/v1/checkout/sessions") { const id = "cs_test_" + randomBytes(4).toString("hex"); ses.set(id, { id, amount_total: +f["line_items[0][price_data][unit_amount]"], payment_status: "unpaid", status: "open", success: f.success_url }); return send({ id, url: base + "/pay/" + id }); }
    let m = req.url.match(/^\/pay\/(.+)$/); if (m) { const x = ses.get(m[1]); x.payment_status = "paid"; x.status = "complete"; res.writeHead(302, { Location: x.success }); return res.end(); }
    m = req.url.match(/^\/v1\/checkout\/sessions\/(.+)$/); if (m) { const x = ses.get(decodeURIComponent(m[1])); return send({ ...x, payment_intent: "pi_" + x.id }); }
    if (req.url === "/v1/balance") return send({ available: [{ currency: "try" }] });
    send({ error: { message: "?" } }, 404);
  });
  s.listen(0, "127.0.0.1");
  return once(s, "listening").then(() => ({ base: "http://127.0.0.1:" + s.address().port + "/v1", close: () => s.close() }));
}

// ---------- Statik site sunucusu (config.js yerel API'ye yönlendirilir) ----------
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon" };
async function freePort() { const s = http.createServer(); s.listen(0, "127.0.0.1"); await once(s, "listening"); const p = s.address().port; s.close(); await once(s, "close"); return p; }
async function serveOn(port, apiBase) {
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/config.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); return res.end(`window.GMS_CONFIG={api:${JSON.stringify(apiBase)}};`); }
    if (p === "/sw.js") { res.writeHead(404); return res.end(); }
    if (p.endsWith("/")) p += "index.html";
    const f = normalize(join(ROOT, p)); if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": MIME[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
  });
  s.listen(port, "127.0.0.1"); await once(s, "listening"); return { close: () => s.close() };
}

// ---------- API ----------
async function startApi(env) {
  const cli = (c) => execFileSync(process.execPath, [SERVER, c], { env, encoding: "utf8" });
  const adminPass = cli("create-admin").match(/Şifre: (\S+)/)[1];
  const child = spawn(process.execPath, [SERVER], { env, stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; child.stderr.on("data", (d) => { log += d; });
  const ready = await Promise.race([once(child.stdout, "data").then(([b]) => b.toString()), once(child, "exit").then(() => { throw new Error("API başlamadı: " + log); })]);
  const base = "http://127.0.0.1:" + ready.match(/API :(\d+)/)[1];
  const req = async (method, path, body, token) => { const r = await fetch(base + "/api/" + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); let j = {}; try { j = await r.json(); } catch { } return { status: r.status, ...j }; };
  return { base, req, adminPass, child, log: () => log };
}

const CUST = ["ana", "magaza", "studio", "kreator", "sablonlar", "baglantilar", "eylem", "otomasyon", "uygulamalarim", "modeller", "hesabim", "dunya", "olustur", "paketler", "ai-destek", "siparislerim", "guncel"];
const ADMIN = ["odemeler", "yonetim", "yapay-zeka", "eposta", "github-ayar", "maliyetler", "kullanicilar", "yonetim-projeler", "siparisler", "radar", "plan", "kesfet", "uretim-ajani", "kategori", "liste", "kuyruk", "ayar"];

async function main() {
  const dir = mkdtempSync(join(tmpdir(), "gitmapp-e2e-"));
  const ai = await fakeAi(); const fstripe = await fakeStripe();
  const port = await freePort(); const siteBase = "http://127.0.0.1:" + port;
  const env = { ...process.env, PORT: "0", DB_PATH: join(dir, "db"), SECRET: randomBytes(32).toString("hex"), ADMIN_EMAIL: "yonetici@gitmapp.test",
    SITE_URL: siteBase, CORS_EXTRA: siteBase, API_URL: "http://127.0.0.1", AI_BASE: ai.base, AI_KEY: "test-key", AI_MODELS: "claude-sonnet-4.5", AI_MODEL: "claude-sonnet-4.5",
    COPILOT_MODEL: "claude-sonnet-4.5", AI_FALLBACKS: "", OPENROUTER_API_KEY: "", ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "", GEMINI_API_KEY: "", DEEPSEEK_API_KEY: "", HOSTINGER_AI_KEY: "",
    GITHUB_CLIENT_ID: "", GOOGLE_CLIENT_ID: "", STRIPE_API_BASE: fstripe.base, STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "", CANVA_CLIENT_ID: "", SIGNUP_CREDITS: "50", CREATOR_TICK_MS: "3600000" };
  const api = await startApi(env); const apiBase = api.base;
  const site2 = await serveOn(port, apiBase);

  const browser = await chromium.launch();
  const out = { pageErrors: [] };
  try {
    // --- API düzeyi ---
    const h = await api.req("GET", "health"); rec("API", "Sağlık kontrolü", h.status === 200, "durum " + h.status);
    const pass = "Test-" + randomBytes(6).toString("hex");
    const reg = await api.req("POST", "auth/register", { email: "test@gitmapp.test", password: pass, name: "Test Kullanıcı" });
    rec("Hesap", "Test kullanıcısı kaydı (test@gitmapp.test)", reg.status === 200 && !!reg.token, "kredi " + reg.user?.credits);
    const admin = await api.req("POST", "auth/login", { email: env.ADMIN_EMAIL, password: api.adminPass });
    rec("Hesap", "Yönetici girişi", admin.status === 200 && admin.user?.admin === true);
    const me = await api.req("GET", "auth/me", null, reg.token); rec("Hesap", "Oturum bilgisi (/auth/me)", me.user?.email === "test@gitmapp.test");
    const bad = await api.req("POST", "auth/login", { email: "test@gitmapp.test", password: "yanlis-sifre" }); rec("Hesap", "Yanlış şifre reddediliyor", bad.status === 401, "durum " + bad.status);
    const forb = await api.req("GET", "admin/overview", null, reg.token); rec("Güvenlik", "Müşteri yönetim API'sine giremiyor", forb.status === 403, "durum " + forb.status);
    const cr = await api.req("POST", "admin/credits", { email: "test@gitmapp.test", amount: 25 }, admin.token); rec("Yönetim", "Yönetici test kullanıcısına 25 kredi yükledi", cr.status === 200, "durum " + cr.status);
    const gen = await api.req("POST", "ai/generate", { prompt: "Kuaför randevu uygulaması", kind: "app" }, reg.token);
    rec("Yapay zekâ", "Uygulama üretimi (API)", gen.status === 200 && /Test Randevu/.test(gen.html || ""), "durum " + gen.status + (gen.error ? " · " + gen.error : ""));
    const app = await api.req("POST", "apps", { title: "E2E Test Uygulaması", html: APP_HTML }, reg.token);
    rec("Projeler", "Proje kaydetme (API)", app.status === 200 && !!(app.id || app.app?.id), "durum " + app.status + (app.error ? " · " + app.error : ""));
    const list = await api.req("GET", "apps", null, reg.token);
    rec("Projeler", "Proje listesi", list.status === 200, "durum " + list.status + " · " + (list.apps?.length ?? "?") + " proje");

    // --- Tarayıcı ---
    const visit = async (ctx, area, views, token) => {
      const page = await ctx.newPage(); const errs = []; const fails = [];
      page.on("pageerror", (e) => errs.push(e.message));
      page.on("response", (r) => { if (r.url().startsWith(apiBase) && r.status() >= 500) fails.push(r.status() + " " + new URL(r.url()).pathname); });
      await page.goto(siteBase + "/#ana"); await page.evaluate((t) => { localStorage.setItem("gms_tok", JSON.stringify(t)); localStorage.setItem("gms_seenVer", JSON.stringify("999")); }, token);
      for (const v of views) {
        const e0 = errs.length, f0 = fails.length;
        await page.goto(siteBase + "/#" + v); await page.reload(); await page.waitForTimeout(1600);
        const txt = await page.evaluate(() => document.querySelector("#root")?.innerText.trim().length || 0);
        const shot = area.toLowerCase().replace(/\W+/g, "-") + "-" + v + ".png";
        await page.screenshot({ path: join(SHOTS, shot) });
        const newErr = errs.slice(e0), newFail = fails.slice(f0);
        rec(area, "#" + v, !newErr.length && !newFail.length && txt > 40, [newErr.length ? "JS: " + newErr.join(" | ").slice(0, 200) : "", newFail.length ? "API: " + newFail.join(", ") : "", txt <= 40 ? "sayfa boş" : ""].filter(Boolean).join(" · "), shot);
      }
      return page;
    };
    const guest = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await visit(guest, "Misafir", ["ana", "dunya", "paketler", "studio", "guncel"], "");
    const user = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const up = await visit(user, "Müşteri", CUST, reg.token);

    // Stüdyo akışı: istem yaz → gönder → önizleme → kaydet
    {
      const errs = []; up.on("pageerror", (e) => errs.push(e.message));
      await up.goto(siteBase + "/#studio"); await up.reload(); await up.waitForTimeout(1500);
      const chip = await up.$(".sx-chip"); if (chip) await chip.click();
      const filled = await up.inputValue("textarea.gta").catch(() => "");
      rec("Stüdyo", "Hızlı başlangıç hapı istemi dolduruyor", filled.length > 20);
      await up.fill("textarea.gta", "Kuaför salonum için randevu uygulaması");
      await up.click(".gsend");
      let ok = false; for (let i = 0; i < 40 && !ok; i++) { await up.waitForTimeout(500); ok = await up.evaluate(() => [...document.querySelectorAll("iframe")].some((f) => /Test Randevu/.test(f.getAttribute("srcdoc") || ""))); }
      // Model önerisi kartı ya da plan onayı çıkarsa geç
      if (!ok) { const b = await up.$(".esc-a .btn.g.s"); if (b) { await b.click(); for (let i = 0; i < 30 && !ok; i++) { await up.waitForTimeout(500); ok = await up.evaluate(() => [...document.querySelectorAll("iframe")].some((f) => /Test Randevu/.test(f.getAttribute("srcdoc") || ""))); } } }
      await up.screenshot({ path: join(SHOTS, "studio-uretim.png") });
      rec("Stüdyo", "İstem gönderildi, uygulama üretildi ve önizlemede açıldı", ok, errs.length ? "JS: " + errs.join(" | ").slice(0, 200) : "", "studio-uretim.png");
      if (ok) {
        const save = await up.$('.ib[title="Kaydet"]'); if (save) await save.click(); await up.waitForTimeout(1500);
        const after = await api.req("GET", "apps", null, reg.token);
        rec("Stüdyo", "Kaydet düğmesi projeyi hesaba kaydetti", (after.apps?.length || 0) > (list.apps?.length || 0), (after.apps?.length ?? "?") + " proje");
        // Model / mod menüleri
        await up.click('.cmp-b[title="Dil modeli seç"]'); const mm = await up.$(".cmp-pop"); rec("Stüdyo", "Dil modeli menüsü açılıyor", !!mm); await up.keyboard.press("Escape");
        await up.click(".cmp-mode"); await up.waitForTimeout(300); await up.screenshot({ path: join(SHOTS, "studio-mod-menusu.png") }); let modeErr = ""; await up.click(".cmp-pop >> text=Planlı", { timeout: 4000 }).catch((e) => { modeErr = e.message.split("\n").slice(0, 6).join(" "); }); await up.waitForTimeout(300); const ml = await up.$eval(".cmp-mode .cmp-l", (e) => e.textContent).catch(() => "");
        rec("Stüdyo", "Çalışma modu değiştirilebiliyor", ml === "Planlı", ml + (modeErr ? " · " + modeErr.slice(0, 300) : ""), "studio-mod-menusu.png");
        await up.fill("textarea.gta", "Ren"); const gs = await up.$eval(".gh-s", (e) => e.textContent).catch(() => ""); rec("Stüdyo", "Tab tamamlama önerisi", gs.length > 3, "“Ren” → “Ren" + gs + "”");
        await up.fill("textarea.gta", "");
      }
    }
    // Arayüzden giriş (yönetici)
    const adm = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    {
      const p = await adm.newPage(); await p.goto(siteBase + "/#yonetim"); await p.waitForTimeout(1500);
      const email = await p.$('input[type="email"][autocomplete="username"]');
      if (email) { await email.fill(env.ADMIN_EMAIL); await p.fill('input[aria-label="Şifre"]', api.adminPass); await p.keyboard.press("Enter"); await p.waitForTimeout(2000); }
      const tok = await p.evaluate(() => localStorage.getItem("gms_tok"));
      rec("Hesap", "Arayüzden yönetici girişi (#yonetim)", !!email && !!tok && tok.length > 10, email ? "" : "giriş formu bulunamadı");
      await p.close();
    }
    await visit(adm, "Yönetici", ADMIN, admin.token);
    // ---------- Kredi ve ödeme ----------
    {
      const ap = await adm.newPage(); const errs = []; ap.on("pageerror", (e) => errs.push(e.message));
      await ap.goto(siteBase + "/#odemeler"); await ap.waitForTimeout(1500);
      await ap.fill('input[name="iban"]', "TR33 0006 1005 1978 6457 8413 26"); await ap.fill('input[name="accountName"]', "Gitmapp Test"); await ap.fill('input[name="bank"]', "Test Bankası");
      await ap.locator("form:has(input[name=iban]) button.btn.s").click(); await ap.waitForTimeout(800);
      await ap.fill('input[name="stripeSecret"]', "sk_test_" + "e2e".repeat(8)); await ap.fill('input[name="stripeWebhook"]', "whsec_" + "e2e".repeat(8));
      await ap.locator("form[data-toggles] button.btn.s:has-text('Kaydet')").click(); await ap.waitForTimeout(800);
      const set = (await api.req("GET", "admin/billing", null, admin.token)).settings;
      rec("Ödeme", "Yönetici IBAN ve Stripe anahtarlarını panelden kaydetti", /^TR33/.test(set.iban) && set.stripe.mode === "test", set.iban + " · Stripe " + set.stripe.mode);
      await ap.click("text=Bağlantıyı test et"); await ap.waitForTimeout(800);
      await ap.screenshot({ path: join(SHOTS, "odeme-yonetici.png"), fullPage: true });
      rec("Ödeme", "Kredi ve ödemeler sayfası", !errs.length, errs.join(" | ").slice(0, 200), "odeme-yonetici.png");

      const p = await user.newPage(); const ue = []; p.on("pageerror", (e) => ue.push(e.message));
      const bal = async () => (await api.req("GET", "billing", null, reg.token)).balance;
      const b0 = await bal();
      await p.goto(siteBase + "/#hesabim"); await p.waitForTimeout(1500);
      await p.click("text=Kredi yükle"); await p.waitForSelector(".bc-pack"); await p.waitForTimeout(400);
      await p.screenshot({ path: join(SHOTS, "odeme-paketler.png") });
      rec("Ödeme", "Kredi yükle penceresi paketleri gösteriyor", (await p.locator(".bc-pack").count()) === 3, "", "odeme-paketler.png");
      // Havale
      await p.click(".bc-m button:has-text('Havale')"); await p.click(".bc-pay"); await p.waitForSelector(".bc-hbox");
      await p.screenshot({ path: join(SHOTS, "odeme-havale.png") });
      const code = (await p.locator(".bc-hr:has-text('Açıklama') b").textContent()).trim();
      await p.click("text=Ödemeyi yaptım"); await p.waitForSelector(".bc-note.ok");
      rec("Ödeme", "Havale: IBAN ve açıklama kodu gösterildi, “Ödemeyi yaptım” bildirildi", /^GM/.test(code), code, "odeme-havale.png");
      await p.keyboard.press("Escape");
      await ap.reload(); await ap.waitForTimeout(1500);
      ap.once("dialog", (d) => d.accept("Dekont E2E"));
      await ap.locator("tr:has-text('" + code + "') button:has-text('Onayla')").click(); await ap.waitForTimeout(1200);
      const b1 = await bal();
      rec("Ödeme", "Yönetici havaleyi onayladı, 330 kredi yüklendi", b1 - b0 === 330, b0 + " → " + b1);
      // Kart (Stripe Checkout → dönüş)
      await p.goto(siteBase + "/#hesabim"); await p.waitForTimeout(1200);
      await p.click("text=Kredi yükle"); await p.waitForSelector(".bc-pack");
      await p.locator(".bc-pack").first().click(); await p.click(".bc-m button:has-text('Kart')"); await p.click(".bc-pay");
      await p.waitForURL(/#hesabim/, { timeout: 15000 }).catch(() => {}); await p.waitForSelector(".bc-ret b:has-text('Ödeme alındı')", { timeout: 15000 }).catch(() => {});
      await p.screenshot({ path: join(SHOTS, "odeme-kart-sonuc.png") });
      const b2 = await bal();
      rec("Ödeme", "Kart: Stripe sayfasına gidip döndü, ödeme doğrulandı ve 100 kredi yüklendi", b2 - b1 === 100, b1 + " → " + b2, "odeme-kart-sonuc.png");
      await p.keyboard.press("Escape"); await p.waitForTimeout(300);
      await p.goto(siteBase + "/#hesabim"); await p.waitForTimeout(1500);
      const rows = await p.locator(".bc-hist tbody tr").count();
      await p.screenshot({ path: join(SHOTS, "odeme-gecmis.png"), fullPage: true });
      rec("Ödeme", "Hesabım › Ödemelerim geçmişi", rows >= 2 && !ue.length, rows + " ödeme" + (ue.length ? " · JS: " + ue.join(" | ").slice(0, 200) : ""), "odeme-gecmis.png");
      await p.close(); await ap.close();
    }
    // Mobil
    const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await visit(mob, "Mobil", ["ana", "studio", "uygulamalarim", "hesabim"], reg.token);
    const wide = await mob.newPage(); await wide.goto(siteBase + "/#studio"); await wide.waitForTimeout(1500);
    const ov = await wide.evaluate(() => document.documentElement.scrollWidth - innerWidth); rec("Mobil", "Stüdyoda yatay taşma yok", ov <= 1, ov + " px");
  } finally {
    await browser.close(); site2.close(); ai.close(); fstripe.close(); api.child.kill(); rmSync(dir, { recursive: true, force: true });
  }
  const pass = results.filter((r) => r.ok).length;
  const md = ["# Uçtan uca test raporu", "", new Date().toISOString().slice(0, 16).replace("T", " ") + " · sahte yapay zekâ sağlayıcısı, geçici veritabanı · test kullanıcısı `test@gitmapp.test`, yönetici `yonetici@gitmapp.test`", "",
    "**" + pass + " / " + results.length + " kontrol geçti.**", "", "| Alan | Kontrol | Sonuç | Not |", "|---|---|---|---|",
    ...results.map((r) => "| " + r.area + " | " + (r.shot ? "[" + r.name + "](screens/e2e/" + r.shot + ")" : r.name) + " | " + (r.ok ? "✅" : "❌") + " | " + String(r.note || "").replace(/\|/g, "/") + " |")].join("\n");
  writeFileSync(join(ROOT, "validation/e2e-rapor.md"), md + "\n");
  writeFileSync(join(ROOT, "validation/e2e-sonuc.json"), JSON.stringify(results, null, 1));
  console.log("\n" + pass + "/" + results.length + " geçti");
  process.exitCode = pass === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });

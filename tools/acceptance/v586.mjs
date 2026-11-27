// v5.86 kabul testi — Salon senaryosu: üç paralel çalışma, sekme kapalıyken sunucuda kayıt, birlikte önizleme (250 TL), güvenli birleştirme
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
const SHOTS = join(ROOT, "validation/screens/v586"); mkdirSync(SHOTS, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) process.exitCode = 1; };
const listen = async (s) => { s.listen(0, "127.0.0.1"); await once(s, "listening"); return s.address().port; };
const freePort = async () => { const s = http.createServer(); const p = await listen(s); s.close(); await once(s, "close"); return p; };

// Sahte yapay zekâ: isteğe göre mevcut dosyayı satır bazında değiştirir (her iş 4 sn sürer → işler paralel)
const BASE = ["<!doctype html><html lang=\"tr\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Salon</title>",
  "<style>body{margin:0;font-family:system-ui;background:#fff7f2;color:#1c1917}header{padding:24px;background:#e11d48;color:#fff}main{padding:20px;display:grid;gap:12px}.c{background:#fff;border-radius:14px;padding:16px}</style></head><body>",
  "<header><img id=\"logo\" alt=\"Salon logosu\" src=\"data:,eski\"><h1>Salon Kuaför</h1></header><main>",
  "<section class=\"c\" id=\"randevu\"><h2>Randevu</h2>", "<p>Saat seçin ve randevu alın.</p>", "</section>",
  "<section class=\"c\" id=\"odeme\"><h2>Ödeme</h2>", "<p>Ödemenizi güvenle yapın.</p>", "</section>",
  ...Array.from({ length: 4 }, (_, i) => `<div class="c"><h2>Hizmet ${i + 1}</h2><p>Saç kesimi ve bakım.</p></div>`),
  "</main></body></html>"].join("\n");
const seen = [];
const ai = http.createServer(async (req, res) => { let b = ""; for await (const c of req) b += c; const j = b ? JSON.parse(b) : null; res.writeHead(200, { "Content-Type": "application/json" });
  if (req.url.endsWith("/models")) return res.end(JSON.stringify({ data: [{ id: "claude-sonnet-5-5" }, { id: "claude-opus-5-5" }, { id: "claude-haiku-5-5" }] }));
  const txt = j.messages.map(m => typeof m.content === "string" ? m.content : (m.content || []).map(x => x.text || "").join("")).join("\n\n");
  const cur = (/Mevcut dosya:\n([\s\S]*)$/.exec(j.messages.map(m => typeof m.content === "string" ? m.content : "").find(c => c.startsWith("Mevcut dosya:")) || "") || [])[1] || BASE;
  const ask = (/İstenen değişiklik: ([^\n]*)/.exec(txt) || [])[1] || "";
  seen.push(ask || "ilk");
  let out = cur;
  if (/kapora/i.test(ask) && !/ödeme/i.test(ask)) out = cur.replace("<p>Saat seçin ve randevu alın.</p>", "<p>Saat seçin ve randevu alın.</p>\n<p>Kapora: <b id=\"kapora\">250 TL</b></p>\n<script>window.KAPORA=250</script>");
  else if (/ödeme/i.test(ask)) out = cur.replace("<p>Ödemenizi güvenle yapın.</p>", "<p>Ödemenizi güvenle yapın.</p>\n<p>Ödenecek kapora: <b id=\"tutar\"></b></p>\n<script>document.getElementById('tutar').textContent=window.KAPORA+' TL'</script>");
  else if (/başlı/i.test(ask)) out = cur.replace("<h1>Salon Kuaför</h1>", "<h1>Salon Kuaför · Online randevu</h1>");
  else if (/logo/i.test(ask)) out = cur.replace('src="data:,eski"', 'src="data:,yeni"');
  await new Promise((r) => setTimeout(r, ask ? 4500 : 1500));
  res.end(JSON.stringify({ choices: [{ message: { content: out }, finish_reason: "stop" }], usage: { prompt_tokens: 9000, completion_tokens: 2000, total_tokens: 11000 } })); });
const rates = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ data: [
  { id: "anthropic/claude-sonnet-5.5", pricing: { prompt: "0.000003", completion: "0.000015", input_cache_read: "0.0000003" } }, { id: "anthropic/claude-opus-5.5", pricing: { prompt: "0.000005", completion: "0.000025", input_cache_read: "0.0000005" } }, { id: "anthropic/claude-haiku-5.5", pricing: { prompt: "0.000001", completion: "0.000005", input_cache_read: "0.0000001" } }] })); });
const fx = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ rates: { TRY: 41.8 } })); });
const ghSrv = http.createServer((req, res) => { res.writeHead(404); res.end("{}"); }); const ghPort = await listen(ghSrv);
const aiPort = await listen(ai), rPort = await listen(rates), fxPort = await listen(fx);
const dir = mkdtempSync(join(tmpdir(), "gitmapp-v586-")); const apiPort = await freePort(), webPort = await freePort();
const apiBase = "http://127.0.0.1:" + apiPort, webBase = "http://127.0.0.1:" + webPort;
const env = { ...process.env, PORT: String(apiPort), DB_PATH: join(dir, "db"), SECRET: randomBytes(32).toString("hex"), ADMIN_EMAIL: "y@gitmapp.test", SITE_URL: webBase, CORS_EXTRA: webBase, API_URL: apiBase, GITHUB_CLIENT_ID: "", GOOGLE_CLIENT_ID: "", AI_BASE: "http://127.0.0.1:" + aiPort + "/v1", AI_KEY: "k-test-123456789012", AI_MODEL: "", AI_MODELS: "claude-sonnet-5-5,claude-opus-5-5,claude-haiku-5-5", AI_FALLBACKS: "", ANTHROPIC_API_KEY: "", OPENROUTER_API_KEY: "", AI_PROFILE_AUTO: "0", RATES_URL: "http://127.0.0.1:" + rPort + "/m", FX_URL: "http://127.0.0.1:" + fxPort + "/fx", SIGNUP_CREDITS: "200", TEST_GH_API: "http://127.0.0.1:" + ghPort };
const adminPw = execFileSync(process.execPath, [join(ROOT, "server/server.mjs"), "create-admin"], { env, encoding: "utf8" }).match(/Şifre: (\S+)/)[1];
let api = spawn(process.execPath, [join(ROOT, "server/server.mjs")], { env, stdio: ["ignore", "pipe", "inherit"] }); await once(api.stdout, "data");
const web = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p === "/config.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); return res.end(`window.GMS_CONFIG={api:${JSON.stringify(apiBase)}};`); } if (p === "/sw.js") { res.writeHead(404); return res.end(); } if (p.endsWith("/")) p += "index.html"; const f = normalize(join(ROOT, p)); if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": MIME[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); }); web.listen(webPort, "127.0.0.1"); await once(web, "listening");
const post = async (path, body, t) => (await fetch(apiBase + "/api/" + path, { method: "POST", headers: { "Content-Type": "application/json", ...(t ? { Authorization: "Bearer " + t } : {}) }, body: JSON.stringify(body) })).json();
const prep = async (p, t, extra = {}) => { await p.goto(webBase + "/#ana"); await p.evaluate(([t, x]) => { for (const [k, v] of Object.entries({ tok: t, seenVer: "999", nrSeen: true, vbarOff: true, installSnooze: 9e15, autoFix: false, ...x })) localStorage.setItem("gms_" + k, JSON.stringify(v)); }, [t, extra]); };
const browser = await chromium.launch();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const admin = (await post("auth/login", { email: env.ADMIN_EMAIL, password: adminPw })).token;
  const H = { Authorization: "Bearer " + admin, "Content-Type": "application/json" };
  const get = async (path) => (await fetch(apiBase + "/api/" + path, { headers: H })).json();
  const send = async (m, path, body) => { const r = await fetch(apiBase + "/api/" + path, { method: m, headers: H, body: JSON.stringify(body || {}) }); return { status: r.status, j: await r.json() }; };
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); let p = await ctx.newPage(); const errs = []; const watch = (pg) => { pg.on("pageerror", (e) => errs.push(e.message)); pg.on("dialog", d => d.dismiss()); }; watch(p);
  await prep(p, admin); await p.goto(webBase + "/#studio"); await p.reload(); await p.locator("textarea.gta").first().waitFor({ timeout: 20000 });
  // 0) Salon projesi
  await p.locator("textarea.gta").first().fill("Salon için randevu ve ödeme sayfası"); await p.keyboard.press("Enter");
  let apps = []; for (let i = 0; i < 60 && !apps.length; i++) { await p.waitForTimeout(300); apps = (await get("apps")).apps || []; } const app = apps[0];
  ok(!!app, "Salon projesi hesaba kaydedildi");
  await p.waitForTimeout(2500);
  const G = "apps/" + app.id + "/git";
  const start = async (prompt, fromMain) => {
    await p.locator(".cc-newchat").click(); await p.locator(".ns").waitFor();
    if (fromMain !== undefined && await p.locator(".ns-from").count()) {
      ok(true, "yeni çalışma penceresi “Nereden başlasın?” diye soruyor (açık çalışma: " + (await p.locator(".ns-from-o").nth(1).innerText()).split("\n")[0] + ")");
      await p.locator(".ns-from-o").nth(fromMain ? 0 : 1).click();
    }
    const before = await p.locator(".br-bar > b").innerText().catch(() => "");
    await p.locator(".ns-go").click();
    let br = before; for (let i = 0; i < 60 && (!br || br === before); i++) { await p.waitForTimeout(200); br = await p.locator(".br-bar > b").innerText().catch(() => ""); }
    await p.locator("textarea.gta").first().fill(prompt); await p.keyboard.press("Enter"); await p.waitForTimeout(900);
    return br;
  };
  // 1–3) Üç çalışma: ikisi sürerken yenisi açılıyor, sonra sekme kapanıyor
  const bK = await start("Randevuya 250 TL kapora ekle");
  await p.screenshot({ path: join(SHOTS, "1-kapora-suruyor.png") });
  const bO = await start("Ödeme ekranında kapora tutarını göster", true);
  const bL = await start("Logoyu güncelle", true);
  await p.locator(".cc-newchat").click(); await p.locator(".ns").waitFor(); await p.waitForTimeout(700); await p.screenshot({ path: join(SHOTS, "2-nereden-baslasin.png") }); await p.keyboard.press("Escape");
  const mainBefore = (await get(G + "/branch?name=main")).head;
  ok(new Set([bK, bO, bL]).size === 3, "üç ayrı çalışma dalı: " + [bK, bO, bL].join(", "));
  await p.close(); // sekme kapandı — işler sunucuda sürüyor
  // Sunucu: işler bitince her sonuç kendi dalına kaydedilir (Stüdyo açılmadan)
  let jobs = []; for (let i = 0; i < 80; i++) { jobs = (await get(G + "/jobs")).jobs || []; if (jobs.length >= 3 && jobs.every(j => !["running", "saving"].includes(j.status))) break; await wait(300); }
  const by = (b) => jobs.find(j => j.branch === b);
  ok([bK, bO, bL].every(b => by(b)?.status === "saved"), "sekme kapalıyken üç iş de sunucuda kaydedildi: " + jobs.map(j => j.branch + "=" + j.status).join(", "));
  const html = async (b) => (await get(G + "/branch?name=" + encodeURIComponent(b)));
  const hK = await html(bK), hO = await html(bO), hL = await html(bL);
  ok(hK.head === by(bK).sha && /window\.KAPORA=250/.test(hK.html), "kapora dalının son commit'i işin commit'i (" + hK.head.slice(0, 7) + ")");
  ok(/id="tutar"/.test(hO.html) && !/KAPORA=250/.test(hO.html), "ödeme dalı ana sürümden başladı (kaporayı içermiyor)");
  ok(/data:,yeni/.test(hL.html) && !/KAPORA/.test(hL.html), "logo dalı bağımsız");
  ok((await get(G + "/branch?name=main")).head === mainBefore, "ana sürüm değişmedi");
  // İki sekmeden aynı işi yeniden işleme: ikinci commit yok
  const r2 = await send("POST", G + "/jobs/" + by(bK).job_id + "/retry");
  ok(r2.status === 409 && (await html(bK)).head === hK.head, "aynı işi yeniden işleme reddedildi, tek commit (" + r2.j.error + ")");
  // 4) Ertesi gün: yeni sekme, Geçmiş'te durumlar
  p = await ctx.newPage(); watch(p); await p.goto(webBase + "/#ana"); await p.waitForTimeout(5500);
  const hist = await p.locator(".hist .sess-t small").allInnerTexts().catch(() => []);
  ok(hist.filter(t => /kaydedildi/.test(t)).length >= 3, "Geçmiş: çalışmalar “kaydedildi” olarak görünüyor → " + JSON.stringify(hist.slice(0, 4)));
  await p.screenshot({ path: join(SHOTS, "3-ertesi-gun-gecmis.png") });
  // 5) Birlikte dene: ödeme tek başına vs. kapora ile birlikte — müşteri ekranındaki gerçek tutar
  const show = async (h) => { const pg = await ctx.newPage(); await pg.setContent(h); const t = await pg.locator("#tutar").innerText(); await pg.close(); return t; };
  const alone = await get(G + "/merge-preview?branches=" + encodeURIComponent(bO) + "&into=main");
  const both = await get(G + "/merge-preview?branches=" + encodeURIComponent(bK) + "," + encodeURIComponent(bO) + "&into=main");
  const tA = await show(alone.html), tB = await show(both.html);
  ok(tA === "undefined TL", "ödeme tek başına: müşteri “" + tA + "” görüyor (bağımlılık)");
  ok(both.ok && tB === "250 TL", "kapora + ödeme birlikte önizlemede: “" + tB + "”");
  ok((await get(G + "/branch?name=main")).head === mainBefore && (await html(bK)).head === hK.head, "birlikte önizleme hiçbir dalı değiştirmedi");
  // 6) İncelemeden sonra hedef ilerlerse eski inceleme ile birleşemez
  const cmpK = await get(G + "/compare?from=" + encodeURIComponent(bK) + "&into=main");
  const mL = await send("POST", G + "/merge?source=gitmapp", { from: bL, into: "main" }); ok(mL.status === 200, "logo ayrı ilerledi: ana sürüme birleşti");
  const stale = await send("POST", G + "/merge?source=gitmapp", { from: bK, into: "main", head: cmpK.head, intoHead: cmpK.intoHead });
  ok(stale.status === 409, "logo birleştikten sonra eski incelemeyle kapora birleştirilemedi: " + stale.j.error);
  const cK = await get(G + "/compare?from=" + encodeURIComponent(bK) + "&into=main");
  ok((await send("POST", G + "/merge?source=gitmapp", { from: bK, into: "main", head: cK.head, intoHead: cK.intoHead })).status === 200, "yeniden incelenip kapora birleşti");
  const cO = await get(G + "/compare?from=" + encodeURIComponent(bO) + "&into=main");
  ok((await send("POST", G + "/merge?source=gitmapp", { from: bO, into: "main", head: cO.head, intoHead: cO.intoHead })).status === 200, "ödeme birleşti");
  const draft = (await get("apps/" + app.id)).app.html;
  ok(await show(draft) === "250 TL" && /data:,yeni/.test(draft), "proje taslağında müşteri 250 TL görüyor ve yeni logo duruyor (birleşim hiçbir değişikliği silmedi)");
  // 3) Üretim sürerken dala dışarıdan değişiklik → iş inceleme dalına alınır, iki değişiklik korunur
  await p.goto(webBase + "/#studio"); await p.waitForTimeout(2500);
  const bX = await start("Başlığı güncelle", true);
  const hx = await html(bX); const ext = await send("POST", G + "/commits?source=gitmapp", { name: bX, head: hx.head, message: "Dışarıdan", html: hx.html.replace("<p>Saat seçin ve randevu alın.</p>", "<p>Saat seçin ve randevu alın. Lara şubesi.</p>") });
  let jx; for (let i = 0; i < 60; i++) { jx = ((await get(G + "/jobs?branch=" + encodeURIComponent(bX))).jobs || [])[0]; if (jx && !["running", "saving"].includes(jx.status)) break; await wait(300); }
  ok(jx?.status === "review" && (await html(bX)).head === ext.j.head && /Online randevu/.test((await html(jx.review_branch)).html), "dış değişiklik ezilmedi; üretilen sonuç “" + jx?.review_branch + "” dalında, durum: İnceleme gerekiyor");
  await p.locator(".cc-rbtn", { hasText: "İnceleme gerekiyor" }).last().waitFor({ timeout: 10000 }).then(() => ok(true, "Stüdyo akışında “İnceleme gerekiyor” adımı"), () => ok(false, "Stüdyo akışında “İnceleme gerekiyor” adımı"));
  await p.screenshot({ path: join(SHOTS, "4-inceleme-gerekiyor.png") });
  // 4) Kayıt sırasında sunucu yeniden başlar
  const bR = await start("Logoyu güncelle", true); await p.waitForTimeout(500);
  api.kill(); await once(api, "exit");
  api = spawn(process.execPath, [join(ROOT, "server/server.mjs")], { env, stdio: ["ignore", "pipe", "inherit"] }); await once(api.stdout, "data");
  await wait(2500); const jr = ((await get(G + "/jobs?branch=" + encodeURIComponent(bR))).jobs || [])[0];
  ok(jr?.status === "dropped" && (await html(bR)).head === (await html(bR)).head, "üretim sırasında sunucu yeniden başladı: iş “tamamlanamadı” olarak işaretlendi, dala yarım bir şey yazılmadı");
  ok(errs.length === 0, "sayfa hatası yok" + (errs.length ? ": " + errs.join(" | ") : ""));
  // Telefon
  const m = await browser.newContext({ ...devices["iPhone 13"] }); const mp = await m.newPage(); await prep(mp, admin); await mp.goto(webBase + "/#studio"); await mp.reload(); await mp.waitForTimeout(2500);
  const w = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(w <= 1, "telefonda yatay taşma yok"); await mp.screenshot({ path: join(SHOTS, "5-telefon.png") }); await m.close();
} finally { await browser.close(); api.kill(); for (const s of [web, ai, rates, fx, ghSrv]) s.close(); rmSync(dir, { recursive: true, force: true }); }

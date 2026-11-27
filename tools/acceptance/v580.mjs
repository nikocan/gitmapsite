// v5.80 kabul testi: Oturumlar (sol menü, depo grupları, arka planda süren iş ve durum simgeleri), oturum başına dal, otomatik commit, Gitmapp birleştirme, GitHub PR aç ve birleştir
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
const SHOTS = join(ROOT, "validation/screens/v580"); mkdirSync(SHOTS, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) process.exitCode = 1; };
const listen = async (s) => { s.listen(0, "127.0.0.1"); await once(s, "listening"); return s.address().port; };
const freePort = async () => { const s = http.createServer(); const p = await listen(s); s.close(); await once(s, "close"); return p; };
const seen = []; let calls = 0;
const PAGE = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Makas</title><style>body{margin:0;font-family:system-ui;background:#fff7f2;color:#1c1917}header{padding:24px;background:#e11d48;color:#fff}main{padding:20px;display:grid;gap:12px}.c{background:#fff;border-radius:14px;padding:16px}</style></head><body><header><h1>Makas Kuaför</h1></header><main>${Array.from({ length: 6 }, (_, i) => `<div class="c"><h2>Hizmet ${i + 1}</h2><p>Saç kesimi ve bakım.</p></div>`).join("")}</main></body></html>`;
const ai = http.createServer(async (req, res) => { let b = ""; for await (const c of req) b += c; const j = b ? JSON.parse(b) : null; res.writeHead(200, { "Content-Type": "application/json" });
  if (req.url.endsWith("/models")) return res.end(JSON.stringify({ data: [{ id: "claude-sonnet-5-5" }, { id: "claude-opus-5-5" }, { id: "claude-haiku-5-5" }] }));
  seen.push(j.model); calls++; const n = calls; await new Promise((r) => setTimeout(r, 4000));
  res.end(JSON.stringify({ choices: [{ message: { content: PAGE.replace("#e11d48", ["#e11d48","#7c3aed","#0891b2","#16a34a","#ea580c","#db2777"][n % 6]).replace("Makas Kuaför", "Makas Kuaför " + n) }, finish_reason: "stop" }], usage: { prompt_tokens: 9000, completion_tokens: 2000, total_tokens: 11000 } })); });
const rates = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ data: [
  { id: "anthropic/claude-sonnet-5.5", pricing: { prompt: "0.000003", completion: "0.000015", input_cache_read: "0.0000003" } }, { id: "anthropic/claude-opus-5.5", pricing: { prompt: "0.000005", completion: "0.000025", input_cache_read: "0.0000005" } }, { id: "anthropic/claude-haiku-5.5", pricing: { prompt: "0.000001", completion: "0.000005", input_cache_read: "0.0000001" } }] })); });
const fx = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ rates: { TRY: 41.8 } })); });

const GH = { refs: new Map([["main", "c0"]]), commits: new Map([["c0", { html: "<!doctype html><title>Salon</title><h1>Salon</h1>", parent: null }]]), pulls: [], seq: 1, calls: [] };
const ghSrv = http.createServer(async (req, res) => { let b = ""; for await (const c of req) b += c; const body = b ? JSON.parse(b) : null; const u = new URL(req.url, "http://x"); const p = decodeURIComponent(u.pathname); GH.calls.push(req.method + " " + p);
  const send = (o, c = 200) => { res.writeHead(c, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); }; const R = "/repos/tester/salon";
  if (p === "/user/repos") return send([{ full_name: "tester/salon", name: "salon", private: false, default_branch: "main", description: "Kuaför", permissions: { push: true }, html_url: "https://github.com/tester/salon", pushed_at: new Date().toISOString() }]);
  if (p === R && req.method === "GET") return send({ full_name: "tester/salon", html_url: "https://github.com/tester/salon", owner: { login: "tester" }, permissions: { push: true }, default_branch: "main" });
  if (p === R + "/branches") return send([...GH.refs.keys()].map(name => ({ name })));
  if (p.startsWith(R + "/git/ref/heads/")) { const n = p.slice((R + "/git/ref/heads/").length); return GH.refs.has(n) ? send({ ref: "refs/heads/" + n, object: { type: "commit", sha: GH.refs.get(n) } }) : send({}, 404); }
  if (p === R + "/contents/index.html") { const c = GH.commits.get(u.searchParams.get("ref")); return send({ type: "file", encoding: "base64", size: c.html.length, content: Buffer.from(c.html).toString("base64"), sha: "b" }); }
  if (p === R + "/commits") return send([]);
  if (p === R + "/git/refs" && req.method === "POST") { GH.refs.set(body.ref.replace("refs/heads/", ""), body.sha); return send({}); }
  if (p.startsWith(R + "/git/commits/")) return send({ tree: { sha: "t-" + p.split("/").pop() } });
  if (p === R + "/git/trees") { const t = "t" + GH.seq++; GH.commits.set("pending-" + t, { html: body.tree[0].content }); return send({ sha: t }); }
  if (p === R + "/git/commits" && req.method === "POST") { const sha = "c" + GH.seq++; GH.commits.set(sha, { html: GH.commits.get("pending-" + body.tree).html, parent: body.parents[0] }); return send({ sha }); }
  if (p.startsWith(R + "/git/refs/heads/") && req.method === "PATCH") { GH.refs.set(p.slice((R + "/git/refs/heads/").length), body.sha); return send({}); }
  if (p.startsWith(R + "/compare/")) { const [base, head] = p.slice((R + "/compare/").length).split("..."); let n = 0, c = GH.refs.get(head); const stop = GH.refs.get(base); while (c && c !== stop && n < 50) { n++; c = GH.commits.get(c)?.parent; } return send({ ahead_by: n, behind_by: 0 }); }
  if (p === R + "/pulls" && req.method === "GET") { const h = (u.searchParams.get("head") || "").split(":")[1]; return send(GH.pulls.filter(x => x.head.ref === h)); }
  if (p === R + "/pulls" && req.method === "POST") { const pr = { number: GH.pulls.length + 1, state: "open", html_url: "https://github.com/tester/salon/pull/" + (GH.pulls.length + 1), title: body.title, head: { ref: body.head }, base: { ref: body.base }, merged_at: null, body: body.body }; GH.pulls.push(pr); return send(pr, 201); }
  const mm = /\/pulls\/(\d+)\/merge$/.exec(p); if (mm && req.method === "PUT") { const pr = GH.pulls[mm[1] - 1]; pr.merged_at = new Date().toISOString(); pr.state = "closed"; GH.refs.set(pr.base.ref, GH.refs.get(pr.head.ref)); return send({ merged: true, sha: GH.refs.get(pr.head.ref) }); }
  send({ message: "not found " + req.method + " " + p }, 404); });
const ghPort = await listen(ghSrv);
const aiPort = await listen(ai), rPort = await listen(rates), fxPort = await listen(fx);
const dir = mkdtempSync(join(tmpdir(), "gitmapp-v580-")); const apiPort = await freePort(), webPort = await freePort();
const apiBase = "http://127.0.0.1:" + apiPort, webBase = "http://127.0.0.1:" + webPort;
const env = { ...process.env, PORT: String(apiPort), DB_PATH: join(dir, "db"), SECRET: randomBytes(32).toString("hex"), ADMIN_EMAIL: "y@gitmapp.test", SITE_URL: webBase, CORS_EXTRA: webBase, API_URL: apiBase, GITHUB_CLIENT_ID: "", GOOGLE_CLIENT_ID: "", AI_BASE: "http://127.0.0.1:" + aiPort + "/v1", AI_KEY: "k-test-123456789012", AI_MODEL: "", AI_MODELS: "claude-sonnet-5-5,claude-opus-5-5,claude-haiku-5-5", AI_FALLBACKS: "", ANTHROPIC_API_KEY: "", OPENROUTER_API_KEY: "", AI_PROFILE_AUTO: "0", RATES_URL: "http://127.0.0.1:" + rPort + "/m", FX_URL: "http://127.0.0.1:" + fxPort + "/fx", SIGNUP_CREDITS: "200", TEST_GH_API: "http://127.0.0.1:" + ghPort };
const adminPw = execFileSync(process.execPath, [join(ROOT, "server/server.mjs"), "create-admin"], { env, encoding: "utf8" }).match(/Şifre: (\S+)/)[1];
const api = spawn(process.execPath, [join(ROOT, "server/server.mjs")], { env, stdio: ["ignore", "pipe", "inherit"] }); await once(api.stdout, "data");
const web = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p === "/config.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); return res.end(`window.GMS_CONFIG={api:${JSON.stringify(apiBase)}};`); } if (p === "/sw.js") { res.writeHead(404); return res.end(); } if (p.endsWith("/")) p += "index.html"; const f = normalize(join(ROOT, p)); if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": MIME[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); }); web.listen(webPort, "127.0.0.1"); await once(web, "listening");
const post = async (path, body, t) => (await fetch(apiBase + "/api/" + path, { method: "POST", headers: { "Content-Type": "application/json", ...(t ? { Authorization: "Bearer " + t } : {}) }, body: JSON.stringify(body) })).json();
const browser = await chromium.launch();
const prep = async (p, t, extra = {}) => { await p.goto(webBase + "/#ana"); await p.evaluate(([t, x]) => { for (const [k, v] of Object.entries({ tok: t, seenVer: "999", nrSeen: true, vbarOff: true, installSnooze: 9e15, autoFix: false, ...x })) localStorage.setItem("gms_" + k, JSON.stringify(v)); }, [t, extra]); };
try {
  const admin = (await post("auth/login", { email: env.ADMIN_EMAIL, password: adminPw })).token;
  const get = async (path) => (await fetch(apiBase + "/api/" + path, { headers: { Authorization: "Bearer " + admin } })).json();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", d => { errs.push("onay penceresi: " + d.message()); d.dismiss(); });
  await prep(p, admin); await p.goto(webBase + "/#studio"); await p.reload(); await p.locator("textarea.gta").first().waitFor({ timeout: 20000 });
  const side = async () => { if (await p.locator(".studio-side-toggle").first().getAttribute("aria-expanded") === "false") await p.locator(".studio-side-toggle").first().click(); };
  const row = (status) => p.locator('.cc-sess .nav.sess' + (status ? '[data-status="' + status + '"]' : ""));
  // 1) İlk oturum: boş sayfa → üret → otomatik kayıt → Gitmapp deposu grubu
  await p.locator("textarea.gta").first().fill("Kuaför randevu uygulaması"); await p.keyboard.press("Enter");
  await p.locator(".picker-handle").waitFor({ timeout: 30000 });
  let apps = []; for (let i = 0; i < 30 && !apps.length; i++) { await p.waitForTimeout(300); apps = (await get("apps")).apps; } const app = apps[0];
  ok(!!app, "ilk oturum otomatik olarak Gitmapp deposuna kaydedildi");
  await side(); await p.waitForTimeout(600);
  ok(await row().count() === 1 && /Makas/.test(await p.locator(".cc-sess .sess-gh").first().innerText()), "sol menü: Oturumlar · “Makas” deposu grubunda 1 oturum");
  // 2) Aynı projede yeni oturum → yeni dal
  await p.locator(".cc-newchat").click(); await p.locator(".ns").waitFor();
  ok(await p.locator('.ns-card[data-k="ayni"]').getAttribute("aria-checked") === "true" && await p.locator(".ns-br-tg input").isChecked(), "yeni oturum: bu projede, yeni dalda (varsayılan)");
  await p.screenshot({ path: join(SHOTS, "1-yeni-oturum-dal.png") });
  await p.locator(".ns-go").click(); await p.locator(".br-bar").waitFor({ timeout: 10000 });
  const brName = await p.locator(".br-bar > b").innerText(); ok(/^gitmapp\//.test(brName) && /→ main/.test(await p.locator(".br-bar").innerText()), "oturum kendi dalında: " + brName + " → main");
  await p.waitForTimeout(500); ok(await row().count() === 2, "sol menüde aynı depo altında 2 oturum");
  // 3) Dalda iş başlat, bitmeden yeni boş oturuma geç → iş arka planda sürer
  await p.locator("textarea.gta").first().fill("Renkleri daha canlı yap"); await p.keyboard.press("Enter");
  await p.waitForTimeout(1200); ok(await row("run").count() === 1, "çalışan oturumda dönen simge");
  await p.locator(".cc-newchat").click(); await p.locator('.ns-card[data-k="bos"]').click(); await p.locator(".ns-go").click();
  await p.waitForTimeout(800); ok(await row("run").count() === 1, "başka oturuma geçince önceki iş arka planda sürüyor");
  await p.screenshot({ path: join(SHOTS, "2-arka-planda-suruyor.png") });
  await row("done").first().waitFor({ timeout: 25000 }); ok(true, "iş bitince yeşil “bitti” simgesi (okunmamış)");
  await p.screenshot({ path: join(SHOTS, "3-bitti-simgesi.png") });
  // 4) Bitene tıkla → kaldığı yerden yüklenir, sonuç uygulanır, dala commit
  await row("done").first().locator(".rec-open").click(); await p.locator(".br-bar").waitFor({ timeout: 10000 });
  ok((await p.locator(".br-bar > b").innerText()) === brName, "oturum yüklendi: aynı dal");
  await p.locator(".cc-rbtn", { hasText: "Commit kaydedildi" }).last().waitFor({ timeout: 15000 }); ok(true, "akışta “Commit kaydedildi → " + brName + "” adımı");
  ok(/Renkleri daha canlı yap/.test(await p.locator(".ws-msgs").innerText()), "sohbet ve istek geri geldi");
  await p.locator(".br-n", { hasText: "1 commit önde" }).waitFor({ timeout: 8000 }); ok(true, "dal çubuğu: 1 commit önde");
  ok(await row("done").count() === 0, "açılınca “okunmamış” işareti kalktı");
  await p.screenshot({ path: join(SHOTS, "4-oturum-yuklendi-commit.png") });
  await p.locator(".br-btn").click(); await p.locator(".br-st.ok").waitFor({ timeout: 8000 });
  const mainNow = await get("apps/" + app.id + "/git/branch?name=main"); const brNow = await get("apps/" + app.id + "/git/branch?name=" + encodeURIComponent(brName));
  ok(mainNow.html === brNow.html && /Makas Kuaför 2/.test(mainNow.html), "main'e birleştirildi; main, dalın son hâlini taşıyor");
  ok(/birleştirildi/.test(await p.locator(".ws-msgs").innerText()), "birleştirme akışta not olarak görünüyor");
  await p.screenshot({ path: join(SHOTS, "5-birlestirildi.png") });
  // 5) GitHub deposunda oturum → dal → commit → PR aç → birleştir
  const { DatabaseSync } = await import("node:sqlite"); const dbx = new DatabaseSync(env.DB_PATH); dbx.prepare("UPDATE users SET github_login='tester', github_token='gh-test' WHERE email=?").run(env.ADMIN_EMAIL); dbx.close();
  await p.locator(".cc-newchat").click(); await p.locator('.ns-card[data-k="depo"]').click(); await p.locator('.ns-env [role="tab"]', { hasText: "GitHub" }).click();
  await p.locator(".ns-row", { hasText: "tester/salon" }).click(); await p.screenshot({ path: join(SHOTS, "6-github-depo-sec.png") }); await p.locator(".ns-go").click();
  let ghBr = brName; for (let i = 0; i < 60 && (ghBr === brName || !GH.refs.has(ghBr)); i++) { await p.waitForTimeout(250); ghBr = await p.locator(".br-bar > b").innerText().catch(() => brName); }
  ok(GH.refs.has(ghBr), "GitHub'da oturum dalı açıldı: " + ghBr);
  await p.waitForTimeout(500); ok(/tester\/salon/.test(await p.locator(".cc-sess").innerText()), "sol menü: “tester/salon” GitHub grubu");
  await p.locator("textarea.gta").first().fill("Salon başlığını büyüt"); await p.keyboard.press("Enter");
  await p.locator(".cc-rbtn", { hasText: "Commit kaydedildi" }).last().waitFor({ timeout: 30000 });
  ok(/Makas Kuaför/.test(GH.commits.get(GH.refs.get(ghBr)).html), "değişiklik GitHub dalına commit edildi");
  await p.locator(".br-btn", { hasText: "PR aç" }).waitFor({ timeout: 8000 }); await p.locator(".br-btn").click();
  await p.locator(".br-st", { hasText: "PR #1 açık" }).waitFor({ timeout: 8000 }); ok(GH.pulls[0].head.ref === ghBr && GH.pulls[0].base.ref === "main" && /Salon başlığını büyüt/.test(GH.pulls[0].body), "PR #1 açıldı (istekler açıklamada)");
  await p.screenshot({ path: join(SHOTS, "7-github-pr-acik.png") });
  await p.locator(".br-btn", { hasText: "Birleştir" }).click(); await p.locator(".br-st.ok").waitFor({ timeout: 8000 });
  ok(!!GH.pulls[0].merged_at && GH.refs.get("main") === GH.refs.get(ghBr), "PR birleştirildi, GitHub main güncel");
  await p.waitForTimeout(500); ok(/PR #1/.test(await p.locator(".cc-sess").innerText()) || /birleştirildi/.test(await p.locator(".cc-sess").innerText()), "sol menüde PR / birleştirme durumu");
  await p.screenshot({ path: join(SHOTS, "8-github-birlestirildi.png") });
  // 6) Yenileme sonrası oturumlar kalıcı
  await p.reload(); await p.waitForTimeout(1500); await side(); await p.waitForTimeout(500); ok(await row().count() === 3, "yenilemeden sonra 3 oturum (main, dal, GitHub dalı) geçmişte duruyor; boş oturum kayda geçmez (" + await row().count() + ")");
  ok(errs.length === 0, "sayfa hatası yok" + (errs.length ? ": " + errs.join(" | ") : ""));
  const m = await browser.newContext({ ...devices["iPhone 13"] }); const mp = await m.newPage(); await prep(mp, admin); await mp.goto(webBase + "/#studio"); await mp.reload(); await mp.waitForTimeout(2000);
  const w = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(w <= 1, "telefonda yatay taşma yok"); await mp.screenshot({ path: join(SHOTS, "9-telefon.png") }); await m.close();
} finally { await browser.close(); api.kill(); for (const s of [web, ai, rates, fx, ghSrv]) s.close(); rmSync(dir, { recursive: true, force: true }); }

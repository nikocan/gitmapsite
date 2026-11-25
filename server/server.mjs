// Gitmapp API — Node.js (harici bağımlılık yok) + SQLite
// Uç noktalar: kimlik, yapay zekâ ile uygulama üretimi, uygulamalar, mağaza, siparişler, talep radarı, alan adı sorgusu
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const E = process.env;
const CFG = {
  port: +(E.PORT || 8787),
  db: E.DB_PATH || "./data.db",
  secret: E.SECRET || "dev-secret-change-me",
  admin: (E.ADMIN_EMAIL || "").trim().toLowerCase(),
  site: E.SITE_URL || "https://gitmapp.com",
  api: E.API_URL || "https://api.gitmapp.com",
  appHost: E.APP_HOST || "app.gitmapp.com",
  aiBase: E.AI_BASE || "https://router.hostinger.com/v1",
  aiKey: E.AI_KEY || "",
  aiModel: E.AI_MODEL || "",
  hostingerToken: E.HOSTINGER_API_TOKEN || "",
  gh: { id: E.GITHUB_CLIENT_ID || "", secret: E.GITHUB_CLIENT_SECRET || "" },
  google: { id: E.GOOGLE_CLIENT_ID || "", secret: E.GOOGLE_CLIENT_SECRET || "" },
  cors: [E.SITE_URL || "https://gitmapp.com", "https://www.gitmapp.com", "https://nikocan.github.io", ...(E.CORS_EXTRA ? E.CORS_EXTRA.split(",") : [])],
  aiDailyAnon: +(E.AI_DAILY_ANON || 3),
  aiDailyUser: +(E.AI_DAILY_USER || 40),
};

// ---------- Veritabanı ----------
fs.mkdirSync(path.dirname(path.resolve(CFG.db)), { recursive: true });
const db = new DatabaseSync(CFG.db);
db.exec(`
PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, pass TEXT, email_verified INTEGER DEFAULT 0,
  github_login TEXT, github_token TEXT, google_sub TEXT, created TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS apps(
  id TEXT PRIMARY KEY, owner_id TEXT REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, slug TEXT UNIQUE,
  description TEXT, category TEXT, emoji TEXT, color TEXT, html TEXT NOT NULL, prompt_log TEXT DEFAULT '[]',
  status TEXT DEFAULT 'draft', listed INTEGER DEFAULT 0, price INTEGER DEFAULT 0, downloads INTEGER DEFAULT 0, opens INTEGER DEFAULT 0,
  github_repo TEXT, pages_url TEXT, created TEXT DEFAULT (datetime('now')), updated TEXT DEFAULT (datetime('now')), published_at TEXT);
CREATE INDEX IF NOT EXISTS apps_owner ON apps(owner_id);
CREATE INDEX IF NOT EXISTS apps_listed ON apps(listed, downloads);
CREATE TABLE IF NOT EXISTS orders(
  id TEXT PRIMARY KEY, user_id TEXT, created TEXT DEFAULT (datetime('now')), updated TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'Yeni talep', data TEXT NOT NULL, customer_name TEXT, phone TEXT, email TEXT, brand TEXT,
  total REAL DEFAULT 0, monthly REAL DEFAULT 0, live_url TEXT);
CREATE TABLE IF NOT EXISTS events(
  id INTEGER PRIMARY KEY AUTOINCREMENT, created TEXT DEFAULT (datetime('now')), session_id TEXT, user_id TEXT,
  type TEXT, query TEXT, category TEXT, repo TEXT, meta TEXT);
CREATE INDEX IF NOT EXISTS events_type ON events(type, created);
CREATE TABLE IF NOT EXISTS ai_usage(k TEXT, day TEXT, n INTEGER DEFAULT 0, PRIMARY KEY(k, day));
`);
const q = (sql) => db.prepare(sql);
const now = () => new Date().toISOString().replace("T", " ").slice(0, 19);
const rid = (n = 12) => crypto.randomBytes(n * 2).toString("base64url").replace(/[-_]/g, "").slice(0, n);

// ---------- Kimlik ----------
const b64u = (s) => Buffer.from(s).toString("base64url");
const sign = (obj, ttlSec = 60 * 60 * 24 * 30) => {
  const p = b64u(JSON.stringify({ ...obj, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  return p + "." + crypto.createHmac("sha256", CFG.secret).update(p).digest("base64url");
};
const verify = (tok) => {
  if (!tok || typeof tok !== "string" || !tok.includes(".")) return null;
  const [p, s] = tok.split(".");
  const exp = crypto.createHmac("sha256", CFG.secret).update(p).digest("base64url");
  if (!s || s.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(exp))) return null;
  try { const o = JSON.parse(Buffer.from(p, "base64url").toString()); return o.exp > Date.now() / 1000 ? o : null; } catch { return null; }
};
const hashPw = (pw) => { const salt = crypto.randomBytes(16).toString("hex"); return salt + ":" + crypto.scryptSync(pw, salt, 64).toString("hex"); };
const checkPw = (pw, h) => { if (!h) return false; const [salt, hex] = h.split(":"); const a = crypto.scryptSync(pw, salt, 64); const b = Buffer.from(hex, "hex"); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const isAdmin = (u) => !!u && !!CFG.admin && u.email.toLowerCase() === CFG.admin && !!u.email_verified;
const pubUser = (u) => u && ({ id: u.id, email: u.email, name: u.name, github: u.github_login || null, admin: isAdmin(u) });
function authUser(req) {
  const h = req.headers.authorization || "";
  const t = verify(h.startsWith("Bearer ") ? h.slice(7) : "");
  return t && t.uid && !t.purpose && !t.prov ? q("SELECT * FROM users WHERE id=?").get(t.uid) || null : null;
}
function upsertOAuthUser({ email, name, github_login, github_token, google_sub }) {
  email = email.toLowerCase();
  let u = q("SELECT * FROM users WHERE email=?").get(email);
  if (!u) { const id = rid(); q("INSERT INTO users(id,email,name,email_verified) VALUES(?,?,?,1)").run(id, email, name || ""); u = q("SELECT * FROM users WHERE id=?").get(id); }
  else q("UPDATE users SET email_verified=1, name=COALESCE(NULLIF(name,''),?) WHERE id=?").run(name || "", u.id);
  if (github_login) q("UPDATE users SET github_login=?, github_token=? WHERE id=?").run(github_login, github_token, u.id);
  if (google_sub) q("UPDATE users SET google_sub=? WHERE id=?").run(google_sub, u.id);
  return q("SELECT * FROM users WHERE id=?").get(u.id);
}

// ---------- Yardımcılar ----------
class HttpErr extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const need = (cond, code, msg) => { if (!cond) throw new HttpErr(code, msg); };
const str = (v, max, name, required = false) => {
  if (v == null || v === "") { need(!required, 400, `${name} gerekli`); return null; }
  need(typeof v === "string", 400, `${name} geçersiz`); need(v.length <= max, 400, `${name} çok uzun`); return v;
};
const slugify = (s) => (s || "uygulama").toLowerCase().replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "uygulama";
const clientIp = (req) => (req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim();
function useAi(key, limit, anon) {
  const day = new Date().toISOString().slice(0, 10);
  const r = q("SELECT n FROM ai_usage WHERE k=? AND day=?").get(key, day);
  need(!r || r.n < limit, 429, anon ? "Günlük ücretsiz deneme hakkınız doldu. Devam etmek için ücretsiz hesap oluşturun." : "Bugünkü yapay zekâ kullanım sınırına ulaştınız. Yarın tekrar deneyin.");
  q("INSERT INTO ai_usage(k,day,n) VALUES(?,?,1) ON CONFLICT(k,day) DO UPDATE SET n=n+1").run(key, day);
}

// ---------- Yapay zekâ ----------
let modelCache = null;
async function pickModel() {
  if (CFG.aiModel) return CFG.aiModel;
  if (modelCache) return modelCache;
  const r = await fetch(CFG.aiBase + "/models", { headers: { Authorization: "Bearer " + CFG.aiKey } });
  need(r.ok, 502, "Yapay zekâ model listesi alınamadı (" + r.status + ")");
  const ids = ((await r.json()).data || []).map((m) => m.id);
  modelCache = ids.find((i) => /sonnet/i.test(i)) || ids.find((i) => /claude/i.test(i)) || ids.find((i) => /gpt-?5|gpt-4\.1|gpt-4o/i.test(i)) || ids[0];
  need(modelCache, 502, "Kullanılabilir yapay zekâ modeli yok");
  return modelCache;
}
async function chat(messages, maxTokens = 12000) {
  need(CFG.aiKey, 503, "Yapay zekâ henüz yapılandırılmadı (AI_KEY eksik)");
  const model = await pickModel();
  const r = await fetch(CFG.aiBase + "/chat/completions", {
    method: "POST", signal: AbortSignal.timeout(240000),
    headers: { Authorization: "Bearer " + CFG.aiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.4 }),
  });
  const t = await r.text();
  need(r.ok, 502, "Yapay zekâ hatası (" + r.status + "): " + t.slice(0, 200));
  const j = JSON.parse(t);
  return { text: j.choices?.[0]?.message?.content || "", model, usage: j.usage || null };
}
const GEN_SYSTEM = `Sen Gitmapp Stüdyo'nun uygulama üreticisisin. Kullanıcının fikrini TEK DOSYALIK, kendi içinde çalışan, gerçekten kullanılabilir bir web uygulamasına çevirirsin.
Kurallar:
- Yanıtın SADECE tam bir HTML dosyası olsun. İlk satır şu biçimde bir yorum olsun: <!-- ÖZET: (yaptığın şeyi 1-2 cümleyle Türkçe anlat) --> ardından <!DOCTYPE html>.
- Stil için Tailwind CDN kullan: <script src="https://cdn.tailwindcss.com"></script>. Başka harici kütüphane gerekirse sadece cdn.jsdelivr.net veya unpkg.com kullan.
- JavaScript sade (vanilla) olsun. API anahtarı gerektiren hiçbir dış servis kullanma. Veriler tarayıcıda localStorage ile saklansın.
- Arayüz tamamen Türkçe, mobil öncelikli, modern ve şık olsun; boş ekran bırakma, örnek verilerle başlasın.
- Uygulamanın adı <title> etiketinde olsun. Formlarda doğrulama, boş durum ve hata mesajları olsun.
- Mevcut bir HTML verilirse onu kullanıcının istediği değişiklikle güncelle ve DOSYANIN TAMAMINI döndür; istenmeyen kısımları bozma.`;
function extractHtml(text) {
  let t = text.trim().replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/i, "");
  const sm = t.match(/<!--\s*ÖZET:\s*([\s\S]*?)-->/i);
  const i = t.search(/<!DOCTYPE html|<html/i);
  need(i >= 0, 502, "Yapay zekâ geçerli bir uygulama üretemedi, isteğinizi biraz daha açık yazıp tekrar deneyin.");
  const html = t.slice(i);
  const title = (html.match(/<title>([^<]{1,120})<\/title>/i) || [])[1] || null;
  return { html, summary: sm ? sm[1].trim() : "Uygulama hazır.", title };
}
const ASSIST_SYSTEM = `Sen Gitmapp'in Yayın Asistanısın. Teknik bilgisi olmayan kullanıcılara uygulamalarını yayına almalarında kısa, sıcak ve net Türkçe cümlelerle yardım edersin (en fazla 5 cümle, gerekirse madde işareti).
Gitmapp'te yayın adımları: 1) Stüdyo'da uygulamayı yap ve kaydet. 2) "Hemen yayınla" ile ücretsiz app.gitmapp.com/<ad> adresi alınır, telefona "Ana ekrana ekle" ile indirilebilir. 3) "GitHub'a kaydet" ile uygulama kullanıcının KENDİ GitHub hesabına kaydedilir ve ücretsiz GitHub Pages adresi açılır (GitHub ile bağlan butonu). 4) Alan adı: ekrandan sorgulanır; kullanıcı Hostinger'dan kendisi alabilir ya da "Benim adıma alın" ile Gitmapp ekibi kullanıcı adına alıp bağlar. 5) Mağazaya koy: kategori ve fiyat seçilir, uygulama Gitmapp Mağazası'nda listelenir.
Mobil mağazalar (App Store/Google Play) ayrı ücretli hizmettir, inceleme günler sürer, kullanıcının kendi geliştirici hesabı gerekir. Bilmediğin bir şeyi uydurma; emin değilsen Gitmapp ekibine talep oluşturmasını öner.`;

// ---------- Harici API'ler ----------
async function ghApi(token, method, p, body) {
  const r = await fetch("https://api.github.com" + p, { method, headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "User-Agent": "gitmapp", ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch { }
  return { status: r.status, ok: r.ok, data: j };
}

// ---------- Uygulama sunucusu (app.gitmapp.com) ----------
const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function serveApp(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const slug = parts[0];
  if (!slug) { res.writeHead(302, { Location: CFG.site + "/#magaza" }); return res.end(); }
  const a = q("SELECT * FROM apps WHERE slug=? AND status='published'").get(slug);
  if (!a) { res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" }); return res.end(`<!doctype html><meta charset=utf-8><title>Bulunamadı</title><body style="font-family:sans-serif;text-align:center;padding:60px"><h1>Uygulama bulunamadı</h1><a href="${CFG.site}">Gitmapp'e dön</a>`); }
  const color = /^#[0-9a-f]{6}$/i.test(a.color || "") ? a.color : "#4f8cff";
  if (parts[1] === "manifest.webmanifest") {
    res.writeHead(200, { "Content-Type": "application/manifest+json" });
    return res.end(JSON.stringify({ name: a.title, short_name: a.title.slice(0, 12), start_url: `/${slug}`, scope: `/${slug}`, display: "standalone", background_color: "#ffffff", theme_color: color, icons: [{ src: `/${slug}/icon.svg`, sizes: "any", type: "image/svg+xml", purpose: "any" }] }));
  }
  if (parts[1] === "icon.svg") {
    res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" });
    return res.end(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${color}"/><text x="50%" y="54%" font-size="300" text-anchor="middle" dominant-baseline="middle">${esc(a.emoji || "✨")}</text></svg>`);
  }
  if (parts.length > 1) { res.writeHead(404); return res.end(); }
  q("UPDATE apps SET opens=opens+1 WHERE id=?").run(a.id);
  const inject = `<link rel="manifest" href="/${slug}/manifest.webmanifest"><link rel="icon" href="/${slug}/icon.svg"><meta name="theme-color" content="${color}"><meta name="apple-mobile-web-app-capable" content="yes">`;
  const badge = `<a href="${CFG.site}/#magaza" target="_blank" style="position:fixed;right:10px;bottom:10px;z-index:2147483647;background:#0b0f17;color:#fff;font:600 11px/1 system-ui,sans-serif;padding:7px 10px;border-radius:999px;text-decoration:none;opacity:.85">⚡ Gitmapp ile yapıldı</a>`;
  let html = a.html;
  html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, inject + "</head>") : inject + html;
  html = /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, badge + "</body>") : html + badge;
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Cache-Control": "no-cache" });
  res.end(html);
}

// ---------- API ----------
const routes = [];
const route = (m, p, fn) => routes.push({ m, re: new RegExp("^" + p.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$"), fn });
const appRow = (a, withHtml) => ({ id: a.id, title: a.title, slug: a.slug, description: a.description, category: a.category, emoji: a.emoji, color: a.color, status: a.status, listed: !!a.listed, price: a.price, downloads: a.downloads, opens: a.opens, github_repo: a.github_repo, pages_url: a.pages_url, created: a.created, updated: a.updated, published_at: a.published_at, url: a.slug && a.status === "published" ? `https://${CFG.appHost}/${a.slug}` : null, ...(withHtml ? { html: a.html, prompt_log: JSON.parse(a.prompt_log || "[]") } : {}) });
const ownApp = (u, id) => { const a = q("SELECT * FROM apps WHERE id=?").get(id); need(a, 404, "Uygulama bulunamadı"); need(a.owner_id === u.id || isAdmin(u), 403, "Bu uygulama size ait değil"); return a; };
const CATS = ["is", "egitim", "saglik", "eticaret", "yemek", "oyun", "verimlilik", "finans", "sosyal", "araclar", "diger"];

route("GET", "/api/health", () => ({ ok: true, ai: !!CFG.aiKey, github: !!CFG.gh.id, google: !!CFG.google.id, domain: !!CFG.hostingerToken }));

// Kimlik
route("POST", "/api/auth/register", ({ body }) => {
  const email = str(body.email, 200, "E-posta", true).trim().toLowerCase(); const pw = str(body.password, 200, "Şifre", true);
  need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 400, "Geçerli bir e-posta girin"); need(pw.length >= 8, 400, "Şifre en az 8 karakter olmalı");
  need(!q("SELECT 1 FROM users WHERE email=?").get(email), 409, "Bu e-posta ile zaten hesap var, giriş yapın");
  const id = rid(); q("INSERT INTO users(id,email,name,pass) VALUES(?,?,?,?)").run(id, email, str(body.name, 120, "Ad") || "", hashPw(pw));
  const u = q("SELECT * FROM users WHERE id=?").get(id); return { token: sign({ uid: id }), user: pubUser(u) };
});
route("POST", "/api/auth/login", ({ body }) => {
  const email = (str(body.email, 200, "E-posta", true) || "").trim().toLowerCase(); const u = q("SELECT * FROM users WHERE email=?").get(email);
  need(u && checkPw(String(body.password || ""), u.pass), 401, "E-posta veya şifre hatalı");
  return { token: sign({ uid: u.id }), user: pubUser(u) };
});
route("GET", "/api/auth/me", ({ user }) => ({ user: pubUser(user) }));
route("POST", "/api/auth/link", ({ user }) => { need(user, 401, "Giriş yapın"); return { link: sign({ uid: user.id, purpose: "link" }, 600) }; });
route("GET", "/api/auth/oauth/:prov/start", ({ params, url, res }) => {
  const prov = params.prov; const link = url.searchParams.get("link"); let uid = null;
  if (link) { const t = verify(link); uid = t && t.purpose === "link" ? t.uid : null; }
  const state = sign({ prov, uid, n: rid(6) }, 600);
  let loc;
  if (prov === "github") { need(CFG.gh.id, 503, "GitHub girişi henüz yapılandırılmadı"); loc = `https://github.com/login/oauth/authorize?client_id=${CFG.gh.id}&scope=${encodeURIComponent("read:user user:email public_repo")}&state=${state}&redirect_uri=${encodeURIComponent(CFG.api + "/api/auth/oauth/github/callback")}`; }
  else if (prov === "google") { need(CFG.google.id, 503, "Google girişi henüz yapılandırılmadı"); loc = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CFG.google.id}&response_type=code&scope=${encodeURIComponent("openid email profile")}&state=${state}&redirect_uri=${encodeURIComponent(CFG.api + "/api/auth/oauth/google/callback")}&prompt=select_account`; }
  else throw new HttpErr(404, "Bilinmeyen sağlayıcı");
  res.writeHead(302, { Location: loc }); res.end(); return null;
});
route("GET", "/api/auth/oauth/:prov/callback", async ({ params, url, res }) => {
  const back = (h) => { res.writeHead(302, { Location: CFG.site + "/#" + h }); res.end(); return null; };
  const st = verify(url.searchParams.get("state")); const code = url.searchParams.get("code");
  if (!st || st.prov !== params.prov || !code) return back("auth-hata");
  try {
    let u;
    if (params.prov === "github") {
      const tr = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ client_id: CFG.gh.id, client_secret: CFG.gh.secret, code }) });
      const tok = (await tr.json()).access_token; if (!tok) return back("auth-hata");
      const me = await ghApi(tok, "GET", "/user"); const em = await ghApi(tok, "GET", "/user/emails");
      if (st.uid && q("SELECT 1 FROM users WHERE id=?").get(st.uid)) { q("UPDATE users SET github_login=?, github_token=? WHERE id=?").run(me.data.login, tok, st.uid); return back("github-baglandi"); }
      const primary = (em.data || []).find((e) => e.primary && e.verified) || (em.data || []).find((e) => e.verified);
      if (!primary) return back("auth-eposta-yok");
      u = upsertOAuthUser({ email: primary.email, name: me.data.name || me.data.login, github_login: me.data.login, github_token: tok });
    } else {
      const tr = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: CFG.google.id, client_secret: CFG.google.secret, code, grant_type: "authorization_code", redirect_uri: CFG.api + "/api/auth/oauth/google/callback" }) });
      const tok = (await tr.json()).access_token; if (!tok) return back("auth-hata");
      const info = await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: "Bearer " + tok } })).json();
      if (!info.email || !info.email_verified) return back("auth-eposta-yok");
      u = upsertOAuthUser({ email: info.email, name: info.name, google_sub: info.sub });
    }
    return back("auth=" + sign({ uid: u.id }));
  } catch (e) { console.error(e); return back("auth-hata"); }
});

// Yapay zekâ
route("POST", "/api/ai/generate", async ({ body, user, req }) => {
  const prompt = str(body.prompt, 4000, "İstek", true); const cur = str(body.html, 400000, "HTML");
  useAi(user ? "u:" + user.id : "ip:" + clientIp(req), user ? CFG.aiDailyUser : CFG.aiDailyAnon, !user);
  const messages = [{ role: "system", content: GEN_SYSTEM }];
  if (cur) messages.push({ role: "user", content: "Mevcut uygulama:\n" + cur }, { role: "user", content: "İstenen değişiklik: " + prompt });
  else messages.push({ role: "user", content: "Uygulama fikri: " + prompt });
  const { text, model, usage } = await chat(messages);
  return { ...extractHtml(text), model, usage };
});
route("POST", "/api/ai/assist", async ({ body, user, req }) => {
  need(Array.isArray(body.messages) && body.messages.length <= 30, 400, "Mesajlar geçersiz");
  useAi(user ? "a:" + user.id : "aip:" + clientIp(req), user ? 200 : 20, !user);
  const msgs = body.messages.slice(-12).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 2000) }));
  const ctx = body.context ? "\nKullanıcının durumu: " + String(JSON.stringify(body.context)).slice(0, 800) : "";
  const { text } = await chat([{ role: "system", content: ASSIST_SYSTEM + ctx }, ...msgs], 800);
  return { reply: text.trim() };
});

// Uygulamalar (kullanıcının kendi)
route("GET", "/api/apps", ({ user }) => { need(user, 401, "Giriş yapın"); return { apps: q("SELECT * FROM apps WHERE owner_id=? ORDER BY updated DESC").all(user.id).map((a) => appRow(a)) }; });
route("GET", "/api/apps/:id", ({ user, params }) => { need(user, 401, "Giriş yapın"); return { app: appRow(ownApp(user, params.id), true) }; });
route("POST", "/api/apps", ({ user, body }) => {
  need(user, 401, "Kaydetmek için giriş yapın");
  const id = rid(); const html = str(body.html, 400000, "HTML", true);
  q("INSERT INTO apps(id,owner_id,title,description,category,emoji,color,html,prompt_log) VALUES(?,?,?,?,?,?,?,?,?)").run(id, user.id, str(body.title, 80, "Ad") || "Adsız uygulama", str(body.description, 400, "Açıklama"), CATS.includes(body.category) ? body.category : "diger", str(body.emoji, 8, "Simge") || "✨", /^#[0-9a-f]{6}$/i.test(body.color || "") ? body.color : "#4f8cff", html, JSON.stringify((Array.isArray(body.prompt_log) ? body.prompt_log : []).slice(-50)));
  return { app: appRow(q("SELECT * FROM apps WHERE id=?").get(id), true) };
});
route("PUT", "/api/apps/:id", ({ user, body, params }) => {
  need(user, 401, "Giriş yapın"); const a = ownApp(user, params.id);
  q(`UPDATE apps SET title=?, description=?, category=?, emoji=?, color=?, html=?, prompt_log=?, updated=? WHERE id=?`).run(
    str(body.title, 80, "Ad") || a.title, body.description !== undefined ? str(body.description, 400, "Açıklama") : a.description, CATS.includes(body.category) ? body.category : a.category, str(body.emoji, 8, "Simge") || a.emoji,
    /^#[0-9a-f]{6}$/i.test(body.color || "") ? body.color : a.color, body.html !== undefined ? str(body.html, 400000, "HTML", true) : a.html, Array.isArray(body.prompt_log) ? JSON.stringify(body.prompt_log.slice(-50)) : a.prompt_log, now(), a.id);
  return { app: appRow(q("SELECT * FROM apps WHERE id=?").get(a.id), true) };
});
route("DELETE", "/api/apps/:id", ({ user, params }) => { need(user, 401, "Giriş yapın"); const a = ownApp(user, params.id); q("DELETE FROM apps WHERE id=?").run(a.id); return { ok: true }; });
route("POST", "/api/apps/:id/publish", ({ user, body, params }) => {
  need(user, 401, "Giriş yapın"); const a = ownApp(user, params.id);
  let slug = a.slug;
  if (!slug) { const base = slugify(body.slug || a.title); slug = base; let i = 2; while (q("SELECT 1 FROM apps WHERE slug=?").get(slug)) slug = base + "-" + i++; }
  const listed = body.listed ? 1 : 0; const price = Math.max(0, Math.min(100000, Math.round(+body.price || 0)));
  q("UPDATE apps SET slug=?, status='published', listed=?, price=?, published_at=COALESCE(published_at,?), updated=? WHERE id=?").run(slug, listed, price, now(), now(), a.id);
  return { app: appRow(q("SELECT * FROM apps WHERE id=?").get(a.id)) };
});
route("POST", "/api/apps/:id/unpublish", ({ user, params }) => { need(user, 401, "Giriş yapın"); const a = ownApp(user, params.id); q("UPDATE apps SET status='draft', listed=0 WHERE id=?").run(a.id); return { ok: true }; });
route("POST", "/api/apps/:id/github", async ({ user, params }) => {
  need(user, 401, "Giriş yapın"); const a = ownApp(user, params.id);
  need(user.github_token, 412, "Önce GitHub hesabınızı bağlayın");
  const name = "gitmapp-" + (a.slug || slugify(a.title)); const login = user.github_login;
  let repo = await ghApi(user.github_token, "GET", `/repos/${login}/${name}`);
  if (repo.status === 404) { repo = await ghApi(user.github_token, "POST", "/user/repos", { name, description: (a.title + " — Gitmapp ile yapıldı").slice(0, 300), homepage: a.slug ? `https://${CFG.appHost}/${a.slug}` : undefined, auto_init: false }); need(repo.ok, 502, "GitHub deposu oluşturulamadı: " + (repo.data && repo.data.message)); }
  const ex = await ghApi(user.github_token, "GET", `/repos/${login}/${name}/contents/index.html`);
  const put = await ghApi(user.github_token, "PUT", `/repos/${login}/${name}/contents/index.html`, { message: "Gitmapp: uygulama güncellendi", content: Buffer.from(a.html).toString("base64"), ...(ex.ok ? { sha: ex.data.sha } : {}) });
  need(put.ok, 502, "Dosya GitHub'a yüklenemedi: " + (put.data && put.data.message));
  const branch = (await ghApi(user.github_token, "GET", `/repos/${login}/${name}`)).data?.default_branch || "main";
  const pages = await ghApi(user.github_token, "POST", `/repos/${login}/${name}/pages`, { source: { branch, path: "/" } });
  const okPages = pages.ok || pages.status === 409; const pagesUrl = `https://${login}.github.io/${name}/`;
  q("UPDATE apps SET github_repo=?, pages_url=? WHERE id=?").run(`https://github.com/${login}/${name}`, okPages ? pagesUrl : null, a.id);
  return { repo: `https://github.com/${login}/${name}`, pages_url: okPages ? pagesUrl : null, pages_note: okPages ? null : "GitHub Pages otomatik açılamadı; depo Ayarlar → Pages'ten açılabilir." };
});

// Mağaza
route("GET", "/api/store", ({ url }) => {
  const cat = url.searchParams.get("cat"); const s = (url.searchParams.get("q") || "").trim().slice(0, 60); const sort = url.searchParams.get("sort") === "yeni" ? "a.published_at DESC" : "a.downloads DESC, a.opens DESC";
  let sql = "SELECT a.*, u.name AS author FROM apps a JOIN users u ON u.id=a.owner_id WHERE a.status='published' AND a.listed=1"; const args = [];
  if (cat && CATS.includes(cat)) { sql += " AND a.category=?"; args.push(cat); }
  if (s) { sql += " AND (a.title LIKE ? OR a.description LIKE ?)"; args.push("%" + s + "%", "%" + s + "%"); }
  return { apps: q(sql + ` ORDER BY ${sort} LIMIT 100`).all(...args).map((a) => ({ ...appRow(a), author: a.author || "Gitmapp kullanıcısı" })) };
});
route("GET", "/api/store/:slug", ({ params }) => { const a = q("SELECT a.*, u.name AS author FROM apps a JOIN users u ON u.id=a.owner_id WHERE a.slug=? AND a.status='published' AND a.listed=1").get(params.slug); need(a, 404, "Uygulama bulunamadı"); return { app: { ...appRow(a), author: a.author || "Gitmapp kullanıcısı" } }; });
route("POST", "/api/store/:slug/download", ({ params }) => { q("UPDATE apps SET downloads=downloads+1 WHERE slug=? AND status='published'").run(params.slug); return { ok: true }; });
route("POST", "/api/store/:slug/remix", ({ user, params }) => {
  need(user, 401, "Kopyalamak için giriş yapın"); const a = q("SELECT * FROM apps WHERE slug=? AND status='published' AND listed=1").get(params.slug); need(a, 404, "Uygulama bulunamadı");
  need(!a.price || a.owner_id === user.id, 402, "Bu ücretli bir uygulama; kopyalamak için satın alma yakında açılacak.");
  const id = rid(); q("INSERT INTO apps(id,owner_id,title,description,category,emoji,color,html) VALUES(?,?,?,?,?,?,?,?)").run(id, user.id, (a.title + " (kopya)").slice(0, 80), a.description, a.category, a.emoji, a.color, a.html);
  return { app: appRow(q("SELECT * FROM apps WHERE id=?").get(id), true) };
});

// Alan adı
route("GET", "/api/domain/check", async ({ url }) => {
  need(CFG.hostingerToken, 503, "Alan adı sorgusu henüz yapılandırılmadı");
  const name = (url.searchParams.get("name") || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(".")[0].replace(/[^a-z0-9-]/g, "").slice(0, 63);
  need(name.length >= 2, 400, "Geçerli bir ad girin");
  const r = await fetch("https://developers.hostinger.com/api/domains/v1/availability", { method: "POST", headers: { Authorization: "Bearer " + CFG.hostingerToken, "Content-Type": "application/json" }, body: JSON.stringify({ domain: name, tlds: ["com", "com.tr", "net", "app", "online"] }) });
  const j = await r.json().catch(() => null); need(r.ok && Array.isArray(j), 502, "Alan adı sorgulanamadı");
  return { results: j.map((d) => ({ domain: d.domain, available: !!d.is_available, premium: !!d.is_premium, restriction: d.restriction })) };
});

// Siparişler
const ORDER_ST = ["Yeni talep", "Teklif gönderildi", "Ödeme alındı", "Geliştiriliyor", "Test", "Web'de yayında", "Mağazaya gönderildi", "Mağazada", "İptal"];
route("POST", "/api/orders", ({ body, user }) => {
  const id = str(body.id, 30, "Sipariş no", true); need(/^GM-[A-Z0-9]{4,20}$/.test(id), 400, "Sipariş no geçersiz");
  const name = str(body.name, 120, "Ad", true); const phone = str(body.phone, 30, "Telefon"); const email = str(body.email, 200, "E-posta");
  need(phone || email, 400, "Telefon veya e-posta gerekli");
  const data = JSON.stringify(body); need(data.length < 20000, 400, "Talep çok büyük");
  need(!q("SELECT 1 FROM orders WHERE id=?").get(id), 409, "Bu sipariş zaten kayıtlı");
  q("INSERT INTO orders(id,user_id,data,customer_name,phone,email,brand,total,monthly) VALUES(?,?,?,?,?,?,?,?,?)").run(id, user ? user.id : null, data, name, phone, email, str(body.brand, 120, "Marka") || "", +body.total || 0, +body.monthly || 0);
  return { ok: true, id };
});
route("GET", "/api/orders/status", ({ url }) => {
  const id = (url.searchParams.get("id") || "").trim().toUpperCase(); const c = (url.searchParams.get("contact") || "").trim(); need(id && c, 400, "Sipariş no ve iletişim bilgisi gerekli");
  const o = q("SELECT * FROM orders WHERE id=?").get(id); const digits = (s) => String(s || "").replace(/\D/g, "");
  const ok = o && ((o.phone && digits(c).length >= 7 && digits(o.phone).endsWith(digits(c).slice(-10))) || (o.email && o.email.toLowerCase() === c.toLowerCase()));
  return { order: ok ? { id: o.id, brand: o.brand, status: o.status, live_url: o.live_url, created: o.created, total: o.total } : null };
});
route("GET", "/api/admin/orders", ({ user }) => { need(isAdmin(user), 403, "Yönetici yetkisi gerekli"); return { orders: q("SELECT * FROM orders ORDER BY created DESC LIMIT 500").all().map((o) => ({ ...JSON.parse(o.data), id: o.id, status: o.status, live: o.live_url || "", created: o.created })) }; });
route("PATCH", "/api/admin/orders/:id", ({ user, params, body }) => {
  need(isAdmin(user), 403, "Yönetici yetkisi gerekli"); if (body.status) need(ORDER_ST.includes(body.status), 400, "Durum geçersiz");
  q("UPDATE orders SET status=COALESCE(?,status), live_url=COALESCE(?,live_url), updated=? WHERE id=?").run(body.status || null, body.live !== undefined ? str(body.live, 500, "URL") || "" : null, now(), params.id); return { ok: true };
});
route("DELETE", "/api/admin/orders/:id", ({ user, params }) => { need(isAdmin(user), 403, "Yönetici yetkisi gerekli"); q("DELETE FROM orders WHERE id=?").run(params.id); return { ok: true }; });

// Talep radarı
const EV = ["search", "category_view", "app_view", "app_want", "wizard_submit", "radar_search", "studio_prompt", "store_view", "store_open"];
route("POST", "/api/events", ({ body, user }) => {
  need(EV.includes(body.type), 400, "Olay türü geçersiz");
  q("INSERT INTO events(session_id,user_id,type,query,category,repo,meta) VALUES(?,?,?,?,?,?,?)").run(str(body.session_id, 64, "Oturum"), user ? user.id : null, body.type, str(body.query, 200, "Sorgu"), str(body.category, 60, "Kategori"), str(body.repo, 200, "Depo"), body.meta ? JSON.stringify(body.meta).slice(0, 4000) : null);
  return { ok: true };
});
route("GET", "/api/admin/radar", ({ user, url }) => {
  need(isAdmin(user), 403, "Yönetici yetkisi gerekli"); const d = Math.max(1, Math.min(365, Math.floor(+(url.searchParams.get("days") || 7)) || 7)); const since = `datetime('now','-${d} days')`;
  const rows = [
    ...q(`SELECT 'kategori' kind, category label, COUNT(*) hits FROM events WHERE type='category_view' AND created>${since} AND category IS NOT NULL GROUP BY category`).all(),
    ...q(`SELECT 'arama' kind, LOWER(TRIM(query)) label, COUNT(*) hits FROM events WHERE type IN ('search','radar_search') AND created>${since} AND TRIM(COALESCE(query,''))<>'' GROUP BY LOWER(TRIM(query))`).all(),
    ...q(`SELECT 'uygulama' kind, repo label, COUNT(*) hits FROM events WHERE type IN ('app_view','app_want','store_open') AND created>${since} AND repo IS NOT NULL GROUP BY repo`).all(),
    ...q(`SELECT 'fikir' kind, SUBSTR(query,1,120) label, COUNT(*) hits FROM events WHERE type='studio_prompt' AND created>${since} AND TRIM(COALESCE(query,''))<>'' GROUP BY SUBSTR(query,1,120)`).all(),
  ].sort((a, b) => b.hits - a.hits);
  const stats = { users: q("SELECT COUNT(*) n FROM users").get().n, apps: q("SELECT COUNT(*) n FROM apps").get().n, published: q("SELECT COUNT(*) n FROM apps WHERE status='published'").get().n, listed: q("SELECT COUNT(*) n FROM apps WHERE listed=1").get().n };
  return { rows: rows.slice(0, 120), stats };
});

// ---------- Sunucu ----------
async function readBody(req) {
  return new Promise((ok, bad) => { let n = 0; const ch = []; req.on("data", (c) => { n += c.length; if (n > 2_000_000) { bad(new HttpErr(413, "İstek çok büyük")); req.destroy(); } else ch.push(c); }); req.on("end", () => { if (!ch.length) return ok({}); try { const v = JSON.parse(Buffer.concat(ch).toString()); ok(v && typeof v === "object" ? v : {}); } catch { bad(new HttpErr(400, "Geçersiz JSON")); } }); req.on("error", bad); });
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(":")[0];
  if (host === CFG.appHost && !url.pathname.startsWith("/api/")) { try { return serveApp(req, res, url); } catch (e) { console.error(e); res.writeHead(500); return res.end(); } }
  const origin = req.headers.origin;
  const cors = origin && CFG.cors.includes(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "Access-Control-Max-Age": "600" } : {};
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  const send = (code, obj) => { if (res.headersSent) return; res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", ...cors }); res.end(JSON.stringify(obj)); };
  try {
    const r = routes.find((r) => r.m === req.method && r.re.test(url.pathname));
    if (!r) return send(404, { error: "Bulunamadı" });
    const params = url.pathname.match(r.re).groups || {};
    const body = ["POST", "PUT", "PATCH"].includes(req.method) ? await readBody(req) : {};
    const out = await r.fn({ req, res, url, params, body, user: authUser(req) });
    if (out !== null && out !== undefined) send(200, out);
  } catch (e) {
    if (e instanceof HttpErr) send(e.code, { error: e.message });
    else { console.error(new Date().toISOString(), req.method, url.pathname, e); send(e.name === "TimeoutError" ? 504 : 500, { error: e.name === "TimeoutError" ? "Yapay zekâ yanıtı gecikti, tekrar deneyin." : "Sunucu hatası" }); }
  }
});

// CLI: ADMIN_EMAIL ortam değişkeniyle: node server.mjs create-admin
if (process.argv[2] === "create-admin") {
  if (!CFG.admin) { console.error("ADMIN_EMAIL ortam değişkeni tanımlı değil."); process.exit(1); }
  const pw = crypto.randomBytes(9).toString("base64url");
  const u = q("SELECT * FROM users WHERE email=?").get(CFG.admin);
  if (u) q("UPDATE users SET pass=?, email_verified=1 WHERE id=?").run(hashPw(pw), u.id);
  else q("INSERT INTO users(id,email,name,pass,email_verified) VALUES(?,?,?,?,1)").run(rid(), CFG.admin, "Yönetici", hashPw(pw));
  console.log(`Yönetici hesabı hazır: ${CFG.admin}\nŞifre: ${pw}\n(Bu şifreyi güvenli bir yere kaydedin.)`);
  process.exit(0);
}
server.listen(CFG.port, "127.0.0.1", () => console.log(`Gitmapp API :${CFG.port} — AI:${!!CFG.aiKey} GitHub:${!!CFG.gh.id} Google:${!!CFG.google.id} Alan adı:${!!CFG.hostingerToken}`));

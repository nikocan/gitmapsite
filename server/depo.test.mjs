import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sniff, classify, blocks, srcsetBest, theme, zip, makeFetcher } from "./depo.mjs";

const server = fileURLToPath(new URL("server.mjs", import.meta.url));

// Gerçek imzalı küçük görseller
function png(w, h) { const b = Buffer.alloc(64); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); b.writeUInt32BE(13, 8); b.write("IHDR", 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); crypto.randomBytes(30).copy(b, 30); return b; }
function jpg(w, h) { const b = Buffer.alloc(200); b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[3] = 0xc0; b.writeUInt16BE(17, 4); b[6] = 8; b.writeUInt16BE(h, 7); b.writeUInt16BE(w, 9); crypto.randomBytes(80).copy(b, 100); return b; }

async function fakeSite() {
  const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="48" viewBox="0 0 180 48"><rect width="180" height="48" fill="#e11d48"/><script>alert(1)</script></svg>`;
  const files = {
    "/": ["text/html", `<!doctype html><html><head><title>Lezzet Durağı | Restoran</title><meta name="description" content="Ev yemekleri"><meta name="theme-color" content="#e11d48">
      <meta property="og:image" content="/img/paylas.jpg"><link rel="icon" href="/favicon.png"><link rel="stylesheet" href="/site.css"><script>window.x=1</script></head>
      <body><header class="site-header"><a href="/"><img src="/img/marka.svg" alt="Lezzet Durağı"></a>
      <nav><a href="/menu">Menü</a><a href="/hakkimizda">Hakkımızda</a><a href="/iletisim">İletişim</a><a href="https://dis.example/x">Dış</a></nav></header>
      <section class="hero"><h1>Hoş geldiniz</h1><img src="/img/kapak.jpg" alt="Kapak" onclick="steal()"></section>
      <section class="products"><h2>Ürünler</h2><div class="card"><img data-src="/img/u1.jpg" alt="Kebap"></div><div class="card"><img srcset="/img/u2-small.jpg 300w, /img/u2.jpg 600w" alt="Pide"></div></section>
      <img src="/img/pixel.png"><footer><p>© Lezzet</p><p>Adres bilgisi ve iletişim satırı burada yer alıyor, yeterince uzun bir alt bilgi.</p></footer></body></html>`],
    "/menu": ["text/html", `<html><head><title>Menü</title></head><body><h1>Menü</h1><img src="/img/u1.jpg"><img src="/img/ekip-avatar.jpg" alt="Şefimiz"></body></html>`],
    "/hakkimizda": ["text/html", `<html><head><title>Hakkımızda</title></head><body><h1>Biz</h1></body></html>`],
    "/iletisim": ["text/html", `<html><body>gizli</body></html>`],
    "/robots.txt": ["text/plain", "User-agent: *\nDisallow: /iletisim\n"],
    "/site.css": ["text/css", `:root{--ana:#e11d48}body{font-family:"Poppins",sans-serif;color:#111111;background:#ffffff}.hero{background:url(/img/desen.png)}a{color:#e11d48}.btn{background:#0ea5e9}`],
    "/favicon.png": ["image/png", png(32, 32)],
    "/img/marka.svg": ["image/svg+xml", logo],
    "/img/paylas.jpg": ["image/jpeg", jpg(1200, 630)],
    "/img/kapak.jpg": ["image/jpeg", jpg(1920, 800)],
    "/img/u1.jpg": ["image/jpeg", jpg(500, 500)],
    "/img/u2.jpg": ["image/jpeg", jpg(600, 600)],
    "/img/ekip-avatar.jpg": ["image/jpeg", jpg(400, 400)],
    "/img/desen.png": ["image/png", png(64, 64)],
    "/img/pixel.png": ["image/png", png(1, 1)],
  };
  const hits = [];
  const s = http.createServer((req, res) => {
    hits.push(req.url); const f = files[req.url.split("?")[0]];
    if (!f) { res.writeHead(404); return res.end("yok"); }
    const body = Buffer.isBuffer(f[1]) ? f[1] : Buffer.from(f[1]);
    if (f[0] === "text/css") { res.writeHead(200, { "Content-Type": f[0], "Content-Encoding": "gzip" }); return res.end(zlib.gzipSync(body)); }
    res.writeHead(200, { "Content-Type": f[0] }); res.end(body);
  });
  s.listen(0, "127.0.0.1"); await once(s, "listening");
  return { base: "http://127.0.0.1:" + s.address().port, hits, close: () => s.close() };
}

async function fixture(t, extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), "gitmapp-depo-"));
  const env = { ...process.env, PORT: "0", DB_PATH: join(dir, "db"), DEPO_DIR: join(dir, "depo"), ADMIN_EMAIL: "owner@example.test", SECRET: crypto.randomBytes(32).toString("hex"), GITHUB_CLIENT_ID: "", GOOGLE_CLIENT_ID: "", API_URL: "http://api.test", ...extra };
  const child = spawn(process.execPath, [server], { env, stdio: ["ignore", "pipe", "inherit"] });
  t.after(async () => { if (child.exitCode === null) { const end = once(child, "exit"); child.kill(); await end; } rmSync(dir, { recursive: true, force: true }); });
  const port = (await once(child.stdout, "data"))[0].toString().match(/API :(\d+)/)[1];
  const base = "http://127.0.0.1:" + port;
  const raw = (method, p, body, token) => fetch(base + "/api/" + p, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body == null ? undefined : JSON.stringify(body) });
  const req = async (...a) => { const r = await raw(...a); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
  const token = (await req("POST", "auth/register", { email: "u" + crypto.randomBytes(3).toString("hex") + "@example.test", password: "parola1234" })).token;
  return { base, req, raw, token };
}

test("dosya imzası, ayrıştırma, srcset, blok ve tema yardımcıları", () => {
  assert.deepEqual([sniff(png(10, 20)).mime, sniff(png(10, 20)).w, sniff(png(10, 20)).h], ["image/png", 10, 20]);
  assert.deepEqual([sniff(jpg(640, 480)).w, sniff(jpg(640, 480)).h], [640, 480]);
  assert.equal(sniff(Buffer.from("<!doctype html><html><body>404</body></html>")), null);
  assert.equal(sniff(Buffer.from('<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>')).w, 24);
  assert.equal(classify({ url: "https://a.com/logo-dark.svg", w: 200, h: 50 }), "logo");
  assert.equal(classify({ url: "https://a.com/x.jpg", w: 1920, h: 700 }), "banner");
  assert.equal(classify({ url: "https://a.com/x.jpg", w: 500, h: 480 }), "urun");
  assert.equal(classify({ url: "https://a.com/x.png", w: 24, h: 24 }), "ikon");
  assert.equal(classify({ url: "https://a.com/x.jpg", alt: "Ekibimiz", ctx: "team", w: 400, h: 400 }), "kisi");
  assert.equal(srcsetBest("a.jpg 300w, b.jpg 900w, c.jpg 600w", "https://x.com/"), "https://x.com/b.jpg");
  const b = blocks("<section>a<section>b</section></section><section>c</section>", "section");
  assert.equal(b.length, 2); assert.equal(b[0].html, "<section>a<section>b</section></section>");
  const th = theme("a{color:#e11d48}b{color:#e11d48;background:#fff}p{color:#111;font-family:'Inter',sans-serif}", "");
  assert.equal(th.roles.primary, "#e11d48"); assert.equal(th.roles.background, "#ffffff"); assert.equal(th.fonts[0].name, "Inter");
  const z = zip([{ name: "a.txt", data: "merhaba" }]); assert.equal(z.readUInt32LE(0), 0x04034b50); assert.equal(z.readUInt32LE(z.length - 22), 0x06054b50);
});

test("iç ağ adresleri engellenir", async () => {
  const get = makeFetcher({ allowLocal: false });
  for (const u of ["http://127.0.0.1/", "http://169.254.169.254/latest", "http://[::1]/", "http://localhost/", "file:///etc/passwd"]) await assert.rejects(get(u));
});

test("API: iç ağ taraması reddedilir, onay gerekir, giriş zorunlu", async (t) => {
  const { req, token } = await fixture(t);
  assert.equal((await req("POST", "depo/scan", { url: "https://example.com", consent: true })).status, 401);
  assert.equal((await req("POST", "depo/scan", { url: "example.com" }, token)).status, 400);
  const r = await req("POST", "depo/scan", { url: "http://127.0.0.1:9/", consent: true }, token);
  assert.equal(r.status, 400); assert.match(r.error, /iç ağ|geçerli/i);
});

test("API: site taranır, görseller ayrıştırılır, kopya/bileşen/şablon/ZIP üretilir", async (t) => {
  const site = await fakeSite(); t.after(site.close);
  const { req, raw, token, base } = await fixture(t, { DEPO_ALLOW_LOCAL: "1" });
  const start = await req("POST", "depo/scan", { url: site.base + "/", consent: true, maxPages: 5 }, token);
  assert.equal(start.status, 200, start.error); const id = start.site.id;
  let s; for (let i = 0; i < 100; i++) { s = (await req("GET", "depo/sites/" + id, null, token)).site; if (s.status !== "taraniyor") break; await new Promise((r) => setTimeout(r, 100)); }
  assert.equal(s.status, "hazir", s.error);
  // Menü kategorileri (dış bağlantı hariç) ve robots.txt'e uyum
  assert.deepEqual(s.categories.map((c) => c.name), ["Menü", "Hakkımızda", "İletişim"]);
  assert.ok(!site.hits.includes("/iletisim"), "robots.txt ile yasaklanan sayfa taranmamalı");
  assert.ok(s.pages.some((p) => p.title === "Menü"));
  // Ayrıştırma
  const cat = (n) => s.assets.find((a) => a.name.startsWith(n))?.category;
  assert.equal(cat("marka"), "logo"); assert.equal(cat("kapak"), "banner"); assert.equal(cat("paylas"), "sosyal");
  assert.equal(cat("favicon"), "ikon"); assert.equal(cat("u1"), "urun"); assert.equal(cat("ekip-avatar"), "kisi"); assert.equal(cat("desen"), "arkaplan");
  assert.ok(s.assets.some((a) => a.name.startsWith("u2.")), "srcset içindeki en büyük görsel alınmalı");
  assert.ok(!s.assets.some((a) => a.name.startsWith("pixel")), "takip pikseli atılmalı");
  assert.equal(s.assets.filter((a) => a.name.startsWith("u1")).length, 1, "aynı görsel tekrar kaydedilmemeli");
  assert.equal(s.theme.roles.primary, "#e11d48"); assert.equal(s.theme.fonts[0].name, "Poppins"); assert.match(s.themeCss, /--renk-ana:#e11d48/);
  // Dosya herkese açık sunulur, SVG korumalı
  const logo = s.assets.find((a) => a.category === "logo"); assert.ok(logo.url.startsWith("http://api.test/api/depo/f/"));
  const f = await fetch(base + logo.url.replace("http://api.test", "")); assert.equal(f.status, 200); assert.equal(f.headers.get("content-type"), "image/svg+xml"); assert.match(f.headers.get("content-security-policy"), /sandbox/);
  // Ekran kopyası: betik ve olay öznitelikleri çıkarılmış, görseller depoya yönlenmiş, CSS gömülü
  const clone = (await req("GET", "depo/sites/" + id + "/clone", null, token)).html;
  assert.ok(!/<script/i.test(clone) && !/onclick/i.test(clone)); assert.match(clone, /api\/depo\/f\//); assert.match(clone, /font-family:"Poppins"/);
  // Bileşenler
  assert.ok(s.components.some((c) => c.kind === "ust") && s.components.some((c) => c.kind === "kapak") && s.components.some((c) => c.kind === "alt"));
  const comp = await req("GET", "depo/sites/" + id + "/components/" + s.components[0].id, null, token); assert.match(comp.page, /^<!doctype html>/);
  // Şablon
  const tpl = await req("POST", "depo/sites/" + id + "/template", {}, token); assert.match(tpl.html, /--renk-ana:#e11d48/); assert.match(tpl.html, new RegExp(logo.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))); assert.equal(tpl.title, "Lezzet Durağı");
  // Elle kategori değiştirme
  const u1 = s.assets.find((a) => a.name.startsWith("u1")); assert.equal((await req("PATCH", "depo/assets/" + u1.id, { category: "galeri" }, token)).asset.category, "galeri");
  // ZIP
  const z = await raw("GET", "depo/sites/" + id + "/zip", null, token); const zb = Buffer.from(await z.arrayBuffer());
  assert.equal(z.headers.get("content-type"), "application/zip"); assert.equal(zb.readUInt32LE(0), 0x04034b50); assert.ok(zb.includes("tema.css") && zb.includes("gorseller/logo/") && zb.includes("ekran-kopyasi.html"));
  // Başka kullanıcı erişemez
  const other = (await req("POST", "auth/register", { email: "b" + crypto.randomBytes(3).toString("hex") + "@example.test", password: "parola1234" })).token;
  assert.equal((await req("GET", "depo/sites/" + id, null, other)).status, 404);
  // Silme
  assert.equal((await req("DELETE", "depo/sites/" + id, null, token)).ok, true);
  assert.equal((await fetch(base + logo.url.replace("http://api.test", ""))).status, 404);
});

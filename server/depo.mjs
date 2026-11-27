// Gitmapp Depo — bir siteyi tarar; görselleri indirir ve ayrıştırır, menü kategorilerini, renk/yazı tipi temasını,
// ana sayfanın kopyasını ve bölüm bileşenlerini çıkarır. Harici bağımlılık yok.
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import net from "node:net";
import zlib from "node:zlib";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DEPO_CATS = {
  logo: "Logo", ikon: "İkon", banner: "Banner / Kapak", urun: "Ürün / Kart", galeri: "Galeri / Fotoğraf",
  kisi: "Kişi / Ekip", arkaplan: "Arka plan", sosyal: "Paylaşım görseli", diger: "Diğer",
};
const LIMITS = { pages: 25, assets: 400, asset: 10_000_000, total: 200_000_000, page: 4_000_000, css: 1_500_000, cssFiles: 10 };
const UA = "Mozilla/5.0 (compatible; GitmappDepo/1.0; +https://gitmapp.com)";

// ---------- Güvenli indirme: yalnız http(s), iç ağ adresleri ve DNS yeniden bağlama engellenir ----------
export const privIp = (ip) => /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|22[4-9]\.|2[3-5]\d\.)/.test(ip) || /^(::1?$|f[cd]|fe[89ab]|::ffff:(127|10|0|192\.168|169\.254|172\.(1[6-9]|2\d|3[01]))\.)/i.test(ip);
export function makeFetcher({ allowLocal = false } = {}) {
  const lookup = (host, opts, cb) => {
    if (typeof opts === "function") { cb = opts; opts = {}; }
    dns.lookup(host, { all: true }, (err, addrs) => {
      if (err) return cb(err);
      if (!allowLocal && addrs.some((a) => privIp(a.address))) return cb(Object.assign(new Error("İç ağ adresine erişilemez"), { code: "EPRIVATE" }));
      if (opts && opts.all) return cb(null, addrs);
      cb(null, addrs[0].address, addrs[0].family);
    });
  };
  const once = (u, max, accept) => new Promise((ok, bad) => {
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.get(u, { lookup, timeout: 15000, headers: { "User-Agent": UA, Accept: accept || "*/*", "Accept-Encoding": "gzip, deflate, br", "Accept-Language": "tr,en;q=0.8" } }, (res) => {
      const st = res.statusCode || 0;
      if (st >= 300 && st < 400 && res.headers.location) { res.resume(); return ok({ redirect: res.headers.location, status: st }); }
      const enc = String(res.headers["content-encoding"] || "").toLowerCase();
      const stream = enc === "gzip" ? res.pipe(zlib.createGunzip()) : enc === "deflate" ? res.pipe(zlib.createInflate()) : enc === "br" ? res.pipe(zlib.createBrotliDecompress()) : res;
      const ch = []; let n = 0;
      stream.on("data", (c) => { n += c.length; if (n > max) { req.destroy(); bad(Object.assign(new Error("Dosya çok büyük"), { code: "EBIG" })); } else ch.push(c); });
      stream.on("end", () => ok({ status: st, type: String(res.headers["content-type"] || "").split(";")[0].trim().toLowerCase(), buf: Buffer.concat(ch) }));
      stream.on("error", bad);
    });
    req.on("timeout", () => req.destroy(new Error("Zaman aşımı")));
    req.on("error", bad);
  });
  return async function get(url, { max = LIMITS.asset, accept } = {}) {
    let u = typeof url === "string" ? new URL(url) : url;
    for (let hop = 0; hop < 6; hop++) {
      if (!/^https?:$/.test(u.protocol)) throw new Error("Yalnızca http/https adresleri");
      if (u.username || u.password) throw new Error("Adreste kullanıcı adı/şifre olamaz");
      const host = u.hostname.replace(/^\[|\]$/g, "");
      if (net.isIP(host) && !allowLocal && privIp(host)) throw Object.assign(new Error("İç ağ adresine erişilemez"), { code: "EPRIVATE" });
      if (!allowLocal && /^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw Object.assign(new Error("İç ağ adresine erişilemez"), { code: "EPRIVATE" });
      const r = await once(u, max, accept);
      if (r.redirect) { u = new URL(r.redirect, u); continue; }
      return { ...r, url: u.href };
    }
    throw new Error("Çok fazla yönlendirme");
  };
}

// ---------- HTML / CSS yardımcıları ----------
const ENT = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
export const decode = (s) => String(s || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m);
export function attrs(tag) {
  const o = {}; const re = /([^\s=/<>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g; let m;
  const body = tag.replace(/^<\s*[\w:-]+/, "").replace(/\/?>$/, "");
  while ((m = re.exec(body))) o[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? "");
  return o;
}
const textOf = (h) => decode(String(h || "").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const abs = (u, base) => { try { const x = new URL(String(u).trim(), base); x.hash = ""; return /^https?:$/.test(x.protocol) ? x.href : (x.protocol === "data:" ? x.href : null); } catch { return null; } };
export function srcsetBest(v, base) {
  let best = null, score = -1;
  for (const part of String(v || "").split(/,\s+(?=\S)/)) {
    const [u, d = "1x"] = part.trim().split(/\s+/); const n = parseFloat(d) * (/w$/i.test(d) ? 1 : 1000);
    if (u && n > score) { score = n; best = abs(u, base); }
  }
  return best;
}
const cssUrls = (css, base) => [...String(css).matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)].map((m) => abs(m[2], base)).filter(Boolean);
// Aynı ada sahip etiketin dengeli (iç içe sayımlı) en dış bloklarını bulur
export function blocks(html, tag) {
  const out = []; const open = new RegExp("<" + tag + "\\b[^>]*>", "gi"); const any = new RegExp("<(/?)" + tag + "\\b[^>]*>", "gi"); let m;
  while ((m = open.exec(html))) {
    any.lastIndex = m.index; let depth = 0, end = -1, t;
    while ((t = any.exec(html))) { depth += t[1] ? -1 : 1; if (depth === 0) { end = any.lastIndex; break; } }
    if (end < 0) break;
    out.push({ start: m.index, end, html: html.slice(m.index, end) }); open.lastIndex = end;
  }
  return out;
}

// ---------- Görsel türü ve boyutu (dosya imzasından) ----------
export function sniff(buf) {
  const b = buf; if (!b || b.length < 12) return null;
  const s = (i, n) => b.toString("latin1", i, i + n);
  if (b[0] === 0x89 && s(1, 3) === "PNG") return { mime: "image/png", ext: "png", w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2; while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; } const mk = b[i + 1]; const len = b.readUInt16BE(i + 2);
      if ((mk >= 0xc0 && mk <= 0xcf) && ![0xc4, 0xc8, 0xcc].includes(mk)) return { mime: "image/jpeg", ext: "jpg", h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + len;
    }
    return { mime: "image/jpeg", ext: "jpg", w: 0, h: 0 };
  }
  if (s(0, 4) === "GIF8") return { mime: "image/gif", ext: "gif", w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
  if (s(0, 4) === "RIFF" && s(8, 4) === "WEBP") {
    const f = s(12, 4);
    if (f === "VP8X") return { mime: "image/webp", ext: "webp", w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (f === "VP8L") { const v = b.readUInt32LE(21); return { mime: "image/webp", ext: "webp", w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
    return { mime: "image/webp", ext: "webp", w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  }
  if (s(4, 4) === "ftyp" && /avi[fs]/.test(s(8, 4))) { const i = b.indexOf("ispe"); return { mime: "image/avif", ext: "avif", w: i > 0 ? b.readUInt32BE(i + 8) : 0, h: i > 0 ? b.readUInt32BE(i + 12) : 0 }; }
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return { mime: "image/x-icon", ext: "ico", w: b[6] || 256, h: b[7] || 256 };
  const head = b.toString("utf8", 0, Math.min(b.length, 2048));
  if (/<svg[\s>]/i.test(head) && !/<html[\s>]/i.test(head)) {
    const tag = (head.match(/<svg\b[^>]*>/i) || [""])[0]; const a = attrs(tag); const vb = String(a.viewbox || "").split(/[\s,]+/).map(Number);
    const px = (v) => /^[\d.]+(px)?$/.test(String(v || "")) ? Math.round(parseFloat(v)) : 0;
    return { mime: "image/svg+xml", ext: "svg", w: px(a.width) || Math.round(vb[2] || 0), h: px(a.height) || Math.round(vb[3] || 0) };
  }
  return null;
}

// ---------- Ayrıştırma: görselin rolünü bağlam, ad ve boyuttan tahmin eder ----------
export function classify(a) {
  const hint = (a.url + " " + (a.alt || "") + " " + (a.ctx || "")).toLowerCase(); const w = a.w || 0, h = a.h || 0, r = h ? w / h : 0;
  const has = (re) => re.test(hint);
  if (a.from === "icon") return "ikon";
  if (has(/logo|brand|marka|site-?title/)) return w && h && w <= 32 && h <= 32 ? "ikon" : "logo";
  if (a.from === "og") return "sosyal";
  if (a.from === "css" && !has(/\bicon|ikon|sprite|logo/)) return w >= 1000 && r >= 1.6 && has(/hero|banner|slider|cover|kapak/) ? "banner" : "arkaplan";
  if ((w && w <= 96 && h <= 96) || has(/\bicon|ikon|sprite|emoji|\bflag\b|bayrak/)) return "ikon";
  if (a.inHeader && a.mime === "image/svg+xml" && w <= 400) return "logo";
  if (has(/avatar|team|ekip|author|yazar|person|profile|profil|testimonial|yorum|staff|doktor|doctor|user/)) return "kisi";
  if (has(/hero|banner|slider|slide|carousel|cover|kapak|jumbotron|masthead/) || (w >= 1000 && r >= 1.6)) return "banner";
  if (a.from === "css" || has(/\bbg\b|background|arkaplan|pattern|texture|desen/)) return "arkaplan";
  if (has(/product|urun|ürün|card|kart|item|shop|magaza|mağaza|menu-?item|catalog|katalog|price|fiyat/) || (w >= 200 && w <= 1000 && r >= 0.7 && r <= 1.4)) return "urun";
  if (w >= 300 || h >= 300) return "galeri";
  return "diger";
}

// ---------- Renk ve yazı tipi teması ----------
const hex6 = (s) => { s = s.replace("#", "").toLowerCase(); return "#" + (s.length === 3 ? s.split("").map((c) => c + c).join("") : s.slice(0, 6)); };
const rgbHex = (r, g, b) => "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(+x))).toString(16).padStart(2, "0")).join("");
function hsl(hex) {
  const n = parseInt(hex.slice(1), 16); const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  return { s: d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), l };
}
export function theme(css, metaColor) {
  const count = new Map(); const vars = {}; const fonts = new Map();
  const add = (hx, n = 1) => count.set(hx, (count.get(hx) || 0) + n);
  for (const m of css.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b(?![0-9a-f])/gi)) add(hex6(m[1]));
  for (const m of css.matchAll(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)/gi)) { if (m[4] && parseFloat(m[4]) < (m[4].endsWith("%") ? 50 : 0.5)) continue; add(rgbHex(m[1], m[2], m[3])); }
  for (const m of css.matchAll(/(--[\w-]{2,40})\s*:\s*([^;}{]{1,80})/g)) { const v = m[2].trim(); if (/^#[0-9a-f]{3,8}$|^rgba?\(|^hsla?\(/i.test(v) && Object.keys(vars).length < 40) vars[m[1]] = v; }
  for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) { const f = m[1].split(",")[0].trim().replace(/^['"]|['"]$/g, ""); if (f && !/^(inherit|initial|unset|var\(|-apple-system|system-ui|sans-serif|serif|monospace|icon|font\w*awesome|fa-|glyph|swiper)/i.test(f) && f.length < 40) fonts.set(f, (fonts.get(f) || 0) + 1); }
  if (metaColor && /^#[0-9a-f]{3,6}$/i.test(metaColor)) add(hex6(metaColor), 25);
  const all = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([hex, n]) => ({ hex, n, ...hsl(hex) }));
  const vivid = all.filter((c) => c.s > 0.35 && c.l > 0.18 && c.l < 0.82);
  const light = all.filter((c) => c.l >= 0.9), dark = all.filter((c) => c.l <= 0.25);
  const primary = metaColor && /^#[0-9a-f]{3,6}$/i.test(metaColor) ? hex6(metaColor) : vivid[0]?.hex || "#5e5ce6";
  const roles = { primary, accent: vivid.find((c) => c.hex !== primary)?.hex || primary, background: light[0]?.hex || "#ffffff", text: dark[0]?.hex || "#111111", muted: all.find((c) => c.s < 0.15 && c.l > 0.35 && c.l < 0.75)?.hex || "#6b7280" };
  const fontList = [...fonts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, n]) => ({ name, n }));
  return { roles, palette: all.slice(0, 16).map(({ hex, n }) => ({ hex, n })), vars, fonts: fontList };
}
export function themeCss(t) {
  if (!t?.roles) return "";
  const f = t.fonts?.[0]?.name; const f2 = t.fonts?.[1]?.name;
  return `:root{\n  --renk-ana:${t.roles.primary};\n  --renk-vurgu:${t.roles.accent};\n  --renk-zemin:${t.roles.background};\n  --renk-metin:${t.roles.text};\n  --renk-soluk:${t.roles.muted};\n  --yazi-govde:${f ? `"${f}", ` : ""}system-ui, sans-serif;\n  --yazi-baslik:${f2 ? `"${f2}", ` : f ? `"${f}", ` : ""}system-ui, sans-serif;\n${(t.palette || []).slice(0, 10).map((c, i) => `  --palet-${i + 1}:${c.hex};`).join("\n")}\n}\n`;
}

// ---------- Bileşen türü ----------
function compKind(tag, h) {
  const low = h.slice(0, 4000).toLowerCase(); const imgs = (h.match(/<img\b/gi) || []).length;
  if (tag === "header" || tag === "nav") return "ust";
  if (tag === "footer") return "alt";
  if (/hero|banner|slider|carousel|jumbotron|masthead/.test(low.slice(0, 600))) return "kapak";
  if (/<form\b/.test(low) || /iletişim|contact|bize ulaş/.test(low)) return "iletisim";
  if (/fiyat|pricing|price|paket|plan\b|₺|\$\d/.test(low)) return "fiyat";
  if (/testimonial|yorum|referans|müşterilerimiz|review/.test(low)) return "yorum";
  if (/sss|faq|sıkça sorulan/.test(low)) return "sss";
  if (imgs >= 4) return "galeri";
  return "bolum";
}
export const COMP_KINDS = { ust: "Üst bölüm / Menü", kapak: "Kapak (Hero)", galeri: "Galeri / Kartlar", fiyat: "Fiyatlar", yorum: "Yorumlar", sss: "SSS", iletisim: "İletişim / Form", bolum: "Bölüm", alt: "Alt bilgi" };

// ---------- ZIP (sıkıştırmasız, STORE) ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function zip(files) {
  const parts = [], cen = []; let off = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8"); const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(String(f.data), "utf8"); const crc = crc32(data);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8); h.writeUInt32LE(0, 10); h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26); h.writeUInt16LE(0, 28);
    parts.push(h, name, data);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10); c.writeUInt32LE(0, 12); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(off, 42);
    cen.push(c, name); off += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(cen); const e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, e]);
}

// ---------- robots.txt (User-agent: * Disallow kuralları) ----------
function robotsRules(txt) {
  const rules = []; let on = false;
  for (const line of String(txt || "").split(/\r?\n/)) {
    const [k, ...r] = line.replace(/#.*/, "").split(":"); const v = r.join(":").trim(); const key = k.trim().toLowerCase();
    if (key === "user-agent") on = v === "*" || /gitmapp/i.test(v); else if (on && key === "disallow" && v) rules.push(v);
  }
  return (p) => !rules.some((r) => p.startsWith(r.replace(/\*.*$/, "")));
}

// ---------- Tarayıcı ----------
export async function crawl(start, { get, maxPages = 8, onProgress = () => { }, save }) {
  const origin = new URL(start); const host = origin.hostname.replace(/^www\./, "");
  const same = (u) => { try { return new URL(u).hostname.replace(/^www\./, "") === host; } catch { return false; } };
  let allowed = () => true;
  try { const r = await get(new URL("/robots.txt", origin).href, { max: 200_000 }); if (r.status === 200) allowed = robotsRules(r.buf.toString("utf8")); } catch { }
  const queue = [start], seen = new Set(), pages = [], cats = new Map(), cand = new Map(); let cssAll = ""; let metaColor = ""; let home = null;
  const want = (url, info) => {
    if (!url || cand.size >= LIMITS.assets * 2) return; const prev = cand.get(url);
    if (prev) { if (info.ctx && prev.ctx.length < 300) prev.ctx += " " + info.ctx; if (!prev.alt && info.alt) prev.alt = info.alt; if (info.from === "og" || info.from === "icon") prev.from = info.from; if (info.inHeader) prev.inHeader = true; return; }
    cand.set(url, { url, alt: "", ctx: "", page: info.page, from: "img", ...info });
  };
  while (queue.length && pages.length < Math.min(LIMITS.pages, maxPages)) {
    const url = queue.shift(); if (seen.has(url)) continue; seen.add(url);
    if (pages.length && !allowed(new URL(url).pathname)) continue;
    onProgress({ phase: "sayfa", page: url, pages: pages.length });
    let r; try { r = await get(url, { max: LIMITS.page, accept: "text/html,application/xhtml+xml" }); } catch (e) { if (!pages.length) throw e; continue; }
    if (r.status >= 400 || !/html/.test(r.type || "text/html")) { if (!pages.length) throw new Error("Sayfa açılamadı (HTTP " + r.status + ")"); continue; }
    const base0 = r.url; const raw = r.buf.toString("utf8");
    const baseTag = raw.match(/<base\b[^>]*>/i); const base = baseTag ? abs(attrs(baseTag[0]).href || "", base0) || base0 : base0;
    const title = textOf((raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").slice(0, 160);
    const metas = [...raw.matchAll(/<meta\b[^>]*>/gi)].map((m) => attrs(m[0]));
    const desc = (metas.find((m) => /^(description|og:description)$/i.test(m.name || m.property || ""))?.content || "").slice(0, 300);
    if (!metaColor) metaColor = metas.find((m) => /theme-color/i.test(m.name || ""))?.content || "";
    for (const m of metas) if (/^(og:image|og:image:url|twitter:image)$/i.test(m.property || m.name || "") && m.content) want(abs(m.content, base), { from: "og", page: url });
    const links = [...raw.matchAll(/<link\b[^>]*>/gi)].map((m) => attrs(m[0]));
    for (const l of links) if (/icon/i.test(l.rel || "") && l.href) want(abs(l.href, base), { from: "icon", page: url });
    // CSS: dış dosyalar + <style> + style=""
    let css = [...raw.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
    const cssFiles = [];
    for (const l of links.filter((l) => /stylesheet/i.test(l.rel || "") && l.href).slice(0, LIMITS.cssFiles)) {
      const cu = abs(l.href, base); if (!cu) continue;
      try { const c = await get(cu, { max: LIMITS.css, accept: "text/css" }); if (c.status < 400) { const t = c.buf.toString("utf8"); cssFiles.push({ url: c.url, css: t }); for (const u of cssUrls(t, c.url)) if (!/\.(woff2?|ttf|otf|eot)(\?|$)/i.test(u)) want(u, { from: "css", page: url, ctx: "background" }); } } catch { }
    }
    for (const u of cssUrls(css, base)) want(u, { from: "css", page: url, ctx: "background" });
    for (const m of raw.matchAll(/style\s*=\s*("([^"]*)"|'([^']*)')/gi)) for (const u of cssUrls(decode(m[2] ?? m[3]), base)) want(u, { from: "img", page: url, ctx: "background" });
    cssAll += "\n" + css + "\n" + cssFiles.map((c) => c.css).join("\n");
    // Üst bölüm sınırı (logo tespiti için)
    const hb = blocks(raw, "header")[0]; const headerEnd = hb ? hb.end : Math.min(raw.length, (raw.search(/<main\b|<section\b/i) + 1 || 1) - 1 || 0);
    // Görseller
    for (const m of raw.matchAll(/<(img|source|video|image)\b[^>]*>/gi)) {
      const a = attrs(m[0]); const ctx = [a.class, a.id, a.title, a["aria-label"]].filter(Boolean).join(" ");
      const near = raw.slice(Math.max(0, m.index - 260), m.index).match(/class\s*=\s*["']([^"']{1,120})["'][^<]*$/i)?.[1] || "";
      const info = { page: url, alt: (a.alt || "").slice(0, 160), ctx: (ctx + " " + near).slice(0, 300), inHeader: hb ? m.index >= hb.start && m.index < hb.end : m.index < headerEnd };
      const tag = m[1].toLowerCase();
      if (tag === "video") { if (a.poster) want(abs(a.poster, base), { ...info, ctx: info.ctx + " cover" }); continue; }
      const best = srcsetBest(a.srcset || a["data-srcset"], base);
      const src = abs(a["data-src"] || a["data-lazy-src"] || a["data-original"] || a.src || a.href || a["xlink:href"] || "", base);
      if (best) want(best, info); else if (src) want(src, info);
    }
    // Satır içi SVG (logo/ikon)
    let svgN = 0;
    for (const b of blocks(raw, "svg")) {
      if (svgN >= 40 || b.html.length > 60_000 || b.html.length < 80) continue; svgN++;
      const svg = /xmlns=/.test(b.html) ? b.html : b.html.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
      const a = attrs(b.html.match(/<svg\b[^>]*>/i)[0]);
      want("data:image/svg+xml;base64," + Buffer.from(svg).toString("base64"), { page: url, from: "inline", ctx: [a.class, a.id, a["aria-label"]].filter(Boolean).join(" "), inHeader: hb ? b.start >= hb.start && b.start < hb.end : b.start < headerEnd });
    }
    // Menü kategorileri: <nav> (yoksa <header>) içindeki bağlantılar
    const navs = blocks(raw, "nav"); const navHtml = (navs.length ? navs : hb ? [hb] : []).map((b) => b.html).join("\n");
    const linkRe = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
    for (const m of navHtml.matchAll(linkRe)) {
      const a = attrs(m[0].match(/<a\b[^>]*>/i)[0]); const href = abs(a.href || "", base); const text = textOf(m[1]) || a.title || a["aria-label"] || "";
      if (!href || href.startsWith("data:") || !same(href) || text.length < 2 || text.length > 40 || cats.size >= 60) continue;
      const key = text.toLocaleLowerCase("tr"); if (![...cats.values()].some((c) => c.key === key || c.url === href)) cats.set(href, { key, name: text, url: href, from: url });
    }
    // Taranacak iç sayfalar: önce menüdekiler
    const navLinks = [...cats.keys()];
    const bodyLinks = [...raw.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["']/gi)].map((m) => abs(decode(m[1]), base)).filter((u) => u && same(u) && !/\.(jpe?g|png|gif|webp|svg|pdf|zip|mp4|mp3|docx?|xlsx?)(\?|$)/i.test(u) && !/\/(wp-login|cart|sepet|login|giris|account|hesap|logout)\b/i.test(u));
    for (const u of [...navLinks, ...bodyLinks]) if (!seen.has(u) && !queue.includes(u) && queue.length < 200) queue.push(u);
    const page = { url, title, desc, h1: textOf((raw.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || "").slice(0, 160), images: 0 };
    pages.push(page);
    if (!home) home = { url, base, raw, cssFiles, css };
  }
  onProgress({ phase: "indirme", pages: pages.length, found: cand.size, saved: 0 });
  // İndir, imzadan doğrula, tekrarları ayıkla, ayrıştır
  const list = [...cand.values()].slice(0, LIMITS.assets); const bySha = new Map(); const saved = []; const urlMap = new Map(); let total = 0, idx = 0, done = 0;
  async function worker() {
    while (idx < list.length) {
      const a = list[idx++];
      try {
        let buf;
        if (a.url.startsWith("data:")) { const m = a.url.match(/^data:([^;,]+)?(;base64)?,(.*)$/s); if (!m) continue; buf = m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3])); }
        else { const r = await get(a.url, { max: LIMITS.asset, accept: "image/avif,image/webp,image/svg+xml,image/*,*/*;q=0.5" }); if (r.status >= 400) continue; buf = r.buf; }
        if (buf.length < 40 || total + buf.length > LIMITS.total) continue;
        const t = sniff(buf); if (!t) continue; if (t.w && t.h && t.w <= 2 && t.h <= 2) continue;
        const sha = crypto.createHash("sha256").update(buf).digest("hex");
        const dup = bySha.get(sha); if (dup) { urlMap.set(a.url, dup); continue; }
        total += buf.length;
        const item = { ...a, ...t, bytes: buf.length, sha };
        item.category = classify(item);
        const name = (a.url.startsWith("data:") ? "satir-ici" : decodeURIComponent(new URL(a.url).pathname.split("/").pop() || "gorsel")).replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[^\p{L}\p{N}_-]+/gu, "-").slice(0, 60) || "gorsel";
        item.name = name + "." + t.ext;
        const stored = await save(item, buf); bySha.set(sha, stored); urlMap.set(a.url, stored); saved.push(stored);
      } catch { } finally { done++; if (done % 5 === 0) onProgress({ phase: "indirme", pages: pages.length, found: list.length, saved: saved.length }); }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  for (const p of pages) p.images = saved.filter((s) => s.page === p.url).length;
  // Logo yoksa üst bölümdeki ilk uygun görsel logo sayılır
  if (!saved.some((s) => s.category === "logo")) { const l = saved.find((s) => s.inHeader && ["diger", "ikon", "galeri", "urun"].includes(s.category) && (!s.w || s.w >= 60)); if (l) l.category = "logo"; }
  const th = theme(cssAll, metaColor);
  th.logo = saved.find((s) => s.category === "logo")?.id || null;
  return { pages, categories: [...cats.values()].map(({ name, url }) => ({ name, url })), assets: saved, theme: th, home, urlMap };
}

// Ana sayfa kopyası: betikler ve olay öznitelikleri çıkarılır, CSS gömülür, görseller depodaki kopyalara yönlendirilir
export function buildClone(home, urlMap, fileUrl) {
  if (!home) return { html: "", head: "", comps: [] };
  const local = (u, base) => { const a = abs(u, base); if (!a) return u; const s = urlMap.get(a); return s ? fileUrl(s) : a; };
  const rewriteCss = (css, base) => css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, u) => /^data:/.test(u) ? m : `url("${local(u, base)}")`);
  let h = home.raw
    .replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi, "$1")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "").replace(/<(object|embed)\b[\s\S]*?(<\/\1>|\/?>)/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"')
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh[^>]*>/gi, "")
    .replace(/<base\b[^>]*>/gi, "");
  // Görsel öznitelikleri
  h = h.replace(/<(img|source|video)\b[^>]*>/gi, (tag) => tag
    .replace(/\s(data-src|data-lazy-src|data-original)\s*=\s*(["'])([^"']*)\2/gi, (m, k, q, v) => ` src="${local(decode(v), home.base)}"`)
    .replace(/\s(src|poster)\s*=\s*(["'])([^"']*)\2/gi, (m, k, q, v) => ` ${k}="${local(decode(v), home.base)}"`)
    .replace(/\s(srcset|data-srcset)\s*=\s*(["'])([^"']*)\2/gi, (m, k, q, v) => { const b = srcsetBest(decode(v), home.base); return b ? ` srcset="${local(b, home.base)}"` : ""; })
    .replace(/\sloading\s*=\s*(["'])lazy\1/gi, ""));
  h = h.replace(/style\s*=\s*"([^"]*)"/gi, (m, v) => `style="${rewriteCss(decode(v), home.base).replace(/"/g, "'")}"`);
  h = h.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (m, a, css) => `<style${a}>${rewriteCss(css, home.base)}</style>`);
  // Dış CSS dosyalarını yerine göm
  const inlined = new Set();
  h = h.replace(/<link\b[^>]*>/gi, (tag) => {
    const a = attrs(tag); if (!/stylesheet/i.test(a.rel || "")) return /icon|preconnect|preload/i.test(a.rel || "") && !/stylesheet/i.test(a.rel || "") ? "" : tag;
    const u = abs(a.href || "", home.base); const f = home.cssFiles.find((c) => c.url === u || c.url.split("?")[0] === String(u).split("?")[0]);
    if (!f) return u ? `<link rel="stylesheet" href="${u}">` : ""; inlined.add(f.url);
    return `<style data-kaynak="${u}">${rewriteCss(f.css, f.url)}</style>`;
  });
  // Diğer göreli bağlantılar özgün siteye çözülsün
  h = /<head\b[^>]*>/i.test(h) ? h.replace(/<head\b[^>]*>/i, (m) => `${m}<base href="${home.base}" target="_blank">`) : `<base href="${home.base}" target="_blank">` + h;
  const head = (h.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i) || [, ""])[1].replace(/<title[\s\S]*?<\/title>/i, "").replace(/<meta\b[^>]*>/gi, "");
  const body = (h.match(/<body\b[^>]*>([\s\S]*)<\/body>/i) || [, h])[1];
  // Bileşenler: en dış header/nav/section/footer blokları (sırayla)
  const found = [];
  for (const tag of ["header", "nav", "section", "footer", "aside", "form"]) for (const b of blocks(body, tag)) found.push({ ...b, tag });
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const comps = []; let last = -1;
  for (const b of found) {
    if (b.start < last) continue; last = b.end; if (b.html.length < 120 || b.html.length > 400_000) continue;
    const a = attrs(b.html.match(/^<[^>]+>/)[0]); const heading = textOf((b.html.match(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/i) || [])[1] || "").slice(0, 60);
    const kind = compKind(b.tag, b.html);
    comps.push({ id: "b" + (comps.length + 1), kind, tag: b.tag, name: heading || a.id || String(a.class || "").split(/\s+/)[0] || COMP_KINDS[kind], bytes: b.html.length, html: b.html });
    if (comps.length >= 40) break;
  }
  return { html: h, head, comps };
}

// ---------- Kayıt ve API ----------
export function registerDepo({ db, route, need, dir, allowLocal = false, publicBase = "" }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS depo_sites(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, url TEXT NOT NULL, host TEXT,
      title TEXT, status TEXT DEFAULT 'taraniyor', error TEXT, info TEXT DEFAULT '{}', created TEXT DEFAULT (datetime('now')), updated TEXT DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS depo_sites_user ON depo_sites(user_id, created);
    CREATE TABLE IF NOT EXISTS depo_assets(id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES depo_sites(id) ON DELETE CASCADE, file TEXT NOT NULL, name TEXT,
      src TEXT, page TEXT, mime TEXT, bytes INTEGER, w INTEGER, h INTEGER, sha TEXT, category TEXT, alt TEXT, tags TEXT DEFAULT '', created TEXT DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS depo_assets_site ON depo_assets(site_id, category);
  `);
  db.prepare("UPDATE depo_sites SET status='hata', error='Sunucu yeniden başladığı için tarama yarıda kaldı. Yeniden tarayın.' WHERE status='taraniyor'").run();
  const root = path.resolve(dir); fs.mkdirSync(root, { recursive: true });
  const get = makeFetcher({ allowLocal });
  const id = (n = 16) => crypto.randomBytes(n * 2).toString("base64url").replace(/[-_]/g, "").slice(0, n);
  const PROG = new Map();
  const fileUrl = (siteId, file) => publicBase + "/api/depo/f/" + siteId + "/" + file;
  const siteDir = (sid) => { need(/^[A-Za-z0-9]{8,32}$/.test(sid), 400, "Geçersiz depo"); return path.join(root, sid); };
  const ownSite = (user, sid) => { need(user, 401, "Depoyu kullanmak için giriş yapın."); const s = db.prepare("SELECT * FROM depo_sites WHERE id=?").get(sid); need(s && s.user_id === user.id, 404, "Depo bulunamadı"); return s; };
  const pubAsset = (a) => ({ id: a.id, name: a.name, url: fileUrl(a.site_id, a.file), src: a.src?.startsWith("data:") ? null : a.src, page: a.page, mime: a.mime, bytes: a.bytes, w: a.w, h: a.h, category: a.category, alt: a.alt || "", tags: a.tags || "" });
  const pubSite = (s, full = false) => {
    const info = JSON.parse(s.info || "{}"); const counts = Object.fromEntries(db.prepare("SELECT category, COUNT(*) n FROM depo_assets WHERE site_id=? GROUP BY category").all(s.id).map((r) => [r.category, r.n]));
    const cover = db.prepare("SELECT * FROM depo_assets WHERE site_id=? AND category IN ('sosyal','banner','galeri','urun') ORDER BY CASE category WHEN 'sosyal' THEN 0 WHEN 'banner' THEN 1 ELSE 2 END, bytes DESC LIMIT 1").get(s.id);
    const out = { id: s.id, url: s.url, host: s.host, title: s.title, status: s.status, error: s.error, created: s.created, updated: s.updated, counts, total: Object.values(counts).reduce((a, b) => a + b, 0), cover: cover ? fileUrl(s.id, cover.file) : null, progress: PROG.get(s.id) || null, logo: info.theme?.logo ? (() => { const a = db.prepare("SELECT * FROM depo_assets WHERE id=?").get(info.theme.logo); return a ? fileUrl(s.id, a.file) : null; })() : null };
    if (full) Object.assign(out, { pages: info.pages || [], categories: info.categories || [], theme: info.theme || null, themeCss: themeCss(info.theme), components: (info.components || []), hasClone: !!info.hasClone, assets: db.prepare("SELECT * FROM depo_assets WHERE site_id=? ORDER BY CASE category WHEN 'logo' THEN 0 WHEN 'banner' THEN 1 WHEN 'urun' THEN 2 WHEN 'galeri' THEN 3 ELSE 4 END, bytes DESC").all(s.id).map(pubAsset) });
    return out;
  };

  async function runScan(site, maxPages) {
    const d = siteDir(site.id); fs.mkdirSync(d, { recursive: true });
    const ins = db.prepare("INSERT INTO depo_assets(id,site_id,file,name,src,page,mime,bytes,w,h,sha,category,alt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)");
    try {
      const res = await crawl(site.url, {
        get, maxPages, onProgress: (p) => PROG.set(site.id, p),
        save: async (item, buf) => { const aid = id(12); const file = aid + "." + item.ext; await fs.promises.writeFile(path.join(d, file), buf); ins.run(aid, site.id, file, item.name, item.url.slice(0, 2000), item.page, item.mime, item.bytes, item.w || 0, item.h || 0, item.sha, item.category, item.alt || ""); return { ...item, id: aid, file }; },
      });
      PROG.set(site.id, { phase: "kopya", pages: res.pages.length, saved: res.assets.length });
      const clone = buildClone(res.home, res.urlMap, (s) => fileUrl(site.id, s.file));
      if (clone.html) { await fs.promises.writeFile(path.join(d, "kopya.html"), clone.html); await fs.promises.writeFile(path.join(d, "bas.html"), clone.head); await fs.promises.writeFile(path.join(d, "bilesenler.json"), JSON.stringify(clone.comps.map(({ id, html }) => ({ id, html })))); }
      const info = { pages: res.pages, categories: res.categories, theme: res.theme, hasClone: !!clone.html, components: clone.comps.map(({ html, ...c }) => c) };
      db.prepare("UPDATE depo_sites SET status='hazir', error=NULL, title=?, info=?, updated=datetime('now') WHERE id=?").run((res.pages[0]?.title || site.host).slice(0, 160), JSON.stringify(info), site.id);
    } catch (e) {
      db.prepare("UPDATE depo_sites SET status='hata', error=?, updated=datetime('now') WHERE id=?").run(e.code === "EPRIVATE" ? "Bu adres iç ağa ait; yalnızca herkese açık siteler taranabilir." : /ENOTFOUND|EAI_AGAIN/.test(e.code || e.message) ? "Alan adı bulunamadı. Adresi kontrol edin." : String(e.message || e).slice(0, 240), site.id);
    } finally { PROG.delete(site.id); }
  }

  route("POST", "/api/depo/scan", async ({ user, body }) => {
    need(user, 401, "Depoyu kullanmak için giriş yapın.");
    let raw = String(body.url || "").trim(); if (raw && !/^https?:\/\//i.test(raw)) raw = "https://" + raw;
    let u; try { u = new URL(raw); } catch { need(false, 400, "Geçerli bir site adresi girin (ör. ornek.com)"); }
    need(/^https?:$/.test(u.protocol) && u.hostname.includes(".") || allowLocal, 400, "Geçerli bir site adresi girin (ör. ornek.com)");
    need(body.consent === true, 400, "Bu sitedeki içerikleri kullanma hakkınız olduğunu onaylayın.");
    const running = db.prepare("SELECT COUNT(*) n FROM depo_sites WHERE user_id=? AND status='taraniyor'").get(user.id).n; need(running < 2, 429, "Aynı anda en fazla 2 tarama yapılabilir; biri bitince tekrar deneyin.");
    const total = db.prepare("SELECT COUNT(*) n FROM depo_sites WHERE user_id=?").get(user.id).n; need(total < 40, 429, "Depoda en fazla 40 site tutulabilir; eskileri silin.");
    const host = u.hostname.toLowerCase(); const maxPages = Math.max(1, Math.min(LIMITS.pages, Math.round(+body.maxPages || 8)));
    if (!allowLocal) { const addrs = await dns.promises.lookup(host, { all: true }).catch(() => []); need(addrs.length, 400, "Alan adı bulunamadı. Adresi kontrol edin."); need(!addrs.some((a) => privIp(a.address)), 400, "Bu adres iç ağa ait; yalnızca herkese açık siteler taranabilir."); }
    u.hash = ""; const sid = id(16);
    db.prepare("INSERT INTO depo_sites(id,user_id,url,host,title) VALUES(?,?,?,?,?)").run(sid, user.id, u.href, host, host);
    const site = db.prepare("SELECT * FROM depo_sites WHERE id=?").get(sid); PROG.set(sid, { phase: "basliyor", pages: 0 });
    runScan(site, maxPages);
    return { site: pubSite(site) };
  });
  route("GET", "/api/depo/sites", ({ user }) => { need(user, 401, "Depoyu kullanmak için giriş yapın."); return { sites: db.prepare("SELECT * FROM depo_sites WHERE user_id=? ORDER BY created DESC").all(user.id).map((s) => pubSite(s)), cats: DEPO_CATS, kinds: COMP_KINDS }; });
  route("GET", "/api/depo/sites/:id", ({ user, params }) => ({ site: pubSite(ownSite(user, params.id), true), cats: DEPO_CATS, kinds: COMP_KINDS }));
  route("DELETE", "/api/depo/sites/:id", ({ user, params }) => {
    const s = ownSite(user, params.id); need(s.status !== "taraniyor", 409, "Tarama sürerken silinemez.");
    db.prepare("DELETE FROM depo_sites WHERE id=?").run(s.id); fs.rmSync(siteDir(s.id), { recursive: true, force: true }); return { ok: true };
  });
  route("PATCH", "/api/depo/assets/:id", ({ user, params, body }) => {
    const a = db.prepare("SELECT * FROM depo_assets WHERE id=?").get(params.id); need(a, 404, "Görsel bulunamadı"); ownSite(user, a.site_id);
    if (body.category !== undefined) { need(Object.hasOwn(DEPO_CATS, body.category), 400, "Geçersiz kategori"); db.prepare("UPDATE depo_assets SET category=? WHERE id=?").run(body.category, a.id); }
    if (body.alt !== undefined) db.prepare("UPDATE depo_assets SET alt=? WHERE id=?").run(String(body.alt).slice(0, 200), a.id);
    if (body.tags !== undefined) db.prepare("UPDATE depo_assets SET tags=? WHERE id=?").run(String(body.tags).slice(0, 200), a.id);
    return { asset: pubAsset(db.prepare("SELECT * FROM depo_assets WHERE id=?").get(a.id)) };
  });
  route("DELETE", "/api/depo/assets/:id", ({ user, params }) => {
    const a = db.prepare("SELECT * FROM depo_assets WHERE id=?").get(params.id); need(a, 404, "Görsel bulunamadı"); ownSite(user, a.site_id);
    db.prepare("DELETE FROM depo_assets WHERE id=?").run(a.id); fs.rmSync(path.join(siteDir(a.site_id), path.basename(a.file)), { force: true }); return { ok: true };
  });
  // Kendi görselini depoya ekle (data URL)
  route("POST", "/api/depo/sites/:id/upload", async ({ user, params, body }) => {
    const s = ownSite(user, params.id); const m = String(body.data || "").match(/^data:image\/[\w.+-]+;base64,([A-Za-z0-9+/=]+)$/); need(m, 400, "Görsel okunamadı");
    const buf = Buffer.from(m[1], "base64"); const t = sniff(buf); need(t, 415, "Desteklenmeyen görsel türü"); need(buf.length <= 1_900_000, 413, "Görsel çok büyük (en fazla 1,9 MB)");
    const cat = Object.hasOwn(DEPO_CATS, body.category) ? body.category : classify({ url: String(body.name || ""), ...t });
    const aid = id(12); const file = aid + "." + t.ext; fs.mkdirSync(siteDir(s.id), { recursive: true }); await fs.promises.writeFile(path.join(siteDir(s.id), file), buf);
    db.prepare("INSERT INTO depo_assets(id,site_id,file,name,src,page,mime,bytes,w,h,sha,category,alt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(aid, s.id, file, String(body.name || "yukleme." + t.ext).slice(0, 80), null, "yükleme", t.mime, buf.length, t.w || 0, t.h || 0, crypto.createHash("sha256").update(buf).digest("hex"), cat, "");
    return { asset: pubAsset(db.prepare("SELECT * FROM depo_assets WHERE id=?").get(aid)) };
  });
  route("GET", "/api/depo/sites/:id/clone", ({ user, params }) => { const s = ownSite(user, params.id); const f = path.join(siteDir(s.id), "kopya.html"); need(fs.existsSync(f), 404, "Bu tarama için ekran kopyası yok"); return { html: fs.readFileSync(f, "utf8") }; });
  route("GET", "/api/depo/sites/:id/components/:cid", ({ user, params }) => {
    const s = ownSite(user, params.id); const d = siteDir(s.id); need(fs.existsSync(path.join(d, "bilesenler.json")), 404, "Bileşen bulunamadı");
    const c = JSON.parse(fs.readFileSync(path.join(d, "bilesenler.json"), "utf8")).find((x) => x.id === params.cid); need(c, 404, "Bileşen bulunamadı");
    const head = fs.existsSync(path.join(d, "bas.html")) ? fs.readFileSync(path.join(d, "bas.html"), "utf8") : "";
    return { html: c.html, page: `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${head}</head><body>${c.html}</body></html>` };
  });
  // Depodaki tema ve görsellerle Stüdyo'da açılacak başlangıç şablonu
  route("POST", "/api/depo/sites/:id/template", ({ user, params, body }) => {
    const s = ownSite(user, params.id); const full = pubSite(s, true); need(full.status === "hazir", 409, "Tarama bitmeden şablon oluşturulamaz.");
    const pick = Array.isArray(body.assets) ? new Set(body.assets.map(String)) : null;
    const A = full.assets.filter((a) => !pick || pick.has(a.id)); const by = (c) => A.filter((a) => a.category === c);
    const logo = by("logo")[0], hero = by("banner")[0] || by("sosyal")[0] || by("galeri")[0], cards = [...by("urun"), ...by("galeri")].filter((a) => a !== hero).slice(0, 9);
    const t = full.theme || { roles: { primary: "#5e5ce6", accent: "#5e5ce6", background: "#fff", text: "#111", muted: "#6b7280" }, fonts: [] };
    const esc = (v) => String(v || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const name = esc(String(body.title || full.title || full.host).split(/[|\-–—]/)[0].trim() || full.host);
    const fontLinks = (t.fonts || []).slice(0, 2).map((f) => `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.name).replace(/%20/g, "+")}:wght@400;600;700&display=swap">`).join("");
    const nav = (full.categories || []).slice(0, 7).map((c) => `<a href="#${esc(c.name.toLocaleLowerCase("tr").replace(/\s+/g, "-"))}">${esc(c.name)}</a>`).join("");
    const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title>${fontLinks}
<style>
${themeCss(t)}*{box-sizing:border-box}body{margin:0;font-family:var(--yazi-govde);color:var(--renk-metin);background:var(--renk-zemin);line-height:1.6}
img{max-width:100%;display:block}a{color:inherit}.w{max-width:1160px;margin:0 auto;padding:0 20px}
header{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--renk-zemin) 92%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid color-mix(in srgb,var(--renk-metin) 10%,transparent)}
header .w{display:flex;align-items:center;gap:24px;min-height:68px}header img{height:40px;width:auto}header b{font-family:var(--yazi-baslik);font-size:20px}
nav{display:flex;gap:18px;margin-left:auto;flex-wrap:wrap}nav a{text-decoration:none;font-weight:600;font-size:15px;opacity:.85}nav a:hover{color:var(--renk-ana);opacity:1}
.hero{position:relative;min-height:min(70vh,620px);display:grid;place-items:center;text-align:center;color:#fff;background:var(--renk-ana) center/cover no-repeat}
.hero::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.55))}.hero .w{position:relative}
.hero h1{font-family:var(--yazi-baslik);font-size:clamp(32px,6vw,60px);margin:0 0 12px;line-height:1.1}.hero p{font-size:clamp(16px,2.2vw,20px);margin:0 auto 24px;max-width:640px;opacity:.95}
.btn{display:inline-block;background:var(--renk-vurgu);color:#fff;padding:14px 26px;border-radius:999px;text-decoration:none;font-weight:700}
section{padding:72px 0}h2{font-family:var(--yazi-baslik);font-size:clamp(26px,4vw,38px);margin:0 0 28px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:22px}.card{background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.08)}
.card img{aspect-ratio:4/3;object-fit:cover;width:100%}.card div{padding:16px 18px}.card h3{margin:0 0 4px;font-size:18px}.card p{margin:0;color:var(--renk-soluk);font-size:14px}
footer{background:var(--renk-metin);color:var(--renk-zemin);padding:40px 0;font-size:14px}footer .w{display:flex;gap:20px;flex-wrap:wrap;justify-content:space-between;align-items:center}
@media(max-width:720px){nav{display:none}}
</style></head>
<body>
<header><div class="w">${logo ? `<img src="${logo.url}" alt="${name} logo">` : `<b>${name}</b>`}<nav>${nav}</nav></div></header>
<div class="hero" style="${hero ? `background-image:url('${hero.url}')` : ""}"><div class="w"><h1>${name}</h1><p>${esc(full.pages?.[0]?.desc || "Markanızın görselleri ve renkleriyle hazırlanan başlangıç sayfası.")}</p><a class="btn" href="#iletisim">Bize ulaşın</a></div></div>
${cards.length ? `<section><div class="w"><h2>${esc((full.categories || [])[1]?.name || "Öne çıkanlar")}</h2><div class="grid">${cards.map((c, i) => `<div class="card"><img src="${c.url}" alt="${esc(c.alt || "Görsel " + (i + 1))}" loading="lazy"><div><h3>${esc(c.alt || "Başlık " + (i + 1))}</h3><p>Kısa açıklama metni</p></div></div>`).join("")}</div></div></section>` : ""}
<section id="iletisim"><div class="w" style="text-align:center"><h2>İletişim</h2><p>Bize yazın, en kısa sürede dönüş yapalım.</p><a class="btn" href="mailto:info@example.com">E-posta gönder</a></div></section>
<footer><div class="w">${logo ? `<img src="${logo.url}" alt="" style="height:32px;width:auto;filter:brightness(0) invert(1)">` : `<b>${name}</b>`}<span>© ${new Date().getFullYear()} ${name}</span></div></footer>
</body></html>`;
    return { html, title: name };
  });
  // Tüm depo (ya da bir kategori) ZIP olarak
  route("GET", "/api/depo/sites/:id/zip", ({ user, params, url, res, cors }) => {
    const s = ownSite(user, params.id); const d = siteDir(s.id); const cat = url.searchParams.get("cat"); const full = pubSite(s, true);
    const files = []; const used = new Set();
    const uniq = (n) => { let x = n, i = 2; while (used.has(x)) x = n.replace(/(\.[^.]+)?$/, "-" + i++ + "$1"); used.add(x); return x; };
    for (const a of db.prepare("SELECT * FROM depo_assets WHERE site_id=?" + (cat ? " AND category=?" : "")).all(...(cat ? [s.id, cat] : [s.id]))) {
      const f = path.join(d, path.basename(a.file)); if (fs.existsSync(f)) files.push({ name: uniq("gorseller/" + a.category + "/" + (a.name || a.file)), data: fs.readFileSync(f) });
    }
    if (!cat) {
      files.push({ name: "tema.css", data: themeCss(full.theme) });
      files.push({ name: "depo.json", data: JSON.stringify({ site: full.url, title: full.title, taranan: full.updated, kategoriler: full.categories, sayfalar: full.pages, tema: full.theme, gorseller: full.assets.map((a) => ({ ad: a.name, kategori: a.category, boyut: a.w + "x" + a.h, tur: a.mime, kaynak: a.src, sayfa: a.page })) }, null, 2) });
      if (fs.existsSync(path.join(d, "kopya.html"))) files.push({ name: "ekran-kopyasi.html", data: fs.readFileSync(path.join(d, "kopya.html")) });
      if (fs.existsSync(path.join(d, "bilesenler.json"))) { const head = fs.existsSync(path.join(d, "bas.html")) ? fs.readFileSync(path.join(d, "bas.html"), "utf8") : ""; for (const c of JSON.parse(fs.readFileSync(path.join(d, "bilesenler.json"), "utf8"))) { const meta = full.components.find((x) => x.id === c.id); files.push({ name: uniq("bilesenler/" + c.id + "-" + (meta?.kind || "bolum") + ".html"), data: `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${head}</head><body>${c.html}</body></html>` }); } }
    }
    const buf = zip(files);
    res.writeHead(200, { "Content-Type": "application/zip", "Content-Length": buf.length, "Content-Disposition": `attachment; filename="depo-${(s.host || "site").replace(/[^a-z0-9.-]/gi, "")}${cat ? "-" + cat : ""}.zip"`, ...cors });
    res.end(buf); return null;
  });
  // Herkese açık dosya sunumu (projelerde <img src> ile kullanılır); SVG içinde betik çalışmaz
  route("GET", "/api/depo/f/:site/:file", ({ params, res }) => {
    need(/^[A-Za-z0-9]{6,20}\.(png|jpg|gif|webp|avif|ico|svg)$/.test(params.file), 404, "Bulunamadı");
    const a = db.prepare("SELECT mime FROM depo_assets WHERE site_id=? AND file=?").get(params.site, params.file); need(a, 404, "Bulunamadı");
    const f = path.join(siteDir(params.site), params.file); need(fs.existsSync(f), 404, "Bulunamadı");
    const buf = fs.readFileSync(f);
    res.writeHead(200, { "Content-Type": a.mime, "Content-Length": buf.length, "Cache-Control": "public, max-age=31536000, immutable", "Access-Control-Allow-Origin": "*", "Cross-Origin-Resource-Policy": "cross-origin", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox" });
    res.end(buf); return null;
  });
}

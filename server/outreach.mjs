// Müşteri Avı: Google Haritalar'dan işletme bulma → web sitesini tarayıp analiz etme → kişisel teklif dizisi (10 adım)
// → gelen yanıtı sınıflandırıp otomatik cevap → ödeme bağlantısı → ödenince Siparişler'e (yapım ve teslim) düşen talep.
// Bağımlılık yok; ekran görüntüsü için sunucuda Playwright kuruluysa kullanılır, yoksa atlanır.
import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";

// Sektör → Places arama terimi, Gitmapp hazır şablonu ve önerilecek uygulama
export const SECTORS = [
  { id: "restoran", ad: "Restoran", q: "restoran", tpl: "restoran", app: "QR menü, online rezervasyon ve paket sipariş uygulaması" },
  { id: "kafe", ad: "Kafe", q: "kafe", tpl: "kavurma", app: "mobil sipariş ve sadakat kartı uygulaması" },
  { id: "dis", ad: "Diş kliniği", q: "diş kliniği", tpl: "klinik", app: "online randevu, hatırlatma SMS'i ve hasta takibi" },
  { id: "doktor", ad: "Muayenehane / poliklinik", q: "muayenehane", tpl: "muayene", app: "randevu ajandası ve hasta kayıt uygulaması" },
  { id: "kuafor", ad: "Kuaför / güzellik salonu", q: "kuaför", tpl: "percem", app: "online randevu ve müşteri kartı uygulaması" },
  { id: "berber", ad: "Berber", q: "berber", tpl: "sira", app: "sıra alma ve randevu uygulaması" },
  { id: "veteriner", ad: "Veteriner", q: "veteriner kliniği", tpl: "patik", app: "aşı takvimi, randevu ve hasta dosyası uygulaması" },
  { id: "pilates", ad: "Pilates / spor stüdyosu", q: "pilates stüdyosu", tpl: "pilates", app: "ders rezervasyonu ve üyelik uygulaması" },
  { id: "emlak", ad: "Emlak ofisi", q: "emlak ofisi", tpl: "emlak", app: "ilan vitrini ve müşteri talep uygulaması" },
  { id: "oto", ad: "Oto servis / detaylı temizlik", q: "oto servis", tpl: "detaygaraj", app: "servis randevusu ve bakım hatırlatma uygulaması" },
  { id: "pansiyon", ad: "Pansiyon / butik otel", q: "pansiyon", tpl: "konak", app: "doğrudan rezervasyon (komisyonsuz) uygulaması" },
  { id: "cicek", ad: "Çiçekçi", q: "çiçekçi", tpl: "cicek", app: "online sipariş ve teslimat takibi" },
  { id: "foto", ad: "Fotoğraf stüdyosu", q: "fotoğraf stüdyosu", tpl: "fotostudyo", app: "portfolyo ve çekim randevusu uygulaması" },
  { id: "mimar", ad: "Mimarlık ofisi", q: "mimarlık ofisi", tpl: "mimari", app: "proje portfolyosu ve teklif formu" },
  { id: "sigorta", ad: "Sigorta acentesi", q: "sigorta acentesi", tpl: "sigortasite", app: "teklif alma ve poliçe yenileme hatırlatma uygulaması" },
  { id: "kurs", ad: "Kurs / eğitim merkezi", q: "kurs merkezi", tpl: "derslik", app: "ders programı, yoklama ve veli bilgilendirme uygulaması" },
  { id: "usta", ad: "Tamir atölyesi", q: "tamir servisi", tpl: "usta", app: "iş emri ve müşteri bilgilendirme uygulaması" },
  { id: "davet", ad: "Düğün / etkinlik salonu", q: "düğün salonu", tpl: "etkinlik", app: "tarih sorgulama ve etkinlik rezervasyonu" },
  { id: "butik", ad: "Butik mağaza", q: "butik giyim", tpl: "dukkan", app: "online mağaza ve WhatsApp sipariş uygulaması" },
  { id: "musavir", ad: "Mali müşavir", q: "mali müşavir", tpl: "muhasebe", app: "müşteri evrak paylaşımı ve ön muhasebe uygulaması" },
];
const sectorOf = (id) => SECTORS.find((s) => s.id === id) || null;

export const STAGES = { yeni: "Bulundu", analiz: "Analiz edildi", gonderildi: "Dizide", yanitladi: "Yanıt verdi", ilgili: "İlgileniyor", odeme: "Ödeme bekleniyor", odendi: "Ödendi · yapımda", teslim: "Teslim edildi", sessiz: "Yanıt yok", ret: "İlgilenmiyor", cikis: "Listeden çıktı" };

// 10 adımlı teklif dizisi; {{...}} alanları her işletmeye göre doldurulur
export const DEFAULT_STEPS = [
  { gun: 0, konu: "{{isletme}} için ücretsiz site analizi", metin: "Merhaba {{isletme}} ekibi,\n\nGoogle Haritalar'da {{sehir}} bölgesindeki {{sektor}} işletmelerine bakarken sizi gördüm; {{puan}} puanınız gerçekten güzel. Sitenize de kısaca baktım ve birkaç şey dikkatimi çekti:\n\n{{sorunlar}}\n\nSizin için {{uygulama}} hazırlayabiliriz. Nasıl görüneceğini merak ederseniz örnek bir sayfa hazırladım: {{demo}}\n\nİsterseniz 10 dakikalık bir görüşmede anlatayım.\n\nSevgiler,\n{{gonderen}}" },
  { gun: 3, konu: "Re: {{isletme}} için ücretsiz site analizi", metin: "Merhaba,\n\nGeçen mesajımı görme fırsatınız olmadıysa kısaca: müşterilerinizin çoğu sizi telefondan arıyor. {{oneri}}\n\nÖrnek sayfa hâlâ burada: {{demo}}\n\n{{gonderen}}" },
  { gun: 6, konu: "{{sektor}} işletmeleri online randevuyla ne kazanıyor?", metin: "Merhaba {{isletme}},\n\nBenzer işletmelerde gördüğümüz şey şu: telefonla gelen soruların büyük kısmı (fiyat, saat, yer, müsaitlik) sitede ya da uygulamada cevaplanınca hem zaman kazanılıyor hem kaçan müşteri azalıyor.\n\nSizin için düşündüğüm: {{uygulama}}.\n\nİlginizi çekerse bu e-postaya “evet” yazmanız yeterli.\n\n{{gonderen}}" },
  { gun: 10, konu: "{{isletme}} cebinizde: kendi mobil uygulamanız", metin: "Merhaba,\n\nSitenin yanında App Store ve Google Play'de {{isletme}} adına bir uygulama da yayınlayabiliyoruz. Tasarım, kurulum ve mağaza yayını dahil; siz yalnızca içeriği onaylıyorsunuz.\n\nÖrnek: {{demo}}\n\n{{gonderen}}" },
  { gun: 14, konu: "Kısa bir soru", metin: "Merhaba {{isletme}},\n\nSitenizi yenilemek ya da bir uygulama yaptırmak şu an gündeminizde mi? “Şimdi değil” derseniz bir daha yazmam, söz.\n\n{{gonderen}}" },
  { gun: 18, konu: "{{isletme}} için hazır teklif", metin: "Merhaba,\n\nSizin için net bir teklif hazırladım:\n\n{{paketler}}\n\nHepsinde alan adı, SSL, Hostinger sunucusu ve ilk ay destek dahil. Onaylarsanız 7 iş günü içinde yayına alırız.\n\nÖdeme ve başlangıç: {{odeme}}\n\n{{gonderen}}" },
  { gun: 23, konu: "Bu ay başlayanlara kurulum hediye", metin: "Merhaba {{isletme}},\n\nBu ay başlayan işletmelerden kurulum ücreti almıyoruz. Teklif bağlantısı hâlâ geçerli: {{odeme}}\n\nSorunuz varsa bu e-postaya yazın, hemen dönerim.\n\n{{gonderen}}" },
  { gun: 28, konu: "Doğru kişiye mi yazıyorum?", metin: "Merhaba,\n\n{{isletme}} için web ve dijital işleri kim takip ediyor? Doğru kişi siz değilseniz bu e-postayı ona iletebilir misiniz?\n\nTeşekkürler,\n{{gonderen}}" },
  { gun: 35, konu: "{{isletme}} için ücretsiz 3 öneri", metin: "Merhaba,\n\nBizimle çalışmasanız da işinize yarayacak üç öneri:\n\n1) Google İşletme Profilinize çalışma saatlerini ve randevu bağlantısını ekleyin.\n2) Sitenizin telefondan düzgün açıldığından emin olun.\n3) WhatsApp üzerinden hızlı yanıt düğmesi koyun.\n\n{{oneri}}\n\n{{gonderen}}" },
  { gun: 45, konu: "Son mesajım", metin: "Merhaba {{isletme}},\n\nBir süredir yazıyorum, yoğun olduğunuzu anlıyorum; bu son mesajım. İleride siteniz ya da bir uygulama için ihtiyaç olursa bu e-postaya yazmanız yeterli.\n\nİşlerinizde bol şans!\n{{gonderen}}" },
];
// Gelen yanıta göre gönderilecek hazır cevaplar
export const DEFAULT_REPLIES = {
  ilgili: { konu: "Re: {{isletme}} · bir sonraki adım", metin: "Merhaba,\n\nDönüşünüz için çok teşekkürler! Paketlerimiz:\n\n{{paketler}}\n\nSeçtiğiniz paketle hemen başlamak için: {{odeme}}\nÖdemeden sonra marka bilgilerinizi (logo, renkler, hizmetler) isteyen kısa bir form gelecek; 7 iş günü içinde yayına alıyoruz.\n\nGörüşme isterseniz uygun olduğunuz saati yazmanız yeterli.\n\n{{gonderen}}" },
  sonra: { konu: "Re: {{isletme}}", metin: "Merhaba,\n\nAnladım, teşekkürler. İki hafta sonra kısaca tekrar yazacağım; o zamana kadar bir sorunuz olursa buradayım.\n\n{{gonderen}}" },
  ret: { konu: "Re: {{isletme}}", metin: "Merhaba,\n\nAnladım, zaman ayırdığınız için teşekkürler. Sizi listemden çıkardım, bir daha yazmayacağım.\n\nİyi çalışmalar,\n{{gonderen}}" },
  odendi: { konu: "{{isletme}} · ödemeniz alındı, başlıyoruz", metin: "Merhaba,\n\nÖdemeniz alındı, teşekkürler! Projeniz yapım kuyruğuna girdi.\n\nSıradaki adımlar:\n1) Logo, renk ve hizmet listenizi bu e-postaya yanıt olarak gönderin.\n2) 3 iş günü içinde ilk taslağı paylaşacağız.\n3) Onayınızdan sonra alan adınızda yayına alıp (istenirse) App Store ve Google Play'e gönderiyoruz.\n\n{{gonderen}}" },
};
export const DEFAULT_PACKS = [
  { id: "site", ad: "Web sitesi yenileme", fiyat: 990000 },
  { id: "site-app", ad: "Web sitesi + mobil uygulama (PWA)", fiyat: 2490000 },
  { id: "magaza", ad: "Uygulama + App Store ve Google Play yayını", fiyat: 3990000 },
];
const DEF = { placesKey: "", city: "İstanbul", sender: "", company: "", address: "", replyTo: "", dailyLimit: 40, autoSend: false, autoReply: false, inboundSecret: "", steps: null, replies: null, packs: null };

const tl = (k) => (k / 100).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " ₺";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clip = (v, n) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f]/g, "").slice(0, n);
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const BAD_MAIL = /\.(png|jpe?g|gif|webp|svg)$|example\.|sentry|wixpress|@(2x|3x)|domain\.com|email\.com|yourname/i;

// Kamuya açık olmayan adreslere istek atılmaz (SSRF koruması)
export function privateIp(ip) {
  if (net.isIPv4(ip)) { const [a, b] = ip.split(".").map(Number); return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224; }
  const x = ip.toLowerCase(); return x === "::1" || x === "::" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80") || x.startsWith("::ffff:") && privateIp(x.slice(7));
}
async function publicUrl(u, allowLocal) {
  const url = new URL(u); if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error("Desteklenmeyen adres");
  if (allowLocal) return url;
  const ips = await dns.lookup(url.hostname, { all: true }); if (!ips.length || ips.some((a) => privateIp(a.address))) throw new Error("Bu adres taranamaz");
  return url;
}
async function fetchSite(u, allowLocal) {
  let url = await publicUrl(u, allowLocal), r, t0 = Date.now();
  for (let i = 0; i < 4; i++) { // yönlendirmeleri tek tek kontrol ederek izle
    r = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(12000), headers: { "User-Agent": "Mozilla/5.0 (compatible; GitmappSiteCheck/1.0)", Accept: "text/html" } });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { url = await publicUrl(new URL(r.headers.get("location"), url).href, allowLocal); continue; }
    break;
  }
  const reader = r.body.getReader(), dec = new TextDecoder(); let html = "", bytes = 0;
  try { while (bytes < 1_500_000) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; html += dec.decode(value, { stream: true }); } } finally { await reader.cancel().catch(() => { }); }
  return { status: r.status, finalUrl: url.href, html, bytes, ms: Date.now() - t0 };
}

// Sayfadan ölçülebilir sinyalleri çıkarır ve fırsat puanı hesaplar (0–100; yüksek = daha çok iş fırsatı)
export function auditHtml(page, year = new Date().getFullYear()) {
  const h = page.html || "", low = h.toLowerCase();
  const title = (h.match(/<title[^>]*>([^<]{0,200})/i) || [])[1]?.trim() || "";
  const desc = /<meta[^>]+name=["']description["'][^>]*content=["'][^"']{20,}/i.test(h);
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(h);
  const https = page.finalUrl.startsWith("https:");
  const years = [...h.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d{2})/gi)].map((m) => +m[1]);
  const copyright = years.length ? Math.max(...years) : null;
  const emails = [...new Set([...(h.match(/mailto:([^"'?\s>]+)/gi) || []).map((m) => m.slice(7)), ...(h.match(EMAIL) || [])].map((e) => decodeURIComponent(e).toLowerCase()).filter((e) => !BAD_MAIL.test(e)))].slice(0, 5);
  const social = { instagram: /instagram\.com\//i.test(h), facebook: /facebook\.com\//i.test(h), whatsapp: /wa\.me\/|api\.whatsapp\.com|whatsapp:\/\//i.test(h) };
  const booking = /randevu|rezervasyon|booking|appointment|online sipariş|sepete ekle/i.test(low);
  const flash = /\.swf|<frameset|<marquee|<font\s/i.test(h);
  const builder = /wixsite\.com|weebly|jimdo|site123|blogspot/i.test(h + page.finalUrl);
  const p = [];
  if (page.status >= 400) p.push("Siteniz açılmıyor (hata " + page.status + "), gelen müşteriler boş sayfa görüyor");
  if (!https) p.push("Site güvenli bağlantı (https) kullanmıyor; tarayıcılar “Güvenli değil” uyarısı gösteriyor");
  if (!viewport) p.push("Site telefona uyumlu değil; ziyaretçilerin çoğu telefondan geliyor ve yazılar küçük görünüyor");
  if (page.ms > 3000) p.push("Sayfa " + (page.ms / 1000).toFixed(1) + " saniyede açılıyor; 3 saniyeyi geçince ziyaretçilerin yarısı çıkıyor");
  if (copyright && copyright < year - 1) p.push("Sitedeki telif yılı " + copyright + "; uzun süredir güncellenmemiş görünüyor");
  if (!booking) p.push("Online randevu/rezervasyon ya da sipariş seçeneği yok; müşteriler yalnızca telefonla ulaşabiliyor");
  if (!social.whatsapp) p.push("WhatsApp ile hızlı iletişim düğmesi yok");
  if (!desc) p.push("Google arama sonuçlarında görünen açıklama (meta description) eksik");
  if (flash) p.push("Sayfada eski teknoloji (çerçeve/eski etiketler) kullanılıyor");
  if (builder) p.push("Site ücretsiz site kurucu alt alan adında; marka güveni zayıf görünüyor");
  if (page.bytes > 3_000_000) p.push("Sayfa çok ağır; mobil veride yavaş açılıyor");
  const score = Math.min(100, 15 + p.length * 8 + (!viewport ? 15 : 0) + (!https ? 8 : 0) + (page.status >= 400 ? 30 : 0));
  return { title, https, viewport, desc, copyright, emails, social, booking, ms: page.ms, bytes: page.bytes, status: page.status, url: page.finalUrl, problems: p, score };
}
export const noSiteAudit = () => ({ problems: ["İşletmenizin bir web sitesi yok; Google Haritalar'da sizi bulan müşteri hizmet, fiyat ve randevu bilgisine ulaşamıyor", "Online randevu/rezervasyon ya da sipariş seçeneği yok", "Rakipleriniz aramalarda siteleriyle öne çıkıyor"], score: 92, nosite: true, emails: [], social: {} });

export function fill(t, v) { return String(t || "").replace(/\{\{(\w+)\}\}/g, (_, k) => v[k] ?? ""); }

// Yanıt niyeti: yapay zekâ yoksa anahtar kelimelerle
export function intentOf(text) {
  const t = String(text || "").toLocaleLowerCase("tr");
  if (/listeden çıkar|abonelik|bir daha yazma|rahatsız etme|istemiyoruz|ilgilenmiyor|gerek yok|ihtiyacımız yok|hayır teşekkür|unsubscribe|spam/.test(t)) return "ret";
  if (/sonra|ileride|şu an değil|şimdi değil|meşgul|ay sonra|haftaya|yoğunuz/.test(t)) return "sonra";
  if (/fiyat|ücret|ne kadar|kaç para|teklif|evet|ilgilen|görüşelim|arayın|detay|olur|başlayalım|tamam/.test(t)) return "ilgili";
  return "soru";
}

export function registerOutreach({ db, route, need, HttpErr, encKey, decKey, cfg, chat, send, mailReady, billing, adminEmail, allowLocal = false, placesBase }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS out_leads(id TEXT PRIMARY KEY, place_id TEXT UNIQUE, sector TEXT, city TEXT, name TEXT NOT NULL, address TEXT,
      phone TEXT, website TEXT, email TEXT, rating REAL, reviews INTEGER, maps_url TEXT, score INTEGER DEFAULT 0, audit TEXT DEFAULT '{}',
      shot TEXT, stage TEXT DEFAULT 'yeni', step INTEGER DEFAULT 0, next_at TEXT, opt_out INTEGER DEFAULT 0, token TEXT, note TEXT,
      order_id TEXT, created TEXT DEFAULT (datetime('now')), updated TEXT DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS out_leads_stage ON out_leads(stage, next_at);
    CREATE TABLE IF NOT EXISTS out_messages(id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id TEXT REFERENCES out_leads(id) ON DELETE CASCADE,
      dir TEXT NOT NULL, channel TEXT DEFAULT 'email', step INTEGER, subject TEXT, body TEXT, status TEXT, intent TEXT, created TEXT DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS out_messages_lead ON out_messages(lead_id, id);
    CREATE TABLE IF NOT EXISTS out_offers(id TEXT PRIMARY KEY, lead_id TEXT REFERENCES out_leads(id) ON DELETE CASCADE, pack TEXT, title TEXT, amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending', session TEXT, created TEXT DEFAULT (datetime('now')), paid TEXT, reference TEXT);
  `);
  const q = (sql) => db.prepare(sql);
  const readS = () => { const r = q("SELECT v FROM server_settings WHERE k='outreach'").get(); let v = {}; try { v = r ? JSON.parse(r.v) : {}; } catch { } return { ...DEF, ...v }; };
  const writeS = (v) => q("INSERT INTO server_settings(k,v) VALUES('outreach',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").run(JSON.stringify(v));
  const placesKey = () => { if (process.env.GOOGLE_PLACES_API_KEY) return process.env.GOOGLE_PLACES_API_KEY; const s = readS(); try { return s.placesKey ? decKey(s.placesKey) : ""; } catch { return ""; } };
  const steps = () => readS().steps || DEFAULT_STEPS;
  const replies = () => ({ ...DEFAULT_REPLIES, ...(readS().replies || {}) });
  const packs = () => readS().packs || DEFAULT_PACKS;
  const lead = (id) => { const l = q("SELECT * FROM out_leads WHERE id=?").get(id); need(l, 404, "Aday bulunamadı"); return l; };
  const jparse = (t, d = {}) => { try { return JSON.parse(t || ""); } catch { return d; } };
  const pub = (l) => ({ ...l, audit: jparse(l.audit), shot: !!l.shot, token: undefined, stageTr: STAGES[l.stage] || l.stage, sectorTr: sectorOf(l.sector)?.ad || l.sector });
  const touch = (id, set, ...vals) => q(`UPDATE out_leads SET ${set}, updated=datetime('now') WHERE id=?`).run(...vals, id);
  const sentToday = () => q("SELECT COUNT(*) n FROM out_messages WHERE dir='out' AND status='gonderildi' AND created>=datetime('now','start of day')").get().n;
  const aiJson = async (prompt, max = 900) => { const r = await chat([{ role: "user", content: prompt }], max); const s = r.text, a = s.indexOf("{"), b = s.lastIndexOf("}"); return JSON.parse(s.slice(a, b + 1)); };

  // ---------- Google Places (New) Text Search ----------
  async function places(textQuery, pageToken) {
    const key = placesKey(); need(key, 400, "Önce Ayarlar sekmesinden Google Places API anahtarını gir");
    const r = await fetch((placesBase || "https://places.googleapis.com/v1") + "/places:searchText", { method: "POST", signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus,nextPageToken" },
      body: JSON.stringify({ textQuery, languageCode: "tr", regionCode: "TR", pageSize: 20, ...(pageToken ? { pageToken } : {}) }) }).catch(() => null);
    need(r, 502, "Google Places'a ulaşılamadı");
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new HttpErr(r.status === 403 || r.status === 400 ? 400 : 502, "Google Places: " + clip(j.error?.message || r.status, 200));
    return { list: (j.places || []).filter((p) => p.businessStatus !== "CLOSED_PERMANENTLY"), next: j.nextPageToken || null };
  }

  // ---------- Sektör araştırması: hangi iş kolu için uygulama yapmalı? ----------
  route("POST", "/api/admin/outreach/research", async ({ body }) => {
    const city = clip(body.city || readS().city, 60).trim(); need(city, 400, "Şehir gir");
    const ids = Array.isArray(body.sectors) && body.sectors.length ? body.sectors : SECTORS.map((s) => s.id);
    const rows = [];
    for (const s of ids.map(sectorOf).filter(Boolean).slice(0, 20)) {
      const { list } = await places(s.q + " " + city);
      const n = list.length, noSite = list.filter((p) => !p.websiteUri).length;
      const reviews = n ? list.reduce((a, p) => a + (p.userRatingCount || 0), 0) / n : 0, rating = n ? list.reduce((a, p) => a + (p.rating || 0), 0) / n : 0;
      // Fırsat: sitesi olmayanların oranı + işletmelerin canlılığı (yorum sayısı = müşteri trafiği = ödeme gücü)
      const score = n ? Math.round((noSite / n) * 55 + Math.min(30, reviews / 15) + (rating >= 4.3 ? 15 : rating >= 4 ? 10 : 5)) : 0;
      rows.push({ id: s.id, ad: s.ad, tpl: s.tpl, app: s.app, n, noSite, reviews: Math.round(reviews), rating: +rating.toFixed(1), score });
    }
    rows.sort((a, b) => b.score - a.score);
    const out = { city, at: new Date().toISOString(), rows };
    q("INSERT INTO server_settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").run("outreach_research:" + city.toLocaleLowerCase("tr"), JSON.stringify(out));
    return out;
  });

  // ---------- Aday bulma ----------
  route("POST", "/api/admin/outreach/search", async ({ body }) => {
    const s = sectorOf(body.sector); const city = clip(body.city || readS().city, 60).trim();
    const text = clip(body.query, 120).trim() || (s ? s.q + " " + city : ""); need(text, 400, "Sektör seç ya da arama yaz");
    let added = 0, dup = 0, token = null; const pages = Math.min(3, Math.max(1, +body.pages || 1));
    for (let i = 0; i < pages; i++) {
      const { list, next } = await places(text, token);
      for (const p of list) {
        const r = q("INSERT OR IGNORE INTO out_leads(id,place_id,sector,city,name,address,phone,website,rating,reviews,maps_url,token) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
          .run("L" + crypto.randomBytes(6).toString("hex"), p.id, s?.id || clip(body.sector, 30), city, clip(p.displayName?.text || "İşletme", 160), clip(p.formattedAddress, 300), clip(p.nationalPhoneNumber, 40), clip(p.websiteUri, 400) || null, p.rating || null, p.userRatingCount || 0, clip(p.googleMapsUri, 400), crypto.randomBytes(16).toString("hex"));
        r.changes ? added++ : dup++;
      }
      token = next; if (!token) break;
    }
    return { added, dup, query: text };
  });

  // ---------- Site analizi (tarama + ekran görüntüsü + yapay zekâ yorumu) ----------
  async function screenshot(url) {
    try {
      const { chromium } = await import("playwright");
      const b = await chromium.launch({ args: ["--no-sandbox"] });
      try { const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }); await pg.goto(url, { timeout: 20000, waitUntil: "domcontentloaded" }); await pg.waitForTimeout(1200); return "data:image/jpeg;base64," + (await pg.screenshot({ type: "jpeg", quality: 55 })).toString("base64"); }
      finally { await b.close(); }
    } catch { return null; }
  }
  async function audit(l) {
    const s = sectorOf(l.sector);
    let a, shot = null;
    if (!l.website) a = noSiteAudit();
    else {
      try { a = auditHtml(await fetchSite(l.website, allowLocal)); shot = await screenshot(a.url); }
      catch (e) { a = { ...noSiteAudit(), problems: ["Siteniz açılmıyor (" + clip(e.message, 60) + "); müşteriler size ulaşamıyor", ...noSiteAudit().problems.slice(1)], score: 90, broken: true }; }
    }
    a.app = s?.app || "işletmenize özel web sitesi ve mobil uygulama"; a.tpl = s?.tpl || "dukkan";
    a.oneri = "Sitenizi telefona uyumlu, hızlı ve online randevu/sipariş alabilen hâle getirip aynı altyapıyla mobil uygulamanızı da yayınlayabiliriz.";
    try { // Yapay zekâ işletmeye özel kısa yorum ve öneri yazar; başarısızsa kural tabanlı sonuç kalır
      const j = await aiJson(`Bir web ajansı için satış analisti olarak yaz. İşletme: ${l.name} (${s?.ad || l.sector}, ${l.city}). Google puanı ${l.rating || "?"} (${l.reviews} yorum). Site: ${l.website || "yok"}.
Ölçülen sorunlar: ${a.problems.join(" | ")}.
Yalnızca JSON döndür: {"sorunlar":["en etkili 3 sorun, işletme sahibine kibar ve somut dille, her biri tek cümle"],"oneri":"tek cümlelik kazanç odaklı öneri","uygulama":"bu işletmeye özel uygulama fikri, kısa"}`);
      if (Array.isArray(j.sorunlar) && j.sorunlar.length) a.top = j.sorunlar.slice(0, 3).map((x) => clip(x, 240));
      if (j.oneri) a.oneri = clip(j.oneri, 300); if (j.uygulama) a.app = clip(j.uygulama, 200); a.ai = true;
    } catch { }
    const email = l.email || a.emails?.[0] || null;
    touch(l.id, "audit=?, score=?, shot=?, email=?, stage=CASE WHEN stage='yeni' THEN 'analiz' ELSE stage END", JSON.stringify(a), a.score, shot, email);
    return lead(l.id);
  }
  route("POST", "/api/admin/outreach/leads/:id/audit", async ({ params }) => ({ lead: pub(await audit(lead(params.id))) }));
  route("POST", "/api/admin/outreach/audit-batch", async () => {
    const list = q("SELECT * FROM out_leads WHERE stage='yeni' ORDER BY reviews DESC LIMIT 10").all(); let n = 0;
    for (const l of list) { await audit(l).catch(() => { }); n++; }
    return { done: n, left: q("SELECT COUNT(*) n FROM out_leads WHERE stage='yeni'").get().n };
  });
  route("GET", "/api/admin/outreach/leads/:id/shot", ({ params }) => ({ data: lead(params.id).shot || null }));

  // ---------- Mesaj oluşturma ve gönderme ----------
  const vars = (l) => {
    const a = jparse(l.audit), s = readS(), sec = sectorOf(l.sector);
    return { isletme: l.name, sehir: l.city || "", sektor: (sec?.ad || l.sector || "").toLocaleLowerCase("tr"), puan: l.rating ? l.rating.toFixed(1) + " ⭐" : "",
      sorunlar: (a.top || a.problems || []).slice(0, 3).map((p) => "• " + p).join("\n"), oneri: a.oneri || "", uygulama: a.app || "", demo: cfg.site + "/templates/" + (a.tpl || sec?.tpl || "dukkan") + ".html",
      paketler: packs().map((p) => "• " + p.ad + ": " + tl(p.fiyat)).join("\n"), odeme: cfg.api + "/api/out/offer/" + l.token, gonderen: [s.sender || "Gitmapp", s.company].filter(Boolean).join("\n") };
  };
  const footer = (l) => { const s = readS(); return "\n\n—\n" + [s.company || "Gitmapp", s.address].filter(Boolean).join(" · ") + "\nBu e-postayı işletmenizin herkese açık iletişim adresine gönderdik. Bir daha almak istemezseniz: " + cfg.api + "/api/out/unsub/" + l.token; };
  const toHtml = (t) => "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f2328;max-width:600px\">" + esc(t).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}">${u}</a>`).replace(/\n/g, "<br>") + "</div>";
  async function deliver(l, subject, text, step, kind = "out") {
    need(!l.opt_out, 400, "Bu işletme listeden çıktı; ileti gönderilmez");
    need(l.email, 400, "Bu adayın e-posta adresi yok; telefon/WhatsApp ile elle ulaşın");
    need(mailReady(), 400, "Önce Yönetim › E-posta gönderimi ayarlarını yap");
    need(sentToday() < (+readS().dailyLimit || 40), 429, "Günlük gönderim sınırına ulaşıldı (alan adının itibarını korumak için)");
    const body = text + footer(l), s = readS();
    let status = "gonderildi"; try { await send({ to: l.email, subject, text: body, html: toHtml(body), replyTo: s.replyTo || undefined }); } catch (e) { status = "hata"; q("INSERT INTO out_messages(lead_id,dir,step,subject,body,status) VALUES(?,?,?,?,?,?)").run(l.id, "out", step, subject, body, "hata: " + clip(e.message, 120)); throw new HttpErr(502, "Gönderilemedi: " + clip(e.message, 160)); }
    q("INSERT INTO out_messages(lead_id,dir,step,subject,body,status,intent) VALUES(?,?,?,?,?,?,?)").run(l.id, "out", step, subject, body, status, kind);
  }
  const nextAt = (stepIdx) => { const st = steps(); const cur = st[stepIdx - 1], nx = st[stepIdx]; if (!nx) return null; return new Date(Date.now() + Math.max(1, nx.gun - (cur?.gun || 0)) * 864e5).toISOString().replace("T", " ").slice(0, 19); };
  async function sendStep(l, n) {
    const st = steps()[n - 1]; need(st, 400, "Dizide bu adım yok");
    const v = vars(l); await deliver(l, fill(st.konu, v), fill(st.metin, v), n);
    const nx = nextAt(n); touch(l.id, "step=?, next_at=?, stage=CASE WHEN stage IN ('yeni','analiz','sessiz') THEN 'gonderildi' ELSE stage END", n, nx);
    if (!nx) touch(l.id, "stage=CASE WHEN stage='gonderildi' THEN 'sessiz' ELSE stage END");
  }
  route("GET", "/api/admin/outreach/leads/:id/preview", ({ params, url }) => { const l = lead(params.id); const n = +url.searchParams.get("step") || l.step + 1; const st = steps()[n - 1]; need(st, 400, "Dizi tamamlandı"); const v = vars(l); return { step: n, subject: fill(st.konu, v), text: fill(st.metin, v) + footer(l), whatsapp: l.phone ? "https://wa.me/" + l.phone.replace(/\D/g, "").replace(/^0/, "90") + "?text=" + encodeURIComponent(fill(st.metin, v)) : null }; });
  route("POST", "/api/admin/outreach/leads/:id/send", async ({ params }) => { const l = lead(params.id); await sendStep(l, l.step + 1); return { lead: pub(lead(l.id)) }; });
  route("POST", "/api/admin/outreach/leads/:id/manual", ({ params, body }) => { const l = lead(params.id); const n = l.step + 1; q("INSERT INTO out_messages(lead_id,dir,channel,step,subject,body,status) VALUES(?,?,?,?,?,?,?)").run(l.id, "out", clip(body.channel || "telefon", 20), n, "Elle iletişim", clip(body.text, 4000), "gonderildi"); touch(l.id, "step=?, next_at=?, stage=CASE WHEN stage IN ('yeni','analiz') THEN 'gonderildi' ELSE stage END", n, nextAt(n)); return { lead: pub(lead(l.id)) }; });
  route("PATCH", "/api/admin/outreach/leads/:id", ({ params, body }) => {
    const l = lead(params.id);
    if (body.email !== undefined) { const e = String(body.email || "").trim().toLowerCase(); need(!e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e), 400, "E-posta geçersiz"); touch(l.id, "email=?", e || null); }
    if (body.stage !== undefined) { need(STAGES[body.stage], 400, "Aşama geçersiz"); touch(l.id, "stage=?, opt_out=CASE WHEN ? IN ('ret','cikis') THEN 1 ELSE opt_out END", body.stage, body.stage); }
    if (body.note !== undefined) touch(l.id, "note=?", clip(body.note, 2000));
    return { lead: pub(lead(l.id)) };
  });
  route("DELETE", "/api/admin/outreach/leads/:id", ({ params }) => { q("DELETE FROM out_leads WHERE id=?").run(params.id); return { ok: true }; });
  route("POST", "/api/admin/outreach/start", async ({ body }) => { // seçilenleri diziye al (ilk e-postayı hemen gönder)
    const ids = (Array.isArray(body.ids) ? body.ids : []).slice(0, 50); let ok = 0; const errors = [];
    for (const id of ids) { try { const l = lead(id); if (l.step === 0) { await sendStep(l, 1); ok++; } } catch (e) { errors.push(clip(e.message, 120)); if (e.code === 429) break; } }
    return { sent: ok, errors: [...new Set(errors)] };
  });

  // ---------- Gelen yanıt: sınıflandır, otomatik cevap ver, ilerlet ----------
  async function handleReply(l, text, subject = "") {
    let intent = intentOf(text), answer = "";
    try { const j = await aiJson(`Bir web ajansının soğuk e-postasına işletmeden gelen yanıtı sınıflandır. Yanıt:\n<<<\n${clip(text, 3000)}\n>>>\nYalnızca JSON: {"niyet":"ilgili|sonra|ret|soru","cevap":"niyet soru ise kısa, kibar Türkçe cevap; fiyat sorulursa paketlere yönlendir"}`, 500);
      if (["ilgili", "sonra", "ret", "soru"].includes(j.niyet)) intent = j.niyet; answer = clip(j.cevap, 1500); } catch { }
    q("INSERT INTO out_messages(lead_id,dir,subject,body,status,intent) VALUES(?,?,?,?,?,?)").run(l.id, "in", clip(subject, 200), clip(text, 8000), "alindi", intent);
    const s = readS(), v = vars(l), R = replies();
    const reply = async (tpl, txt) => { const subj = fill(tpl?.konu || "Re: {{isletme}}", v), body = txt || fill(tpl.metin, v);
      if (s.autoReply && l.email && !l.opt_out) { try { await deliver(l, subj, body, null, "cevap"); return "gonderildi"; } catch { } }
      q("INSERT INTO out_messages(lead_id,dir,subject,body,status,intent) VALUES(?,?,?,?,?,?)").run(l.id, "out", subj, body + footer(l), "taslak", "cevap"); return "taslak"; };
    let did;
    if (intent === "ret") { did = await reply(R.ret); touch(l.id, "stage='ret', opt_out=1, next_at=NULL"); }
    else if (intent === "sonra") { touch(l.id, "stage='gonderildi', next_at=datetime('now','+14 days')"); did = await reply(R.sonra); }
    else if (intent === "ilgili") { touch(l.id, "stage='odeme', next_at=NULL"); did = await reply(R.ilgili); }
    else { touch(l.id, "stage='yanitladi', next_at=NULL"); did = await reply({ konu: "Re: {{isletme}}" }, answer ? answer + "\n\n" + v.gonderen : "Merhaba,\n\nYanıtınız için teşekkürler, en kısa sürede ayrıntılı dönüş yapacağım.\n\n" + v.gonderen); }
    return { intent, reply: did, lead: pub(lead(l.id)) };
  }
  route("POST", "/api/admin/outreach/leads/:id/reply", async ({ params, body }) => { const t = clip(body.text, 8000).trim(); need(t, 400, "Gelen yanıtı yapıştır"); return handleReply(lead(params.id), t, "Elle eklenen yanıt"); });
  route("POST", "/api/admin/outreach/messages/:id/approve", async ({ params }) => {
    const m = q("SELECT * FROM out_messages WHERE id=? AND status='taslak'").get(+params.id); need(m, 404, "Taslak bulunamadı");
    const l = lead(m.lead_id); const body = m.body.replace(/\n\n—\n[\s\S]*$/, ""); await deliver(l, m.subject, body, null, "cevap"); q("DELETE FROM out_messages WHERE id=?").run(m.id); return { lead: pub(lead(l.id)) };
  });
  // Gelen e-posta webhook'u (Hostinger Mail / Resend inbound / Cloudflare Email Worker / Zapier): {from, subject, text}
  route("POST", "/api/out/inbound/:secret", async ({ params, body }) => {
    const sec = readS().inboundSecret; need(sec && params.secret.length === sec.length && crypto.timingSafeEqual(Buffer.from(params.secret), Buffer.from(sec)), 403, "Geçersiz anahtar");
    const d = body.data && typeof body.data === "object" ? body.data : body;
    const from = String(d.from?.address || d.from?.email || d.from || d.sender || "").match(EMAIL)?.[0]?.toLowerCase();
    const text = String(d.text || d.plain || d["body-plain"] || d.body || "").split(/\n(?:On .+wrote:|.+tarihinde .+ yazdı:|-{2,} ?Original Message)/)[0].trim();
    need(from && text, 400, "from ve text gerekli");
    const l = q("SELECT * FROM out_leads WHERE email=? ORDER BY updated DESC").get(from); if (!l) return { matched: false };
    return { matched: true, ...(await handleReply(l, text, clip(d.subject, 200))) };
  });
  // Listeden çıkma (her e-postada bağlantısı var)
  const page = (title, body) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><body style="font-family:system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 18px;line-height:1.6;color:#1f2328"><h1 style="font-size:22px">${esc(title)}</h1>${body}</body>`;
  const html = (res, code, h) => { res.writeHead(code, { "Content-Type": "text/html; charset=utf-8", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'" }); res.end(h); return null; };
  const byToken = (t) => /^[a-f0-9]{32}$/.test(t) ? q("SELECT * FROM out_leads WHERE token=?").get(t) : null;
  route("GET", "/api/out/unsub/:token", ({ params, res }) => { const l = byToken(params.token); if (l) { touch(l.id, "opt_out=1, stage='cikis', next_at=NULL"); q("INSERT INTO out_messages(lead_id,dir,body,status,intent) VALUES(?,?,?,?,?)").run(l.id, "in", "Listeden çıkma bağlantısına tıkladı", "alindi", "ret"); } return html(res, 200, page("Listeden çıkarıldınız", "<p>Bir daha e-posta göndermeyeceğiz. İyi çalışmalar dileriz.</p>")); });

  // ---------- Teklif ve ödeme ----------
  route("GET", "/api/out/offer/:token", ({ params, res }) => {
    const l = byToken(params.token); if (!l) return html(res, 404, page("Teklif bulunamadı", "<p>Bağlantı geçersiz.</p>"));
    const card = billing.cardOn(), hv = billing.havale();
    const rows = packs().map((p) => `<form method="post" action="${esc(cfg.api)}/api/out/offer/${l.token}/${esc(p.id)}" style="border:1px solid #d0d7de;border-radius:12px;padding:16px;margin:12px 0"><b>${esc(p.ad)}</b><div style="font-size:24px;font-weight:700;margin:6px 0">${tl(p.fiyat)}</div>${card ? '<button name="m" value="kart" style="background:#111;color:#fff;border:0;border-radius:10px;padding:10px 16px;font-size:15px;cursor:pointer">Kartla öde</button> ' : ""}${hv ? '<button name="m" value="havale" style="background:#fff;border:1px solid #111;border-radius:10px;padding:10px 16px;font-size:15px;cursor:pointer">Havale / EFT</button>' : ""}${!card && !hv ? "<p>Ödeme için bu e-postaya yanıt verin, size bağlantı gönderelim.</p>" : ""}</form>`).join("");
    return html(res, 200, page(l.name + " için teklif", `<p>Alan adı, SSL, sunucu kurulumu ve ilk ay destek tüm paketlerde dahil. Ödemeden sonra marka bilgilerinizi istiyoruz ve 7 iş günü içinde yayına alıyoruz.</p>${rows}`));
  });
  route("POST", "/api/out/offer/:token/:pack", async ({ params, body, res }) => {
    const l = byToken(params.token), p = packs().find((x) => x.id === params.pack); if (!l || !p) return html(res, 404, page("Teklif bulunamadı", ""));
    const id = "GO" + Date.now().toString(36).toUpperCase().slice(-6) + crypto.randomBytes(2).toString("hex").toUpperCase();
    q("INSERT INTO out_offers(id,lead_id,pack,title,amount,reference) VALUES(?,?,?,?,?,?)").run(id, l.id, p.id, p.ad, p.fiyat, id);
    touch(l.id, "stage=CASE WHEN stage IN ('odendi','teslim') THEN stage ELSE 'odeme' END");
    if (body.m === "havale" || !billing.cardOn()) { const h = billing.havale(); return html(res, 200, page("Havale / EFT bilgileri", h ? `<p><b>${esc(p.ad)}</b> · ${tl(p.fiyat)}</p><p>IBAN: <b>${esc(h.iban)}</b><br>Alıcı: ${esc(h.name)}<br>Banka: ${esc(h.bank)}<br>Açıklama: <b>${id}</b></p><p>Ödeme ulaştığında e-posta ile haber vereceğiz.</p>` : "<p>Havale bilgisi henüz tanımlı değil; bu e-postaya yanıt verin.</p>")); }
    const ses = await billing.stripe("POST", "/checkout/sessions", { mode: "payment", "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "try", "line_items[0][price_data][unit_amount]": String(p.fiyat), "line_items[0][price_data][product_data][name]": p.ad + " · " + l.name, "metadata[offer_id]": id, customer_email: l.email || "", success_url: cfg.api + "/api/out/paid/" + id, cancel_url: cfg.api + "/api/out/offer/" + l.token });
    q("UPDATE out_offers SET session=? WHERE id=?").run(ses.id, id);
    res.writeHead(303, { Location: ses.url }); res.end(); return null;
  });
  async function markPaid(o, ref) {
    if (!q("UPDATE out_offers SET status='paid', paid=datetime('now'), reference=COALESCE(?,reference) WHERE id=? AND status='pending'").run(ref || null, o.id).changes) return false;
    const l = lead(o.lead_id), a = jparse(l.audit), orderId = "M" + crypto.randomBytes(5).toString("hex").toUpperCase();
    // Siparişler'e düşer: oradan Yapım Kuyruğu, yayın ve mağaza teslimi mevcut akışla ilerler
    q("INSERT INTO orders(id,data,customer_name,phone,email,brand,total,status) VALUES(?,?,?,?,?,?,?,?)").run(orderId, JSON.stringify({ kaynak: "Müşteri Avı", paket: o.title, teklif: o.id, sektor: sectorOf(l.sector)?.ad, sablon: a.tpl, uygulama: a.app, site: l.website, harita: l.maps_url, adres: l.address, sorunlar: a.problems }), l.name, l.phone || "", l.email || "", l.name, o.amount / 100, "Ödendi · yapım bekliyor");
    touch(l.id, "stage='odendi', order_id=?, next_at=NULL", orderId);
    const v = vars(l); if (l.email) await deliver(lead(l.id), fill(replies().odendi.konu, v), fill(replies().odendi.metin, v), null, "cevap").catch(() => { });
    if (adminEmail()) send({ to: adminEmail(), subject: "💰 Müşteri Avı: " + l.name + " ödedi (" + tl(o.amount) + ")", text: o.title + " · Sipariş " + orderId, html: toHtml(o.title + " · Sipariş " + orderId) }).catch(() => { });
    return true;
  }
  async function verifyOffer(o) { if (!o?.session || o.status !== "pending") return; const s = await billing.stripe("GET", "/checkout/sessions/" + encodeURIComponent(o.session)); if (s.payment_status === "paid") await markPaid(o, s.payment_intent || s.id); }
  route("GET", "/api/out/paid/:id", async ({ params, res }) => { const o = q("SELECT * FROM out_offers WHERE id=?").get(params.id); if (o) await verifyOffer(o).catch(() => { }); const ok = q("SELECT status FROM out_offers WHERE id=?").get(params.id)?.status === "paid"; return html(res, 200, page(ok ? "Ödemeniz alındı 🎉" : "Ödeme kontrol ediliyor", ok ? "<p>Teşekkürler! Projeniz yapım kuyruğuna girdi; bir sonraki adımlar için e-postanızı kontrol edin.</p>" : "<p>Ödeme onaylandığında e-posta ile haber vereceğiz.</p>")); });
  route("POST", "/api/admin/outreach/offers/:id/paid", async ({ params, body }) => { const o = q("SELECT * FROM out_offers WHERE id=?").get(params.id); need(o, 404, "Teklif bulunamadı"); need(o.status === "pending", 400, "Bu teklif zaten kapanmış"); await markPaid(o, clip(body.reference, 120) || null); return { ok: true }; });
  route("POST", "/api/admin/outreach/leads/:id/delivered", ({ params }) => { touch(lead(params.id).id, "stage='teslim'"); return { lead: pub(lead(params.id)) }; });

  // ---------- Panel verisi ve ayarlar ----------
  route("GET", "/api/admin/outreach", ({ url }) => {
    const st = url.searchParams.get("stage") || "", term = clip(url.searchParams.get("q"), 80);
    const rows = q(`SELECT * FROM out_leads WHERE (?='' OR stage=?) AND (?='' OR name LIKE ? OR city LIKE ? OR email LIKE ?) ORDER BY CASE stage WHEN 'odeme' THEN 0 WHEN 'yanitladi' THEN 1 WHEN 'ilgili' THEN 1 ELSE 2 END, score DESC, updated DESC LIMIT 300`).all(st, st, term, "%" + term + "%", "%" + term + "%", "%" + term + "%").map(pub);
    const funnel = Object.fromEntries(q("SELECT stage, COUNT(*) n FROM out_leads GROUP BY stage").all().map((r) => [r.stage, r.n]));
    const revenue = q("SELECT COUNT(*) n, COALESCE(SUM(amount),0) a FROM out_offers WHERE status='paid'").get();
    const s = readS(), key = placesKey(), research = q("SELECT v FROM server_settings WHERE k GLOB 'outreach_research:*'").all().map((r) => jparse(r.v)).sort((a, b) => String(b.at).localeCompare(a.at))[0] || null;
    return { rows, funnel, stages: STAGES, sectors: SECTORS, revenue, sentToday: sentToday(), research, drafts: q("SELECT COUNT(*) n FROM out_messages WHERE status='taslak'").get().n,
      settings: { ...s, placesKey: undefined, places: !!key, placesLast4: key ? key.slice(-4) : "", placesFromEnv: !!process.env.GOOGLE_PLACES_API_KEY, mail: mailReady(), card: billing.cardOn(), havale: !!billing.havale(), steps: steps(), replies: replies(), packs: packs(), inboundUrl: s.inboundSecret ? cfg.api + "/api/out/inbound/" + s.inboundSecret : "" } };
  });
  route("GET", "/api/admin/outreach/leads/:id", ({ params }) => { const l = lead(params.id); return { lead: pub(l), messages: q("SELECT * FROM out_messages WHERE lead_id=? ORDER BY id").all(l.id), offers: q("SELECT * FROM out_offers WHERE lead_id=? ORDER BY created DESC").all(l.id), order: l.order_id ? q("SELECT id,status,live_url,updated FROM orders WHERE id=?").get(l.order_id) || null : null }; });
  route("POST", "/api/admin/outreach/settings", ({ body }) => {
    const s = readS(), n = { ...s };
    for (const [k, max] of [["city", 60], ["sender", 120], ["company", 160], ["address", 240]]) if (body[k] !== undefined) n[k] = clip(body[k], max).trim();
    if (body.replyTo !== undefined) { const r = String(body.replyTo || "").trim(); need(!r || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r), 400, "Yanıt adresi geçersiz"); n.replyTo = r; }
    if (body.dailyLimit !== undefined) { const d = +body.dailyLimit; need(Number.isInteger(d) && d >= 1 && d <= 500, 400, "Günlük sınır 1–500 arası olmalı"); n.dailyLimit = d; }
    for (const k of ["autoSend", "autoReply"]) if (body[k] !== undefined) n[k] = !!body[k];
    if (body.placesKey) { const k = String(body.placesKey).trim(); need(/^[A-Za-z0-9_-]{30,60}$/.test(k), 400, "Google API anahtarı biçimi tanınmadı (AIza… ile başlar)"); n.placesKey = encKey(k); }
    if (body.placesKey === "") n.placesKey = "";
    if (body.newInbound) n.inboundSecret = crypto.randomBytes(18).toString("hex");
    if (Array.isArray(body.steps)) { need(body.steps.length >= 1 && body.steps.length <= 10, 400, "Dizi 1–10 adım olmalı"); n.steps = body.steps.map((x, i) => ({ gun: Math.max(0, Math.min(120, Math.round(+x.gun || 0))), konu: clip(x.konu, 200) || "Adım " + (i + 1), metin: clip(x.metin, 4000) })); }
    if (body.resetSteps) n.steps = null;
    if (body.replies && typeof body.replies === "object") { n.replies = {}; for (const k of Object.keys(DEFAULT_REPLIES)) if (body.replies[k]) n.replies[k] = { konu: clip(body.replies[k].konu, 200), metin: clip(body.replies[k].metin, 4000) }; }
    if (Array.isArray(body.packs)) { need(body.packs.length >= 1 && body.packs.length <= 6, 400, "1–6 paket olmalı"); n.packs = body.packs.map((p, i) => { const f = Math.round(+p.fiyat * 100); need(f >= 10000 && f <= 100000000, 400, "Paket fiyatı 100 ₺ ile 1.000.000 ₺ arası olmalı"); return { id: clip(p.id, 20).replace(/[^a-z0-9-]/gi, "") || "p" + (i + 1), ad: clip(p.ad, 80) || "Paket", fiyat: f }; }); }
    writeS(n); return { ok: true };
  });

  // ---------- Otomatik dizi: zamanı gelen adımları gönder, bekleyen kart ödemelerini doğrula ----------
  let running = false;
  async function tick() {
    if (running) return; running = true;
    try {
      const s = readS();
      if (s.autoSend && mailReady()) for (const l of q("SELECT * FROM out_leads WHERE stage='gonderildi' AND opt_out=0 AND email IS NOT NULL AND next_at IS NOT NULL AND next_at<=datetime('now') ORDER BY next_at LIMIT 25").all()) {
        if (sentToday() >= (+s.dailyLimit || 40)) break;
        if (l.step >= steps().length) { touch(l.id, "stage='sessiz', next_at=NULL"); continue; }
        await sendStep(l, l.step + 1).catch(() => touch(l.id, "next_at=datetime('now','+1 day')"));
      }
      if (billing.cardOn()) for (const o of q("SELECT * FROM out_offers WHERE status='pending' AND session IS NOT NULL AND created>=datetime('now','-2 days') LIMIT 20").all()) await verifyOffer(o).catch(() => { });
    } finally { running = false; }
  }
  setInterval(() => tick().catch(() => { }), +process.env.OUTREACH_TICK_MS || 600000).unref();
  route("POST", "/api/admin/outreach/tick", async () => { await tick(); return { ok: true, sentToday: sentToday() }; });
}

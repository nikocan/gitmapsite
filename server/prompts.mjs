// Üretim istemleri: sistem istemi, tür kuralları ve kullanıcının bağladığı servislerin kuralları.
// Saf fonksiyonlardır; prompts.test.mjs ile test edilir.

export const GEN_SYSTEM = `Sen Gitmapp Stüdyo'nun kıdemli ön yüz mühendisi ve ürün tasarımcısısın. Kullanıcının fikrini TEK DOSYALIK, kendi içinde çalışan, gerçekten kullanılabilir ve yayınlanabilir kalitede bir web uygulamasına çevirirsin.
Çıktı biçimi:
- Yanıtın SADECE tam bir HTML dosyası olsun. İlk satır şu biçimde bir yorum olsun: <!-- ÖZET: (yaptığın şeyi 1-2 cümleyle Türkçe anlat) --> ardından <!DOCTYPE html>. Kod bloğu işareti (\`\`\`) ya da açıklama metni yazma.
- Stil için Tailwind CDN kullan: <script src="https://cdn.tailwindcss.com"></script>. Başka harici kütüphane gerekirse sadece cdn.jsdelivr.net veya unpkg.com kullan.
- JavaScript sade (vanilla) olsun. API anahtarı gerektiren hiçbir dış servis kullanma. Veriler tarayıcıda localStorage ile saklansın (try/catch ile; erişilemezse bellekte devam et).
Kapsam (çok önemli):
- Kullanıcının İSTEDİĞİ şeyi yap; istenmeyen bölüm ve özellik EKLEME. Özellikle kullanıcı istemedikçe WhatsApp/Telegram düğmesi, iletişim/başvuru formu, bülten aboneliği, sosyal medya bağlantıları, çerez bandı, sahte giriş ekranı, “Bize ulaşın” bölümü koyma.
- Fikir kısa ise eksikleri o fikrin doğal ihtiyaçlarıyla tamamla (ör. bir bütçe uygulamasında kategori, özet ve grafik); konuyla ilgisi olmayan şirket, marka ya da sektör içeriği uydurma.
Kalite çıtası:
- Önce kafanda veri modelini, ekranları ve durum (state) akışını kur; sonra kodu tek seferde, tutarlı ve eksiksiz yaz. Yarım fonksiyon, “TODO”, “...”, sahte/çalışmayan düğme bırakma: görünen her düğme ve bağlantı gerçekten çalışsın.
- Tek bir state nesnesi ve render fonksiyonlarıyla düzenli kod yaz; olay dinleyicilerini doğru bağla, konsola hata düşmesin.
- Arayüz tamamen Türkçe, mobil öncelikli (390px'te kusursuz, masaüstünde de düzgün), modern ve özenli olsun: tutarlı boşluk ritmi, net tipografi hiyerarşisi, yeterli kontrast (en az 4.5:1), dokunma hedefleri en az 44px, yumuşak geçişler.
- Boş ekran bırakma: ilk açılışta gerçekçi Türkçe örnek verilerle dolu görünsün. Boş durum, yükleniyor ve hata mesajları olsun; formlarda doğrulama olsun.
- Uygulamanın adı <title> etiketinde olsun.
- Mevcut bir HTML verilirse onu kullanıcının istediği değişiklikle güncelle ve DOSYANIN TAMAMINI döndür; istenmeyen kısımları bozma, mevcut özellikleri silme.`;

export const KIND_RULES = {
  app: "Bir UYGULAMA yap: ekranlar arası geçiş (alt sekme çubuğu ya da menü), veri ekleme/düzenleme/silme, liste ve özet görünümleri olsun.",
  site: "Bir WEB SİTESİ yap: etkileyici bir giriş bölümü (hero) ve konuya uygun bölümler (hizmetler/özellikler, referanslar, SSS, alt bilgi) olsun; iletişim bölümünü yalnızca konu gerektiriyorsa ekle. SEO için anlamlı başlıklar ve meta açıklaması ekle.",
  game: "Bir OYUN yap: <canvas> veya DOM ile akıcı oynanış (requestAnimationFrame, delta zamanlı), klavye + dokunmatik kontroller, başlat/duraklat/yeniden başla, skor ve en yüksek skor (localStorage), artan zorluk ve ses kapatma düğmesi olsun. Ekran oyunun kendisine ayrılsın: iletişim, WhatsApp, form, mağaza, hakkımızda gibi web sitesi öğeleri KOYMA. Telif hakkı olan karakter, isim veya görsel kullanma; tüm görseller kodla çizilsin.",
};

const clean = (v, n = 200) => String(v ?? "").replace(/[<>`"\\]/g, "").trim().slice(0, n);
const httpsUrl = (v) => /^https:\/\/[^\s<>"']{4,300}$/.test(v || "") ? v : "";

// Görünür öğe ekleyen servisler: yalnızca konuyla ilgiliyse kullanılır.
// words: isteğin bu servisi açıkça istediğini gösteren kelimeler. topics: servisin doğal olarak uyduğu konular.
const VISIBLE = {
  whatsapp: { words: /whats ?app|vatsap|wa\.me/i, topics: /sipariş|siparis|randevu|rezervasyon|iletişim|iletisim|teklif|menü|menu|restoran|kafe|cafe|mağaza|magaza|satış|satis|ürün|urun|kuaför|kuafor|klinik|emlak|otel|servis|destek|müşteri|musteri/i },
  telegram: { words: /telegram/i, topics: /iletişim|iletisim|topluluk|kanal|destek/i },
  email: { words: /e-?posta|mail/i, topics: /iletişim|iletisim|teklif|başvuru|basvuru|destek/i },
  form: { words: /form|başvuru|basvuru/i, topics: /iletişim|iletisim|başvuru|basvuru|teklif|kayıt ol|anket|rezervasyon|randevu/i },
  maps: { words: /harita|konum|adres|yol tarifi/i, topics: /restoran|kafe|mağaza|magaza|klinik|ofis|şube|sube|otel|salon|kuaför|kuafor|emlak/i },
  calendar: { words: /takvim/i, topics: /randevu|etkinlik|rezervasyon|ders programı|toplantı|toplanti/i },
  calendly: { words: /calendly|randevu/i, topics: /randevu|görüşme|gorusme|danışman|danisman|klinik|kuaför|kuafor/i },
  payment: { words: /ödeme|odeme|satın al|satin al|stripe|iyzico|paytr/i, topics: /mağaza|magaza|satış|satis|ürün|urun|bilet|abonelik|sipariş|siparis/i },
  instagram: { words: /instagram/i, topics: /kafe|restoran|marka|butik|kuaför|kuafor|fotoğraf|fotograf|sanat/i },
  youtube: { words: /youtube|video/i, topics: /video|kanal|eğitim|egitim|kurs/i },
  livechat: { words: /canlı destek|canli destek|sohbet|tawk/i, topics: /destek|müşteri|musteri|mağaza|magaza/i },
  github: { words: /github|kaynak kod/i, topics: /açık kaynak|acik kaynak|geliştirici|gelistirici/i },
};
// Veri servisleri: uygulamalarda veri saklama ihtiyacı varsa kullanılır.
const DATA = new Set(["supabase", "firebase", "sheets", "gmdb"]);
// Görünmeyen ölçüm/etiket servisleri: arayüzü değiştirmez, oyun dışında eklenir.
const SILENT = new Set(["analytics", "searchconsole", "pixel"]);

const CONN_RULES = {
  whatsapp: (c) => c.phone && `WhatsApp (${clean(c.phone).replace(/\D/g, "")}): sipariş/iletişim/randevu noktalarında https://wa.me/${clean(c.phone).replace(/\D/g, "")}?text=... bağlantısı kullan (mesajı encodeURIComponent ile hazırla). Uygun bir yer yoksa sağ altta küçük bir WhatsApp düğmesi yeterli.`,
  telegram: (c) => c.user && `Telegram: iletişim alanına https://t.me/${clean(c.user).replace(/^@/, "")} bağlantılı bir Telegram düğmesi ekle.`,
  email: (c) => c.email && `E-posta: iletişim bağlantılarında mailto:${clean(c.email)} kullan.`,
  form: (c) => httpsUrl(c.url) && `Form gönderimi: uygulamadaki iletişim/başvuru formlarını fetch ile ${httpsUrl(c.url)} adresine POST (FormData) olarak gönder, başarılı olunca teşekkür mesajı göster, hata olursa kullanıcıyı bilgilendir.`,
  maps: (c) => c.address && `Harita: “${clean(c.address)}” adresi için <iframe src="https://www.google.com/maps?q=${encodeURIComponent(clean(c.address))}&output=embed" loading="lazy"> ile harita göster ve “Yol tarifi al” düğmesi ekle (https://www.google.com/maps/dir/?api=1&destination=...).`,
  calendar: () => `Takvim: randevu/etkinlik gösterilen yerlere Google Takvim'e ekle bağlantısı koy (https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=YYYYMMDDTHHMMSS/YYYYMMDDTHHMMSS&details=...).`,
  calendly: (c) => httpsUrl(c.url) && `Randevu: ${httpsUrl(c.url)} adresini randevu al düğmesine bağla ve uygun bir bölümde iframe ile göm.`,
  payment: (c) => httpsUrl(c.url) && `Ödeme: “${clean(c.provider || "Ödeme", 40)}” ödeme bağlantısı ${httpsUrl(c.url)}. Satın al/öde düğmeleri bu bağlantıyı yeni sekmede açsın; kart bilgisi asla uygulamada toplanmasın.`,
  sheets: (c) => httpsUrl(c.url) && `Google E-Tablolar: kayıt ekleme/gönderme işlemlerinde verileri JSON olarak ${httpsUrl(c.url)} adresine (Apps Script web uygulaması) fetch ile POST et (mode:"no-cors" kullan) ve yerelde de sakla; “E-Tabloya gönder” düğmesi ekle.`,
  supabase: (c) => httpsUrl(c.url) && c.anon && `Supabase: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> ile createClient("${httpsUrl(c.url)}","${clean(c.anon, 400)}") kullan; verileri ${clean(c.table || "kayitlar", 40)} tablosunda tut (okuma/ekleme/güncelleme/silme). Hata olursa localStorage'a düş ve kullanıcıya bildir.`,
  firebase: (c) => c.config && `Firebase: Firebase JS SDK (gstatic CDN, modüler v10) ile şu yapılandırmayı kullan: ${clean(c.config, 600)}; verileri Firestore'da tut.`,
  gmdb: () => `Gitmapp Bulut Kayıt: verileri herkesle paylaşılan bulutta saklamak için window.GitmappDB (async get(anahtar), set(anahtar, değer), keys()) kullan. Bu nesne yalnızca yayındaki uygulamada vardır; yoksa (önizleme) localStorage'a düş. Kişisel/gizli bilgi saklama.`,
  analytics: (c) => /^G-[A-Z0-9]{4,15}$/.test(c.id || "") && `Google Analytics 4: <head> içine gtag.js ile ${c.id} ölçüm kimliğini ekle.`,
  searchconsole: (c) => c.code && `Google Search Console: <head> içine <meta name="google-site-verification" content="${clean(c.code, 100)}"> ekle; anlamlı title ve meta description yaz.`,
  pixel: (c) => /^\d{6,20}$/.test(c.id || "") && `Meta Pixel: <head> içine ${c.id} kimlikli standart Meta Pixel kodunu ekle; form gönderiminde Lead olayı tetikle.`,
  instagram: (c) => c.user && `Instagram: alt bilgide https://instagram.com/${clean(c.user).replace(/^@/, "")} bağlantısı ekle.`,
  youtube: (c) => httpsUrl(c.url) && `YouTube: ${httpsUrl(c.url)} videosunu/kanalını uygun bir bölümde youtube-nocookie gömme (iframe) ile göster.`,
  livechat: (c) => /^[a-f0-9]{24}\/[a-z0-9]{5,12}$/i.test(c.id || "") && `Canlı destek: Tawk.to sohbet kodunu https://embed.tawk.to/${c.id} ile ekle.`,
  github: () => `GitHub: alt bilgiye kaynak kodu bağlantısı için yer bırak.`,
};

// Bir servisin bu istekte kullanılıp kullanılmayacağına karar verir.
// "asked": istek servisi açıkça istiyor → kesin kural. "fits": konu uygun → isteğe bağlı kural. null → hiç gönderme.
export function connUse(id, { kind = "app", prompt = "", edit = false } = {}) {
  const text = String(prompt || "");
  const v = VISIBLE[id];
  if (v) {
    if (v.words.test(text)) return "asked";
    if (kind === "game" || edit) return null; // oyunlara ve küçük düzenlemelere istenmeden görünür öğe eklenmez
    return v.topics.test(text) ? "fits" : null;
  }
  if (DATA.has(id)) {
    if (edit) return /kaydet|sakla|veritaban|bulut|senkron|paylaş|paylas|skor tablosu|liderlik|supabase|firebase|e-?tablo|sheets/i.test(text) ? "asked" : null;
    if (kind === "game") return /skor tablosu|liderlik|leaderboard|çok oyunculu|cok oyunculu|bulut/i.test(text) ? "asked" : null;
    return "fits";
  }
  if (SILENT.has(id)) return kind === "game" || edit ? null : "fits";
  if (id === "custom") return edit ? null : "fits";
  return null;
}

export function connRules(list, opts = {}) {
  if (!Array.isArray(list)) return "";
  const asked = [], fits = [];
  for (const it of list.slice(0, 16)) {
    if (!it || typeof it !== "object") continue; const c = it.cfg && typeof it.cfg === "object" ? it.cfg : {};
    const use = connUse(it.id, opts); if (!use) continue;
    let r;
    if (it.id === "custom") { const u = httpsUrl(c.url); r = u && `Özel API “${clean(c.name || "API", 40)}” (${u}): ${clean(c.desc, 300)}. Gerektiğinde fetch ile çağır, hata durumlarını ele al; uygulamaya gizli anahtar yazma.`; }
    else { const f = CONN_RULES[it.id]; r = f && f(c); }
    if (r) (use === "asked" ? asked : fits).push(r);
  }
  let out = "";
  if (asked.length) out += "\n- Kullanıcının istediği bağlı servisler (bunları kullan):\n  • " + asked.join("\n  • ");
  if (fits.length) out += "\n- Kullanıcının hesabında bağlı servisler (YALNIZCA uygulamanın amacına doğal olarak uyuyorsa kullan; uymuyorsa hiç ekleme, zorla yer açma):\n  • " + fits.join("\n  • ");
  return out;
}

// Profil (iş alanı) bilgisinin bu projeyle ilgili olup olmadığı: oyunlarda ve konu dışı fikirlerde kullanılmaz.
export function profileRelevant(kind) { return kind !== "game"; }

export function scopeRule(kind) {
  return kind === "game"
    ? "\n- KAPSAM: Bu bir oyun; yalnızca oyunu yap. İletişim, WhatsApp, form, menü sayfası, hakkımızda gibi öğeler ekleme."
    : "\n- KAPSAM: Yalnızca istenen ürünü yap; yukarıda listelenmeyen iletişim düğmesi, form ya da sosyal medya öğesi ekleme.";
}

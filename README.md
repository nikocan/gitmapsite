# Gitmapsite — Uygulama Dünyası

GitHub'daki açık kaynak projelerden, lisansı ve güvenliği kontrol edilmiş hazır uygulamaları işletmelere sunan; markaya göre özelleştirip alan adı, Hostinger sunucusu ve istenirse App Store / Google Play'e kadar teslim eden platform.

- Canlı: https://gitmapp.com (yedek: https://nikocan.github.io/gitmapsite/)
- Müşteri görünümü: Uygulama Dünyası, Uygulamamı Oluştur, Paketler, Yapay Zekâ Destekleri, Taleplerim
- Yönetici görünümü: Siparişler, İş Planı & Gelir, GitHub Radar, İş Kolları, Listem, Yapım Kuyruğu, Ayarlar
- Sürüm notları: uygulama içinde **Güncellemeler** sekmesi

## Oturumlar, oturum dalları ve PR (v5.80)

- **Oturumlar:** sol menüde çalışma geçmişi (`localStorage` `sessions:<hesap>`), depo/çalışma alanına göre gruplanır ve son etkinliğe göre sıralanır. Ayrılırken oturumun son hâli `sessSnap:<kapsam>` olarak saklanır (son 10 oturum); tıklayınca yüklenir.
- **Arka plan:** giriş yapmış kullanıcının üretimleri sunucu işi olarak sürer. İstemci iş kimliğini önceden (`jobId`) gönderir, sunucu işi bağlantı kurulmadan kaydeder. Sol menü süren işleri `GET /api/ai/jobs/:id` ile 4 sn'de bir yoklar ve sürüyor/bitti/hata simgesini gösterir.
- **Oturum dalı:** yeni oturum varsayılan olarak yeni dalda açılır (`gitmapp/<proje>-xxxx`). Dalda her üretimden sonra otomatik commit atılır.
- **Uç noktalar:** `GET /api/apps/:id/git/compare` (önde/geride, PR), `POST /api/apps/:id/git/merge` (yalnız Gitmapp; main'e birleşince proje taslağı güncellenir), `POST /api/apps/:id/git/pulls`, `POST /api/apps/:id/git/pulls/:n/merge`.
- Testler: `node --test server/version-control.test.mjs`, tarayıcıda `node tools/acceptance/v580.mjs` (sahte GitHub sunucusu `TEST_GH_API` ile).

## Geliştirme akışı ve otomatik kayıt (v5.78)

- Akış Claude Code düzenindedir: son işin adımları açık, öncekiler tek özet satırında (adım sayısı, süre, boyut, model, kredi); tıklayınca açılır. “Kod yazıldı” adımı modelin yazdığı kodun son 4.000 karakterini gösterir.
- Çıktı tek satırdır (index.html +/−, önizle/kod/commit simgeleri). Tasarım denetimi sorun yoksa tek satır; önizleme üstündeki durum penceresi yalnızca sorun veya kod kontrolü bulgusunda açılır. Beceriler çubuğu Stüdyo'da kapalı başlar (`skDockWs`).
- **Otomatik kayıt:** giriş yapılmışsa taslak ve yayınlanmamış projeler değişiklikten ~2,5 sn sonra sessizce `POST/PUT /api/apps` ile kaydedilir (art arda 3 hatada durur). Yayındaki projeler canlı adresi değiştirmemek için otomatik kaydedilmez; **Yayınla** ile güncellenir. Dal üzerinde çalışırken kayıt commit ile yapılır.
- Test: `node tools/acceptance/v578.mjs`.

## Yeni sohbet, ortam seçici ve sık kullanılanlar (v5.77)

Claude Code (claude.ai/code) ve ChatGPT Codex düzenini izler: her sohbet bir **ortamda** (depo + dal) çalışır.

- **Yeni sohbet** düğmesi sol menünün en üstündedir (⌘/Ctrl+Shift+O). Üç başlangıç: *Bu projede yeni sohbet* (dosyalar, sürümler ve dal korunur; sohbet tertemiz başlar), *Boş sayfa* (yeni proje) ve *Bir depodan*.
- **Ortam seçici:** Bulut sekmesi kayıtlı Gitmapp projelerini, GitHub sekmesi `GET /api/me/github/repos` ile bağlı hesabın yazabildiği depoları listeler; dal adı girilebilir. Son ortam `localStorage` `nsLast` anahtarında tutulur.
- **Mod:** Hızlı, Plan (`planli`, önce plan) veya Ajan. İlk mesaj yazılırsa sohbet açılır açılmaz gönderilir.
- **Sohbetler** proje kapsamına göre `studioChats:<kapsam>` anahtarında saklanır (en fazla 20 sohbet, her biri son 40 mesaj). Sol menüde proje adının altında ve Stüdyo üst çubuğunda listelenir. Taslak buluta kaydedilip kimlik değişince sohbetler yeni kapsama taşınır.
- **Projeye ekle:** üst çubuktaki depo simgesi, açık sayfayı seçilen projeye yeni ekran olarak ekletir (yapay zekâ menü bağlantısı ve tasarım uyumu yapar).
- **Sık kullanılanlar:** sol menüde iki tonlu simgelerle üçlü ızgara; kalem simgesiyle düzenlenir (`favNav`). Simgeler `brand/ecosystem.svg` içinde: `newchat`, `chats`, `plan`, `environment`, `repo`, `branch`, `favorites`.
- Testler: `node --test server/version-control.test.mjs` ve tarayıcıda `node tools/acceptance/v577.mjs`.

## Keşif hafızası ve kişisel öneriler

**Keşfet** sayfası kullanıcının aramalarını, açtığı uygulamaları, canlı denediği şablonları, baktığı temaları ve Stüdyo’ya yazdığı ilk fikirleri tarayıcıda (`localStorage`, `gms_taste`) tutar. Sunucuya veri gönderilmez. Her yeni sinyal eski sinyalleri biraz zayıflatır; böylece profil son ilgilere göre değişir.

Profilden sektör ilgisi, renk eğilimi (ağırlıklı ton ortalaması), koyu/açık zemin tercihi ve en uygun tasarım dili hesaplanır. Bu profil şu yerlerde kullanılır:

- **Senin tarzın** kartı: tahmin edilen tema, renk paleti, ilgi alanları, son aramalar ve **Bu tarzla yeni proje** düğmesi.
- **Sana özel** rafı: şablonlar profile göre sıralanır, her önerinin gerekçesi yazılır; son denenen şablona benzeyenler ayrı rafta gösterilir.
- Akıllı arama kutusu: yazarken geçmiş aramalar, şablon adları ve sektör sözcükleri önerilir; yazılan fikirden sektör ve tasarım tahmin edilip **Bu fikirle başla** sunulur.
- Arama sonuçları: **İlgili aramalar** ve **Aramana uygun şablonlar**.
- Stüdyo’da **Otomatik tasarım**: sektörün önerdiği temalar profile göre yeniden sıralanır.

Kullanıcı kartın ⋯ menüsünden hafızayı sıfırlayabilir veya kapatabilir.

Giriş yapmış kullanıcının hafızası hesabında da tutulur (`user_taste` tablosu; `GET`, `PUT`, `DELETE /api/me/taste`). Girişte cihazdaki ve hesaptaki profil birleştirilir, sonraki değişiklikler birkaç saniye gecikmeyle yazılır. Sunucu gelen veriyi temizler: yalnızca beklenen alanlar, sınırlı sayıda anahtar, geçerli renk kodları ve en fazla 32 KB. Hafıza kapatıldığında hesaptaki veri de boşaltılır. Testler: `node --test server/taste.test.mjs`.

## Stüdyo işlem akışı

Her üretim adımı kısa bir anlatım cümlesi ve altında açılır bir işlem satırı olarak gösterilir. Çalışan satırda turuncu-sarı nokta göstergesi ve süre bulunur. İş bitince adımlar "Çalıştırıldı N adım" satırında toplanır. Önizlemenin sağ altındaki durum penceresi son adımın çıktısını (satır farkı, onarılan hatalar, süre, kredi), kod kontrolü bulgularını ve önizleme sorunlarını gösterir; sorun varsa **Düzelt** ile otomatik onarım başlatılır.

## Telefon uyumu (iPhone ve Android)

Gitmapp ana ekrana eklenebilen bir web uygulamasıdır (`manifest.webmanifest`: maskelenebilir simgeler, kısayollar, tam ekran). `sw.js` sayfayı her açılışta yeniler ve bildirime dokunulunca açık pencereye geçer.

- **Kurulum:** Android ve masaüstü Chrome'da `beforeinstallprompt` ile tek dokunuşla; iPhone'da Paylaş › Ana Ekrana Ekle adımlarını gösteren sayfa. Kart ikinci ziyarette çıkar, kapatılırsa 14 gün gösterilmez.
- **Bildirim ve rozet:** Stüdyo'da iş bittiğinde sayfa arka plandaysa bildirim ve uygulama rozeti. İzin ilk başarılı üretimden sonra istenir. iPhone'da yalnızca ana ekrana eklenmiş uygulamada çalışır (iOS 16.4+).
- **Titreşim ve ekran kilidi:** Android'de kısa titreşim; üretim sürerken Screen Wake Lock.
- **Dokunmatik düzen:** dokunmatik ekranda giriş alanları 16 px (iOS yakınlaştırması olmaz), en az 38 px dokunma alanı, klavye açıkken alt menü gizlenir (`html.kb-open`), güvenli alan boşlukları (`viewport-fit=cover`).
- **Ayarlar › Telefon:** bu seçenekler ve cihazda çalışan özelliklerin listesi.

## Yönetici girişi

Yönetim merkezini çalışma alanı menüsündeki **Yönetici** düğmesinden veya `/#yonetim` adresinden açın. Doğrudan bir yönetim sayfasına giden kullanıcı, girişten sonra aynı sayfaya döner.

Sunucuda `ADMIN_EMAIL` yöneticiye ait e-posta adresidir. `deploy/setup-api.sh` bu adresi ilk kurulumda ister. Operatör, API servisiyle aynı ortam değişkenleri ve aynı `DB_PATH` ile `node server/server.mjs create-admin` çalıştırarak parola oluşturabilir. Komut mevcut parolayı korur. Bilinçli bir parola değişikliği için `reset-admin` kullanılır. Yeni parola operatör terminalinde bir kez gösterilir ve önceki yönetici oturumları kapatılır. Google veya GitHub ile giriş için ilgili sağlayıcının istemci kimliği ve sırrı sunucuda tanımlanmalı, sağlayıcı yönetici adresini doğrulamalıdır.

**Kullanıcılar** sayfası hesap arama ve kredi yüklemeyi, **Projeler** sayfası proje sahibini, yayın durumunu ve mağaza görünürlüğünü yönetir. **Ayarlar** üzerinden kaydedilen işletme bilgileri ve paket fiyatları müşterilerle paylaşılır. Yönetim API testlerini `node --test server/admin.test.mjs` ile çalıştırabilirsiniz.

## Stüdyoda sürüm kontrolü

Hızlı yol: giriş alanının altındaki çubukta **dal adına** tıklayın. Menü dalları listeler, yazdığınız ada göre süzer, tıklanan dala geçer ve listede olmayan bir ad yazıldığında o adla yeni dal açar. **Bulut / GitHub** düğmesi dalların nerede tutulacağını seçer.

**Geliştir → Dallar** panelinde bir kaynak ve başlangıç dalı seçin. **Yeni dal** ile çalışma dalını açın. Stüdyoda düzenleme yaptıktan sonra panelde `index.html` farkını inceleyin, bir commit mesajı yazın ve kaydedin.

Gitmapp sekmesi geçmişi proje sahibinin hesabında, SQLite üzerinde tutar. GitHub sekmesi mevcut OAuth bağlantısını kullanır. Kendi hesabınızda yazma yetkiniz bulunan bir depoyu bağlayabilir veya yeni, herkese açık bir depo oluşturabilirsiniz. GitHub commit’i seçilen daldaki kök `index.html` dosyasını günceller. Dal başka bir yerde ilerlediyse panel yeni sürümle karşılaştırmanızı ister.

Bir dalı Gitmapp projesinde kullanmak için **Çalışmayı proje taslağına aktar** seçeneğini kullanıp projeyi kaydedin. Yayın işlemini Stüdyo’nun **Yayınla** düğmesinden başlatabilirsiniz. Sürüm kontrolü testleri Node.js üzerinde `node --test server/version-control.test.mjs` komutuyla çalışır.

## Kredi ve ödemeler

Kullanıcılar **Kredi yükle** penceresinden paket seçer, kartla (Stripe Checkout) ya da Havale/EFT ile öder. Yönetim → **Kredi ve ödemeler** sayfası gelirleri, bekleyen ödemeleri, havale onayını, iptali ve iadeyi; paket fiyatlarını, hoş geldin kredisini, davet bonusunu ve işlem başı krediyi yönetir.

Stripe kurulumu: dashboard.stripe.com › Developers › API keys sayfasındaki **Secret key**'i panele girin. Webhooks › Add endpoint adresi `https://api.gitmapp.com/api/payments/stripe/webhook`, olaylar `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`. Webhook'un **Signing secret** değerini (`whsec_…`) panele girin. Anahtarlar sunucuda şifreli saklanır; isterseniz `STRIPE_SECRET_KEY` ve `STRIPE_WEBHOOK_SECRET` ortam değişkenleri paneldeki değerin önüne geçer. Webhook gelmese de ödeme, kullanıcı Stripe'tan döndüğünde doğrulanır. Bir ödeme yalnızca bir kez krediye dönüşür.

Testler: `node --test server/payments.test.mjs` (sahte Stripe ile) ve uçtan uca `node tools/acceptance/e2e.mjs`.

## Müşteri Avı (Yönetim → Müşteri Avı)

Gitmapp'in kendi müşterisini bulduğu satış hattı: **sektör araştırması → Google Haritalar'dan aday → site analizi → 10 adımlı teklif dizisi → gelen yanıta otomatik cevap → teklif sayfasında ödeme → Siparişler**.

- **Google Places API (New)** anahtarı panelden girilir (şifreli saklanır) ya da `GOOGLE_PLACES_API_KEY` ile verilir. Haritalar sayfası kazınmaz.
- Site analizi mobil uyum, https, hız, telif yılı, online randevu/WhatsApp eksikliğini ölçer ve siteden e-posta bulur; `AI_KEY` tanımlıysa yapay zekâ işletmeye özel 3 sorun ve uygulama fikri yazar. Sunucuda `playwright` kuruluysa telefon ekran görüntüsü alınır.
- E-postalar mevcut **E-posta gönderimi** ayarlarıyla gider; her iletide firma unvanı, adres ve listeden çıkma bağlantısı (`/api/out/unsub/…`) bulunur; günlük sınır vardır.
- Gelen yanıtlar `POST /api/out/inbound/<gizli>` adresine `{from, subject, text}` olarak gönderilir (Hostinger Mail webhook, Resend Inbound, Cloudflare Email Worker, Zapier). Telefon/WhatsApp/Facebook yanıtları aday kartından elle eklenir.
- Teklif sayfası `GET /api/out/offer/<token>`: kart (mevcut Stripe anahtarı) ya da havale. Ödeme alınınca `orders` tablosuna “Ödendi · yapım bekliyor” durumunda sipariş açılır.
- Zamanı gelen dizi adımları her 10 dakikada gönderilir (`OUTREACH_TICK_MS`). Testler: `node --test server/outreach.test.mjs`.

## Beceriler ve Beceri Avcısı

Kullanıcı Beceriler panelinden **uygulama planı** (CRM, ön muhasebe/e-Fatura, ERP, stok, B2B bayi, POS, İK, randevu, proje, helpdesk, EBYS, beyaz masa, saha servis, filo, okul, satın alma, klinik, e-ticaret), **tasarım** ve **kalite** becerisi yükler. İstemci yalnızca beceri kimliklerini gönderir (`settings.skills`); metni sunucu ekler. Plan becerisi seçilince bağlı tasarım becerisi ve temiz mimari kendiliğinden eklenir. Katalog: `server/skills-catalog.mjs`.

- Her üretim `skill_runs` tablosuna yazılır: sonuç (temiz / otomatik onarıldı / sözdizimi hatası) ve kullanıcının 👍/👎 oyu (`POST /api/skills/feedback`) başarı oranını oluşturur.
- **Beceri Avcısı** (Yönetim): GitHub'da lisanslı, güncel, 200+ yıldızlı açık kaynak muadilleri bulur; README'den öğrendiği işlevlerle aday sürüm yazar (kod kopyalanmaz). `GITHUB_TOKEN` tanımlanırsa arama sınırı yükselir.
- **Test:** aday ve yayındaki sürüm aynı test istemiyle üretilir; beklenen kavramlar, sözdizimi, mobil uyum ve içerik miktarıyla 0–100 puanlanır; aday eşit ya da daha iyiyse yayına alınır.
- **İyileştirme:** 8+ kullanımı olup başarısı %70'in altında kalan beceriler 6 saatte bir hata notlarından yeniden yazılıp test edilir (`SKILLS_TICK_MS`). Tüm sürümler saklanır.
- Testler: `node --test server/skills.test.mjs`.

## Yapay zekâ sağlayıcıları ve maliyet

**Önerilen yapılandırma (v5.72):** ana sağlayıcı Claude (Anthropic, doğrudan). `ANTHROPIC_API_KEY` tanımlıysa sunucu bir kez kendiliğinden bu yapılandırmaya geçer (önce anahtarı doğrular, önceki ayarları saklar; `AI_PROFILE_AUTO=0` ile kapatılır). Roller: Sonnet uygulama üretimi, Opus güçlü mod, Haiku plan/yapılacaklar/Asistan/Rehber; yedek sırası OpenRouter → OpenAI → Gemini. Anthropic isteklerinde sunucu yerel Messages API'yi kullanır (`server/anthropic.mjs`), çünkü OpenAI uyumlu katman istem önbelleğini desteklemez. Yönetim › Yapay zekâ sağlayıcıları sayfasındaki "Önerilen yapılandırma" kartından uygulanır, yenilenir ya da önceki ayarlara dönülür.

**Maliyet:** API giderleri dolar olarak kaydedilir (giriş, önbellekten okunan, önbelleğe yazılan ve çıkış token'ları ayrı). Model fiyatları OpenRouter'ın herkese açık listesinden günde bir otomatik güncellenir (`AUTO_RATES=0` kapatır; panelden girilen tarife önceliklidir). Dolar/TL kuru günde iki kez otomatik alınır, panelden elle de girilebilir. Kokpit'te "Canlı · modeller ve harcama" bölümü anlık durumu gösterir.

Eski düzende platform çağrıları `AI_BASE` / `AI_KEY` (Hostinger AI Router) üzerinden yapılırdı. `AI_BASE` OpenAI uyumlu herhangi bir uç nokta olabilir; örneğin doğrudan OpenRouter için `AI_BASE=https://openrouter.ai/api/v1`, `AI_KEY=sk-or-…` ve `AI_MODELS` içinde OpenRouter model adları (`anthropic/claude-sonnet-4.5,openai/gpt-5.2`).

**Yedek sağlayıcı zinciri:** birincil sağlayıcı 402 (bakiye bitti), 403, 404 (model yok), 408, 429 ya da 5xx döndürürse istek sırayla aşağıdaki anahtarlı sağlayıcılara aynı ya da en yakın modelle gider. Tanımlanmayan sağlayıcı atlanır.

| Değişken | Açıklama |
| --- | --- |
| `OPENROUTER_API_KEY` | OpenRouter anahtarı (tek anahtarla Claude, GPT, Gemini, DeepSeek, Qwen) |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY` | Doğrudan sağlayıcı anahtarları |
| `AI_FALLBACKS` | Deneme sırası (varsayılan `hostinger,openrouter,anthropic,openai,gemini,deepseek`; ana sağlayıcı kendi yedeği olmaz) |
| `HOSTINGER_AI_KEY` | Hostinger AI Router yedeği; tanımlı değilse sunucu dosyasındaki Hostinger `AI_KEY` kullanılır |
| `PROMPT_CACHE` | `0` yapılırsa Claude istem önbelleği kapanır (varsayılan açık). Sistem istemi ve 12.000 karakterden büyük "Mevcut dosya" mesajı önbelleğe alınır |
| `HELPER_MODEL` | Plan, yapılacaklar, Asistan ve Rehber gibi yardımcı çağrıların modeli. Boşsa platform listesindeki ilk hızlı model (ör. `gpt-5.4-mini`); `off` yazılırsa kullanıcının seçtiği model kullanılır. Asıl sayfa üretimi her zaman seçilen modelle yapılır |
| `COPILOT_MODEL`, `VISION_MODEL` | Asistan ve görsel okuma için sabit model |

`/api/health` yanıtındaki `aiFallbacks` alanı etkin yedekleri listeler. Yedek testleri: `node --test server/failover.test.mjs`.

## Stüdyo tasarım becerileri

Stüdyo’da **Geliştir → Tasarım** bölümünde bir öğe seçin. Önerilen beceriye dokunun, isteğinizi yazın veya seçili öğenin istek alanına `@Mobil menüyü düzenle` girin. Önizlemeyi inceleyip **Seçime uygula** ile kabul edin. Giriş yapmış kullanıcılar önerilen tarifi düzenleyip **Beceri olarak kaydet** ile diğer projelerinde kullanabilir. **Ekle → Beceriler → Tasarım sahnesi** hazır ve kişisel tarifleri listeler.

Platformun otomatik modunda `SKILL_MODEL` sağlayıcı kataloğunda varsa önceliklidir. Sonraki tercihler katalogdaki `qwen2.5-coder:3b`, hızlı sınıftaki ilk model ve platform varsayılanıdır. Katalog `AI_MODELS` ile sınırlandırılmışsa istenen modelin tam kimliğini bu listeye ekleyin. Elle seçilen model ve kişisel sağlayıcı ayarları tasarım sahnesinde de geçerlidir.

## GitHub Radar ve üretim ajanı

**Yönetim → GitHub Radar** proje türü, iş kolu, Stüdyo yolu ve güvenlik ön taramasına göre filtrelenir. Keşif skoru GitHub verilerinden hesaplanır. Ayrıntıdaki güvenlik ön taraması mevcut bağımlılık ve bakım sinyallerini gösterir. Depo incelemesi içe aktarılabilir HTML, derleme ihtiyacı ve yapay zekâ prototipi seçeneklerini belirler. **Tasarımda aç** ile Stüdyo’da bölüm ve öğe seçilebilir.

Radar’dan gelen taslaklarda **Yayın Merkezi** lisans ve güvenlik doğrulaması ile editör puanı ister. Ağırlıklar işlevler %50, kullanılabilirlik %30 ve sunum %20. Yayın eşiği 70/100. Yeni düzenlemeler ayrı bir yayın onayı alana kadar canlı adres ve mağaza kopyası önceki onaylı HTML’i sunar.

**Yönetim → Üretim ajanı** varsayılan olarak GitHub, MDN ve Smashing Magazine’i 24 saatte bir tarar. Aralık ve zamanlama panelden değiştirilebilir. Yapay zekâ üretimi panelden açılır. Günde en fazla bir özgün taslak üretir, aylık kredi sınırını kullanır ve sonucu yönetici projelerine kaydeder.

Mağazada ücretli ürünler için alıcı talep açar. Ödeme dış sağlayıcıda tamamlandığında yönetici **Üretim ajanı → Mağaza satışları** ekranında işlem referansını kaydeder. Teyit, alıcının düzenlenebilir kopyasına erişim verir.

## Depo (site görsellerini indir ve ayrıştır)

**Katalog › Depo** bir site adresini 1–25 sayfa tarar; görselleri (img, srcset, data-src, CSS arka planları, og:image, favicon, satır içi SVG) indirir, dosya imzasından doğrular, tekrarları ayıklar ve Logo, İkon, Banner, Ürün, Galeri, Kişi, Arka plan, Paylaşım görseli olarak ayrıştırır. Menü kategorilerini, renk/yazı tipi temasını (Tema CSS), betiksiz ekran kopyasını ve bölüm bileşenlerini çıkarır. Depodan Stüdyo'ya şablon açılır, her şey ZIP olarak indirilir.

Dosyalar `DEPO_DIR` (varsayılan: veritabanının yanında `depo/`) altında tutulur ve `/api/depo/f/...` adresinden herkese açık sunulur. Yalnız herkese açık adresler taranır; `DEPO_ALLOW_LOCAL=1` yalnızca testler içindir. robots.txt kurallarına uyulur. Testler: `node --test server/depo.test.mjs` ve tarayıcıda `node tools/acceptance/depo.mjs`.

## Sektör kurulum planları

**Stüdyo → Ekle → Beceriler** veya **Beceriler → Kurulum planlarını keşfet** bölümünde uygulama hedefini yazın veya sektör seçin. Açılan planda işin durumları, temel kayıtlar ve tamamlanma koşulu yer alır. Planın tamamını ya da tek bir aşamayı Stüdyo’daki düzenlenebilir isteme aktarabilirsiniz. **Asistana danış** aynı hedefle bir sohbet taslağı açar. İlerleme, her plan için bu tarayıcıda işaretlenir.

Katalog 24 sektör, 240 ayrı iş akışı ve sektör başına 200 uygulama görevinden oluşur. Her sektörde 10 iş akışı, her akışta beş aşama ve aşama başına dört çıktı vardır. Örneğin yazılımda sürüm onayı, sağlıkta randevu çakışması ve perakendede kısmi iade farklı kayıtlarla ve kabul koşullarıyla tanımlanır. Veri modeli, işlem listesi ve kabul testi gibi yeniden kullanılan görevler, seçilen iş akışının kayıtlarını ve kurallarını alır. Ayrıca 16 ortak beceri katalogda yer alır. Mevcut tasarım, kalite ve modül becerilerine **Becerileri yönet** düğmesinden de ulaşılabilir.

### Araştırma kaynakları ve kapsam

- Sektörlerin kapsama kontrolü için NACE Rev. 2.1’in A–V bölümleri kullanıldı. Etiketler Türkçe ürün araması için düzenlendi. Restoran ve güzellik ayrı sektör kartları olarak öne çıkarıldı. Uygulama hedeflerini belirlerken mesleklerin günlük iş ve görevlerinden yararlanıldı. [Eurostat NACE](https://ec.europa.eu/eurostat/web/nace) · [O*NET Content Model](https://www.onetcenter.org/content.html) · [ESCO](https://esco.ec.europa.eu/en/about-esco/faq)
- Ticaret, lojistik ve turizmde sipariş, iade, izlenebilirlik, sefer ve rezervasyon veri akışları incelendi. [Shopify sipariş ve gönderim](https://shopify.dev/docs/apps/build/orders-fulfillment) · [GS1 EPCIS](https://www.gs1.org/standards/epcis) · [GTFS](https://gtfs.org/documentation/overview/) · [OpenTravel](https://opentravel.org/download-specs/) · [Odoo restoran iş akışları](https://www.odoo.com/documentation/saas-19.3/applications/sales/point_of_sale/restaurant.html)
- Sağlık, eğitim, saha ve imalatta kayıtlar ile süreç sınırları incelendi. Randevu, sınıf, kalite kontrol ve saha konusu için bu belgelerden hareketle uygulama görevleri yazıldı. [HL7 FHIR kaynakları](https://hl7.org/fhir/resourcelist.html) · [OneRoster](https://www.1edtech.org/standards/oneroster) · [ISA-95](https://opcfoundation.org/markets-collaboration/isa-95/) · [Frappe üretim](https://docs.frappe.io/erpnext/manufacturing) · [buildingSMART BCF](https://www.buildingsmart.org/standards/bsi-standards/bim-collaboration-format/) · [OGC SensorThings](https://docs.ogc.org/is/23-019/23-019.html)
- Kamu, finans ve uluslararası çalışmalarda başvuru durumu, tedarik sürümü, işlem birleştirme ve faaliyet kaydı örnekleri incelendi. GİB kaynağı Türkiye’deki e-Arşiv Fatura akışına bağlandı. [Open311](https://wiki.open311.org/GeoReport_v2/) · [Open Contracting](https://standard.open-contracting.org/latest/en/) · [ISO 20022](https://www.iso.org/standard/20022-1) · [Stripe Billing](https://docs.stripe.com/billing) · [GİB e-Arşiv Fatura](https://cdn.gib.gov.tr/api/gibportal-file/file/getFileResources?objectKey=arsiv%2Fyardim-kaynaklar%2Finfografikler%2Fpdfs%2Fe_arsiv_fatura.pdf) · [IATI](https://reference.iatistandard.org/en/iati-standard/)
- Keşif, ayrıntı ve uygulama arasındaki geçiş için aşamalı gösterim kullanıldı. Kullanıcı aktarmadan önce çıktıyı ve kabul koşulunu görür. Klavye ve telefon kullanımına uygun yerleşim için W3C’nin diyalog ve erişilebilirlik kılavuzlarından yararlanıldı. [Agent Skills](https://agentskills.io/specification) · [Microsoft Human–AI Interaction](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/) · [W3C modal diyalog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) · [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

Sektörel kaynaklar veri ve iş akışlarını araştırmak için referanstır. Katalogdaki özgün yönergeler Stüdyo’nun örnek veriyle başlatılan uygulama üretimine yön verir. Canlı ödeme, bildirim ve dış sistem akışları ilgili proje bağlantılarının kurulmasını gerektirir. Beceri tercihleri tarayıcıda saklanır. Planlama, Ajan ve üretim isteklerine ilgili etkin sektör becerilerinden en fazla ikisi, istem bütçesi içinde eklenir.

## Sektör şablonları

**Şablonlar** sayfasında kategori ve tema seçerek telefon, tablet veya masaüstü önizlemesini açın. **Sektör HTML dosyaları** seçilen kategorinin 50 görünümünü ayrı dosyalar olarak listeler.

Bir şablon veya tema değiştiğinde sektör dosyalarını tekrar üretmek için `node tools/build_sector_themes.mjs` çalıştırın. Dosyalar `templates/sectors/` altında üretilir. Sektör dizini ve Stüdyo aktarımı `python tools/acceptance/sector_themes.py` ile doğrulanır.

**Keşfet** ve **Şablonlar** içindeki **Figma referansları** seçkisini güncellemek için `validation/catalog/envato-mobil-2026.csv` dosyasını düzenleyip `python tools/build_mobile_references.py` çalıştırın.

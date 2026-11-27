# Gitmapsite — Uygulama Dünyası

GitHub'daki açık kaynak projelerden, lisansı ve güvenliği kontrol edilmiş hazır uygulamaları işletmelere sunan; markaya göre özelleştirip alan adı, Hostinger sunucusu ve istenirse App Store / Google Play'e kadar teslim eden platform.

- Canlı: https://gitmapp.com (yedek: https://nikocan.github.io/gitmapsite/)
- Müşteri görünümü: Uygulama Dünyası, Uygulamamı Oluştur, Paketler, Yapay Zekâ Destekleri, Taleplerim
- Yönetici görünümü: Siparişler, İş Planı & Gelir, GitHub Radar, İş Kolları, Listem, Yapım Kuyruğu, Ayarlar
- Sürüm notları: uygulama içinde **Güncellemeler** sekmesi

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

## Yapay zekâ sağlayıcıları ve maliyet

Platform çağrıları varsayılan olarak `AI_BASE` / `AI_KEY` (Hostinger AI Router) üzerinden yapılır. `AI_BASE` OpenAI uyumlu herhangi bir uç nokta olabilir; örneğin doğrudan OpenRouter için `AI_BASE=https://openrouter.ai/api/v1`, `AI_KEY=sk-or-…` ve `AI_MODELS` içinde OpenRouter model adları (`anthropic/claude-sonnet-4.5,openai/gpt-5.2`).

**Yedek sağlayıcı zinciri:** birincil sağlayıcı 402 (bakiye bitti), 403, 404 (model yok), 408, 429 ya da 5xx döndürürse istek sırayla aşağıdaki anahtarlı sağlayıcılara aynı ya da en yakın modelle gider. Tanımlanmayan sağlayıcı atlanır.

| Değişken | Açıklama |
| --- | --- |
| `OPENROUTER_API_KEY` | OpenRouter anahtarı (tek anahtarla Claude, GPT, Gemini, DeepSeek, Qwen) |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY` | Doğrudan sağlayıcı anahtarları |
| `AI_FALLBACKS` | Deneme sırası (varsayılan `hostinger,openrouter,anthropic,openai,gemini,deepseek`; ana sağlayıcı kendi yedeği olmaz) |
| `HOSTINGER_AI_KEY` | Hostinger AI Router yedeği; tanımlı değilse sunucu dosyasındaki Hostinger `AI_KEY` kullanılır |
| `PROMPT_CACHE` | `0` yapılırsa Claude istem önbelleği kapanır (varsayılan açık) |
| `COPILOT_MODEL`, `VISION_MODEL` | Asistan ve görsel okuma için sabit model |

`/api/health` yanıtındaki `aiFallbacks` alanı etkin yedekleri listeler. Yedek testleri: `node --test server/failover.test.mjs`.

## GitHub Radar ve üretim ajanı

**Yönetim → GitHub Radar** proje türü, iş kolu, Stüdyo yolu ve güvenlik ön taramasına göre filtrelenir. Keşif skoru GitHub verilerinden hesaplanır. Ayrıntıdaki güvenlik ön taraması mevcut bağımlılık ve bakım sinyallerini gösterir. Depo incelemesi içe aktarılabilir HTML, derleme ihtiyacı ve yapay zekâ prototipi seçeneklerini belirler. **Tasarımda aç** ile Stüdyo’da bölüm ve öğe seçilebilir.

Radar’dan gelen taslaklarda **Yayın Merkezi** lisans ve güvenlik doğrulaması ile editör puanı ister. Ağırlıklar işlevler %50, kullanılabilirlik %30 ve sunum %20. Yayın eşiği 70/100. Yeni düzenlemeler ayrı bir yayın onayı alana kadar canlı adres ve mağaza kopyası önceki onaylı HTML’i sunar.

**Yönetim → Üretim ajanı** varsayılan olarak GitHub, MDN ve Smashing Magazine’i 24 saatte bir tarar. Aralık ve zamanlama panelden değiştirilebilir. Yapay zekâ üretimi panelden açılır. Günde en fazla bir özgün taslak üretir, aylık kredi sınırını kullanır ve sonucu yönetici projelerine kaydeder.

Mağazada ücretli ürünler için alıcı talep açar. Ödeme dış sağlayıcıda tamamlandığında yönetici **Üretim ajanı → Mağaza satışları** ekranında işlem referansını kaydeder. Teyit, alıcının düzenlenebilir kopyasına erişim verir.

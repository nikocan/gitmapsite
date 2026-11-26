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

## Yapay zekâ sağlayıcıları ve maliyet

Platform çağrıları varsayılan olarak `AI_BASE` / `AI_KEY` (Hostinger AI Router) üzerinden yapılır. `AI_BASE` OpenAI uyumlu herhangi bir uç nokta olabilir; örneğin doğrudan OpenRouter için `AI_BASE=https://openrouter.ai/api/v1`, `AI_KEY=sk-or-…` ve `AI_MODELS` içinde OpenRouter model adları (`anthropic/claude-sonnet-4.5,openai/gpt-5.2`).

**Yedek sağlayıcı zinciri:** birincil sağlayıcı 402 (bakiye bitti), 403, 404 (model yok), 408, 429 ya da 5xx döndürürse istek sırayla aşağıdaki anahtarlı sağlayıcılara aynı ya da en yakın modelle gider. Tanımlanmayan sağlayıcı atlanır.

| Değişken | Açıklama |
| --- | --- |
| `OPENROUTER_API_KEY` | OpenRouter anahtarı (tek anahtarla Claude, GPT, Gemini, DeepSeek, Qwen) |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY` | Doğrudan sağlayıcı anahtarları |
| `AI_FALLBACKS` | Deneme sırası (varsayılan `openrouter,anthropic,openai,gemini,deepseek`) |
| `PROMPT_CACHE` | `0` yapılırsa Claude istem önbelleği kapanır (varsayılan açık) |
| `COPILOT_MODEL`, `VISION_MODEL` | Asistan ve görsel okuma için sabit model |

`/api/health` yanıtındaki `aiFallbacks` alanı etkin yedekleri listeler. Yedek testleri: `node --test server/failover.test.mjs`.

### Ollama ile ayrı bir Stüdyo pilotu

Ayrı bir Gitmapp API sürecinde `AI_BACKEND=ollama`, `OLLAMA_MODEL=qwen2.5-coder:1.5b` ve pilota özel `DB_PATH` ile başlatın. Pilot API ve Ollama yalnızca localhost üzerinde dinleyebilir. Yerel Ollama servisine modeli önce `ollama pull qwen2.5-coder:1.5b` ile yükleyin. API varsayılan olarak `http://127.0.0.1:11434/v1` kullanır. Farklı bir özel adreste çalışıyorsa `OLLAMA_BASE` değerini tam /v1 adresine ayarlayın. Bu etiket küçük CPU denemesi için seçilmiştir.

```sh
AI_BACKEND=ollama OLLAMA_MODEL=qwen2.5-coder:1.5b PORT=8791 \
  DB_PATH=./pilot-data/gitmapp.sqlite node server/server.mjs
```

Model kataloğunda seçilen etiketin göründüğünü `GET /api/ai/models` ile kontrol edin. Platformdaki metin istekleri pilota gider ve yerel model hata verdiğinde dış sağlayıcıya geçilmez. Kullanıcının ayrıca seçtiği kişisel sağlayıcılar kendi bağlantılarını kullanır. Karşılaştırma için Python Playwright ve Chromium kurulu ortamda aşağıdaki testi çalıştırın. İki örnek projede ilk metin süresini, toplam yanıt süresini ve mevcut eylemin tarayıcıda korunmasını ölçer. Canlı bir API’ye karşı çalıştırmak üretim isteği oluşturur ve kota tüketebilir.

```sh
python tools/ollama-pilot.py http://127.0.0.1:8791
```

Kredi tarifesi uygulamanın mevcut tarifesidir. Gerçek barındırma birim maliyeti için aynı dönemin modele ayrılan sunucu giderini kabul testini geçen düzenleme sayısına bölün. Pilot ayrı süreçte çalıştığı için durdurulması ana API yapılandırmasına dokunmaz.

Küçük belgelerin metin tabanlı düzenlemelerinde Ollama'ya mevcut dosya ve proje bağlamıyla kısa bir düzenleme talimatı gönderilir. Planlı işler, yama biçimi kullanan büyük dosyalar ve entegrasyonlar mevcut kapsamlı talimatı kullanır. Kısa yanıt isteyen soruları ayrı deneyebilirsiniz:

```sh
python tools/ollama-questions.py http://127.0.0.1:8791
```

Soru testi iki projede düğme etiketini doğru söylemeyi ve eksik veri karşısında bilgi uydurmamayı ölçer. Düzenleme testi iki eşzamanlı isteğin ilk metin ve tamamlama sürelerini kaydeder. 390 ve 1440 px'de düğmeleri tıklar, sonuç metnini, görünen stil değişikliğini ve yatay taşmayı kontrol eder.

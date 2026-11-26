# Gitmapp Stüdyo kabul raporu

26 Kasım 2026 · Güncel main `e69b12d5` (v5.25.0) · Dal `feature/studio-context-catalog-v525`

## Asistan ve tasarım paneli

Başlangıç sürümünde restoran geçmişi okul projesinde de görünüyordu. Yan panel `gms_cpMsgs` anahtarından, Stüdyo ise tek bir `gms_studio` kaydından okuyordu. Dal açılırken çalışma dosyası değişiyor, mesajlar taşınıyordu. Yan panel son 16 mesajı ve genel Stüdyo durumunu `/api/ai/copilot` uç noktasına gönderiyordu. Sunucu bu veriyi modelin sistem iletisine ekliyordu. [Değişiklik öncesi tarayıcı ölçümleri](main-hatalari.json)

Yeni sürüm hesap, proje veya taslak kimliği, dal kaynağı, depo ve dal adından bir sohbet anahtarı oluşturur. İlk bulut kaydında taslak geçmişi proje kimliğine taşınır. Yerel kopyalar Projeler → Yerel taslaklar altında açılır. Yalnızca asistanla konuşulmuş ve henüz ekranı oluşmamış bir taslağın da aynı kimlik ve sohbetle yeniden açıldığı sınandı. Belirsiz eski mesajlara misafir görünümünde, aynı cihazdan salt okunur erişilebilir. Geçmiş bu tarayıcının depolamasında tutulur.

İstek bağlamı güncel proje amacı, ekran başlıkları, ilgili bileşen, seçili öğe, tema, önizleme cihazı ve son değişiklikleri içerir. Önceki entegrasyon commit’inde (`f86f24aa`) gerçek model aynı “Ana ekranı iyileştir” isteğine restoranda menü ve rezervasyon, okulda ders programı ve ödev akışıyla yanıt verdi. Aynı projenin iki dalında da farklı ekranları kullandı. v5.25 denemesinde dış API HTTP 400 döndürdü. AI Router, yapılandırılmış `claude-sonnet-4.5` modelini bulamadı (sağlayıcı 404). Bu sürümün tarayıcı testinde her iki proje ve iki dal için gönderilen bağlam denetlendi. Ayrı bir test aynı bağlamları gerçek Gitmapp sunucusundan yerel bir model sağlayıcı test sunucusuna kadar izledi. [v5.25 istek bağlamları](asistan-tarayıcı.json) · [Canlı servis denemesi](asistan-canli-v525.json)

v5.25 alt çubuk dal menüsüyle yapılan ağ sınamasında eski üretim iptal sinyalini yok sayarak döndü. Yeni dalın HTML’i ve mesajları korundu. Aşağıdaki canlı yanıt ve asistan ekranları önceki başarılı model denemesine aittir. [Önceki gerçek istek bağlamları ve yanıtlar](asistan-canli.json) · [Restoran ekranı](screens/asistan-1.png) · [Okul ekranı](screens/asistan-2.png) · [Birinci dal](screens/asistan-3.png) · [İkinci dal](screens/asistan-4.png)

Ses testinde geçici hipotezler tek olayın sonuç listesinde “Uygulamayı”, “Uygulamayı uçtan” ve tamamlanmış cümle olarak geldi. Önceki kod üçünü birleştirdi. Yeni kod geçici uzantıyı günceller, tamamlanmış segmentleri korur. Dokunmatik Chromium’da ses tanıma olayları, klavye kompozisyonu ve asistanın hazır komutu ayrı ayrı sınandı. Her gönderim bir kullanıcı mesajı oluşturdu. Klavyede bilerek girilen “tekrar tekrar” aynen kaldı. Mikrofon ve sistem klavyesi olayları taklit edildi. [Girdi ve gönderim kayıtları](girdi.json)

Telefon görünümünde simge alanı başlangıçta 31 px yüksekliğindeydi. Yeni panel 390 px’de tek sütun kullanır. Test bütün düzenleme kutularının en az 44 px yüksekliğinde olduğunu ve etiketlerin görünür olduğunu ölçtü. Her yeni şablonda başlık ve rengi değiştirildi, yıldız seçildi, “Simge yok” seçilerek kaydedildi. Sayfa yenilendikten sonra başlık ve renk korundu, simge boştu. [Tasarım paneli](screens/tasarim-telefon.png)

## Katalog ve ekranlar

Her sektörde iki bağımsız tek dosyalık tasarım yer alıyor. Ekran bağlantıları görevin tamamlanmasından sonra Chromium’da alınan gerçek görüntüleri açar. Ana görevler örnek verilerle cihazda çalışır. Ortak işletme ajandası, ödeme tahsilatı veya dış kuruma gerçek başvuru bağlantısı kurulmadı. Kanban aşaması, KDV hesabı, bütçe süzgeci, konaklama süresi ve fotoğraf ekleme gibi sektörel davranışlar ilgili akışlarda test edildi.

| Sektör | Araştırılan aday kaynak | 2025 arayüz dosyası | Doğrulanan | Stüdyo’ya eklenen | 50’ye açık | Ana görev ve ekranlar |
|---|---:|---:|---:|---:|---:|---|
| Restoran/kafe | 50 | 50 | 2 | 2 | 48 | [Menüden masa ayırma](../templates/sofra.html) · [390](screens/sofra-390.png) / [1440](screens/sofra-1440.png)<br>[Adisyonu kuruş bazında bölme](../templates/adisyon.html) · [390](screens/adisyon-390.png) / [1440](screens/adisyon-1440.png) |
| Perakende/e-ticaret | 50 | 42 | 2 | 2 | 48 | [Kalan hakla ürün iadesi](../templates/iade.html) · [390](screens/iade-390.png) / [1440](screens/iade-1440.png)<br>[Sepetle sipariş](../templates/dukkan.html) · [390](screens/dukkan-390.png) / [1440](screens/dukkan-1440.png) |
| Kuaför/güzellik | 51 | 50 | 2 | 2 | 48 | [Hizmet ve uzmanla randevu](../templates/percem.html) · [390](screens/percem-390.png) / [1440](screens/percem-1440.png)<br>[Bekleme sırası ve müşteri çağırma](../templates/sira.html) · [390](screens/sira-390.png) / [1440](screens/sira-1440.png) |
| Klinik/sağlık | 54 | 51 | 2 | 2 | 48 | [Kontrol tarihi hesaplama](../templates/takip.html) · [390](screens/takip-390.png) / [1440](screens/takip-1440.png)<br>[Branş ve hekime randevu](../templates/muayene.html) · [390](screens/muayene-390.png) / [1440](screens/muayene-1440.png) |
| Eğitim | 57 | 50 | 2 | 2 | 48 | [Ders yoklaması ve devamsızlık](../templates/yoklama.html) · [390](screens/yoklama-390.png) / [1440](screens/yoklama-1440.png)<br>[Ders programından ödev teslimi](../templates/derslik.html) · [390](screens/derslik-390.png) / [1440](screens/derslik-1440.png) |
| Emlak | 51 | 51 | 2 | 2 | 48 | [Dairelerin m² fiyatını ve aidatını karşılaştırma](../templates/kiyas.html) · [390](screens/kiyas-390.png) / [1440](screens/kiyas-1440.png)<br>[Bütçeye göre ilan ziyareti](../templates/ziyaret.html) · [390](screens/ziyaret-390.png) / [1440](screens/ziyaret-1440.png) |
| Otel/turizm | 53 | 53 | 2 | 2 | 48 | [Gece ve oda ücretiyle rezervasyon](../templates/konak.html) · [390](screens/konak-390.png) / [1440](screens/konak-1440.png)<br>[Duraklara göre zamanlı gezi rotası](../templates/rota.html) · [390](screens/rota-390.png) / [1440](screens/rota-1440.png) |
| Teknik servis | 56 | 54 | 2 | 2 | 48 | [Fotoğraflı iş emri ve atama](../templates/usta.html) · [390](screens/usta-390.png) / [1440](screens/usta-1440.png)<br>[Kilometre bazında bakım takibi](../templates/bakim.html) · [390](screens/bakim-390.png) / [1440](screens/bakim-1440.png) |
| Finans/muhasebe | 71 | 65 | 2 | 2 | 48 | [Kasa sayımı ve fark hesabı](../templates/kasa.html) · [390](screens/kasa-390.png) / [1440](screens/kasa-1440.png)<br>[KDV dâhil proforma](../templates/fatura.html) · [390](screens/fatura-390.png) / [1440](screens/fatura-1440.png) |
| Ajans/CRM | 50 | 39 | 2 | 2 | 48 | [Satış aşamasını ilerletme](../templates/firsat.html) · [390](screens/firsat-390.png) / [1440](screens/firsat-1440.png)<br>[Molalarla faturalandırılabilir mesai](../templates/mesai.html) · [390](screens/mesai-390.png) / [1440](screens/mesai-1440.png) |

**543 aday kaynak incelendi. 20 yeni şablon her iki ekran genişliğinde kabul testini geçti. 500 hedefinde 480 açık yer var.** Sekiz mevcut şablonla katalogda 28 kart bulunuyor. Kartlar küçük WebP görüntülerini tembel yükler. Canlı HTML yalnızca seçilen demo için açılır. Adaylar depo kimliği ve bildirilen demo adresiyle tekilleştirildi. 25 kaynak, hedef kullanıcı göreviyle eşleşmediği için elendi. Depolar arası görsel benzerlik incelemesi tamamlanmadığı için araştırılan kaynak sayısı özgün tasarım sayısı olarak kullanılamaz.

505 adayda 2025 revizyonundaki arayüz dosyası, 160 adayda lisans belgesi bulundu. Aday defteri demo adresi için yapılan HTTP kontrolünü, başlığı veya erişim hatasını ayrı tutar. Bu kontrol kaynak demonun ana görevinin çalıştığını göstermez. Ticari kullanım, yeniden dağıtım ve varlık hakları eksik olan adaylar referans olarak tutuldu. Gitmapp’te dağıtılan 20 yerel uygulama bu çalışma sırasında oluşturuldu. 2025 kanıtları kaynak tasarımlara aittir. İlk on tasarımın telif ve izin bildirimleri kaynak dosyalardaki özgün metinle yenilendi. [Aday defteri](catalog/adaylar.csv) · [Yayıma alınan tasarımların kaynakları ve lisansları](catalog/yayin.json)

## Talep sinyalleri

Sektörlerdeki görev seçimi bir ürün hipotezidir. Depoda kullanım olayları ve yönetici talep radarı bulunuyor. Çalışma ortamındaki geliştirme veritabanında arama olayı ve kaydedilmiş proje yoktu. Üretimdeki anonim aramalar, sonuçsuz aramalar ve başlatılan proje sayıları için ölçüm elde edilemedi. Türkiye için Google Trends’in yayımladığı güncel on yükselen arama incelendi. Hiçbiri tablodaki görevleri doğrudan ölçmüyordu. “Kainat güzellik yarışması” kuaför randevusu talebine yazılmadı. Tarih aralığıyla yapılan sorgu HTTP 429 döndürdü. Bu nedenle sektörlere sayısal talep puanı verilmedi. [Türkiye arama görünümü](catalog/turkiye-trendleri.json)

## Testleri tekrarlama

Chromium ve Playwright Python paketi ile kabul betikleri kendi geçici HTTP sunucularını açar. Ağ bağlantısı sınırlı ortamlarda `BROWSER_LIB` değişkeni React 18.3.1, ReactDOM 18.3.1 ve htm 3.1.1 tarayıcı dosyalarını içeren bir dizine ayarlanabilir. Asistan betiği varsayılan olarak kontrollü yanıt kullanır. `--live` seçimi test projesinin bağlamını anonim Gitmapp Asistan uç noktasına gönderir.

```sh
node --test server/*.test.mjs
python tools/acceptance/assistant.py
python tools/acceptance/late_generation.py
python tools/acceptance/input_methods.py
python tools/acceptance/drafts.py
python tools/acceptance/templates.py
```

17 sunucu testi geçti. 20 yeni şablonun her birinde 390 ve 1440 px genişlikte ana görev, Türkçe uzun metin, boş durum, form doğrulaması, görünür klavye odağı, metin renk kontrastı ve yatay taşma sınandı. Ana görev bağımsız sayfada, kütüphanedeki “Canlı dene” penceresinde ve Stüdyo taslağında çalıştırıldı. Tasarım düzenlemeleri ve Stüdyo’daki görev kaydı sayfa yenilendikten sonra yeniden okundu. Telefon deneyi Chromium’un dokunma ve mobil görünüm öykünmesini kullanır. [Şablon başına test sonuçları](sablon-testleri.json)

# Gitmapp Stüdyo kabul raporu

26 Kasım 2026 · Başlangıç sürümü `a60fc478` · Dal `feature/studio-context-catalog`

## Asistan ve tasarım paneli

Başlangıç sürümünde restoran geçmişi okul projesinde de görünüyordu. Yan panel `gms_cpMsgs` anahtarından, Stüdyo ise tek bir `gms_studio` kaydından okuyordu. Dal açılırken çalışma dosyası değişiyor, mesajlar taşınıyordu. Yan panel son 16 mesajı ve genel Stüdyo durumunu `/api/ai/copilot` uç noktasına gönderiyordu. Sunucu bu veriyi modelin sistem iletisine ekliyordu.

Yeni sürüm hesap, proje veya taslak kimliği, dal kaynağı, depo ve dal adından bir sohbet anahtarı oluşturur. İlk bulut kaydında taslak geçmişi proje kimliğine taşınır. Yerel kopyalar Projeler → Yerel taslaklar altında açılır. Belirsiz eski mesajlara misafir görünümünde, aynı cihazdan salt okunur erişilebilir. Geçmiş bu tarayıcının depolamasında tutulur.

İstek bağlamı güncel proje amacı, ekran başlıkları, ilgili bileşen, seçili öğe, tema, önizleme cihazı ve son değişiklikleri içerir. Gerçek model aynı “Ana ekranı iyileştir” isteğine restoranda menü ve rezervasyon, okulda ders programı ve ödev akışıyla yanıt verdi. Aynı projenin iki dalında da farklı ekranları kullandı. Ağ sınamasında eski üretim iptal sinyalini yok sayarak döndü. Yeni dalın HTML’i ve mesajları korundu. [Gerçek istek bağlamları ve yanıtlar](asistan-canli.json) · [Restoran ekranı](screens/asistan-1.png) · [Okul ekranı](screens/asistan-2.png) · [Birinci dal](screens/asistan-3.png) · [İkinci dal](screens/asistan-4.png)

Ses testinde geçici hipotezler tek olayın sonuç listesinde “Uygulamayı”, “Uygulamayı uçtan” ve tamamlanmış cümle olarak geldi. Önceki kod üçünü birleştirdi. Yeni kod geçici uzantıyı günceller, tamamlanmış segmentleri korur. Dokunmatik Chromium’da ses tanıma olayları, klavye kompozisyonu ve asistanın hazır komutu ayrı ayrı sınandı. Her gönderim bir kullanıcı mesajı oluşturdu. Klavyede bilerek girilen “tekrar tekrar” aynen kaldı. Mikrofon ve sistem klavyesi olayları taklit edildi. [Girdi ve gönderim kayıtları](girdi.json)

Telefon görünümünde simge alanı başlangıçta 31 px yüksekliğindeydi. Yeni panel 390 px’de tek sütun kullanır. Test, simge alanının en az 44 px olduğunu ölçtü. Her yeni şablonda başlık ve rengi değiştirildi, yıldız seçildi, “Simge yok” seçilerek kaydedildi. Sayfa yenilendikten sonra başlık ve renk korundu, simge boştu. [Tasarım paneli](screens/tasarim-telefon.png)

## Katalog ve ekranlar

Her satırda Stüdyo’ya eklenen bir bağımsız tek dosyalık tasarım var. Ana görevler örnek verilerle cihazda çalışır. Ortak işletme ajandası, ödeme tahsilatı veya dış kuruma gerçek başvuru bağlantısı kurulmadı. Kanban aşaması, KDV hesabı, bütçe süzgeci, konaklama süresi ve fotoğraf ekleme gibi sektörel davranışlar ilgili akışlarda test edildi.

| Sektör | Araştırılan kaynak | 2025 arayüz dosyası | Doğrulanan / eklenen | 50’ye açık | Şablon ve ana görev | Ekranlar |
|---|---:|---:|---:|---:|---|---|
| Restoran/kafe | 50 | 50 | 1 / 1 | 49 | [Avlu Sofrası](../templates/sofra.html) · Menüden masa ayırma | [390 px](screens/sofra-390.png) · [1440 px](screens/sofra-1440.png) |
| Perakende/e-ticaret | 50 | 42 | 1 / 1 | 49 | [Kutu Dükkân](../templates/dukkan.html) · Ürün adedi ve sepetle sipariş verme | [390 px](screens/dukkan-390.png) · [1440 px](screens/dukkan-1440.png) |
| Kuaför/güzellik | 50 | 49 | 1 / 1 | 49 | [Perçem Randevu](../templates/percem.html) · Hizmet ve uzmanla randevu alma | [390 px](screens/percem-390.png) · [1440 px](screens/percem-1440.png) |
| Klinik/sağlık | 51 | 48 | 1 / 1 | 49 | [Poliklinik Ajandası](../templates/muayene.html) · Branş ve hekimle saat ayırma | [390 px](screens/muayene-390.png) · [1440 px](screens/muayene-1440.png) |
| Eğitim | 51 | 45 | 1 / 1 | 49 | [Derslik](../templates/derslik.html) · Ders programından ödev teslimine geçme | [390 px](screens/derslik-390.png) · [1440 px](screens/derslik-1440.png) |
| Emlak | 51 | 51 | 1 / 1 | 49 | [Sokak Rehberi](../templates/ziyaret.html) · Bütçeye uygun ilan için ziyaret isteme | [390 px](screens/ziyaret-390.png) · [1440 px](screens/ziyaret-1440.png) |
| Otel/turizm | 50 | 50 | 1 / 1 | 49 | [Kıyı Pansiyon](../templates/konak.html) · Gece ve oda ücretini hesaplayıp talep bırakma | [390 px](screens/konak-390.png) · [1440 px](screens/konak-1440.png) |
| Teknik servis | 50 | 48 | 1 / 1 | 49 | [Atölye Defteri](../templates/usta.html) · Fotoğraflı iş emrini teknisyene atama | [390 px](screens/usta-390.png) · [1440 px](screens/usta-1440.png) |
| Finans/muhasebe | 51 | 46 | 1 / 1 | 49 | [Hesap Pusulası](../templates/fatura.html) · KDV dahil proforma oluşturma | [390 px](screens/fatura-390.png) · [1440 px](screens/fatura-1440.png) |
| Ajans/CRM | 50 | 39 | 1 / 1 | 49 | [Teklif Masası](../templates/firsat.html) · Müşteriyi tekliften kazanıldı aşamasına taşıma | [390 px](screens/firsat-390.png) · [1440 px](screens/firsat-1440.png) |

**Toplam 504 aday kaynak, 10 doğrulanmış yeni şablon ve 490 açık yer.** Sekiz mevcut şablonla birlikte kütüphanede 18 kart bulunur. Kartlar küçük WebP önizlemelerini tembel yükler. Canlı HTML seçilen demo için açılır. Kaynak havuzundaki kayıtlar depo kimliği ve bildirilen demo adresine göre tekilleştirildi. Renk varyantları yayın sayısını artırmadı. Referans adaylarının tamamında bağımsız tasarım, çalışır demo ve varlık hakları doğrulanmış değildir.

Aday defterinde kaynak, bildirilen demo, teknoloji, lisans ve yeniden dağıtım koşulları, 2025 kanıtı, servis ve ücretli sürüm beyanları yer alır. 468 adayın 2025 revizyonundaki arayüz dosyası, 152 adayın lisans belgesi kaydedildi. Depo açılış tarihi tek başına tasarım kanıtı sayılmadı. README’de adı geçen bir servis zorunlu hizmet olarak sınıflandırılmadı. Kaynak demosunun 403 ya da 404 döndürdüğü durumlar ayrıca kayıtlıdır. On yeni Gitmapp tasarımı bu çalışmada oluşturuldu. 2025 tarihleri dayanak olarak incelenen tasarımlara aittir. Dağıtılan HTML dosyaları lisans bildirimlerini içerir. [Aday defteri](catalog/adaylar.csv) · [On tasarımın kaynakları, lisansları ve demo kontrolleri](catalog/yayin.json)

## Talep sinyalleri

Sektörlerdeki görev seçimi bir ürün hipotezidir. Depoda kullanım olayları ve yönetici talep radarı bulunuyor. Bu çalışmada toplu Gitmapp arama, sonuçsuz arama veya başlatılan proje sayısına erişilemedi. Türkiye için Google Trends’in yayımladığı güncel on yükselen arama incelendi. Hiçbiri tablodaki görevleri doğrudan ölçmüyordu. “Kainat güzellik yarışması” kuaför randevusu talebine yazılmadı. Tarih aralığıyla yapılan sorgu HTTP 429 döndürdü. Bu nedenle sektörlere sayısal talep puanı verilmedi. [Türkiye arama görünümü](catalog/turkiye-trendleri.json)

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

Sekiz sunucu testi geçti. Yeni şablonların her birinde iki genişlikte ana görev, Türkçe uzun metin, boş durum, form doğrulaması, görünür klavye odağı, metin renk kontrastı ve yatay taşma sınandı. Tasarım düzenlemeleri Stüdyo’da kaydedilip açıldı. Telefon deneyi Chromium’un dokunma ve mobil görünüm öykünmesini kullanır. [Şablon başına test sonuçları](sablon-testleri.json)

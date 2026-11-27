# GitmappGT

GT, Stüdyo’daki aktif projeye bağlanır. GT penceresinde indirilen örnek dosya poliçe → hasar → ödeme ilişkisini ve toplu bir bekleme sinyalini gösterir. Bu kayıtlar kurgusaldır. Ürün kodu, olayın sebebi ve kurum içi sistem sürümü proje sahibinin kanıtına dayanır.

## Kurumda çalıştırma

1. Oracle yöneticisi kendi ortamında Python ve python-oracledb ile yetkili bağlantıyı kurar. GT_DB_DSN, GT_DB_USER ve GT_DB_PASSWORD yerel süreç ortamında sağlanır. Seçilen tablolar bağlı kullanıcının şemasında görünmelidir. Örnek: `python tools/gt/oracle_metadata.py --tables POLICE HASAR ODEME --modules Police Hasar Odeme > gt-baglam.json`.
2. GT, dışa aktarılan sütun adlarını ve seçili tablolar arasındaki yabancı anahtar bağlantılarını okur. SAP için aynı JSON sözleşmesine uygun bir metadata dışa aktarımı yüklenebilir. Şirket kayıtları, müşteri satırları ve kimlik bilgileri bu sözleşmede yer almaz.
3. Taslakta bağlam oturumluktur. Kayıtlı projede proje erişimi kontrol edilir ve son bağlam sunucuda saklanır. Model çağrısında soru, bu bağlam ve Stüdyo önizleme hataları seçili sağlayıcıya iletilir.
4. Yetkili kurum adaptörü proje erişimiyle `GET /api/apps/{id}/gt` çağrısından revision alır. Yeni veri için aynı adrese `PUT` ile `{revision,snapshot}` yollar. Gövde tam görüntüdür; adaptör güncel şema ile sinyalleri birlikte gönderir. Çakışmada 409 döner; adaptör yeniden okuyup değişikliklerini birleştirir. GT Stüdyo’da açıldıktan sonra aynı proje açık kaldığı sürece 10 saniyede bir kontrol eder.
5. Teknik soru yazıyla veya destekleyen tarayıcıda Türkçe sesle sorulur. GT yanıtını kullanıcı dinleyebilir. “Taslakta geliştir ve test et” Stüdyo’nun model ve kredi ayarlarıyla taslağı günceller, ardından HTML başlangıç kontrollerini çalıştırır. Eldeki tek dosyalık HTML de aynı teste yüklenebilir. Harici kaynak gerektiren uygulamaların bu çevrimdışı testte ek bağımlılıkları sağlanmaz.

## Sigorta kabul koşulları

- Eksik hasar–poliçe bağı için ilişki kanıtını ve reddedilen ilişkiyi göster.
- Bekleyen ödeme sayısından tekil hasarın sebebini çıkarsama. Durum geçişi ve işlem zamanını iste.
- Aynı ödeme olayının iki kez ulaşması senaryosunda tek ödeme ve muhasebe hareketini kurumun test sisteminde doğrula.
- Zeyil/iptal tarihinde önceki ve sonraki teminatı olay tarihine göre karşılaştır.
- Üretim öncesi kurum testi, rol ve şirket ayrımını, örnek poliçe ve hasar işlemlerini, beklenen finansal sonuçları ve geri alma prosedürünü kapsar. HTML duman testi başlık, içerik ve başlangıç hatalarını inceler.

## Kurum içi yerleşim

Hedef mimari sigorta ekranındaki destek düğmesi → kurumun kimlik ve proje eşlemesi → GT bağlam servisi → model yanıtı → geliştirici taslağı → kurum test ortamı → kurumun yayın sürecidir. Bu sürümde arayüz Gitmapp Stüdyo’dadır. Sigorta ekranının eklenti noktası, SSO eşlemesi, gözlem verisi kaynağı, test ortamı ve dağıtım sözleşmesi kurum tarafından sağlandığında kuruma özgü adaptör geliştirilebilir. Mühendis doğruladığı belirti, çözüm ve testi proje bilgisine kaydedebilir. GT soruları yanıtlarken en son on proje çözümünü de okur. Şema ve sinyal güncellemeleri bağlamı yeniler; model eğitimi yapılmaz.

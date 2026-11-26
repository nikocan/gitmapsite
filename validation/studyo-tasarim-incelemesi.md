# Stüdyo tasarım ve erişilebilirlik incelemesi

26 Kasım 2026. İlk ölçümler `4b0808d` sürümünde yapıldı. Düzeltmeler, otomatik model seçimi ve medya stüdyosunu içeren 5.30.0 üzerine uygulandı.

| Kullanıcı görevi | Önceki davranış | Düzeltme ve kontrol |
|---|---|---|
| Yayın asistanındaki soruyu okumak | Kullanıcı mesajında açık sarı zemin üstünde açık yazı 1,03:1 kontrast veriyordu. | Metin ve zemin birlikte tanımlandı. Ölçülen oran 15,97:1. Hazır sorular klavyeyle isteme alınıyor. Kalın yazılar ve maddeler yanıt içinde biçimlendiriliyor. |
| Mobilde fiyatları ve tüketimi karşılaştırmak | Paket rozetinde kontrast 1,12:1 idi. 320 px ekranda Hesabım sayfası 779 px’ye, modeller 346 px’ye taşıyordu. | Rozet 16,52:1. Testte sayfalar 320 px genişlikte kaldı. Tablo genişse tablo alanı kaydırılabiliyor. Sayılar sağa hizalı ve başlıklar hücrelerle ilişkili. |
| Yazmaya başladıktan sonra örnek görmek | Stüdyo’dan çalışan şablonlara doğrudan erişilemiyordu. Hazır fikir seçmek yazılmış istemin yerine geçiyordu. | İstemin yanındaki kaynaklardan örnek inceleniyor. Örnek metin ve kod mevcut isteme ekleniyor. Dolu projeden ayrı bir taslak oluşturulabiliyor. |
| Hangi modelin kullanılacağını anlamak | Ölçüm anındaki 156 model içinde varsayılan model 21. sıradaydı. | Etkin model üstte ve seçili görünüyor. Ad, sağlayıcı veya seviyeye göre aranabiliyor. Otomatik seçimde sıradaki isteğin modeli görünür. Elle seçim otomatik seçimi kapatır. |
| Bir amaçla şablon bulmak | Ana katalogda sektör ve tür filtreleri vardı. | Katalogda görev, örnek adı, özellik ve sektör metni aranabiliyor. Örneğin “rezervasyon” araması çalışan demolara götürüyor. Sonuç yoksa filtreler tek düğmeyle sıfırlanabiliyor. |

## Tasarım kararlarına dayanaklar

- **Kontrast ve odak.** WCAG 2.2 AA normal metinde 4,5:1, büyük yazıda 3:1 ister. Denetimlerin işlevini ve durumunu ayırt etmek için gerekli görsel işaretlerde komşu renkle 3:1 eşiği vardır. Sarı sohbet balonu ve paket rozetinde ölçümler tarayıcının hesapladığı renklerle yapıldı. [Metin kontrastı](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [Metin dışı kontrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- **Uzun pencereler ve tablolar.** WAI-ARIA modal örüntüsü, uzun içerikte başlangıca odaklanmayı, odağın pencere içinde kalmasını ve kapanınca açan denetime dönüşü tarif eder. Veri tablolarında ad ve başlık ilişkileri korundu. GOV.UK tasarım sistemindeki gibi karşılaştırılan sayılar sağa hizalandı. [Modal örüntüsü](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) · [WAI tablo rehberi](https://www.w3.org/WAI/tutorials/tables/) · [GOV.UK tabloları](https://design-system.service.gov.uk/components/table/)
- **Çalışan örnekten başlamak.** Savage Interactive’in Procreate Dreams uygulaması 2024 Apple Design Awards inovasyon ödülünü aldı. Uygulamanın Theater alanındaki örnek projeler, ilk denemeye somut bir başlangıç sağlıyor. 2025 inovasyon ödüllü Play, etkileşimli prototiplerin ürün geliştirmede kullanılmasına örnek. Gitmapp’te kullanıcı hazır projeyi deneyebiliyor ve kendine ait düzenlenebilir bir kopya oluşturabiliyor. [Dreams Theater](https://help.procreate.com/dreams/handbook/interface-and-gestures/theater) · [2024 ödülleri](https://developer.apple.com/design/awards/2024/) · [2025 ödülleri](https://developer.apple.com/design/awards/2025/) · [Framer şablonları](https://www.framer.com/help/articles/how-templates-work/)
- **İlk istemi öğretmek.** Microsoft HAX’in örnek istem yaklaşımı, aracın ne yapabileceğini yapılabilir bir görev üzerinden gösterir. Gitmapp örneği editöre ekleniyor. Kullanıcı metni kendi işi için değiştirip hazır olduğunda gönderiyor. [Microsoft HAX](https://www.microsoft.com/en-us/haxtoolkit/example/microsoft-365-chat-1d-make-clear-what-the-system-can-do/)

## Kabul kayıtları

- [Yayın penceresi ölçümleri](yayin-erisim.json) · [Telefon](screens/yayin-erisim-390.png) · [Masaüstü](screens/yayin-erisim-1440.png)
- [Sekiz sayfadaki tablo ölçümleri](veri-tablolari.json) · [Telefon](screens/kullanim-tablosu-390.png) · [Masaüstü](screens/kullanim-tablosu-1440.png)
- [Stüdyo kaynakları, telefon](screens/studyo-kaynaklar-390.png) · [Masaüstü](screens/studyo-kaynaklar-1440.png) · [Model seçimi](screens/model-secimi-390.png)
- [Kaynak ve taslak testi](../tools/acceptance/studio_resources.py) · [Model seçimi ve katalog arama testi](../tools/acceptance/model_catalog.py)

Chromium’da hesap, alan adı sonucu ve model listesi için tekrarlanabilir örnek yanıtlar kullanıldı. Baştan sona ücretli üretim, alan adı satın alma, yardımcı teknolojiyle kullanıcı oturumu veya tüm uygulama için WCAG uygunluk belgelendirmesi bu ölçümlerin kapsamında değildir.

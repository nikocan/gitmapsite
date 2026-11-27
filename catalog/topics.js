// Each tuple defines a category palette, audience, setup instructions and five subject/record pairs.
const catalogTopics = {
 yemek: ["#82412b", "Restoranlar, kafeler ve butik mutfaklar", "Menü fotoğraflarını, fiyatları ve servis saatlerini ekleyin", [
  ["Günün menüsü","Fırın patlıcan"],["Kahve barı","Filtre kahve"],["Tadım rotası","Meze tabağı"],["Mutfaktan","Şefin seçkisi"],["Masam","Avlu rezervasyonu"]]],
 guzellik: ["#873f60", "Bakım stüdyoları, kuaförler ve bağımsız uzmanlar", "Hizmet sürelerini ve uzmanların çalışma saatlerini tanımlayın", [
  ["Bakım ritüeli","Nem bakımı"],["Stil defteri","Doğal tonlama"],["Seanslar","Cilt analizi"],["Bakım ekibi","Uzman Ece"],["Randevum","Akşam bakımı"]]],
 saglik: ["#1e6581", "Klinikler ve muayenehaneler", "Branş, hekim ve uygun randevu saatlerini tanımlayın", [
  ["Klinikler","Merkez poliklinik"],["Uzmanlar","Diş hekimliği"],["Randevular","İlk muayene"],["Sağlık günlüğü","Günlük ölçüm"],["Kontroller","Kontrol ziyareti"]]],
 spor: ["#3b6a36", "Spor salonları, antrenörler ve koşu kulüpleri", "Seviyeleri, antrenman sürelerini ve haftalık hedefleri ekleyin", [
  ["Antrenman","Temel kuvvet"],["Parkurlar","Sahil koşusu"],["Haftalık program","Dayanıklılık günü"],["Takımım","Sabah grubu"],["İlerleme","5 km hedefi"]]],
 seyahat: ["#216777", "Gezi rehberleri, konaklama işletmeleri ve gezginler", "Durak, mesafe ve ulaşım bilgilerini kendi rotanıza göre düzenleyin", [
  ["Rotalar","Likya Yolu"],["Duraklar","Kabak Koyu"],["Seyahat planı","Kaş hafta sonu"],["Rehberler","Kıyı yürüyüşü"],["Gezi günlüğü","Gün batımı notu"]]],
 etkinlik: ["#875341", "Organizatörler, düğün ekipleri ve etkinlik mekânları", "Etkinlik tarihini, mekân adresini ve konuk yanıt seçeneklerini ekleyin", [
  ["Program","Avlu karşılaması"],["Mekânlar","Zeytin bahçesi"],["Konuklar","Akşam listesi"],["Davetiyeler","Kır düğünü"],["Biletlerim","Ön sıra bileti"]]],
 bahce: ["#426544", "Ev bahçıvanları, fidanlıklar ve sera ekipleri", "Bitki türlerini, sulama aralıklarını ve gözlem notlarını ekleyin", [
  ["Bitkilerim","Salon sarmaşığı"],["Türler","Monstera deliciosa"],["Bakım takvimi","Fesleğen sulaması"],["Seralar","Kuzey serası"],["Bahçe günlüğü","Yeni yaprak gözlemi"]]],
 is: ["#3d5c81", "Ajanslar, küçük işletmeler ve proje ekipleri", "Ekip üyelerini, proje aşamalarını ve müşteri alanlarını düzenleyin", [
  ["Projeler","Marka yenileme"],["Ekip","Tasarım ekibi"],["İş takvimi","Haftalık durum"],["Müşteriler","Kuzey Mimarlık"],["Raporlar","Aylık iş özeti"]]],
 finans: ["#5c517e", "Küçük işletmeler ve kişisel bütçe takibi yapanlar", "Para birimini, gider kategorilerini ve bütçe limitlerini belirleyin", [
  ["Cüzdanım","Günlük bakiye"],["Portföy","Uzun vadeli birikim"],["Bütçe","Hane giderleri"],["Hareketler","Market alışverişi"],["Hedefler","Acil durum fonu"]]],
 eticaret: ["#884f42", "Butikler, bağımsız markalar ve çevrimiçi mağazalar", "Ürün görsellerini, stokları ve teslimat seçeneklerini ekleyin", [
  ["Koleksiyon","Keten serisi"],["Yeni sezon","Yaz kapsülü"],["Seçkiler","Hafta sonu çantası"],["Favoriler","Keten gömlek"],["Sepetim","Kanvas omuz çantası"]]],
 emlak: ["#42665c", "Emlak ofisleri, mimarlık ekipleri ve proje sahipleri", "İlan fotoğraflarını, konumları ve ziyaret saatlerini tanımlayın", [
  ["Portföy","Avlulu villa"],["Mahalleler","Urla merkez"],["Ziyaretler","Teraslı daire"],["Mimarlar","Taş ev projesi"],["Kaydettiklerim","Bahçeli konut"]]],
 verimlilik: ["#4a644e", "Serbest çalışanlar, öğrenciler ve küçük ekipler", "Rutinlerinizi, odak sürelerini ve haftalık hedeflerinizi oluşturun", [
  ["Bugün","Günün üç önceliği"],["Odak seansı","25 dakika odak"],["Görevler","Pazartesi planı"],["Alışkanlıklar","Sabah rutini"],["Haftalık özet","Tamamlanan işler"]]],
 araclar: ["#4c6577", "Teknik servisler, atölyeler ve saha ekipleri", "Ölçü birimlerini, toleransları ve kayıt alanlarını düzenleyin", [
  ["Araç kutusu","Dijital kumpas"],["Ölçümler","Mil çapı"],["Dönüşümler","Milimetre / inç"],["Kısayollar","Sık ölçülenler"],["Geçmiş","Son ölçüm raporu"]]],
 egitim: ["#8a592b", "Okullar, kurslar ve bağımsız eğitmenler", "Dersleri, kaynakları, sınıfları ve teslim tarihlerini ekleyin", [
  ["Dersler","Temel geometri"],["Atölyeler","Problem çözümü"],["Programım","Pazartesi dersi"],["Eğitmenler","Matematik ekibi"],["Kitaplık","Çalışma föyleri"]]],
 fotograf: ["#5c5373", "Fotoğrafçılar, yaratıcı stüdyolar ve galeriler", "Albümleri, çekim açıklamalarını ve iletişim bilgilerinizi ekleyin", [
  ["Sergiler","Şehir ve ışık"],["Portreler","Stüdyo portresi"],["Çekim planı","Altın saat"],["Sanatçılar","Belgesel ekibi"],["Albümler","Kıyı serisi"]]],
 teknoloji: ["#37687d", "Ürün ekipleri, maker toplulukları ve teknoloji girişimleri", "Projeleri, sürüm notlarını ve etkinlik kayıtlarını ekleyin", [
  ["Keşfet","Robotik prototip"],["Ürünler","Sensör kiti"],["Buluşmalar","Maker gecesi"],["Topluluk","Donanım kulübü"],["Kütüphane","Başlangıç rehberi"]]],
 sosyal: ["#77526e", "Topluluk yöneticileri, kulüpler ve yerel gruplar", "Topluluk kurallarını, grupları ve buluşma konumlarını tanımlayın", [
  ["Akış","Mahalle sohbeti"],["Gruplar","Hafta sonu kulübü"],["Buluşmalar","Parkta kahve"],["Arkadaşlar","Yeni üyeler"],["Mesajlar","Buluşma grubu"]]],
 oyun: ["#524595", "Bağımsız oyun ekipleri ve oyun toplulukları", "Dünya görsellerini, görevleri ve puanlama kurallarını belirleyin", [
  ["Görevler","Sinyal istasyonu"],["Dünyalar","Mavi yörünge"],["Turnuvalar","Yörünge kupası"],["Oyuncular","Keşif filosu"],["Başarılar","İlk temas"]]],
 diger: ["#855643", "Hobi üreticileri ve kişisel arşiv sahipleri", "Kendi fotoğraflarınızı, notlarınızı ve koleksiyon etiketlerini ekleyin", [
  ["Defterim","Çamur denemesi"],["İlham","Doğal sır tonları"],["Takvim","Atölye günü"],["Koleksiyon","El yapımı kupalar"],["Günlük","Pişirim notları"]]]
};

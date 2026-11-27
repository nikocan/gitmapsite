// Beceri kataloğu: Türkiye'de işletmelerin, B2B şirketlerin ve kamu kurumlarının kullandığı yazılım türlerinin
// baştan sona nasıl yapılacağını anlatan "uygulama planı" becerileri (geliştirme), tasarım becerileri ve kalite becerileri.
// Bunlar belirli bir markanın kopyası değildir: o yazılım türünün işlevlerini, veri modelini ve iş kurallarını tarif eder.
// checks: test üretiminde çıktıda aranacak kavramlar (küçük harf; '|' ile alternatifler).

import { SECTOR_SKILLS, SECTOR_HUNT } from "./skills-sectors.mjs";

const dev = (id, ad, kim, govde, checks, tasarim) => ({ id: "plan-" + id, kind: "gelistirme", cat: id, name: ad, who: kim, body: govde.trim(), checks, design: tasarim, test: ad + " uygulaması yap; örnek verilerle dolu olsun." });

export const CATALOG = [
  dev("crm", "CRM · müşteri ve satış takibi", "Satış ekipleri, ajanslar, B2B firmalar", `
MODÜLLER: Kişiler, Firmalar, Fırsatlar (satış hunisi), Teklifler, Aktiviteler (arama/görüşme/görev), Raporlar.
VERİ: firma{ad,vkn,sektor,sehir}, kisi{ad,unvan,tel,eposta,firmaId}, firsat{baslik,tutar,asama,olasilik,beklenenTarih,sorumlu}, aktivite{tur,tarih,not,firsatId,tamamlandi}, teklif{no,kalemler[],kdv,toplam,durum}.
EKRANLAR: Pano (açık fırsat toplamı, bu ay kazanılan, dönüşüm oranı), Kanban huni (Yeni→Görüşme→Teklif→Pazarlık→Kazanıldı/Kaybedildi, sürükle bırak), firma/kişi listesi + detay zaman çizelgesi, teklif oluşturucu (KDV %1/10/20, yazdır/PDF).
KURALLAR: aşama değişince olasılık otomatik güncellenir; kaybedilen fırsatta kayıp nedeni zorunlu; gecikmiş aktiviteler kırmızı; teklif numarası yıl-sıra (2026-0001).
ENTEGRASYON İPUCU: e-posta/WhatsApp bağlantısı, CSV içe aktarma, İYS onay alanı.`, ["fırsat|firsat", "teklif", "firma", "aktivite|görev"], "tasarim-kurumsal-panel"),

  dev("on-muhasebe", "Ön muhasebe ve e-Fatura", "KOBİ'ler, serbest meslek, mali müşavir müşterileri", `
MODÜLLER: Cari hesaplar, Satış/alış faturası, Tahsilat-ödeme, Kasa-banka, Gelir-gider, KDV özeti, e-Fatura/e-Arşiv taslağı.
VERİ: cari{unvan,vknTckn,vergiDairesi,adres,bakiye}, fatura{tip(satis|alis),seri,no,tarih,vade,cariId,kalemler[{urun,miktar,birim,fiyat,kdvOrani,iskonto}],araToplam,kdv,genelToplam,durum}, hareket{tarih,tur,tutar,hesap,aciklama}.
EKRANLAR: Pano (alacak/borç, vadesi geçen, bu ay KDV), fatura formu (satır ekle, KDV %0/1/10/20 ayrı ayrı toplanır, tevkifat seçeneği), cari ekstre, kasa/banka hareketleri, yazdırılabilir fatura.
KURALLAR: VKN 10, TCKN 11 hane ve algoritmayla doğrulanır; tutarlar kuruş tamsayı olarak hesaplanıp ₺ biçiminde gösterilir; fatura kesilince cari bakiye otomatik değişir; tahsilat faturaya bağlanır; e-Fatura için UBL-TR alanları (ETTN, senaryo TEMEL/TICARI) taslak olarak tutulur.
NOT: Gerçek GİB gönderimi bir özel entegratör API'siyle yapılır; uygulama gönderime hazır veriyi üretir.`, ["fatura", "cari", "kdv", "tahsilat|ödeme"], "tasarim-kurumsal-panel"),

  dev("stok", "Stok ve depo yönetimi", "Toptancılar, üreticiler, mağazalar", `
MODÜLLER: Ürün kartları, Depolar/raflar, Giriş-çıkış-transfer hareketleri, Sayım, Kritik stok, Barkod.
VERİ: urun{kod,barkod,ad,birim,kategori,alisFiyati,satisFiyati,kritikSeviye}, depo{ad,konum}, hareket{tarih,tur(giris|cikis|transfer|sayim),urunId,depoId,miktar,belgeNo}, stok = hareketlerden hesaplanır.
EKRANLAR: Pano (toplam stok değeri, kritik ürünler, son hareketler), ürün listesi (filtre, arama, CSV), hareket fişi, depo bazlı stok tablosu, sayım ekranı (fark raporu).
KURALLAR: stok asla doğrudan düzenlenmez, hareketten türetilir; eksiye düşüren çıkış uyarı verir; FIFO maliyet; sayım farkı düzeltme hareketi oluşturur; kamera ile barkod okuma (BarcodeDetector varsa).`, ["stok", "depo", "hareket|giriş|giris", "kritik"], "tasarim-kurumsal-panel"),

  dev("erp-uretim", "ERP · üretim ve iş emri", "İmalat atölyeleri, fabrikalar", `
MODÜLLER: Reçete (ürün ağacı/BOM), İş emirleri, Üretim planı, Malzeme ihtiyacı (MRP), Kalite kontrol, Maliyet.
VERİ: recete{mamulId,bilesenler[{urunId,miktar}],iscilikDk}, isEmri{no,mamulId,miktar,baslangic,bitis,durum(planlandi|uretimde|kalite|tamamlandi),istasyon}, kalite{isEmriId,sonuc,hataTuru}.
EKRANLAR: Pano (açık iş emri, geciken, kapasite doluluğu), iş emri kanbanı, Gantt benzeri zaman çizelgesi, malzeme ihtiyaç listesi (stok yetmezse satın alma önerisi), maliyet özeti.
KURALLAR: iş emri başlarken bileşen stoktan düşülür, bitince mamul stoğa girer; fire oranı kaydedilir; kalite reddi yeniden işleme açar.`, ["iş emri|is emri", "reçete|recete", "üretim|uretim", "malzeme"], "tasarim-kurumsal-panel"),

  dev("b2b-bayi", "B2B bayi ve sipariş portalı", "Distribütörler, üreticiler, toptancılar", `
MODÜLLER: Bayi girişi, Bayiye özel fiyat listesi ve iskonto, Ürün kataloğu, Sepet ve sipariş, Cari bakiye ve limit, Sipariş takibi, Duyurular.
VERİ: bayi{unvan,vkn,fiyatGrubu,iskonto,krediLimiti,bakiye}, fiyatListesi{grup,urunId,fiyat}, siparis{no,bayiId,kalemler[],toplam,durum(alindi|onaylandi|hazirlaniyor|sevk|teslim),kargoNo}.
EKRANLAR: katalog (stok durumu, koli içi adet, hızlı adet girişi), sepet (iskonto ve KDV dökümü), sipariş geçmişi, cari ekstre, yönetici tarafında sipariş onay kuyruğu.
KURALLAR: fiyat bayi grubuna göre gösterilir; kredi limiti aşan sipariş onaya düşer; minimum sipariş tutarı; tekrar sipariş (son siparişi kopyala).`, ["bayi", "sipariş|siparis", "iskonto", "limit"], "tasarim-b2b-katalog"),

  dev("pos-adisyon", "POS · adisyon ve kasa", "Restoran, kafe, büfe", `
MODÜLLER: Masa planı, Adisyon, Menü ve opsiyonlar, Mutfak ekranı, Ödeme (nakit/kart/bölüşme), Gün sonu (Z raporu benzeri özet).
VERİ: masa{no,bolum,durum}, adisyon{masaId,kalemler[{urun,adet,not,durum}],acilis,indirim,odemeler[]}, urun{ad,kategori,fiyat,kdv,opsiyonlar}.
EKRANLAR: dokunmatik masa planı (renkle durum), sipariş ekranı (büyük düğmeler, kategori sekmeleri), mutfak sırası, hesap bölme, gün sonu raporu.
KURALLAR: sipariş mutfağa gidince değiştirilemez, iptal gerekçeli; hesap kişi başı ya da ürün bazlı bölünür; servis ücreti/indirim yetkiye bağlı; gün sonu kapanmadan yeni gün açılmaz.`, ["masa", "adisyon|sipariş", "ödeme|odeme", "mutfak"], "tasarim-pos-dokunmatik"),

  dev("ik", "İK · personel, izin ve puantaj", "Her ölçekte şirket, kamu kurumu", `
MODÜLLER: Personel kartları, İzin talebi ve onayı, Puantaj (giriş-çıkış), Vardiya, Bordro ön hesaplama, Zimmet, Performans.
VERİ: personel{ad,tckn,departman,unvan,iseGiris,maas,yoneticiId}, izin{personelId,tur(yillik|mazeret|rapor|ucretsiz),baslangic,bitis,gun,durum}, puantaj{personelId,tarih,giris,cikis}.
EKRANLAR: personel listesi, izin takvimi, onay kuyruğu (yönetici), kişinin kalan izin bakiyesi, puantaj tablosu, bordro özeti.
KURALLAR: 4857'ye göre yıllık izin kıdeme göre 14/20/26 gün; hafta sonu ve resmî tatiller izin gününden düşülmez; brüt-net hesap yaklaşık olarak gösterilir ve "bilgi amaçlı" yazılır; KVKK: TCKN maskelenir.`, ["izin", "personel", "puantaj|vardiya", "onay"], "tasarim-kurumsal-panel"),

  dev("randevu", "Randevu ve rezervasyon", "Klinik, kuaför, danışmanlık, spor salonu", `
MODÜLLER: Hizmetler ve süreleri, Çalışanlar ve çalışma saatleri, Takvim, Online randevu sayfası, Hatırlatma, Müşteri kartı.
VERİ: hizmet{ad,sure,fiyat}, calisan{ad,hizmetler,mesai}, randevu{musteri,tel,hizmetId,calisanId,baslangic,bitis,durum(onayli|geldi|gelmedi|iptal)}.
EKRANLAR: günlük/haftalık takvim (çalışan sütunları), müşteri tarafı adım adım randevu (hizmet→çalışan→gün→saat→onay), müşteri geçmişi, gelmeyen oranı.
KURALLAR: çakışan randevu engellenir; mesai dışı ve molalar kapalı; iptal son 2 saatte yapılamaz; hatırlatma WhatsApp bağlantısıyla hazırlanır.`, ["randevu", "takvim", "hizmet", "saat"], "tasarim-mobil-musteri"),

  dev("proje", "Proje ve görev yönetimi", "Ajanslar, yazılım ekipleri, inşaat ofisleri", `
MODÜLLER: Projeler, Görevler (kanban/liste), Kilometre taşları, Zaman kaydı, Dosya notları, Müşteri onayı.
VERİ: proje{ad,musteri,baslangic,bitis,butce}, gorev{baslik,projeId,atanan,durum,oncelik,sonTarih,tahmin,harcanan}, zaman{gorevId,kisi,dakika,tarih}.
EKRANLAR: kanban, liste (filtre: bana atanan, geciken), proje özeti (ilerleme yüzdesi, bütçe/harcanan saat), zaman çizelgesi.
KURALLAR: geciken görev vurgulanır; tamamlanan görev ilerlemeyi günceller; saat kaydı faturalanabilir/olmayan diye ayrılır.`, ["görev|gorev", "proje", "kanban|durum", "zaman|saat"], "tasarim-kurumsal-panel"),

  dev("destek", "Destek talebi (helpdesk)", "Yazılım firmaları, servisler, kamu çağrı merkezleri", `
MODÜLLER: Talep oluşturma, Kuyruk, Atama, SLA süreleri, Hazır yanıtlar, Bilgi bankası, Memnuniyet anketi.
VERİ: talep{no,konu,aciklama,kategori,oncelik,durum(acik|beklemede|cozuldu|kapandi),atanan,olusturma,ilkYanit,cozum}, mesaj{talepId,kimden,metin,tarih}.
EKRANLAR: temsilci kuyruğu (SLA geri sayımı), talep detayı yazışma görünümü, müşteri portalı, rapor (ortalama ilk yanıt ve çözüm süresi).
KURALLAR: önceliğe göre SLA (acil 1 saat, yüksek 4, normal 24); süresi geçen talep yukarı taşınır; çözülen talep 3 gün yanıt gelmezse kapanır.`, ["talep", "sla|süre", "öncelik|oncelik", "kuyruk|atama"], "tasarim-kurumsal-panel"),

  dev("ebys", "EBYS · belge ve yazışma yönetimi", "Kamu kurumları, belediyeler, büyük şirketler", `
MODÜLLER: Gelen/giden evrak, Kayıt numarası, Havale (yönlendirme), Paraf ve onay zinciri, Dosya planı (standart dosya planı kodları), Arşiv, Arama.
VERİ: evrak{sayi,tarih,konu,tur(gelen|giden|iç),gonderen,alici,dosyaKodu,gizlilik,durum}, akis{evrakId,adim,kimde,islem(paraf|onay|iade),tarih,not}.
EKRANLAR: gelen kutusu (bende bekleyenler), evrak oluşturma (resmî yazı şablonu: sayı, konu, ilgi, dağıtım), onay zinciri görünümü, arşiv araması.
KURALLAR: Resmî Yazışma Yönetmeliği biçimi (antet, sayı, tarih, konu, imza bloğu); onaylanan evrak değiştirilemez; her işlem denetim izine yazılır; gizli evrak yalnızca yetkiliye görünür.
NOT: Gerçek e-imza ve KEP entegrasyonu dış hizmet gerektirir; uygulama süreç ve kaydı yönetir.`, ["evrak", "onay|paraf", "sayı|sayi", "arşiv|arsiv"], "tasarim-kamu-portali"),

  dev("beyaz-masa", "Vatandaş talep ve şikâyet (beyaz masa)", "Belediyeler, kamu kurumları", `
MODÜLLER: Başvuru formu (konum, fotoğraf), Başvuru takip numarası, Birimlere yönlendirme, Saha ekibi görevi, Sonuç bildirimi, İstatistik.
VERİ: basvuru{takipNo,tur(talep|sikayet|oneri|ihbar),kategori,aciklama,adres,konum,foto,ad,tel,durum(alindi|birimde|sahada|cozuldu|reddedildi),birim,yanit}.
EKRANLAR: vatandaş tarafı sade form ve takip sorgusu, operatör kuyruğu, birim ekranı, harita görünümü (konum işaretleri), mahalle/kategori istatistikleri.
KURALLAR: 3071/CİMER benzeri yasal yanıt süresi (30 gün) geri sayımı; kimlik bilgisi KVKK aydınlatmasıyla alınır; tekrar eden başvurular birleştirilir.`, ["başvuru|basvuru", "takip", "birim", "şikayet|şikâyet|sikayet"], "tasarim-kamu-portali"),

  dev("saha-servis", "Saha servis ve bakım", "Teknik servis, asansör, klima, güvenlik firmaları", `
MODÜLLER: İş emri, Teknisyen ataması, Rota/günlük plan, Periyodik bakım sözleşmesi, Servis formu (yapılan iş, parça, imza), Fotoğraf.
VERİ: musteri{ad,adres,konum}, cihaz{musteriId,tur,seriNo,sonBakim,periyotGun}, isEmri{no,cihazId,teknisyen,tarih,tur(ariza|bakim|kurulum),durum,yapilan,parcalar[],imza}.
EKRANLAR: dispeçer panosu, teknisyenin mobil günlük listesi (büyük düğmeler, çevrimdışı), servis formu (parmakla imza alanı), bakımı yaklaşan cihazlar.
KURALLAR: periyodu dolan cihaz için otomatik bakım iş emri; kullanılan parça stoktan düşer; imzasız form kapatılamaz.`, ["iş emri|is emri|servis", "teknisyen", "bakım|bakim", "imza"], "tasarim-mobil-saha"),

  dev("filo", "Filo ve araç takibi", "Lojistik, kargo, kurumsal araç filoları", `
MODÜLLER: Araçlar, Sürücüler, Muayene/sigorta/kasko takvimi, Yakıt, Bakım, Kilometre, Ceza ve hasar kayıtları.
VERİ: arac{plaka,marka,model,yil,km,muayeneTarihi,sigortaBitis,kaskoBitis}, yakit{aracId,tarih,litre,tutar,km}, bakim{aracId,tarih,km,yapilan,tutar}.
EKRANLAR: pano (yaklaşan muayene/sigorta, km başı maliyet), araç kartı zaman çizelgesi, yakıt tüketimi grafiği (L/100 km).
KURALLAR: plaka biçimi doğrulanır (34 ABC 123); süresi 30 gün içinde dolan belge uyarı verir; olağan dışı yakıt tüketimi işaretlenir.`, ["araç|arac|plaka", "yakıt|yakit", "muayene", "bakım|bakim"], "tasarim-kurumsal-panel"),

  dev("okul", "Okul ve kurs yönetimi", "Özel okullar, kurslar, eğitim kurumları", `
MODÜLLER: Öğrenci kayıt, Sınıf/şube, Ders programı, Yoklama, Not ve karne, Veli iletişimi, Taksit/ödeme takibi.
VERİ: ogrenci{ad,tckn,sinif,veli{ad,tel}}, ders{ad,ogretmen,sinif,gun,saat}, yoklama{tarih,dersId,ogrenciId,durum}, not{ogrenciId,ders,sinav,puan}, taksit{ogrenciId,vade,tutar,odendi}.
EKRANLAR: öğretmen yoklama ekranı (tek dokunuşla var/yok), haftalık ders programı tablosu, karne görünümü, veli tarafı özet, geciken taksitler.
KURALLAR: devamsızlık sınırı uyarısı; not ortalaması ağırlıklı hesaplanır; veliye toplu mesaj hazır metinle.`, ["öğrenci|ogrenci", "yoklama", "not|karne", "veli"], "tasarim-kurumsal-panel"),

  dev("satin-alma", "Satın alma ve tedarik", "Şirket satın alma birimleri, kamu ihale öncesi süreçler", `
MODÜLLER: Talep, Teklif toplama, Teklif karşılaştırma, Onay, Sipariş, Mal kabul, Tedarikçi değerlendirme.
VERİ: talep{no,talepEden,kalemler[],gerekce,durum}, teklif{talepId,tedarikci,kalemFiyatlari,teslimGun,vade}, siparis{teklifId,durum}, tedarikci{unvan,vkn,puan}.
EKRANLAR: talep formu, karşılaştırma tablosu (en düşük fiyat vurgulu, teslim ve vade dahil), onay zinciri (tutara göre yetki), mal kabul.
KURALLAR: tutar eşiğine göre onay seviyesi; en az 3 teklif kuralı; mal kabulde eksik/hasarlı kalem not edilir; kamu için 4734 eşikleri bilgi notu olarak gösterilir.`, ["talep", "teklif", "tedarikçi|tedarikci", "onay"], "tasarim-kurumsal-panel"),

  dev("klinik", "Klinik ve hasta yönetimi", "Poliklinik, diş kliniği, fizik tedavi, veteriner", `
MODÜLLER: Hasta kartı, Randevu, Muayene notu, Tedavi planı, Reçete taslağı, Tahsilat, Hatırlatma.
VERİ: hasta{ad,tckn,dogum,tel,alerji,notlar}, muayene{hastaId,tarih,sikayet,bulgu,tani,plan}, tedavi{hastaId,islem,seans,ucret,durum}, odeme{hastaId,tutar,tarih}.
EKRANLAR: günün hasta listesi, hasta zaman çizelgesi, tedavi planı ve seans takibi, borç/tahsilat özeti.
KURALLAR: sağlık verisi özel nitelikli kişisel veridir: KVKK açık rıza kutusu, ekranda TCKN maskeli; muayene notu kaydedildikten sonra yalnızca ek notla değiştirilir.`, ["hasta", "muayene|tedavi", "randevu", "tahsilat|ödeme"], "tasarim-kurumsal-panel"),

  dev("e-ticaret", "E-ticaret yönetimi", "Online mağazalar, pazaryeri satıcıları", `
MODÜLLER: Ürün ve varyant, Kategori, Sipariş, Kargo, İade, Kupon, Müşteri, Mağaza vitrini.
VERİ: urun{ad,slug,varyantlar[{beden,renk,stok,fiyat}],gorseller,kategori}, siparis{no,musteri,adres,kalemler,kargoFirmasi,takipNo,durum}, kupon{kod,oran,bitis}.
EKRANLAR: vitrin (filtre, sepet, ödeme adımı), yönetim: sipariş listesi ve durum değiştirme, stok uyarıları, iade talepleri.
KURALLAR: sepette stok tekrar kontrol edilir; Mesafeli Sözleşmeler Yönetmeliği: ön bilgilendirme ve 14 gün cayma hakkı metni; kargo ücreti eşiği; kupon tek kullanımlık olabilir.`, ["sepet", "sipariş|siparis", "kargo", "ürün|urun"], "tasarim-b2b-katalog"),
];

// Tasarım becerileri (arayüz kalıpları)
export const DESIGN = [
  { id: "tasarim-kurumsal-panel", kind: "tasarim", cat: "tasarim", name: "Kurumsal yönetim paneli", who: "ERP, CRM, İK, muhasebe", checks: ["<nav|sidebar|menü", "<table|tablo", "ara|filtre"], body: `DÜZEN: solda daraltılabilir menü, üstte sayfa başlığı + birincil eylem düğmesi + arama. İçerik: özet kartları satırı, ardından filtre çubuğu ve tablo.
TABLO: sabit başlık, sıralanabilir sütunlar, satır üstüne gelince eylemler, toplu seçim, sayfalama, sağa hizalı sayılar, durum için renkli rozet.
FORM: iki sütunlu ızgara, zorunlu alan işareti, satır içi doğrulama mesajı, kaydet/vazgeç sabit alt çubukta.
STİL: nötr gri zemin, tek vurgu rengi, 8px boşluk ızgarası, 14px gövde yazısı, yoğun ama nefes alan tablolar, koyu tema desteği.` },
  { id: "tasarim-kamu-portali", kind: "tasarim", cat: "tasarim", name: "Kamu portalı", who: "Belediye, kamu kurumu, vatandaş hizmeti", checks: ["<label", "aria-|alt=", "<h1"], body: `DÜZEN: sade üst bant (kurum adı/logo), büyük başlık, adım adım ilerleyen formlar (1/3, 2/3), her adımda açıklama.
ERİŞİLEBİLİRLİK zorunlu: WCAG AA kontrast, en az 16px yazı, tüm alanlarda label, klavyeyle tam kullanım, odak halkası, hata mesajı alanın altında ve açık dille.
DİL: resmî ama anlaşılır Türkçe; kısaltma yok; işlem sonunda takip numarası büyük ve kopyalanabilir.
STİL: beyaz zemin, lacivert/kırmızı ölçülü vurgu, süs yok, yazdırılabilir sonuç sayfası.` },
  { id: "tasarim-b2b-katalog", kind: "tasarim", cat: "tasarim", name: "B2B katalog ve sipariş", who: "Bayi portalı, e-ticaret", checks: ["sepet", "ara|filtre", "adet|miktar"], body: `DÜZEN: üstte arama + kategori menüsü + sepet özeti; liste/ızgara görünüm değiştirici; solda filtreler.
ÜRÜN SATIRI: kod, ad, stok rozeti, birim fiyat (bayiye özel), adet girişi (+/-), hızlı "sepete ekle".
SEPET: yan çekmece, kalem bazında iskonto ve KDV dökümü, minimum tutar ilerleme çubuğu.
STİL: bilgi yoğun ama okunur, fiyatlar kalın ve sağa hizalı, mobilde tek sütun kartlar.` },
  { id: "tasarim-pos-dokunmatik", kind: "tasarim", cat: "tasarim", name: "Dokunmatik POS", who: "Restoran, kafe, perakende kasası", checks: ["button", "toplam"], body: `DÜZEN: yatay tablet için iki panel: solda kategori ve ürün ızgarası, sağda adisyon ve toplam.
DOKUNMA: en az 56px düğmeler, büyük yazı, tek dokunuşla ekle, uzun basınca not/opsiyon; onay gerektiren işlemlerde net iletişim kutusu.
RENK: masa ve sipariş durumları için tutarlı renkler (boş yeşil, dolu turuncu, hesap istendi kırmızı); koyu zemin göz yormaz.` },
  { id: "tasarim-mobil-saha", kind: "tasarim", cat: "tasarim", name: "Mobil saha uygulaması", who: "Teknisyen, satış temsilcisi, saha ekibi", checks: ["viewport", "button"], body: `DÜZEN: alt sekme çubuğu (Bugün, İşler, Harita, Profil), kart listesi, tek elle erişilen büyük birincil düğme.
ÇEVRİMDIŞI: veriler cihazda saklanır, bağlantı yokken üst bantta "çevrimdışı" yazar, bağlanınca senkron bekleyenler sayılır.
FORM: adım adım, kamera ve imza alanı, otomatik kayıt.
STİL: güneş altında okunur yüksek kontrast, 18px gövde yazısı.` },
  { id: "tasarim-mobil-musteri", kind: "tasarim", cat: "tasarim", name: "Mobil müşteri akışı", who: "Randevu, rezervasyon, sipariş sayfaları", checks: ["viewport", "button"], body: `DÜZEN: tek sütun, üstte işletme kimliği, adım göstergesi, her ekranda tek karar.
SEÇİM: büyük kart seçenekler, saat seçiminde çip ızgarası, dolu saatler soluk ve seçilemez.
GÜVEN: fiyat ve süre her adımda görünür, onay ekranında özet ve "takvime ekle" / WhatsApp ile paylaş.` },
];

// Kalite becerileri: her uygulamada "tertemiz" çıktı için yazılım mühendisliği kuralları
export const QUALITY = [
  { id: "kalite-temiz-mimari", kind: "kalite", cat: "kalite", name: "Temiz mimari", who: "Tüm uygulamalar", checks: ["localstorage", "function"], body: `KOD DÜZENİ: tek bir durum nesnesi (state) + saf render fonksiyonları + olay işleyicileri; veri erişimi tek bir depo katmanından (load/save) geçer.
İSİMLENDİRME: anlamlı Türkçe/İngilizce tutarlı adlar, sihirli sayı yok, sabitler üstte.
VERİ: localStorage'a sürüm anahtarıyla yaz (app:v1), okumada bozuk veriye karşı try/catch ve varsayılan; tarihleri ISO, tutarları kuruş tamsayı sakla.
DURUMLAR: her listede boş, yükleniyor ve hata durumu; geri al (son silme) seçeneği.
KÜÇÜK FONKSİYONLAR: her fonksiyon tek iş; tekrar eden HTML parçaları bileşen fonksiyonu.` },
  { id: "kalite-tr-dogrulama", kind: "kalite", cat: "kalite", name: "Türkiye veri doğrulama", who: "Kimlik, vergi, banka verisi tutan uygulamalar", checks: ["tckn|vkn|iban"], body: `TCKN: 11 hane, ilk hane 0 değil, 10. ve 11. hane algoritmasıyla doğrula. VKN: 10 hane ve GİB algoritması. IBAN: TR + 24 hane, mod-97 kontrolü. Telefon: 05xx xxx xx xx. Plaka: 2 hane il kodu (01-81) + harf + rakam. Tutar: tr-TR biçimi, ₺ işareti. Tarih: GG.AA.YYYY gösterim, ISO saklama. Hata mesajı alanın altında, neyin yanlış olduğunu söylesin.` },
  { id: "kalite-rol-yetki", kind: "kalite", cat: "kalite", name: "Rol ve yetki", who: "Çok kullanıcılı kurumsal uygulamalar", checks: ["rol|yetki|admin|yönetici"], body: `Roller: Yönetici, Yetkili, Personel, Salt okunur (örnek kullanıcılarla). Her eylem bir yetki anahtarına bağlı (ör. fatura.sil); yetkisiz düğme gizlenir ve işlev de reddeder. Üstte "rol değiştir" demo seçicisi. Onay gerektiren işlemler kimin onayladığını kaydeder.` },
  { id: "kalite-denetim-izi", kind: "kalite", cat: "kalite", name: "Denetim izi (audit log)", who: "Muhasebe, kamu, sağlık", checks: ["kayıt|log|geçmiş|gecmis"], body: `Her ekleme/değiştirme/silme işlemi {kim, ne zaman, hangi kayıt, eski değer, yeni değer} olarak değiştirilemez bir günlüğe yazılır; kayıt detayında "Geçmiş" sekmesi; silme yerine arşivleme (yumuşak silme).` },
  { id: "kalite-test-senaryo", kind: "kalite", cat: "kalite", name: "Kendi kendini sınayan uygulama", who: "Kritik hesap yapan uygulamalar", checks: ["test|kontrol"], body: `Hesap yapan saf fonksiyonları (KDV, toplam, izin günü, stok) ayrı tut ve sayfa açılışında küçük bir self-test çalıştır: bilinen girdilerle beklenen çıktıyı karşılaştır, hata varsa konsola ve geliştirici bandına yaz. Formlarda sınır değerleri (0, negatif, çok büyük) reddet.` },
];

CATALOG.push(...SECTOR_SKILLS);
export const ALL_SKILLS = [...CATALOG, ...DESIGN, ...QUALITY];

// Beceri avcısının GitHub'da açık kaynak muadilleri arayacağı terimler
export const HUNT_TERMS = { crm: "crm", "on-muhasebe": "invoicing accounting", stok: "inventory management", "erp-uretim": "erp manufacturing", "b2b-bayi": "b2b ordering portal", "pos-adisyon": "restaurant pos", ik: "hrms leave management", randevu: "appointment booking", proje: "project management kanban", destek: "helpdesk ticketing", ebys: "document management workflow", "beyaz-masa": "civic issue reporting", "saha-servis": "field service management", filo: "fleet management", okul: "school management system", "satin-alma": "procurement purchase requisition", klinik: "clinic management", "e-ticaret": "ecommerce admin" , ...SECTOR_HUNT};

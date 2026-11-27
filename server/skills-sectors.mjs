// Sektör kütüphanesi: Türkiye'deki işletme türlerinin her biri için "uygulama planı" becerileri ve sektör grupları.
// Biçim skills-catalog.mjs ile aynıdır (MODÜLLER / VERİ / EKRANLAR / KURALLAR). Mevzuat notları bilgi amaçlıdır;
// uygulama resmî sistemlere (GİB, SGK, İTS, KBS, UYAP…) kendisi bağlanmaz, gönderime hazır veriyi ve süreci yönetir.

const P = "tasarim-kurumsal-panel", M = "tasarim-mobil-musteri", S = "tasarim-mobil-saha", K = "tasarim-b2b-katalog", T = "tasarim-pos-dokunmatik", G = "tasarim-kamu-portali";
const dev = (id, ad, kim, govde, checks, tasarim, hunt) => ({ id: "plan-" + id, kind: "gelistirme", cat: id, name: ad, who: kim, body: govde.trim(), checks, design: tasarim, hunt, test: ad + " uygulaması yap; örnek verilerle dolu olsun." });

export const SECTOR_SKILLS = [
  // ---------- Yeme-içme ----------
  dev("restoran-rezervasyon", "Restoran rezervasyon ve masa yönetimi", "Restoranlar, meyhaneler, fine dining", `
MODÜLLER: Online rezervasyon, Masa planı, Bekleme listesi, Kapora, Misafir kartı, Gün özeti.
VERİ: masa{no,bolum,kapasite,birlestirilebilir}, rezervasyon{misafir,tel,kisi,tarih,saat,sure,masaIds,not,durum(bekliyor|onayli|geldi|gelmedi|iptal),kapora}, misafir{ad,tel,ozelGun,alerji,ziyaretSayisi}.
EKRANLAR: müşteri tarafı adım adım rezervasyon (gün→saat→kişi→iletişim), salon planında saatlik doluluk, gelen misafir listesi, bekleme listesi, no-show raporu.
KURALLAR: kişi sayısına uygun masa ya da birleştirilebilir masa önerilir; aynı masada süre çakışması engellenir; kalabalık grupta kapora istenir; 15 dk gecikmede masa serbest bırakılabilir; alerji notu siparişte görünür.`, ["rezervasyon", "masa", "misafir", "kapora|saat"], M, "restaurant reservation"),
  dev("paket-servis", "Online sipariş ve paket servis", "Restoran, pizzacı, dönerci, ev yemekleri", `
MODÜLLER: Menü ve opsiyonlar, Sepet, Teslimat bölgeleri, Sipariş takibi, Kurye atama, Kampanya.
VERİ: urun{ad,kategori,fiyat,opsiyonlar[{ad,ekFiyat}],stokta}, bolge{ad,minTutar,teslimUcreti,sureDk}, siparis{no,musteri,adres,kalemler,odeme(kapida-nakit|kapida-kart|online),durum(alindi|hazirlaniyor|yolda|teslim|iptal),kuryeId}.
EKRANLAR: mobil menü ve sepet, adres/bölge seçimi, sipariş durum ekranı, mutfak/işletme sipariş panosu (sesli uyarı), kurye listesi.
KURALLAR: bölge minimum tutarı altında sipariş verilemez; kapanış saatinde menü kapanır; tükenen ürün seçilemez; tahmini teslim süresi bölge + mutfak yoğunluğuyla hesaplanır; WhatsApp ile sipariş özeti gönderilebilir.`, ["sepet", "sipariş|siparis", "kurye|teslimat", "bölge|bolge|adres"], M, "food delivery ordering"),
  dev("sadakat-kart", "Kafe sadakat ve damga kartı", "Kafe, kahveci, fırın, büfe", `
MODÜLLER: Müşteri kaydı (telefonla), Damga/puan, Ödüller, Kampanyalar, Kasiyer ekranı, Raporlar.
VERİ: musteri{tel,ad,dogumGunu,puan,damga}, hareket{musteriId,tur(kazan|harca),miktar,tarih,kasiyer}, odul{ad,gerekenDamga|gerekenPuan}.
EKRANLAR: kasiyer için büyük düğmeli hızlı ekran (telefon gir → damga ekle), müşterinin kendi kart sayfası (QR, kalan damga), ödül listesi, sadık müşteri raporu.
KURALLAR: 10 damgada 1 ürün hediye gibi kural tanımlanabilir; aynı müşteriye 1 dakikada ikinci damga engellenir; doğum gününde hediye; harcanan ödül geri alınamaz; İYS/ticari ileti onayı ayrı kutu.`, ["damga|puan", "müşteri|musteri", "ödül|odul", "kampanya"], T, "loyalty card"),
  dev("catering", "Catering ve toplu yemek", "Catering firmaları, fabrika ve okul yemekhaneleri", `
MODÜLLER: Menü planı, Reçete ve gramaj, Kurum sözleşmeleri, Günlük kişi sayısı, Teklif, Malzeme ihtiyacı.
VERİ: kurum{ad,kisiFiyati,ogunler,sozlesmeBitis}, menu{tarih,ogun,yemekler[]}, recete{yemek,malzemeler[{ad,gramKisi}]}, sayim{kurumId,tarih,kisi}.
EKRANLAR: haftalık menü takvimi, kurum bazlı günlük kişi girişi, malzeme ihtiyaç listesi (gram × kişi), aylık hakediş/fatura özeti, teklif oluşturucu.
KURALLAR: malzeme ihtiyacı kişi sayısı × gramajdan hesaplanır ve kg'a çevrilir; aynı yemeğin bir hafta içinde tekrarı uyarı verir; alerjen etiketleri menüde görünür; aylık tutar = kişi × gün × kişi başı fiyat.`, ["menü|menu", "kişi|kisi", "gramaj|reçete|recete", "kurum"], P, "catering management"),
  dev("pastane", "Pastane ve fırın sipariş-üretim", "Pastane, fırın, butik pasta", `
MODÜLLER: Vitrin ürünleri, Özel pasta siparişi, Üretim planı, Teslim takvimi, Kapora, Fire.
VERİ: siparis{musteri,tel,teslimTarihi,teslimSaati,urun,kisi,tat,yazi,gorsel,kapora,toplam,durum}, uretim{tarih,urun,adet,uretilen,fire}.
EKRANLAR: özel pasta sipariş formu (kişi sayısı, kat, tat, yazı, fotoğraf), günlük teslim listesi, üretim planı, kapora ve kalan ödeme, fire raporu.
KURALLAR: özel siparişe en az 48 saat süre; kapora alınmadan üretim planına düşmez; kişi sayısına göre boy önerilir; teslim günü sabahı hatırlatma; gün sonu fire kaydı.`, ["pasta|sipariş|siparis", "teslim", "kapora", "üretim|uretim"], M, "bakery order management"),

  // ---------- Sağlık ----------
  dev("dis-klinigi", "Diş kliniği", "Diş hekimleri, ağız ve diş sağlığı polikliniği", `
MODÜLLER: Hasta kartı, Diş şeması, Tedavi planı, Randevu, Ödeme planı, Röntgen notları.
VERİ: hasta{ad,tckn,tel,alerji,ilac}, dis{no(FDI 11–48),durum(saglam|curuk|dolgulu|kanal|cekilmis|implant)}, tedavi{hastaId,disNo,islem,ucret,durum(planlandi|yapildi)}, taksit{tutar,vade,odendi}.
EKRANLAR: tıklanabilir diş şeması (FDI numaralı, renk kodlu), tedavi planı ve toplam fiyat, seans randevuları, ödeme planı ve borç, hasta geçmişi.
KURALLAR: işlem diş numarasına bağlanır; yapılan işlem şemayı günceller; tedavi onamı (KVKK + aydınlatılmış onam) kutusu; taksit vadesi geçince uyarı; TCKN ekranda maskeli.`, ["diş|dis", "tedavi", "hasta", "ödeme|odeme|taksit"], P, "dental clinic"),
  dev("eczane", "Eczane stok ve satış", "Serbest eczaneler", `
MODÜLLER: İlaç ve parafarmasötik stok, Karekod/lot, Miat takibi, Reçeteli satış, Hasta borç, Sipariş (depo).
VERİ: urun{barkod,ad,tur(ilac|otc|dermo|medikal),receteTuru(normal|kirmizi|yesil|turuncu|mor),kdv}, parti{urunId,lot,miat,miktar}, satis{tarih,receteNo,kalemler,katkiPayi,odeme}, borc{hasta,tutar}.
EKRANLAR: hızlı satış (barkod/karekod okut), miadı yaklaşanlar (90/30 gün), kritik stok ve depo sipariş listesi, reçete türü dağılımı, hasta veresiye.
KURALLAR: satışta miadı en yakın uygun lot önerilir; miadı geçmiş lot satılamaz; kırmızı/yeşil reçeteli ilaçlarda reçete no zorunlu; NOT: İTS bildirimi ve SGK Medula provizyonu resmî sistemle yapılır, uygulama hazır kaydı tutar.`, ["miat|lot", "reçete|recete", "stok", "satış|satis"], T, "pharmacy management"),
  dev("veteriner", "Veteriner kliniği", "Veteriner klinikleri, pet kuaför ve oteli", `
MODÜLLER: Hayvan sahibi ve hasta kartı, Aşı takvimi, Muayene, Tedavi ve ilaç, Pet otel/kuaför, Hatırlatma.
VERİ: sahip{ad,tel}, hayvan{ad,tur,irk,dogum,kilo,cip,kisir}, asi{hayvanId,tur(karma|kuduz|ic-dis-parazit),tarih,sonraki}, muayene{tarih,sikayet,bulgu,tani,ilaclar}.
EKRANLAR: hayvan kartı (fotoğraf, kilo grafiği), aşı karnesi ve yaklaşanlar, günlük randevular, tedavi ve tahsilat, sahibine WhatsApp hatırlatma.
KURALLAR: aşı yapılınca sonraki tarih türüne göre otomatik hesaplanır; yaklaşan aşı 7 gün önce listelenir; kilo kayıtlarından ilaç dozu uyarısı (bilgi amaçlı); mikroçip no 15 hane.`, ["aşı|asi", "hayvan", "muayene", "sahip"], P, "veterinary clinic"),
  dev("diyetisyen", "Diyetisyen danışan takibi", "Diyetisyenler, beslenme danışmanları", `
MODÜLLER: Danışan kartı, Ölçümler, Diyet listesi, Kontrol randevusu, Paket ve ödeme, Mesaj notları.
VERİ: danisan{ad,dogum,cinsiyet,boy,hedefKilo,hastalik,alerji}, olcum{tarih,kilo,bel,kalca,yag}, liste{tarih,ogunler[{ogun,icerik,kalori}]}, paket{seans,kalan,ucret}.
EKRANLAR: danışan listesi, ilerleme grafiği (kilo, bel), BKİ ve günlük enerji ihtiyacı hesabı, öğün öğün diyet listesi şablonu (yazdır/PDF), paket kalan seans.
KURALLAR: BKİ = kilo/boy²; enerji ihtiyacı Mifflin-St Jeor ile hesaplanır ve "tahmini" yazılır; alerjen içeren besin listede uyarı verir; paket bitince yenileme önerisi.`, ["ölçüm|olcum|kilo", "diyet|öğün|ogun", "danışan|danisan", "bki|kalori"], P, "nutritionist client tracking"),
  dev("psikolojik-danismanlik", "Psikolog ve danışmanlık seansları", "Psikolog, psikolojik danışman, koç, terapist", `
MODÜLLER: Danışan dosyası, Seans takvimi, Gizli seans notları, Online görüşme bağlantısı, Paket/ücret, Ölçek sonuçları.
VERİ: danisan{ad,rumuz,tel,acilKisi,onam}, seans{danisanId,tarih,sure,tur(yuz-yuze|online),not(gizli),odeme}, olcek{ad,tarih,puan}.
EKRANLAR: haftalık seans takvimi, danışan dosyası (seans geçmişi, ölçek grafiği), kilitli not alanı, ödeme ve iptal geçmişi.
KURALLAR: seans notları yalnız terapiste görünür ve listede rumuzla gösterilir; KVKK açık rıza ve gizlilik onamı zorunlu; 24 saatten kısa iptal ücretli olarak işaretlenir; ölçek puanları tanı değildir notu.`, ["seans", "danışan|danisan", "gizli|onam", "takvim|randevu"], P, "therapy practice management"),
  dev("laboratuvar", "Tıbbi laboratuvar", "Tahlil laboratuvarları, check-up merkezleri", `
MODÜLLER: Hasta kaydı, Test kataloğu, Numune barkodu, Sonuç girişi, Uzman onayı, Sonuç raporu.
VERİ: test{kod,ad,birim,referansMin,referansMax,numuneTuru,fiyat}, istek{hasta,testler,barkod,alimZamani,durum(bekliyor|calisiliyor|onay|rapor)}, sonuc{istekId,testKod,deger,onaylayan}.
EKRANLAR: kayıt ve test seçimi (paketler), barkod etiketi yazdırma, sonuç giriş tablosu, referans dışı değer vurgusu, onaylı PDF rapor, hasta sonuç sorgulama (barkod + doğum tarihi).
KURALLAR: referans aralığı dışı değer kırmızı ve ↑/↓ işaretli; uzman onayı olmadan rapor yayınlanmaz; onaylanan sonuç değiştirilirse düzeltme kaydı tutulur; sağlık verisi KVKK özel nitelikli.`, ["numune|barkod", "sonuç|sonuc", "referans", "test"], P, "laboratory information system"),
  dev("evde-bakim", "Evde bakım ve hasta bakım hizmeti", "Evde sağlık, yaşlı bakım, hasta bakıcı firmaları", `
MODÜLLER: Bakım alan kişi, Bakım planı, Ziyaret takvimi, Bakıcı atama, İlaç saatleri, Ziyaret raporu.
VERİ: kisi{ad,adres,yakin,tel,hastaliklar}, plan{kisiId,gorevler[],ilaclar[{ad,saat,doz}]}, ziyaret{kisiId,bakiciId,tarih,giris,cikis,yapilanlar,olcumler{tansiyon,seker,ates}}.
EKRANLAR: bakıcı mobil ekranı (bugünkü ziyaretler, kontrol listesi, ölçüm girişi), yakın bilgilendirme özeti, haftalık plan, bakıcı puantajı.
KURALLAR: ziyaret giriş-çıkış saati kaydedilir; atlanan ilaç dozu kırmızı; ölçüm sınır dışıysa yakına bildirim önerilir; bakıcının çakışan ziyareti engellenir.`, ["ziyaret", "bakıcı|bakici", "ilaç|ilac", "plan"], S, "home care management"),

  // ---------- Güzellik ve kişisel bakım ----------
  dev("kuafor-salon", "Kuaför ve berber salonu", "Kuaför, berber, erkek bakım salonları", `
MODÜLLER: Randevu, Hizmet ve süre, Personel ve prim, Ürün satışı, Kasa, Müşteri geçmişi.
VERİ: hizmet{ad,sureDk,fiyat}, personel{ad,primOrani,hizmetler}, randevu{musteri,tel,hizmetler,personelId,baslangic,durum}, satis{randevuId,kalemler,odeme,bahsis}.
EKRANLAR: personel sütunlu günlük takvim, müşteri tarafı online randevu, adisyon/kasa, personel prim raporu, müşteri geçmişi (son boya formülü notu).
KURALLAR: birden fazla hizmetin süreleri toplanarak randevu bloğu oluşur; personel izinli günde seçilemez; prim = hizmet cirosu × oran; gelmeyen müşteri işaretlenir; WhatsApp hatırlatma.`, ["randevu", "personel", "prim", "hizmet"], M, "salon booking"),
  dev("guzellik-merkezi", "Güzellik merkezi ve paket seans", "Güzellik merkezi, lazer epilasyon, cilt bakımı, spa", `
MODÜLLER: Danışan kartı, Paket satışı, Seans takibi, Cihaz/oda planı, Öncesi-sonrası fotoğraf, Taksit.
VERİ: paket{ad,seansSayisi,aralikGun,fiyat}, danisanPaket{danisanId,paketId,kalan,baslangic}, seans{danisanPaketId,tarih,uygulayan,cihaz,bolge,ayar,not}.
EKRANLAR: danışanın paketleri ve kalan seans, seans takvimi (oda/cihaz sütunları), seans formu (bölge, ayar), fotoğraf karşılaştırma, borç/taksit.
KURALLAR: seanslar arası minimum gün aralığı (ör. lazer 4–6 hafta) zorlanır; paket bitmeden yenileme hatırlatması; fotoğraf için açık rıza; aynı cihaz aynı saatte iki seansa verilemez.`, ["seans", "paket", "danışan|danisan", "cihaz|oda"], P, "beauty center management"),

  // ---------- Spor ----------
  dev("spor-salonu", "Spor salonu ve fitness üyelik", "Fitness salonları, crossfit, boks salonları", `
MODÜLLER: Üyelik ve paket, Giriş kontrolü (QR), Dondurma, PT dersleri, Ölçüm, Tahsilat.
VERİ: uye{ad,tel,dogum,acilKisi,saglikBeyani}, uyelik{uyeId,paket,baslangic,bitis,dondurmaGun,durum}, giris{uyeId,zaman}, pt{uyeId,hoca,kalanDers}.
EKRANLAR: resepsiyon giriş ekranı (QR/telefon → yeşil/kırmızı), üyelik bitenler, doluluk grafiği (saatlik), PT ders takvimi, üye ölçüm grafiği.
KURALLAR: süresi biten üye girişte uyarı alır; dondurma süresi bitişe eklenir ve yılda üst sınırı vardır; PT dersi yapılınca kalan düşer; aynı QR 5 dakikada ikinci kez okunursa reddedilir.`, ["üye|uye", "giriş|giris", "paket|üyelik", "dondur"], P, "gym membership management"),
  dev("yoga-pilates", "Yoga, pilates ve stüdyo dersleri", "Pilates, yoga, dans ve reformer stüdyoları", `
MODÜLLER: Ders programı, Kontenjanlı rezervasyon, Ders kredisi paketleri, Bekleme listesi, Eğitmen, Yoklama.
VERİ: ders{ad,egitmen,tarih,saat,kontenjan,seviye,salon}, kredi{uyeId,kalan,bitis}, rezervasyon{dersId,uyeId,durum(onayli|bekleme|iptal|katildi)}.
EKRANLAR: haftalık ders takvimi (doluluk göstergesi), üye mobil rezervasyon, bekleme listesi, eğitmen yoklama ekranı, kredi geçmişi.
KURALLAR: kontenjan dolunca bekleme listesine alınır, iptal olunca sıradaki otomatik onaylanır; dersten 6 saat önceye kadar iptal kredi iade eder; katılmayan için kredi düşer; reformer cihaz sayısı kontenjanı belirler.`, ["ders", "kontenjan", "kredi", "bekleme"], M, "studio class booking"),
  dev("spor-kulubu", "Spor kulübü ve akademi", "Futbol, basketbol, yüzme akademileri, amatör kulüpler", `
MODÜLLER: Sporcu kaydı, Gruplar/yaş kategorileri, Antrenman programı, Yoklama, Aidat, Veli iletişimi, Maç/turnuva.
VERİ: sporcu{ad,dogum,veli,tel,lisansNo,saglikRaporuBitis,grup}, antrenman{grup,tarih,saat,saha,antrenor}, yoklama{antrenmanId,sporcuId,var}, aidat{sporcuId,ay,tutar,odendi}.
EKRANLAR: gruplara göre sporcu listesi, antrenör mobil yoklama, aidat tablosu (ay ay), sağlık raporu bitenler, veli duyuru, maç takvimi ve kadro.
KURALLAR: yaş kategorisi doğum yılından hesaplanır; sağlık raporu süresi geçen sporcu kadroya alınamaz; aidat gecikmesi listelenir; kardeş indirimi kuralı.`, ["sporcu", "antrenman", "yoklama", "aidat"], P, "sports club management"),

  // ---------- Eğitim ----------
  dev("kurs-merkezi", "Kurs merkezi ve etüt", "Özel öğretim kursları, etüt merkezleri, dil kursları", `
MODÜLLER: Öğrenci ve veli, Sınıflar ve ders programı, Yoklama, Deneme sınavları, Ödeme planı, Öğretmen.
VERİ: ogrenci{ad,sinif,veli,tel}, deneme{ad,tarih,dersler[{ders,dogru,yanlis}]}, odemePlani{ogrenciId,toplam,taksitler[{vade,tutar,odendi}]}, ders{sinif,gun,saat,ogretmen}.
EKRANLAR: haftalık ders programı, öğrenci karnesi (deneme net grafiği), ders bazlı başarı tablosu, veli bilgilendirme, taksit takibi.
KURALLAR: net = doğru − yanlış/4; deneme sıralaması sınıf ve kurum genelinde; devamsızlık eşiği aşılınca veliye uyarı; taksit gecikmesi listelenir; öğretmen çakışan derse atanamaz.`, ["deneme|net", "öğrenci|ogrenci", "taksit|ödeme", "yoklama|ders"], P, "tutoring center management"),
  dev("online-egitim", "Online eğitim platformu (LMS)", "Eğitmenler, kurum içi eğitim, sertifika programları", `
MODÜLLER: Kurslar ve modüller, Ders içerikleri (video/metin), Sınav/quiz, İlerleme, Sertifika, Satış/kayıt.
VERİ: kurs{ad,egitmen,fiyat,moduller[{ad,dersler[{baslik,tur,sureDk}]}]}, kayit{kullanici,kursId,tamamlananDersler[],quizPuanlari{}}, quiz{dersId,sorular[{soru,secenekler,dogru}]}.
EKRANLAR: kurs kataloğu, kurs sayfası (müfredat), ders oynatıcı ve "tamamlandı" işareti, ilerleme çubuğu, quiz ekranı, sertifika (yazdırılabilir, doğrulama kodlu).
KURALLAR: önceki ders bitmeden kilitli dersler açılmaz (isteğe bağlı); quiz geçme notu %70; tüm dersler + quiz tamamlanınca sertifika üretilir; ilerleme cihazda saklanır.`, ["kurs", "ders", "quiz|sınav|sinav", "sertifika|ilerleme"], P, "learning management system"),
  dev("anaokulu", "Anaokulu ve kreş", "Anaokulu, kreş, gündüz bakımevi", `
MODÜLLER: Çocuk kartı, Sınıflar, Günlük rapor (yemek, uyku, etkinlik), Yoklama ve teslim, Veli duyuruları, Aidat, Sağlık/aşı.
VERİ: cocuk{ad,dogum,sinif,alerji,teslimAlabilecekler[]}, gunluk{cocukId,tarih,kahvalti,ogle,uyku,tuvalet,not,foto}, teslim{cocukId,saat,alan}.
EKRANLAR: öğretmen tablet ekranı (sınıf listesi, hızlı günlük rapor), veli günlük özeti, giriş-çıkış teslim kaydı, aylık aidat, duyuru panosu.
KURALLAR: çocuk yalnız yetkili listedeki kişiye teslim edilir; alerjisi olan çocuğun adı yemek ekranında uyarılı; fotoğraf paylaşımı veli onayına bağlı; aidat gecikme listesi.`, ["çocuk|cocuk", "veli", "günlük|gunluk", "teslim"], S, "preschool management"),
  dev("surucu-kursu", "Sürücü kursu", "Motorlu taşıt sürücü kursları", `
MODÜLLER: Kursiyer, Ehliyet sınıfı, Teorik ders, Direksiyon dersi planı, Araç ve usta öğretici, Sınav takibi, Ödeme.
VERİ: kursiyer{ad,tckn,sinif(B|A2|C…),kayitTarihi,odemePlani}, direksiyon{kursiyerId,ogretmen,arac,tarih,saat,durum}, sinav{kursiyerId,tur(e-sinav|direksiyon),tarih,sonuc}.
EKRANLAR: direksiyon takvimi (araç ve öğretici sütunları), kursiyer dosyası (tamamlanan saat/gerekli saat), sınav sonuçları, taksit takibi.
KURALLAR: ehliyet sınıfına göre zorunlu direksiyon saati takip edilir; aynı araç ve öğretici aynı saatte iki derse verilemez; başarısız sınav hakkı sayılır; TCKN maskeli.`, ["direksiyon", "kursiyer", "sınav|sinav", "araç|arac"], P, "driving school management"),

  // ---------- Perakende ----------
  dev("butik-giyim", "Butik ve giyim mağazası", "Butik, giyim, ayakkabı mağazaları", `
MODÜLLER: Ürün ve varyant matrisi (beden × renk), Barkod, Kasa, Değişim/iade, Sezon ve indirim, Online vitrin.
VERİ: urun{model,ad,sezon,alis,satis}, varyant{urunId,beden,renk,barkod,stok}, satis{tarih,kalemler,odeme,indirim}, degisim{satisId,eski,yeni,fark}.
EKRANLAR: beden × renk stok tablosu, hızlı kasa (barkod), değişim ekranı (fiyat farkı), en çok satan/satmayan modeller, sezon sonu indirim aracı.
KURALLAR: stok varyant düzeyinde tutulur; değişimde iade edilen varyant stoğa döner; indirim fiyatı alış fiyatının altına düşerse uyarı; 14 günlük değişim süresi fişte yazar.`, ["beden|varyant", "stok", "değişim|degisim|iade", "kasa|satış"], T, "retail clothing pos"),
  dev("market-veresiye", "Bakkal, market ve veresiye defteri", "Bakkal, market, şarküteri, mahalle esnafı", `
MODÜLLER: Hızlı satış, Veresiye defteri, Müşteri limiti, Tahsilat, Stok ve kritik ürün, Tedarikçi borcu.
VERİ: musteri{ad,tel,limit,bakiye}, veresiye{musteriId,tarih,tutar,aciklama}, tahsilat{musteriId,tarih,tutar}, urun{barkod,ad,fiyat,stok,kritik}.
EKRANLAR: büyük düğmeli satış ekranı, veresiye defteri (müşteri bazlı ekstre), limiti aşanlar, tahsilat girişi, borç hatırlatma mesajı (WhatsApp), günlük kasa özeti.
KURALLAR: bakiye = veresiyeler − tahsilatlar; limit aşan veresiye onay ister; 30 günü geçen borç kırmızı; tahsilat en eski borçtan düşülür; geri al (son işlem) seçeneği.`, ["veresiye", "bakiye|borç|borc", "tahsilat", "limit"], T, "grocery credit ledger"),
  dev("cicekci", "Çiçekçi sipariş ve teslimat", "Çiçekçiler, online çiçek satışı", `
MODÜLLER: Ürün kataloğu, Sipariş, Kart notu, Teslimat planı ve kurye, Özel günler, Fotoğraflı teslim.
VERİ: siparis{gonderen,alici,aliciTel,adres,teslimTarihi,teslimAraligi,urun,kartNotu,durum(alindi|hazirlaniyor|yolda|teslim),teslimFoto}, ozelGun{musteri,tarih,tur}.
EKRANLAR: vitrin ve sipariş formu, günlük teslimat listesi (saat aralığına göre), kurye mobil ekranı, kart yazdırma, özel gün hatırlatma listesi.
KURALLAR: aynı gün teslim için son sipariş saati; 14 Şubat/Anneler Günü yoğunluk kotası; kart notu 250 karakter; teslim edilince göndericiye fotoğraflı bildirim önerilir; alıcı tel zorunlu.`, ["teslim", "kart", "sipariş|siparis", "alıcı|alici"], M, "florist order delivery"),
  dev("kuyumcu", "Kuyumcu ve altın takip", "Kuyumcular, altın ve mücevher satıcıları", `
MODÜLLER: Ürün (gram, ayar, işçilik), Günlük kur, Alış-satış, Hurda altın alımı, Has altın stoğu, Emanet/tamir.
VERİ: urun{kod,tur,ayar(8|14|18|22|24),gram,iscilik,tasli},kur{tarih,hasAlis,hasSatis}, islem{tur(satis|alis|hurda),kalemler,tutar,odeme}, emanet{musteri,urun,islem,teslim}.
EKRANLAR: günlük kur girişi, hızlı fiyat hesap (gram × milyem × has kuru + işçilik), satış/alış fişi, has karşılığı stok raporu, tamir emanet listesi.
KURALLAR: milyem 22 ayar 0,916, 18 ayar 0,750, 14 ayar 0,585; fiyat günün kuruyla anlık hesaplanır; hurda alımda milyem testi notu; tutarlar 2 ondalık; kur girilmeden satış yapılamaz.`, ["gram|ayar|milyem", "kur", "has", "işçilik|iscilik"], T, "jewelry gold inventory"),
  dev("optik", "Optik mağazası", "Optisyenler, gözlükçüler", `
MODÜLLER: Müşteri ve reçete, Çerçeve ve cam stoku, Sipariş (cam laboratuvarı), Teslim, Lens takibi, Tahsilat.
VERİ: recete{musteriId,tarih,sagSph,sagCyl,sagAks,solSph,solCyl,solAks,add,pd,hekim}, siparis{musteriId,cerceve,cam{tip,indeks,kaplama},fiyat,durum(alindi|laboratuvar|hazir|teslim)}.
EKRANLAR: reçete giriş formu (göz göz), çerçeve kataloğu, sipariş takibi, lens yenileme hatırlatma, müşteri geçmişi.
KURALLAR: SPH/CYL 0,25 adımlı; aks 0–180; reçete tarihi 1 yıldan eskiyse uyarı; hazır sipariş için SMS/WhatsApp; NOT: SGK katkı payı bilgisi gösterilir, resmî işlem Medula ile yapılır.`, ["reçete|recete", "çerçeve|cerceve", "cam|lens", "sipariş|siparis"], P, "optical store"),

  // ---------- Turizm ve konaklama ----------
  dev("otel-pms", "Otel ve pansiyon yönetimi (PMS)", "Butik otel, pansiyon, apart, bungalov", `
MODÜLLER: Oda ve oda tipleri, Rezervasyon takvimi, Check-in/out, Misafir kayıt, Folyo (ekstra harcama), Kat hizmetleri, Fiyat/sezon.
VERİ: oda{no,tip,kat,durum(bos|dolu|kirli|bakim)}, rezervasyon{misafir,odaId,giris,cikis,kisi,kanal,fiyat,kapora,durum}, folyo{rezervasyonId,kalemler[{ad,tutar,tarih}]}.
EKRANLAR: oda × gün doluluk tablosu (sürükle-bırak), check-in formu, folyo ve hesap kapama, kat hizmetleri listesi (kirli odalar), doluluk ve ortalama oda fiyatı raporu.
KURALLAR: aynı odada tarih çakışması engellenir; check-out'ta oda "kirli" olur; sezon fiyatı geceye göre hesaplanır; konaklama vergisi ayrı satır; NOT: KBS (Kimlik Bildirim Sistemi) bildirimi için misafir kimlik alanları hazırlanır.`, ["oda", "rezervasyon", "check-in|giriş|giris", "folyo|hesap"], P, "hotel property management"),
  dev("tur-acentesi", "Tur ve seyahat acentesi", "Seyahat acenteleri, tur operatörleri", `
MODÜLLER: Tur tanımı ve tarihleri, Kontenjan, Rezervasyon ve yolcu listesi, Ödeme/taksit, Rehber ve araç, Belgeler.
VERİ: tur{ad,program[],tarihler[{baslangic,kontenjan,fiyat}]}, rezervasyon{turTarihId,yolcular[{ad,tckn|pasaport,dogum}],odalar,toplam,odenen}, rehber{ad,dil}.
EKRANLAR: tur kataloğu ve detay programı, rezervasyon formu (yolcu yolcu), kontenjan doluluk, yolcu listesi yazdırma (otobüs/otel için), ödeme durumu, satış raporu.
KURALLAR: kontenjan aşılamaz; çocuk fiyatı yaşa göre; tur tarihinden önce bakiye ödenmemişse uyarı; yurt dışı turda pasaport geçerliliği 6 ay kontrolü; acente belge no alt bilgide.`, ["tur", "yolcu", "kontenjan", "rezervasyon"], M, "travel agency booking"),
  dev("arac-kiralama", "Araç kiralama", "Rent a car firmaları", `
MODÜLLER: Filo ve araç durumu, Rezervasyon, Teslim/iade kontrolü (hasar, km, yakıt), Sözleşme, Ekstra (bebek koltuğu), Tahsilat ve depozito.
VERİ: arac{plaka,model,sinif,km,durum(musait|kirada|bakim)}, kiralama{aracId,musteri,ehliyet,alis,iade,km{alis,iade},yakit{alis,iade},hasarlar[],gunluk,ekstralar,depozito}.
EKRANLAR: araç × gün takvimi, rezervasyon formu, teslim/iade kontrol listesi (araç şeması üzerinde hasar işaretleme, fotoğraf), sözleşme çıktısı, gelir raporu.
KURALLAR: ehliyet yaşı ve süresi sınıfa göre kontrol; tarih çakışması engellenir; km aşımı ve yakıt farkı iadede ücretlendirilir; yeni hasar iade formunda zorunlu fotoğraf; depozito iade edilmeden kapanmaz.`, ["araç|arac|plaka", "kiralama|rezervasyon", "hasar", "km|yakıt|yakit"], P, "car rental management"),

  // ---------- İnşaat, emlak, yapı ----------
  dev("emlak-ofisi", "Emlak ofisi portföy ve müşteri eşleştirme", "Emlak danışmanları ve ofisler", `
MODÜLLER: Portföy (satılık/kiralık), Talep sahipleri, Otomatik eşleştirme, Yer gösterme, Sözleşme ve komisyon, İlan vitrini.
VERİ: portfoy{tur,il,ilce,mahalle,m2,oda,kat,yas,fiyat,durum,sahip,fotolar}, talep{musteri,tur,butceMin,butceMax,bolgeler,oda}, gosterme{portfoyId,talepId,tarih,belgeImzali,not}.
EKRANLAR: portföy listesi ve harita, talep listesi, eşleşen ilanlar (puanlı), yer gösterme takvimi, komisyon hesabı, herkese açık ilan sayfası.
KURALLAR: eşleşme puanı bütçe, bölge ve oda sayısına göre; yer gösterme belgesi imzalanmadan gösterim tamamlanmaz; komisyon taraf başına yüzde + KDV olarak hesaplanır (bilgi amaçlı); satılan/kiralanan ilan vitrinden kalkar.`, ["portföy|portfoy", "talep", "eşleş|esles", "komisyon"], P, "real estate crm"),
  dev("site-yonetimi", "Site ve apartman yönetimi", "Site yönetimleri, apartman yöneticileri, yönetim firmaları", `
MODÜLLER: Bloklar ve daireler, Malik/kiracı, Aidat tahakkuku, Tahsilat, Gider ve karar defteri, Arıza/talep, Duyuru.
VERİ: daire{blok,no,arsaPayi,m2,malik,kiraci}, tahakkuk{daireId,donem,tutar,vade}, tahsilat{daireId,tarih,tutar}, gider{tarih,kalem,tutar,fatura}, talep{daireId,konu,durum}.
EKRANLAR: daire listesi ve borç durumu, toplu aidat tahakkuku (eşit/arsa payına göre), ekstre, gelir-gider raporu (şeffaf paylaşım), sakin talep formu, duyuru panosu.
KURALLAR: aidat eşit ya da arsa payına göre dağıtılır; gecikme tazminatı aylık %5 (634 KMK) bilgi amaçlı hesaplanır; tahsilat en eski borca düşer; giderler fatura görseliyle kaydedilir.`, ["aidat", "daire", "tahsilat", "gider"], P, "property hoa management"),
  dev("insaat-santiye", "İnşaat şantiye ve hakediş", "Müteahhitler, taşeronlar, şantiye şefleri", `
MODÜLLER: Projeler ve iş kalemleri, Metraj, Taşeron sözleşmeleri, Hakediş, Puantaj, Malzeme talebi, Günlük şantiye raporu.
VERİ: kalem{pozNo,ad,birim,miktar,birimFiyat}, hakedis{taseronId,donem,kalemler[{kalemId,buDonem,kumulatif}],kesintiler{teminat,stopaj},net}, puantaj{isci,tarih,gun}, rapor{tarih,hava,isler,foto}.
EKRANLAR: iş kalemleri ve gerçekleşme yüzdesi, hakediş hazırlama (önceki + bu dönem = kümülatif), puantaj tablosu, malzeme talep onayı, fotoğraflı günlük rapor.
KURALLAR: kümülatif miktar sözleşme miktarını aşamaz (aşarsa ek iş onayı); hakedişten teminat ve vergi kesintisi düşülür; onaylanan hakediş kilitlenir; günlük rapor tarih başına bir tane.`, ["hakediş|hakedis", "metraj|kalem", "puantaj", "taşeron|taseron"], P, "construction site management"),
  dev("tadilat", "Tadilat, dekorasyon ve usta işleri", "Tadilat firmaları, boya, alçı, tesisat ustaları", `
MODÜLLER: Keşif, Teklif (malzeme + işçilik), İş takvimi, Malzeme listesi, Ödeme aşamaları, Önce/sonra fotoğraf.
VERİ: kesif{musteri,adres,odalar[{ad,m2,isler}],foto}, teklif{kalemler[{is,birim,miktar,malzeme,iscilik}],kdv,toplam,gecerlilik}, is{teklifId,baslangic,bitis,usta,asamalar[{ad,yuzde,odendi}]}.
EKRANLAR: mobil keşif formu (oda oda ölçü), teklif oluşturucu ve PDF, iş takvimi, aşama ödemeleri, müşteri onay sayfası.
KURALLAR: metrekareden malzeme miktarı fireyle hesaplanır (boya için kat sayısı); teklif geçerlilik süresi; ödeme aşamaları toplamı %100; iş bitince fotoğraf karşılaştırma.`, ["keşif|kesif", "teklif", "malzeme", "aşama|asama|ödeme"], S, "renovation contractor estimate"),

  // ---------- Üretim ve sanayi ----------
  dev("kalite-yonetimi", "Kalite yönetimi (ISO 9001)", "Üretim firmaları, belgeli işletmeler", `
MODÜLLER: Doküman yönetimi, Uygunsuzluk ve DÖF, İç tetkik, Müşteri şikâyeti, Tedarikçi değerlendirme, Kalibrasyon.
VERİ: dof{no,kaynak(sikayet|tetkik|uretim),tanim,kokNeden,faaliyet,sorumlu,termin,etkinlik,durum}, dokuman{kod,ad,rev,onaylayan,tarih}, cihaz{ad,kalibrasyonTarihi,periyotAy}.
EKRANLAR: DÖF listesi ve kanban, kök neden (5 neden) formu, doküman listesi ve revizyon geçmişi, tetkik planı, kalibrasyonu yaklaşan cihazlar.
KURALLAR: DÖF kapanmadan etkinlik doğrulaması zorunlu; termini geçen DÖF kırmızı; doküman yeni revizyonda eski sürüm "geçersiz"; kalibrasyon tarihi geçen cihaz kullanılamaz uyarısı.`, ["dof|döf|uygunsuzluk", "tetkik", "doküman|dokuman|revizyon", "kalibrasyon"], P, "quality management system"),
  dev("bakim-onarim", "Bakım onarım (CMMS)", "Fabrikalar, oteller, hastaneler, tesis yönetimi", `
MODÜLLER: Ekipman envanteri, Periyodik bakım planı, Arıza bildirimi, İş emri, Yedek parça, Duruş süresi raporu.
VERİ: ekipman{kod,ad,konum,kritiklik}, plan{ekipmanId,gorev,periyotGun,sonYapilma}, isEmri{ekipmanId,tur(ariza|periyodik),bildiren,teknisyen,baslangic,bitis,parcalar,durum}.
EKRANLAR: ekipman kartı (QR ile açılır), bugünkü bakım işleri, arıza bildirme (mobil, fotoğraflı), iş emri kanbanı, MTBF/MTTR ve duruş raporu.
KURALLAR: periyodu dolan bakım için otomatik iş emri; kullanılan parça stoktan düşer; arıza iş emri kapanınca duruş süresi hesaplanır; kritik ekipman arızası en üstte.`, ["bakım|bakim", "arıza|ariza", "iş emri|is emri", "ekipman"], S, "maintenance cmms"),
  dev("tekstil-atolye", "Tekstil ve konfeksiyon atölyesi", "Konfeksiyon atölyeleri, fason üreticiler", `
MODÜLLER: Model kartı, Sipariş (beden asortisi), Kesim, Dikim bantları, Fason takibi, Kalite ve paketleme, Sevkiyat.
VERİ: model{kod,ad,kumas,aksesuarlar,dikimDk}, siparis{musteri,model,renkler,asorti{S,M,L,XL},termin}, kesim{siparisId,pastal,adet}, fason{atolye,gonderilen,donen,fire}.
EKRANLAR: sipariş ve asorti tablosu, aşama takibi (kesim→dikim→ütü→kalite→paket), bant verimliliği, fason gönderim/dönüş mutabakatı, termin takvimi.
KURALLAR: kumaş ihtiyacı = adet × birim sarfiyat + fire; fasondan dönen + fire = gönderilen olmalı; termine 3 gün kala geride olan sipariş uyarısı; kalite reddi yeniden işleme açar.`, ["model", "kesim", "fason", "asorti|beden"], P, "apparel manufacturing"),
  dev("gida-uretim", "Gıda üretimi ve HACCP", "Gıda imalathaneleri, şarküteri üretimi, kooperatifler", `
MODÜLLER: Reçete, Parti/lot üretimi, Hammadde kabul, HACCP kritik kontrol noktaları, Etiket, Geri çağırma.
VERİ: hammadde{ad,tedarikci,lot,skt,kabulSicaklik}, uretim{lot,urun,tarih,hammaddeLotlari[],miktar,skt}, kkn{nokta,limit,olcum,saat,sorumlu,uygun}.
EKRANLAR: hammadde kabul formu, üretim partisi oluşturma (hammadde lotları seçilir), KKN ölçüm kayıtları, ürün etiketi (içindekiler, alerjen, lot, SKT), lot geriye/ileriye izlenebilirlik.
KURALLAR: limit dışı KKN ölçümü düzeltici faaliyet ister; SKT geçmiş hammadde üretimde kullanılamaz; etikette alerjenler kalın; bir hammadde lotundan etkilenen tüm ürün partileri sorgulanabilir.`, ["lot|parti", "haccp|kontrol noktası|kkn", "etiket", "hammadde"], P, "food production haccp traceability"),

  // ---------- Lojistik ve ulaşım ----------
  dev("kargo-kurye", "Kargo ve kurye gönderi takibi", "Kurye firmaları, şehir içi dağıtım, e-ticaret lojistiği", `
MODÜLLER: Gönderi oluşturma, Desi/ücret hesabı, Rota ve kurye atama, Teslim kanıtı, Takip sayfası, Tahsilatlı gönderi.
VERİ: gonderi{takipNo,gonderen,alici,adres,en,boy,yukseklik,kg,desi,ucret,odemeTuru(gonderici|alici|kapida-tahsilat),durum,gecmis[]}, kurye{ad,bolge}.
EKRANLAR: gönderi formu, kurye mobil teslim ekranı (imza/fotoğraf/teslim kodu), herkese açık takip sayfası (takip no), günlük dağıtım listesi, kapıda tahsilat mutabakatı.
KURALLAR: desi = en × boy × yükseklik / 3000; ücret desi ile kg'dan büyük olana göre; teslim kodu doğrulanmadan teslim kapanmaz; her durum değişikliği zaman damgalı geçmişe eklenir.`, ["desi", "takip", "teslim", "kurye|gönderi|gonderi"], S, "courier delivery tracking"),
  dev("nakliye-sefer", "Nakliye ve sefer yönetimi", "Nakliye firmaları, tır ve kamyon filosu, lojistik", `
MODÜLLER: Yük ilanı/sipariş, Sefer planı, Araç ve şoför, İrsaliye bilgileri, Sefer masrafları, Navlun ve tahsilat.
VERİ: sefer{no,yukleme,bosaltma,tarih,arac,sofor,yuk{tur,ton,palet},navlun,durum}, masraf{seferId,tur(yakit|otoyol|harcirah|bakim),tutar}, musteri{unvan,vkn}.
EKRANLAR: sefer panosu (planlandı→yolda→teslim), sefer kârlılığı (navlun − masraflar), şoför mobil ekranı (yükleme/teslim fotoğrafı), araç bazlı km ve yakıt, müşteri cari.
KURALLAR: araç ve şoför aynı tarihte iki sefere atanamaz; kapasiteyi aşan tonaj uyarısı; teslimde imzalı belge fotoğrafı zorunlu; NOT: e-İrsaliye entegratörle gönderilir, uygulama gerekli alanları hazırlar.`, ["sefer", "navlun", "masraf", "şoför|sofor|araç"], P, "freight transport management"),
  dev("personel-servisi", "Okul ve personel servis taşımacılığı", "Servis firmaları, okul servisçileri", `
MODÜLLER: Güzergâh ve duraklar, Araçlar ve şoförler, Yolcu listesi, Biniş-iniş yoklaması, Veli/firma bildirimi, Aylık ücret.
VERİ: guzergah{ad,duraklar[{ad,saat}],arac,sofor,rehber}, yolcu{ad,durak,veli,tel}, yoklama{guzergahId,tarih,yolcuId,bindi,indi}, ucret{yolcuId,ay,tutar,odendi}.
EKRANLAR: şoför/rehber mobil yoklama (durak sırasıyla), veli için "servis yolda" bilgisi, güzergâh haritası listesi, aylık ücret takibi, araç belgeleri bitiş tarihleri.
KURALLAR: binmeyen öğrenci için veliye bildirim önerisi; araç muayene/sigorta/güzergâh izni bitimine 30 gün kala uyarı; okul servisinde rehber personel zorunlu alanı; ücret gecikmesi listelenir.`, ["güzergah|güzergâh|guzergah", "yoklama", "durak", "veli|yolcu"], S, "school bus transport"),
  dev("evden-eve", "Evden eve nakliyat", "Nakliyat firmaları", `
MODÜLLER: Keşif randevusu, Eşya listesi ve hacim, Teklif, Taşıma planı, Ekip ve araç, Sigorta ve hasar.
VERİ: kesif{musteri,eskiAdres,yeniAdres,katlar{eski,yeni},asansor,esyalar[{ad,adet,m3}],tarih}, teklif{m3,km,ekstra(paketleme|asansor|depolama),fiyat}, tasima{tarih,ekip,arac,durum}.
EKRANLAR: oda oda eşya listesi (hazır eşya kütüphanesi), m³ ve araç önerisi, teklif ve sözleşme PDF, taşıma takvimi, teslimde hasar tespit formu.
KURALLAR: toplam hacim eşya m³ toplamından hesaplanır; asansörsüz kat ücreti; teklif geçerliliği 15 gün; hasar formu fotoğrafsız kapanmaz; taşıma günü bir gün önce hatırlatma.`, ["eşya|esya", "m3|m³|hacim", "teklif", "taşıma|tasima"], S, "moving company estimate"),

  // ---------- Otomotiv ----------
  dev("oto-servis", "Oto servis ve tamirhane", "Özel servisler, tamirhaneler, kaporta-boya", `
MODÜLLER: Araç ve müşteri, Servis kabul, İş emri (işçilik + parça), Parça stoku, Onay ve fiyat, Araç geçmişi, Periyodik bakım hatırlatma.
VERİ: arac{plaka,sasi,marka,model,yil,km,musteri}, isEmri{aracId,kabulKm,sikayet,yapilanlar[{tur(iscilik|parca),ad,miktar,fiyat}],durum(kabul|onay-bekliyor|islemde|hazir|teslim)}.
EKRANLAR: servis kabul formu (hasar işaretleme), iş emri kanbanı, müşteriye fiyat onayı linki, araç geçmişi (plaka ile), bakımı yaklaşanlar, fatura taslağı.
KURALLAR: müşteri onayı olmadan işleme başlanmaz; kullanılan parça stoktan düşer; km ya da 1 yıl hangisi önce dolarsa bakım hatırlatması; işçilik ve parça KDV'si ayrı gösterilir.`, ["plaka", "iş emri|is emri", "parça|parca", "bakım|bakim"], P, "auto repair shop"),
  dev("oto-galeri", "Oto galeri ve ikinci el araç", "Oto galeriler, ikinci el araç satıcıları", `
MODÜLLER: Araç stoku, Alış (ekspertiz, masraf), Satış ve kapora, İlan vitrini, Müşteri talepleri, Kâr hesabı.
VERİ: arac{plaka,marka,model,yil,km,yakit,vites,hasarKaydi,alisFiyati,masraflar[],satisFiyati,durum(stokta|kaporali|satildi),fotolar}, talep{musteri,butce,marka}, satis{aracId,musteri,fiyat,kapora,noterTarihi}.
EKRANLAR: stok listesi (bekleme günü), araç detay ve fotoğraf galerisi, ekspertiz notları (parça boya/değişen şeması), kâr hesabı (satış − alış − masraf), herkese açık ilan sayfası.
KURALLAR: araç başına kâr gösterilir; 60 günü geçen araç fiyat güncelleme önerisi; kaporalı araç ilan vitrininde "rezerve"; NOT: noter satışı ve yetki belgesi bilgisi kayıt altında tutulur.`, ["ekspertiz", "kapora", "km", "kâr|kar|satış"], P, "used car dealership"),
  dev("lastik-oteli", "Lastikçi ve lastik oteli", "Lastikçiler, oto bakım merkezleri", `
MODÜLLER: Lastik oteli (saklama), Mevsim değişimi randevusu, Lastik stok (ebat), Diş derinliği takibi, Hizmetler (balans, rot).
VERİ: saklama{plaka,musteri,lastikler[{ebat,marka,dot,disMm,konum}],raf,giris,cikis}, stok{ebat(205/55 R16),marka,mevsim,adet,fiyat}, randevu{plaka,tarih,hizmet}.
EKRANLAR: plaka ile saklama sorgusu, raf/konum haritası, mevsim geçişi randevu takvimi, ebat ile stok arama, diş derinliği düşük lastik uyarı listesi.
KURALLAR: diş derinliği 1,6 mm altı kullanılamaz, 3 mm altı değişim önerisi; DOT'tan lastik yaşı hesaplanır (5 yaş üstü uyarı); raf aynı anda iki saklamaya verilemez; saklama ücreti mevsimlik.`, ["lastik", "ebat", "diş|dis|dot", "raf|saklama"], P, "tire storage hotel"),

  // ---------- Finans, sigorta, hukuk ----------
  dev("sigorta-acentesi", "Sigorta acentesi", "Sigorta acenteleri ve brokerlar", `
MODÜLLER: Müşteri, Poliçeler (trafik, kasko, DASK, konut, sağlık), Yenileme takibi, Teklif karşılaştırma, Hasar dosyaları, Komisyon.
VERİ: police{no,brans,sirket,musteri,baslangic,bitis,prim,komisyon,plakaVeyaAdres}, teklif{musteri,brans,secenekler[{sirket,prim,teminatlar}]}, hasar{policeId,tarih,tur,durum,tutar}.
EKRANLAR: yenilemesi yaklaşan poliçeler (30/15/7 gün), müşteri portföyü, teklif karşılaştırma tablosu, hasar dosyası takibi, aylık prim ve komisyon raporu.
KURALLAR: bitişe 30 gün kala yenileme görevi otomatik açılır; aynı plakada çakışan trafik poliçesi uyarı; komisyon = prim × oran; hasar dosyası durum geçmişiyle tutulur; TCKN maskeli.`, ["poliçe|police", "yenileme", "prim", "hasar"], P, "insurance agency management"),
  dev("mali-musavir", "Mali müşavir büro yönetimi", "Mali müşavirler, muhasebe büroları", `
MODÜLLER: Mükellefler, Beyanname takvimi, Evrak toplama, Görevler ve personel, Ücret ve tahsilat, Mükellefe duyuru.
VERİ: mukellef{unvan,vkn,tur(sahis|limited|anonim),defter(bilanco|isletme|serbest),beyannameler[]}, beyan{mukellefId,tur(KDV|muhtasar|gecici|yillik|ba-bs),donem,sonTarih,durum}, ucret{mukellefId,ay,tutar,odendi}.
EKRANLAR: ay takvimi (son günler kırmızı), mükellef × beyanname durum tablosu, eksik evrak listesi ve hatırlatma mesajı, personel iş dağılımı, ücret tahsilat takibi.
KURALLAR: beyanname türüne göre son günler takvime otomatik düşer (bilgi amaçlı, resmî takvimle doğrulanmalı); verilen beyanname kilitlenir; evrak gelmeyen mükellefe hatırlatma; VKN 10 hane doğrulama.`, ["beyanname", "mükellef|mukellef", "son tarih|takvim", "evrak"], P, "accounting firm practice management"),
  dev("hukuk-burosu", "Hukuk bürosu dava takibi", "Avukatlar, hukuk büroları", `
MODÜLLER: Müvekkil, Dosyalar (dava/icra/danışmanlık), Duruşma ve süre takvimi, Evrak, Masraf ve avans, Vekalet ücreti, Görevler.
VERİ: dosya{no,tur,mahkeme,esasNo,muvekkil,karsiTaraf,konu,durum}, durusma{dosyaId,tarih,saat,salon,not}, sure{dosyaId,tur,baslangic,gun,sonGun}, masraf{dosyaId,tutar,aciklama}.
EKRANLAR: duruşma ve kesin süre takvimi, dosya kartı (zaman çizelgesi), yaklaşan süreler listesi, masraf/avans dengesi, müvekkil bilgilendirme özeti.
KURALLAR: süre sonu tatile denk gelirse sonraki iş gününe; adli tatil (20 Temmuz–31 Ağustos) uyarısı; kesin süreye 3 gün kala kırmızı; avans bakiyesi eksiye düşerse uyarı; NOT: UYAP verisi elle ya da dışa aktarımla girilir.`, ["duruşma|durusma", "dosya", "süre|sure", "müvekkil|muvekkil"], P, "law firm case management"),

  // ---------- Kamu ve sivil toplum ----------
  dev("dernek-vakif", "Dernek, vakıf ve STK", "Dernekler, vakıflar, kooperatifler, okul aile birlikleri", `
MODÜLLER: Üye kaydı, Aidat, Bağış ve makbuz, Etkinlik/proje, Gönüllüler, Genel kurul, Gelir-gider.
VERİ: uye{ad,tckn,tel,uyelikTarihi,durum}, aidat{uyeId,yil,tutar,odendi}, bagis{bagisci,tutar,tarih,tur(nakdi|ayni),makbuzNo,amac}, gider{tarih,kalem,tutar,belge}.
EKRANLAR: üye listesi ve aidat durumu, bağış formu ve makbuz çıktısı, proje bazlı gelir-gider, gönüllü görev takvimi, genel kurul hazirun listesi.
KURALLAR: makbuz numarası sıralı ve tekrar etmez; aidat borcu olan üye hazirun listesinde işaretlenir; ayni bağış ayrı kaydedilir; NOT: DERBİS bildirimleri resmî sistemden yapılır.`, ["üye|uye", "aidat", "bağış|bagis", "makbuz"], P, "nonprofit membership donations"),
  dev("ruhsat-basvuru", "Kamu başvuru ve ruhsat takibi", "Belediyeler, il müdürlükleri, kamu birimleri", `
MODÜLLER: Online başvuru, Gerekli evrak listesi, Ön inceleme, Birim yönlendirme, Saha denetimi, Sonuç ve belge, Vatandaş takip.
VERİ: basvuru{takipNo,tur(isyeri-ruhsat|yapi|tabela|isgal),basvuran,tckn,adres,evraklar[],durum(alindi|eksik|incelemede|denetim|onay|ret),gecmis[]}, denetim{basvuruId,tarih,denetci,sonuc,foto}.
EKRANLAR: vatandaş başvuru sihirbazı (türüne göre evrak listesi), takip no ile durum sorgulama, personel iş kuyruğu, eksik evrak bildirimi, denetim formu, sonuç belgesi (yazdırılabilir).
KURALLAR: zorunlu evrak eksikse başvuru "eksik" kalır; her durum değişikliği zaman damgalı; yasal süreye göre geri sayım; ret gerekçesi zorunlu; erişilebilirlik ve sade dil.`, ["başvuru|basvuru", "takip", "evrak", "denetim"], G, "permit application tracking"),

  // ---------- Tarım ve hayvancılık ----------
  dev("ciftlik-hayvancilik", "Çiftlik ve hayvancılık", "Süt ve besi çiftlikleri, küçükbaş yetiştiriciler", `
MODÜLLER: Hayvan kartı (küpe no), Süt verimi, Tohumlama ve gebelik, Aşı ve tedavi, Yem, Doğum ve buzağı, Satış.
VERİ: hayvan{kupeNo,tur,irk,dogum,cinsiyet,anneKupe,grup}, sut{hayvanId,tarih,sabah,aksam}, tohumlama{hayvanId,tarih,boga,gebelikKontrol}, saglik{hayvanId,tarih,tur,ilac,arinmaGun}.
EKRANLAR: sürü listesi (grup, yaş), günlük süt girişi ve verim grafiği, doğuma yaklaşanlar takvimi, aşı takvimi, ilaç arınma süresindeki hayvanlar (sütü satılamaz).
KURALLAR: tahmini doğum = tohumlama + 283 gün (sığır); arınma süresi bitmeden süt sağım listesinde uyarı; küpe no tekil; NOT: TÜRKVET kayıtları resmî sistemde yapılır.`, ["küpe|kupe", "süt|sut", "tohumlama|gebelik", "aşı|asi"], S, "livestock farm management"),
  dev("tarla-sera", "Tarla, bahçe ve sera yönetimi", "Çiftçiler, seracılar, tarım işletmeleri", `
MODÜLLER: Parseller, Ekim/dikim, İlaçlama ve gübreleme, Sulama, Hasat, Masraf ve gelir, Hava notları.
VERİ: parsel{ad,ada,parsel,dekar,urun,sezon}, islem{parselId,tarih,tur(ekim|ilaclama|gubre|sulama|hasat),urun,doz,maliyet,beklemeGun}, hasat{parselId,tarih,kg,fiyat}.
EKRANLAR: parsel listesi ve sezon özeti, işlem takvimi (mobil kayıt), ilaç bekleme süresi dolmayan parseller, dekar başı maliyet ve verim, sezon kârlılığı.
KURALLAR: ilaçlamadan sonra bekleme süresi dolmadan hasat uyarısı; doz dekar × birim dozla hesaplanır; parsel başı maliyet tüm işlemlerden toplanır; NOT: ÇKS kayıt bilgileri bilgi amaçlıdır.`, ["parsel", "ilaçlama|ilaclama", "hasat", "dekar"], S, "farm crop management"),

  // ---------- Enerji ve teknik hizmetler ----------
  dev("gunes-enerjisi", "Güneş enerjisi (GES) proje ve kurulum", "GES kurulum firmaları, enerji danışmanları", `
MODÜLLER: Keşif ve tüketim analizi, Sistem boyutlandırma, Teklif, Proje ve izin süreci, Kurulum, Üretim izleme ve bakım.
VERİ: kesif{musteri,adres,catiM2,yon,egim,yillikTuketimKwh}, sistem{kWp,panelW,panelAdet,inverter,tahminiYillikUretim},teklif{fiyat,geriOdemeYil}, proje{asamalar[{ad,durum,tarih}]}.
EKRANLAR: tüketimden sistem boyutu hesaplama, teklif ve geri ödeme grafiği, proje aşamaları (başvuru→onay→kurulum→kabul), aylık üretim girişi ve hedef karşılaştırma, bakım takvimi.
KURALLAR: panel adedi = kWp × 1000 / panel gücü (yukarı yuvarla); yıllık üretim kWp × bölgesel katsayı (tahmini); geri ödeme = yatırım / yıllık tasarruf; üretim hedefin %80'i altına düşerse bakım önerisi.`, ["kwp|panel", "üretim|uretim", "teklif|geri ödeme", "kurulum"], P, "solar installation crm"),
  dev("asansor-bakim", "Asansör bakım firması", "Asansör bakım ve montaj firmaları", `
MODÜLLER: Bina ve asansör envanteri, Aylık bakım planı, Periyodik kontrol (etiket), Arıza çağrısı, Teknisyen rotası, Sözleşme ve fatura.
VERİ: asansor{bina,adres,tip,durak,seriNo,etiket(yesil|mavi|sari|kirmizi),sonKontrol}, bakim{asansorId,tarih,teknisyen,kontrolListesi[],imza}, ariza{asansorId,bildirim,mahsur,varis,cozum}.
EKRANLAR: teknisyen mobil bakım formu (kontrol listesi, imza), aylık bakım planı, arıza çağrı panosu (mahsur yolcu önceliği), etiket durumu raporu, sözleşme yenileme.
KURALLAR: her asansör ayda en az bir bakım; kırmızı etiketli asansör kullanım dışı; mahsur yolculu arıza en üst öncelik ve varış süresi ölçülür; yıllık periyodik kontrol tarihi yaklaşınca uyarı.`, ["asansör|asansor", "bakım|bakim", "etiket", "arıza|ariza"], S, "elevator maintenance"),

  // ---------- Etkinlik, medya, yaratıcı ----------
  dev("etkinlik-bilet", "Etkinlik ve biletleme", "Konser, konferans, seminer, festival düzenleyiciler", `
MODÜLLER: Etkinlik, Bilet türleri ve kontenjan, Kayıt/satış, QR bilet, Kapı kontrolü, Katılımcı iletişimi, Sponsor.
VERİ: etkinlik{ad,tarih,mekan,kapasite}, biletTuru{ad,fiyat,kontenjan,satisBitis}, bilet{kod,etkinlikId,tur,katilimci,eposta,kullanildi,girisZamani}.
EKRANLAR: etkinlik sayfası ve bilet seçimi, QR'lı bilet (indirilebilir), kapı kontrol ekranı (kamera ile tarama → yeşil/kırmızı), satış ve katılım raporu, katılımcı listesi CSV.
KURALLAR: kontenjan aşılamaz; aynı QR ikinci kez okutulursa "kullanılmış" ve ilk giriş saati gösterilir; erken kayıt fiyatı tarihle biter; iptal edilen bilet kontenjana döner.`, ["bilet", "qr", "kontenjan", "katılımcı|katilimci"], M, "event ticketing check-in"),
  dev("dugun-organizasyon", "Düğün salonu ve organizasyon", "Düğün salonları, kır düğünü, organizasyon firmaları", `
MODÜLLER: Salon takvimi, Paketler, Rezervasyon ve kapora, Menü ve kişi sayısı, Ek hizmetler, Ödeme planı, Tedarikçiler.
VERİ: salon{ad,kapasite}, paket{ad,kisiBasi,icerik}, rezervasyon{salonId,tarih,seans(ogle|aksam),cift,tel,kisi,paketId,ekler[],toplam,kapora,taksitler,durum}.
EKRANLAR: salon × tarih takvimi (dolu/opsiyonlu/boş), paket karşılaştırma, teklif ve sözleşme PDF, ödeme takibi, etkinlik günü kontrol listesi.
KURALLAR: aynı salon aynı seansa ikinci rezervasyon alamaz; opsiyon 7 gün içinde kaporaya dönmezse düşer; toplam = kişi × kişi başı + ekler; son ödeme etkinlikten 15 gün önce.`, ["salon", "kapora|opsiyon", "paket", "rezervasyon"], M, "wedding venue booking"),
  dev("fotograf-studyo", "Fotoğraf stüdyosu ve çekim", "Fotoğrafçılar, video prodüksiyon, stüdyolar", `
MODÜLLER: Çekim randevusu, Paketler, Müşteri seçim galerisi, Rötuş ve albüm takibi, Teslim, Ödeme.
VERİ: cekim{musteri,tur(dugun|urun|vesikalik|bebek),tarih,mekan,paket,durum(planlandi|cekildi|secim|rotus|teslim)}, galeri{cekimId,fotolar[{ad,secildi}],secimHakki}, odeme{cekimId,tutar}.
EKRANLAR: çekim takvimi, müşteri seçim galerisi (şifreli bağlantı, seçim sayacı), iş akışı kanbanı, teslim listesi, ödeme durumu.
KURALLAR: seçim hakkı aşılırsa ek fotoğraf ücreti; seçim tamamlanınca rötuşa geçer; teslim için kalan ödeme sıfır olmalı; galeri bağlantısı süreli.`, ["çekim|cekim", "galeri", "seçim|secim", "teslim"], P, "photography studio management"),

  // ---------- Kurumsal ve teknik hizmetler ----------
  dev("it-varlik", "BT varlık ve lisans yönetimi", "Şirket BT birimleri, BT hizmet firmaları", `
MODÜLLER: Donanım envanteri, Zimmet, Yazılım lisansları, Abonelikler ve yenileme, Arıza talebi, Hurdaya ayırma.
VERİ: varlik{etiketNo,tur,marka,model,seriNo,alisTarihi,garantiBitis,durum,zimmetli}, lisans{yazilim,adet,kullanilan,bitis,maliyet}, zimmet{varlikId,personel,teslim,iade,imza}.
EKRANLAR: envanter listesi (QR etiket), personel zimmet formu ve tutanak, lisans kullanım oranı, yaklaşan yenilemeler ve garanti bitişleri, varlık geçmişi.
KURALLAR: zimmetli varlık başkasına zimmetlenemez; işten ayrılan personelin zimmetleri iade listesine düşer; lisans kullanılan > adet ise uyarı; yenilemeye 30 gün kala hatırlatma.`, ["zimmet", "lisans", "envanter|varlık|varlik", "garanti"], P, "it asset management"),
  dev("temizlik-firmasi", "Temizlik ve tesis hizmetleri firması", "Temizlik şirketleri, tesis yönetimi", `
MODÜLLER: Müşteri lokasyonları, Ekip ve vardiya, Görev kontrol listeleri, Fotoğraflı kontrol, Malzeme sarfı, Müşteri memnuniyeti.
VERİ: lokasyon{musteri,adres,alanlar[]}, gorev{lokasyonId,alan,liste[],periyot}, kontrol{gorevId,personel,zaman,tamamlananlar,foto,puan}, sarf{lokasyonId,malzeme,miktar}.
EKRANLAR: personel mobil kontrol listesi (QR ile alan doğrulama, fotoğraf), denetçi puanlama, lokasyon bazlı rapor, vardiya çizelgesi, aylık sarf raporu.
KURALLAR: görev QR okutulmadan tamamlanamaz; fotoğrafsız kritik alan kontrolü kabul edilmez; puanı 70 altı lokasyona düzeltici iş; malzeme stoğu kritik seviyede uyarı.`, ["kontrol", "lokasyon", "vardiya", "görev|gorev"], S, "cleaning services management"),
  dev("guvenlik-firmasi", "Özel güvenlik firması", "Özel güvenlik şirketleri, site güvenliği", `
MODÜLLER: Personel ve kimlik kartı geçerliliği, Nöbet çizelgesi, Devriye noktaları (QR), Olay tutanağı, Ziyaretçi kaydı, Müşteri raporu.
VERİ: personel{ad,kartNo,kartBitis,silahli}, nobet{lokasyon,personel,baslangic,bitis}, devriye{nokta,personel,zaman}, olay{lokasyon,zaman,tur,aciklama,foto}, ziyaretci{ad,kime,giris,cikis}.
EKRANLAR: nöbet çizelgesi, mobil devriye (nokta QR okutma), olay tutanağı formu, ziyaretçi giriş-çıkış, kaçırılan devriye raporu, kart bitişi yaklaşanlar.
KURALLAR: kart süresi dolan personel nöbete atanamaz; planlı devriye noktası zamanında okutulmazsa uyarı; olay tutanağı sonradan değiştirilemez, ek yapılır; ziyaretçi çıkışsız kalırsa gün sonu listesi.`, ["nöbet|nobet", "devriye", "olay|tutanak", "ziyaretçi|ziyaretci"], S, "security guard management"),
  dev("kuru-temizleme", "Kuru temizleme ve çamaşırhane", "Kuru temizleme, halı yıkama, çamaşırhaneler", `
MODÜLLER: Fiş ve etiket, Ürün/hizmet fiyatları, İşlem aşamaları, Teslim hatırlatma, Adresten alım, Tahsilat.
VERİ: fis{no,musteri,tel,kalemler[{urun,hizmet,adet,fiyat,not,etiket}],alis,sozTarihi,durum(alindi|islemde|hazir|teslim),odeme}, alim{adres,tarih,saat}.
EKRANLAR: hızlı fiş (büyük düğmeler), etiket yazdırma, raf/aşama takibi, hazır olanlara mesaj, adresten alım planı, 30 günü geçen teslim edilmeyenler.
KURALLAR: fiş no sıralı; her parça ayrı etiket; hazır olunca SMS/WhatsApp metni hazırlanır; halı için m² × fiyat; teslimde kalan ödeme alınır.`, ["fiş|fis", "etiket", "teslim", "hazır|hazir"], T, "dry cleaning pos"),
];

// Sektör grupları: kullanıcıya gösterilen kütüphane düzeni (mevcut ve yeni planlar birlikte)
export const SECTORS = [
  { id: "yeme-icme", name: "Yeme-içme", icon: "utensils", desc: "Restoran, kafe, paket servis, pastane, catering", cats: ["pos-adisyon", "restoran-rezervasyon", "paket-servis", "sadakat-kart", "pastane", "catering"] },
  { id: "saglik", name: "Sağlık", icon: "clinic", desc: "Klinik, diş, eczane, veteriner, laboratuvar, bakım", cats: ["klinik", "dis-klinigi", "eczane", "veteriner", "diyetisyen", "psikolojik-danismanlik", "laboratuvar", "evde-bakim"] },
  { id: "guzellik", name: "Güzellik ve bakım", icon: "scissors", desc: "Kuaför, berber, güzellik merkezi, randevu", cats: ["kuafor-salon", "guzellik-merkezi", "randevu"] },
  { id: "spor", name: "Spor", icon: "barbell", desc: "Spor salonu, pilates, yoga, kulüp ve akademi", cats: ["spor-salonu", "yoga-pilates", "spor-kulubu"] },
  { id: "egitim", name: "Eğitim", icon: "cap", desc: "Okul, kurs, online eğitim, anaokulu, sürücü kursu", cats: ["okul", "kurs-merkezi", "online-egitim", "anaokulu", "surucu-kursu"] },
  { id: "perakende", name: "Perakende ve ticaret", icon: "store", desc: "Mağaza, market, e-ticaret, bayi, kuyumcu, optik", cats: ["e-ticaret", "b2b-bayi", "stok", "butik-giyim", "market-veresiye", "cicekci", "kuyumcu", "optik"] },
  { id: "turizm", name: "Turizm ve konaklama", icon: "bed", desc: "Otel, pansiyon, tur acentesi, araç kiralama", cats: ["otel-pms", "tur-acentesi", "arac-kiralama"] },
  { id: "insaat-emlak", name: "İnşaat ve emlak", icon: "realty", desc: "Emlak ofisi, site yönetimi, şantiye, tadilat", cats: ["emlak-ofisi", "site-yonetimi", "insaat-santiye", "tadilat"] },
  { id: "uretim", name: "Üretim ve sanayi", icon: "crane", desc: "ERP, kalite, bakım, tekstil, gıda üretimi, satın alma", cats: ["erp-uretim", "satin-alma", "kalite-yonetimi", "bakim-onarim", "tekstil-atolye", "gida-uretim"] },
  { id: "lojistik", name: "Lojistik ve ulaşım", icon: "truck", desc: "Kargo, nakliye, filo, servis, evden eve", cats: ["kargo-kurye", "nakliye-sefer", "filo", "personel-servisi", "evden-eve"] },
  { id: "otomotiv", name: "Otomotiv", icon: "car", desc: "Oto servis, galeri, lastikçi", cats: ["oto-servis", "oto-galeri", "lastik-oteli"] },
  { id: "finans-hukuk", name: "Finans, sigorta ve hukuk", icon: "scale", desc: "Ön muhasebe, mali müşavir, sigorta, avukat", cats: ["on-muhasebe", "mali-musavir", "sigorta-acentesi", "hukuk-burosu"] },
  { id: "kamu-stk", name: "Kamu ve sivil toplum", icon: "policy", desc: "EBYS, beyaz masa, ruhsat, dernek ve vakıf", cats: ["ebys", "beyaz-masa", "ruhsat-basvuru", "dernek-vakif"] },
  { id: "tarim", name: "Tarım ve hayvancılık", icon: "plant", desc: "Çiftlik, süt ve besi, tarla ve sera", cats: ["ciftlik-hayvancilik", "tarla-sera"] },
  { id: "enerji-teknik", name: "Enerji ve teknik servis", icon: "bolt", desc: "GES, asansör, saha servisi, bakım", cats: ["gunes-enerjisi", "asansor-bakim", "saha-servis"] },
  { id: "etkinlik-medya", name: "Etkinlik ve yaratıcı işler", icon: "confetti", desc: "Bilet, düğün salonu, fotoğraf stüdyosu, ajans", cats: ["etkinlik-bilet", "dugun-organizasyon", "fotograf-studyo", "proje"] },
  { id: "kurumsal", name: "Kurumsal ve hizmet", icon: "briefcase", desc: "CRM, İK, destek, BT, temizlik, güvenlik", cats: ["crm", "ik", "destek", "it-varlik", "temizlik-firmasi", "guvenlik-firmasi", "kuru-temizleme"] },
];
export const SECTOR_OF = Object.fromEntries(SECTORS.flatMap((s) => s.cats.map((c) => [c, s.id])));
export const SECTOR_HUNT = Object.fromEntries(SECTOR_SKILLS.map((s) => [s.cat, s.hunt]));

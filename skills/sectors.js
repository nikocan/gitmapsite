// Each line defines a distinct business workflow: stable ID, goal, search terms, inputs, states and acceptance criterion.
const SKILL_SECTOR_DATA = [
["satis", "Perakende ve e-ticaret", "G", "Shopify · Sipariş ve gönderim", "https://shopify.dev/docs/apps/build/orders-fulfillment", `
magaza|Çevrimiçi mağaza|e ticaret, butik, sepet, satış|ürün varyantı, sepet satırı, teslimat adresi|sepet → sipariş → gönderim → teslim|Aynı işlem iki kez gelse bile tek sipariş ve tek stok hareketi oluşsun.
iade|İade ve değişim portalı|refund, tersine lojistik|sipariş satırı, iade adedi, iade nedeni|talep → inceleme → kabul → sonuç|Sipariş satırının kalan iade edilebilir adedi aşılmasın.
envanter|Çok şubeli stok takibi|stok, envanter, depo|SKU, şube, rezerve adet|elde → rezerve → transfer → teslim|Transferin açık miktarı kaynak ve hedefte doğru görünsün.
pos|Mağaza kasası|kasa, barkod, pos|barkod, fiş, kasa vardiyası|sepet → tahsilat → fiş → kasa kapanışı|Gün sonu toplamı işlem ve iade kayıtlarından yeniden hesaplanabilsin.
pazaryeri|Çok satıcılı pazaryeri|pazar yeri, satıcı, komisyon|satıcı, ilan, komisyon satırı|onay → satış → dağıtım → uzlaştırma|Satıcı yalnız kendi sipariş kalemlerini ve hak edişini görebilsin.
fiyat|Fiyat ve kampanya yönetimi|indirim, kupon, promosyon|fiyat listesi, kupon kotası, geçerlilik|taslak → zamanlandı → etkin → bitti|Tarih aralığı ve birlikte kullanım kuralları önizlemede doğrulansın.
toptan|Toptan sipariş portalı|toptancı, b2b, bayi|bayi, koli katı, fiyat kademesi|teklif → onay → sipariş → teslim|Yetkili bayi yalnız kendi fiyat kademesiyle işlem yapsın.
teslim-al|Mağazadan teslim alım|click and collect, gel al|teslim mağazası, rezerv süre sonu, teslim kodu|ayrıldı → hazır → teslim → süre doldu|Süresi dolan rezervasyon satılabilir stoka dönsün.
sadakat|Müşteri sadakat programı|puan, üyelik, kupon|üye, puan hareketi, sona erme tarihi|kazanım → kullanım → iade → sona erme|İade, ilgili puan hareketini tek sefer tersine çevirsin.
urun|Ürün bilgi yönetimi|pim, katalog, varyant|ürün ailesi, zorunlu özellik, kanal|taslak → eksik → onaylı → yayında|Yayın öncesi kanalın eksik zorunlu alanları listelensin.
`],
["saglik", "Sağlık ve sosyal bakım", "R", "HL7 FHIR · Kaynak dizini", "https://hl7.org/fhir/resourcelist.html", `
randevu|Klinik randevu ve kabul|doktor, hasta, diş, muayene, appointment|hasta referansı, uzman takvimi, saat aralığı|istek → teyit → kabul → tamamlandı|Aynı uzman ve saat için çifte rezervasyon engellensin.
sira|Poliklinik sıra ekranı|sıramatik, kuyruk, hasta sırası|sıra kodu, birim, çağrı zamanı|bekliyor → çağrıldı → alındı → kapandı|Halka açık ekran ad yerine sıra kodu göstersin.
sevk|Sevk ve randevu koordinasyonu|sevk, referral|sevk referansı, hedef birim, dosya yetkisi|alındı → incelendi → randevu → kapandı|Hedef birim yetkisi bulunmayan kişi sevk detayını göremesin.
sonuc|Onaylı sonuçların hasta portalı|laboratuvar, rapor, sonuç|sonuç referansı, onay zamanı, hasta ilişkisi|alındı → onay bekliyor → erişime açık → düzeltildi|Yalnız onaylanmış belge ilgili kişinin portalına açılsın.
evde|Evde bakım ziyaret takibi|ev ziyareti, bakım planı|ziyaret saati, görevli, teslim notu|planlandı → ziyaret → not alındı → kapandı|Ziyaret kaydı yetkili bakım ekibiyle sınırlı kalsın.
yatak|Yatak ve oda kapasitesi|servis yatağı, yatış, taburcu|oda, yatak, tahsis süresi|uygun → ayrıldı → dolu → temizlik|Temizlikteki yatak boş kapasiteye katılmasın.
cihaz|Tıbbi cihaz bakım kaydı|kalibrasyon, demirbaş, cihaz|cihaz seri no, bakım tarihi, servis belgesi|planlı → serviste → kontrol → kullanıma açık|Süresi geçen bakım ekipman kartında gerekçesiyle görünsün.
stoksarf|Klinik sarf malzemesi stoku|sarf, lot, skt|sarf kodu, lot, son kullanma tarihi|giriş → ayrıldı → tüketildi → karantina|Süresi geçmiş lot seçilebilir sarf listesinde yer almasın.
belge|Hasta belge ve tercih yönetimi|onam, gizlilik, belge|belge sürümü, tercih zamanı, yetki|hazırlandı → bildirildi → kaydedildi → güncellendi|Belge sürümü ve tercih değişiklik geçmişi korunabilsin.
sosyal|Sosyal hizmet başvuru takibi|danışmanlık, vaka, sosyal destek|başvuru no, sorumlu, erişim grubu|alındı → atandı → takip → kapandı|Vaka notu yalnız atanmış ve yetkili rolde görülsün.
`],
["egitim", "Eğitim ve kurslar", "Q", "1EdTech · OneRoster", "https://www.1edtech.org/standards/oneroster", `
sinif|Sınıf ve öğrenci yönetimi|okul, sınıf, öğrenci, lms|öğrenci, şube, dönem|başvuru → kayıt → sınıf → arşiv|Öğrenci yalnız kayıtlı olduğu şubenin içeriklerini görsün.
yoklama|Ders yoklaması|katılım, devamsızlık, öğretmen|ders oturumu, öğrenci, katılım kodu|açıldı → işaretlendi → gözden geçirildi → kilitlendi|Aynı derste öğrenci başına tek yoklama sonucu oluşsun.
odev|Ödev teslim ve geribildirim|assignment, ödev, rubrik|ödev, teslim sürümü, rubrik|yayın → teslim → değerlendirme → iade|Geç teslim bilgisi puandan bağımsız görülebilsin.
sinav|Çevrimiçi sınav yönetimi|quiz, sınav, ölçme|soru havuzu, deneme no, süre|planlandı → açık → teslim → sonuç|Süre bitiminde kaydedilmiş yanıtlar tekrar denemede kaybolmasın.
hibrit|Kurs ve canlı ders programı|kurs, zoom, eğitim salonu|eğitmen, grup, oturum saati|listelendi → kayıt → canlı → tamamlandı|Aynı eğitmen çakışan iki oturuma atanamasın.
sertifika|Sertifika ve rozet portalı|microcredential, sertifika|tamamlama ölçütü, belge kimliği, doğrulama|tamamlandı → verildi → yayımlandı → iptal|Belge doğrulama ekranı iptal edilmiş belgeyi ayırt etsin.
veli|Veli iletişim portalı|veli, duyuru, toplantı|veli ilişkisi, duyuru grubu, izin|taslak → yayımlandı → okundu → arşiv|Veli yalnız ilişkili öğrencilerin iletilerine erişsin.
kutuphane|Okul kütüphanesi ve ödünç|kitap, ödünç, rezerv|kitap nüshası, okuyucu, iade tarihi|rafta → ayrıldı → ödünç → iade|Ödünçteki nüsha yeni ödünç kaydına kapalı olsun.
staj|Staj ve danışman takip sistemi|staj, mentor, portfolyo|iş yeri, danışman, haftalık kayıt|başvuru → atama → takip → onay|Danışman değerlendirmesi ilgili staj dönemiyle ilişkilensin.
muafiyet|Ders eşdeğerliği başvurusu|muafiyet, intibak, kredi|başvuru, geçmiş ders, komisyon kararı|alındı → incelendi → karara bağlandı → bildirildi|Karar gerekçesi ve belge sürümü birlikte saklansın.
`],
["konaklama", "Konaklama ve turizm", "I", "OpenTravel · Seyahat veri değişimi", "https://opentravel.org/download-specs/", `
otel|Otel rezervasyon ve resepsiyon|otel, konaklama, oda, pansiyon|oda tipi, giriş ve çıkış tarihi, konaklayan|teklif → rezervasyon → giriş → çıkış|Çıkış günü ve oda tipi kapasitesi doğru hesaplanarak fazla satış önlensin.
kat|Kat hizmetleri ve oda hazırlığı|housekeeping, temizlik|oda, görevli, hazırlık kontrolü|kirli → temizlikte → kontrol → hazır|Hazır olmayan oda resepsiyon ekranında açıkça işaretlensin.
fiyat|Doluluk ve oda fiyatı|rate plan, doluluk, gelir yönetimi|oda tipi, tarih, fiyat kuralı|taslak → onay → aktif → arşiv|Gecelik fiyat ile konaklama toplamı aynı kurallardan hesaplansın.
grup|Grup rezervasyon yönetimi|grup otel, kontenjan, allotment|grup kodu, ayrılan oda, düşüm tarihi|ayrıldı → isimlendi → kesinleşti → kapandı|Süre dolduğunda kullanılmayan oda tekrar satışa dönsün.
talep|Konuk hizmet talepleri|concierge, transfer, konuk|konuk referansı, hizmet, vardiya|alındı → atandı → tamamlandı → kapandı|Devir sırasında açık talepler yeni vardiyada görünsün.
tur|Tur ve etkinlik rezervasyonları|tur, gezi, rehber, acente|tur kalkışı, koltuk, rehber|açık → rezerve → kesinleşti → tamamlandı|Kontenjan ve bekleme listesi birbirinden ayrı tutulsun.
cikis|Konaklama hesabı ve çıkış|folio, minibar, oda hesabı|konaklama no, hizmet kalemi, ödeme durumu|açık → incelemede → mutabık → kapanış|Aynı harcama referansı odaya iki kez yazılmasın.
kanal|Konaklama satış kanalı eşlemesi|channel manager, ota, müsaitlik|kanal, oda eşleşmesi, dış rezervasyon kodu|eşle → al → doğrula → uzlaştır|Eşleşmeyen oda tipi kapasiteyi değiştirmeden incelemeye düşsün.
kiralik|Kısa süreli konut takvimi|villa, tatil evi, kiralık|mülk, gece envanteri, blok tarih|müsait → ayrıldı → konaklama → bakım|Bakım için kapatılan gece satılabilir takvimden ayrılsın.
misafir|Konuk geri bildirim takibi|yorum, anket, misafir deneyimi|konaklama referansı, konu, çözüm|alındı → yönlendirildi → yanıtlandı → kapandı|Geri bildirimler kişisel veriyi açığa çıkarmadan toplu raporlansın.
`],
["yeme", "Restoran ve yemek hizmetleri", "I", "Odoo · Restoran iş akışları", "https://www.odoo.com/documentation/saas-19.3/applications/sales/point_of_sale/restaurant.html", `
adisyon|Masa adisyonu ve mutfak|restoran, kafe, lokanta, adisyon, pos|masa, sipariş kalemi, istasyon|açık → mutfakta → hazır → kapandı|Masaya eklenen kalem yalnız doğru hazırlık istasyonuna iletilsin.
masa|Masa rezervasyonu|restoran rezervasyon, masa, bekleme|masa kapasitesi, kişi sayısı, süre|bekliyor → teyit → oturdu → kapandı|Aynı masaya örtüşen iki teyitli rezervasyon açılmasın.
paket|Paket servis ve teslimat|paket sipariş, kurye, takeaway|adres bölgesi, sipariş, kurye|alındı → hazır → kuryede → teslim|Teslimat bölgesi dışında servis sözü sunulmasın.
menu|QR menü ve erişilebilir katalog|dijital menü, qr, ürün|kategori, fiyat, alerjen beyanı|taslak → kontrol → yayında → gizli|Tükenen kalem ve fiyat güncellemesi aynı menü görünümüne yansısın.
recete|Reçete ve gıda maliyeti|reçete, gramaj, cost|porsiyon, malzeme miktarı, birim maliyet|tanım → hesap → gözden geçirildi → aktif|Kilogram ve gram dönüşümü porsiyon maliyetine doğru yansısın.
hazirlik|Üretim ve hazırlık listesi|mutfak hazırlık, batch, hazırlık|istasyon, hedef porsiyon, vardiya|bekliyor → hazırlanıyor → hazır → devredildi|Vardiya devrinde tamamlanmamış hazırlıklar listelensin.
catering|Toplu yemek ve catering teklifi|catering, ziyafet, davet|etkinlik, kişi sayısı, menü sürümü|talep → teklif → onay → teslim|Onaylı teklif sürümü kişi sayısı değişince geçmişi korusun.
fire|Gıda firesi ve atık kaydı|fire, atık, tartım|malzeme, ağırlık, neden|kaydedildi → incelendi → sınıflandı → raporlandı|Fire miktarı satış miktarına ikinci kez eklenmesin.
tedarik|Mutfak mal kabulü|tedarikçi, teslim, lot|tedarikçi, lot, teslim sıcaklığı kaydı|bekliyor → alındı → ayrıldı → kabul|İnceleme gereken lot kabul edilmiş stoktan ayrı görünsün.
bol|Hesap bölüşme ve gün sonu|hesap bölme, kasa kapanışı|adisyon, tahsilat parçası, vardiya|açık → kısmi → ödendi → kapanış|Kısmi ödemeler toplamı ve ödenecek kalanı mutabık tutulsun.
`],
["lojistik", "Lojistik ve taşımacılık", "H", "GS1 · EPCIS izlenebilirlik", "https://www.gs1.org/standards/epcis", `
sevkiyat|Sevkiyat takip sistemi|kargo, nakliye, teslim, POD|paket kodu, durak, teslim kanıtı|toplandı → taşımada → teslim → kapandı|Yinelenen teslim olayı tek teslim olarak işlensin.
depo|Depo toplama ve paketleme|wms, barkod, depo|raf, toplama listesi, koli|ayrıldı → toplandı → paketlendi → yüklendi|Yanlış raf veya ürün kodu işlem onayında yakalansın.
rota|Rota ve sürücü iş listesi|araç, sürücü, durak|araç kapasitesi, durak, zaman penceresi|taslak → atandı → yolda → tamamlandı|Kapasiteyi aşan plan kullanıcıya çakışan durakları göstersin.
arac|Filo bakım ve muayene takibi|filo, araç bakım, muayene|araç no, kilometre, servis tarihi|uygun → bakım planı → serviste → uygun|Servisteki araç yeni sefere atanamasın.
soguk|Soğuk zincir kayıt paneli|sıcaklık, sensör, soğuk zincir|ölçüm zamanı, sensör, sevkiyat|izleniyor → sapma → incelendi → kapandı|Eksik ölçüm normal ölçüm gibi raporlanmasın.
yuk|Yük ve navlun teklifleri|navlun, yük, forwarder|yük ölçüsü, teklif para birimi, taşıyıcı|talep → teklif → onay → rezervasyon|Farklı para birimleri, kur tarihi gösterilerek karşılaştırılsın.
terminal|Rampa ve terminal takvimi|rampa, dock, liman|yükleme alanı, taşıt, zaman aralığı|talep → ayrıldı → giriş → çıkış|Aynı rampaya çakışan iki araç kabul edilmesin.
iade|Teslim edilemeyen paket yönetimi|adreste yok, yeniden teslim, iade|teslim girişimi, neden, iade deposu|denendi → yeniden planlandı → iade → kapandı|Teslim başarısızlığı gerçek teslim olarak sayılmasın.
hat|Toplu taşıma hat ve tarife portalı|otobüs, GTFS, metro, transit|hat kimliği, durak, sefer takvimi|taslak → doğrulandı → yayın → güncellendi|Hat ve durak kimlikleri tarife ile güncelleme arasında tutarlı kalsın.
devir|Yük aktarma ve izlenebilirlik|cross dock, palet, aktarma|palet, hareket olayı, tesis|geldi → ayrıştırıldı → aktarıldı → çıktı|Paletin son konumu doğrulanmış hareket zincirinden bulunabilsin.
`],
["imalat", "İmalat ve kalite", "C", "OPC Foundation · ISA-95", "https://opcfoundation.org/markets-collaboration/isa-95/", `
isemri|Üretim iş emri takibi|atölye, fason, iş emri, mes|iş emri, operasyon, istasyon|planlandı → başladı → bekledi → tamamlandı|Bir iş emrinin iyi ürün ve fire sayıları ayrı toplansın.
bom|Ürün ağacı ve revizyon|BOM, reçete, ürün ağacı|parça kodu, revizyon, miktar|taslak → incelendi → yayında → arşiv|Eski iş emri yeni ürün ağacı sürümüyle geriye dönük değişmesin.
kalite|Kalite kontrol ve uygunsuzluk|QA, NCR, kontrol planı|ölçüm kaydı, lot, uygunsuzluk|bekliyor → kontrol → karantina → serbest|Karantinadaki lot onaylı lot listesinde görünmesin.
bakim|Makine bakım ve duruş takibi|cmms, bakım, downtime|ekipman, duruş nedeni, bakım emri|uygun → durdu → bakım → devredildi|Duruş süresi çakışan olaylarla çift sayılmasın.
kapasite|Vardiya ve hat kapasite planı|makine kapasitesi, çizelge, vardiya|hat, vardiya, planlanan dakika|hesap → dağıtım → onay → gerçekleşen|İş çizelgesi bakımda ayrılmış süreyi kapasiteden düşsün.
tedarik|Malzeme ihtiyaç ve satın alma|MRP, tedarik, hammadde|ihtiyaç tarihi, açık sipariş, stok|hesaplandı → talep → sipariş → teslim|Açık sipariş ile eldeki stok aynı malzeme ihtiyacını iki kez kapatmasın.
iz|Üretim lotu izlenebilirliği|seri no, lot, parti kaydı|girdi lotu, çıktı lotu, operasyon|tüketim → dönüşüm → serbest → sevk|Bitmiş ürünün girdi lotları ve geri izleme bağlantısı bulunabilsin.
maliyet|Üretim maliyet ve sapma paneli|standart maliyet, işçilik, sapma|standart, gerçekleşen, iş emri|hesaplandı → fark → açıklama → dönem kapanışı|Sapmanın işçilik ve malzeme bileşenleri ayrı gösterilsin.
devir|Vardiya devir defteri|devir, olay, vardiya raporu|vardiya, açık iş, sorumlu|not alındı → devredildi → görüldü → kapandı|Açık iş sonraki vardiyanın teslim listesine taşınsın.
kalip|Takım ve kalıp yaşam döngüsü|kalıp, aparat, çevrim|takım seri no, çevrim sayısı, bakım limiti|uygun → kullanım → bakım → arşiv|Bakımı gelen takım planlama ekranında uyarı versin.
`],
["insaat", "İnşaat ve şantiye", "F", "buildingSMART · BCF koordinasyon", "https://www.buildingsmart.org/standards/bsi-standards/bim-collaboration-format/", `
santiye|Şantiye günlük raporu|şantiye, günlük, saha, işçilik|iş kalemi, ekip, rapor tarihi|taslak → eklendi → onay → arşiv|Günlük rapor onay sonrası değişirse yeni sürüm açılsın.
bim|BIM sorun ve koordinasyon takibi|BIM, BCF, çakışma, model|konu kimliği, model görünümü, atanan ekip|açık → atandı → çözüldü → doğrulandı|Sorun kaydı ilgili model sürümüyle yeniden açılabilsin.
hakedis|Hakediş ve metraj takibi|hakediş, metraj, keşif|poz no, miktar, dönem|taslak → ölçüldü → onay → kapandı|Dönem metrajı kümülatif miktara yalnız bir kez eklensin.
malzeme|Şantiye malzeme teslimi|mal kabul, irsaliye, stok|teslim no, teslim miktarı, parti|bekliyor → kısmi → alındı → uzlaştırıldı|Kısmi mal kabulü kalan talep miktarını doğru güncellesin.
alt|Alt yüklenici iş paketi|taşeron, alt yüklenici, sözleşme|yüklenici, kapsam, bitiş tarihi|atanacak → atandı → teslim → kabul|Alt yüklenici sadece kendine atanan iş paketini görsün.
rfi|Teknik bilgi talebi|RFI, proje sorusu, çizim|talep kodu, çizim sürümü, yanıt sorumlusu|açıldı → yönlendirildi → yanıtlandı → kapandı|Onaylanan yanıt uygulanan çizim sürümüyle bağlansın.
kontrol|Saha kontrol listesi|saha denetim, fotoğraf, eksik|kontrol maddesi, alan, kanıt|bekliyor → incelendi → düzeltme → doğrulandı|Kapalı madde tekrar açıldığında önceki kanıt korunabilsin.
teslim|Eksik iş ve teslim listesi|punch list, teslim, kusur|birim, eksik iş, hedef tarih|açık → düzeltildi → denetlendi → kapandı|Yetkili doğrulamadıkça eksik iş kabul edilmiş görünmesin.
degisiklik|İş kapsamı değişiklik talebi|change order, ek iş, revizyon|değişiklik no, süre etkisi, tutar etkisi|talep → hesap → onay → işlendi|Onaysız değişiklik sözleşme toplamına etki etmesin.
belge|Proje belge yayın yönetimi|doküman, çizim dağıtımı, revizyon|belge no, revizyon, alıcı grup|taslak → inceleme → yayımlandı → geçersiz|Alıcı son geçerli sürümü varsayılan olarak görsün.
`],
["finans", "Finans, muhasebe ve sigorta", "L", "ISO · ISO 20022 finansal mesajları", "https://www.iso.org/standard/20022-1", `
mutabakat|Ödeme ve banka mutabakatı|ekstre, banka, reconciliation|işlem kimliği, ödeme referansı, para birimi|alındı → aday → teyit → kapandı|Çelişen tutarlar otomatik eşleşmek yerine incelemeye düşsün.
fatura|Ön muhasebe ve e-belge paneli|fatura, e fatura, e arşiv, GİB|fatura kalemi, vergi sınıfı, sağlayıcı referansı|taslak → kontrol → iletim → yanıt|Sağlayıcı teyidi bekleyen belge açıkça beklemede görünsün.
masraf|Masraf beyanı ve onayı|gider, fiş, harcırah|talep eden, fiş, masraf türü|taslak → gönderildi → onay → ödendi|Başvuru sahibi kendi masrafını onaylayamasın.
nakit|Nakit akışı ve vade takibi|nakit, tahsilat, yaşlandırma|vade, beklenen nakit, gerçekleşen hareket|öngörü → bekleniyor → gerçekleşti → uzlaştırıldı|Gerçekleşen tahsilat ile tahmin aynı toplamda iki kez yer almasın.
abonelik|Abonelik ve dönemsel faturalama|abonelik, billing, yenileme|plan, fatura dönemi, sağlayıcı olayı|deneme → aktif → gecikmiş → iptal|Aynı yenileme olayı iki fatura oluşturmadan işlensin.
police|Sigorta poliçe operasyonu|sigorta, poliçe, acente, yenileme|poliçe no, kapsam sürümü, bitiş tarihi|teklif → başlangıç → yenileme → kapanış|Yenileme kaydı eski kapsam sürümünü saklasın.
hasar|Hasar dosyası ve belge takibi|sigorta hasar, talep, claim|hasar no, belge durumu, atanan ekip|bildirim → evrak → inceleme → karar|Eksik evrak ile karar gerektiren dosya ayrı görünsün.
butce|Departman bütçe onayı|bütçe, harcama, plan|maliyet merkezi, bütçe dönemi, taahhüt|taslak → öneri → onay → izleme|Taahhüt tutarı gerçekleşenden bağımsız kalan bütçeyi açıklasın.
alacak|Alacak ve tahsilat iş listesi|alacak, müşteri bakiyesi, cari|cari hesap, vade kademesi, ödeme|açık → hatırlatma → kısmi → kapandı|Kısmi ödeme kalan borcu doğru düşsün.
hesap|Masraf merkezi dağıtımı|maliyet merkezi, dağıtım, muhasebe|belge satırı, dağıtım yüzdesi, dönem|taslak → doğrulandı → kaydedildi → kapandı|Dağıtım oranlarının toplamı tam yüzde yüz olmadan kayıt tamamlanmasın.
`],
["tarim", "Tarım, ormancılık ve balıkçılık", "A", "OGC · SensorThings gözlem verisi", "https://docs.ogc.org/is/23-019/23-019.html", `
parsel|Tarla ve parsel yönetimi|tarım, tarla, bahçe, çiftçi|parsel kodu, sezon, ürün|plan → ekildi → izleme → hasat|Yeni sezon planı eski parsel geçmişini değiştirmesin.
sulama|Sulama işi ve ölçüm panosu|sulama, toprak, sensör|parsel, ölçüm zamanı, sayaç|gözlem → plan → uygulama kaydı → değerlendirme|Eksik sensör değeri sıfır ölçüm gibi çizilmesin.
hasat|Hasat ve ürün partisi takibi|hasat, verim, lot|parti, parsel, tartım|toplandı → ayrıldı → depolandı → sevk|Tartım birimi dönüştürüldüğünde parti toplamı doğrulansın.
hayvan|Sürü kayıt ve ziyaret takvimi|hayvancılık, küpe, sürü|hayvan no, grup, ziyaret kaydı|kayıt → takip → ziyaret → arşiv|Aynı küpe kimliği iki aktif kayda bağlanmasın.
sera|Sera görev ve çevre panosu|sera, nem, sıcaklık|sera bölmesi, ölçüm, vardiya|ölçüldü → bildirildi → incelendi → kapandı|Ölçüm sapması zamanı ve veri kalitesi ayrı görünsün.
satis|Kooperatif alım ve ürün teslimi|kooperatif, üretici, alım|üretici, teslim fişi, sınıf|teslim → tartım → kalite kaydı → mutabakat|Düzeltmenin önceki teslim fişiyle ilişkisi kayıtlı kalsın.
orman|Orman parseli saha kayıtları|orman, ormancılık, envanter|bölme, gözlem noktası, ekip|plan → saha kaydı → kontrol → arşiv|Çevrimdışı toplanan gözlem tekrar bağlanınca tek kez aktarılabilsin.
balik|Su ürünleri işletme günlüğü|balıkçılık, çiftlik, kafes|tesis bölmesi, stok kaydı, gözlem tarihi|kayıt → günlük takip → sınıflama → rapor|Eksik günler ölçüm grafiğinde boşluk olarak görünsün.
makine|Tarım ekipmanı rezervasyonu|traktör, ekipman, ortak kullanım|makine, üretici, rezerv aralığı|uygun → ayrıldı → kullanım → iade|Bakım aralığı kullanıcı rezervasyonuna kapalı kalsın.
depo|Hasat sonrası depo kontrolü|ambar, yaş ürün, depo|depo gözü, parti, ölçüm zamanı|giriş → gözetim → çıkış → uzlaştırıldı|Çıkan miktar partinin depodaki kalanını doğru azaltsın.
`],
["enerji", "Enerji ve altyapı hizmetleri", "D", "OpenADR · Enerji esnekliği veri akışları", "https://www.openadr.org/", `
sayac|Sayaç ve tüketim portalı|enerji, elektrik, tüketim|sayaç kimliği, okuma zamanı, birim|geldi → doğrulandı → toplandı → yayımlandı|Tahmini okuma ve ölçülmüş okuma arayüzde ayırt edilsin.
pv|Güneş santrali üretim izlemesi|GES, güneş, inverter|tesis, üretim ölçümü, cihaz|alındı → normal → incelendi → raporlandı|Tesis toplamı ile kayıp veri aralıkları ayrı sunulsun.
ariza|Şebeke hizmet kesintisi kayıtları|kesinti, bildirim, bölge|hizmet bölgesi, olay kimliği, süre|bildirildi → teyit → müdahale → geri döndü|Tahmini dönüş zamanı güncellendiğinde eski bildirim kaydı saklansın.
bakim|Altyapı varlık bakım planı|trafo, varlık, bakım|varlık kodu, saha, servis tarihi|plan → atama → servis → doğrulama|Filtrelenen saha ve yaklaşan servis tarihleri izlenebilsin.
sarj|Şarj istasyonu kullanım raporu|EV, şarj, oturum|istasyon, soket, enerji ölçümü|bağlandı → kullanım → bitti → uzlaştırıldı|Aynı oturumun enerji tüketimi tekrar gelen kayıtta çift sayılmasın.
verim|Enerji verimliliği proje takipçisi|tasarruf, baz dönem, verimlilik|baz dönem, ölçüm alanı, iyileştirme|öneri → uygulandı → ölçüldü → rapor|Baz dönem ile ölçüm dönemi farkı hesapta görünür olsun.
talep|Talep esnekliği olay paneli|talep yanıtı, openadr, esneklik|olay zamanı, site, katılım tercihi|bildirildi → kabul → izlendi → rapor|Katılmayan site sonuç toplamına katılmasın.
baglanti|Yeni abonelik bağlantı talebi|elektrik aboneliği, bağlantı, başvuru|başvuru no, tesis noktası, belge|başvuru → inceleme → randevu → sonuç|Başvuru sahibi yalnız kendi bağlantı kaydını görebilsin.
denetim|Tesis saha kontrol raporu|kontrol turu, saha, kanıt|kontrol noktası, gözlem, sorumlu|plan → kontrol → düzeltme → kapanış|Kapanışın ilgili kanıt ve sorumluya bağlantısı korunsun.
sozlesme|Altyapı hizmet sözleşmeleri|tedarik anlaşması, sözleşme, abonelik|hizmet hattı, sözleşme sürümü, vade|taslak → incelendi → imzalı → yenileme|Son onaylı sürüm ve bekleyen sürüm birlikte ayırt edilsin.
`],
["maden", "Madencilik ve taş ocakları", "B", "EITI · Sektör raporlama başlıkları", "https://eiti.org/eiti-requirements", `
ruhsat|Ruhsat ve saha belge takibi|maden, ocak, ruhsat, saha|ruhsat no, saha, bitiş tarihi|başvuru → inceleme → aktif → yenileme|Belge sürümü ve yaklaşan bitiş tarihi birlikte görünür olsun.
kantar|Kantar ve sevkiyat defteri|kantar, kamyon, tonaj|tartım fişi, araç, brüt ve dara|giriş → tartım → çıkış → uzlaştırma|Net ağırlık farkı negatifse istisnaya ayrılsın.
stok|Ocak ürün yığını takibi|agrega, taş, stok sahası|yığın kodu, ürün sınıfı, miktar|oluştu → ölçüldü → sevk → kapandı|Sevkiyat ve stok sayım farkı ayrı izlensin.
kontrat|Saha hizmet alım takibi|müteahhit, hizmet, iş paketi|yüklenici, sözleşme sürümü, teslimat|teklif → kabul → hizmet → kapandı|Yalnız onaylı hizmet kalemi dönem raporuna girsin.
yuk|Yükleme rampası randevusu|ocak yükleme, kuyruk, araç|araç, vardiya, rampa|bekliyor → çağrıldı → yükleme → çıktı|Aynı rampada çakışan zaman aralıkları işaretlensin.
numune|Ürün kalite numunesi kaydı|numune, analiz, kırmataş|numune kodu, parti, rapor sürümü|alındı → inceleme → doğrulandı → arşiv|Numune sonucu doğru ürün partisiyle ilişkilensin.
rehab|Saha rehabilitasyon görevleri|rehabilitasyon, peyzaj, saha kapatma|saha dilimi, iş paketi, kanıt|planlandı → yürütülüyor → incelendi → kabul|Tamamlanan alanlar önceki saha raporuyla karşılaştırılabilsin.
gozlem|Çevresel gözlem kayıtları|toz kaydı, su izleme, ölçüm|ölçüm türü, konum, birim|ölçüldü → gözden geçirildi → istisna → raporlandı|Geçersiz ölçüm onaylı çevre raporuna karışmasın.
ekipman|Ocak ekipmanı bakım defteri|iş makinesi, bakım, çalışma saati|ekipman kodu, sayaç, bakım emri|planlandı → serviste → teslim → kapandı|Bakım kaydı doğru ekipman sayaç geçmişiyle açılabilsin.
vardiya|Ocak vardiya teslim raporu|vardiya, faaliyet, rapor|ekip, saha, açık görev|hazırlandı → devredildi → alındı → kapandı|Açık görev devir sonrası atamasını korusun.
`],
["cevre", "Su, çevre ve atık yönetimi", "E", "OGC · Çevresel gözlem kayıtları", "https://docs.ogc.org/is/23-019/23-019.html", `
atik|Atık toplama ve teslim zinciri|atık, geri dönüşüm, toplama|atık sınıfı, tartım, teslim fişi|plan → toplandı → teslim → uzlaştırıldı|Kaynak ve alıcı teslimleri aynı partiyle bağlansın.
su|Su kalite ölçüm panosu|su, çevre, ölçüm, numune|numune, istasyon, ölçüm birimi|alındı → ölçüldü → doğrulandı → raporlandı|Birimi belirsiz ölçüm karşılaştırma grafiğine alınmasın.
kacak|Su kaçağı bildirim haritası|kaçak, arıza, harita|bildirim konumu, olay, ekip|alındı → atandı → kontrol → kapandı|Birleştirilen ihbarlar özgün olay kayıtlarına bağlı kalsın.
konteyner|Konteyner doluluk ve rota|konteyner, sensör, rota|nokta, doluluk zamanı, araç|izleniyor → plana alındı → toplandı → sıfırlandı|Son ölçüm gecikmişse veri yaşı kullanıcıya gösterilsin.
tesis|Geri kazanım tesisi mal kabulü|atık tesisi, sınıflandırma, kantar|teslim aracı, malzeme sınıfı, ağırlık|geldi → sınıflandı → kabul → sevk|Reddedilen teslim kabul edilmiş toplamdan ayrı kalsın.
numune|Numune teslim zinciri|numune, şişe, kalite, custody|numune kodu, teslim eden, teslim zamanı|alındı → aktarıldı → ulaştı → kapandı|Teslim zincirindeki eksik halkalar raporda işaretlensin.
musteri|Su abonelik sayaç değişimi|sayaç, abone, değişim|eski sayaç, yeni sayaç, son endeks|talep → plan → değişti → teyit|Yeni sayaç eski sayaç endeksini başlangıç değeri olarak devralmasın.
yagmur|Yağmur suyu varlık kaydı|yağmur suyu, menfez, kanal|varlık, son inceleme, konum|kayıt → kontrol → bakım → güncel|Harita kaydı ile son bakım tarihi aynı varlığa bağlansın.
ayristir|Atık ayrıştırma performansı|geri kazanım, ayrıştırma, oran|girdi ağırlığı, çıktı sınıfı, dönem|toplandı → ölçüldü → hesap → kapandı|Bilanço farkı gerekçesiyle gösterilsin.
tekrar|Yeniden kullanım eşya portalı|eşya, bağış, yeniden kullanım|eşya kodu, yeniden kullanım durumu, teslim|geldi → hazır → ayrıldı → teslim|Ayrılmış eşya ikinci kullanıcıya rezerve edilemesin.
`],
["medya", "Medya, yayıncılık ve içerik", "J", "DDEX · Müzik veri alışverişi standartları", "https://ddex.net/standards/", `
editor|Editoryal üretim takvimi|haber, içerik, yayın, editör|içerik, yazar, yayın tarihi|fikir → taslak → editör → yayın|Zamanlanan içerik yayın saati öncesi herkese açılmasın.
medya|Dijital varlık kütüphanesi|dam, fotoğraf, arşiv, video|varlık, hak sahibi, kullanım süresi|alındı → etiketlendi → onay → arşiv|Süresi dolan varlık yeni kampanyada seçilemesin.
muzik|Müzik yayın meta verisi|isrc, ddex, eser, albüm|kayıt kimliği, sanatçı, yayın|taslak → doğrulandı → gönderildi → onay|Kayıt ile yayın kimliği ayrı tutulup tekrarlar yakalansın.
altyazi|Altyazı hazırlama ve kontrol|altyazı, srt, vtt, transkript|dil, zaman aralığı, metin sürümü|yükle → düzenle → kontrol → dışa aktar|Birbiriyle çakışan altyazı blokları önizlemede işaretlensin.
podcast|Podcast bölüm hazırlığı|podcast, rss, bölüm|bölüm, ses varlığı, yayın zamanı|taslak → hazır → yayında → arşiv|Bölüm güncellemesi kalıcı RSS kimliğini korusun.
telif|Yayın lisans ve bölge takibi|telif, hak, lisans, bölge|hak paketi, bölge, geçerlilik|giriş → onay → kullanım → süre doldu|İçeriğin seçildiği kanal ve bölgede geçerli lisans aranabilsin.
duzeltme|Yayın düzeltme geçmişi|tekzip, düzeltme, revizyon|içerik kimliği, sürüm, açıklama|talep → inceleme → düzeltme → yayın|Güncel metin ve halka açık düzeltme notu birbirine bağlansın.
uye|Okur üyelik portalı|bülten, okur, newsletter|üye, tercih, yayın listesi|kayıt → teyit → aktif → ayrıldı|Ayrılma tercihinin ardından gönderim kuyruğu üyeyi içermesin.
dagitim|İçerik kanalları yayın kuyruğu|dağıtım, sosyal, yayın kanalı|kanal, içerik sürümü, zaman|taslak → sırada → yayımlandı → düzeltme|Başarısız kanal işlemi diğer kanalların durumunu değiştirmesin.
reklam|Yayın reklam envanteri takibi|reklam alanı, sponsor, banner|slot, kampanya, gösterim aralığı|ayrıldı → aktif → tamamlandı → rapor|Çakışan kampanyalar yayın planında görülsün.
`],
["yazilim", "Yazılım, veri ve telekom", "K", "GitHub · Dağıtım ortamları", "https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments", `
surum|Sürüm ve yayın kontrol paneli|yazılım, release, deploy, devops|sürüm, ortam, onay|taslak → test → onay → yayın|Yayın durumu gerçek ortam sonucu ve sürümle eşleşsin.
hata|Yazılım hata ve istek takibi|bug, backlog, issue, yazılım|hata kaydı, öncelik, etkilenen sürüm|açık → atandı → doğrulandı → kapandı|Düzeltilen kaydın doğrulandığı sürüm gösterilsin.
olay|Hizmet olayı ve durum sayfası|incident, outage, durum|hizmet, olay, zaman çizgisi|tespit → incelendi → iyileşti → kapandı|Halka açık görünüm yalnız onaylı durum güncellemelerini yayımlasın.
veri|Veri hattı kalite panosu|etl, veri kalitesi, pipeline|iş çalışması, veri kümesi, sonuç|sırada → çalıştı → kontrol → rapor|Tekrar çalıştırma aynı çıktı bölümünü çoğaltmasın.
musteri|SaaS çalışma alanı kurulumu|saas, tenant, onboarding|çalışma alanı, üye, rol|hazırlandı → davet → aktif → devre dışı|Bir çalışma alanının üyesi diğerinin kayıtlarına erişemesin.
lisans|Yazılım lisans ve hak paneli|lisans, kullanıcı hakkı, entitlement|plan, kullanıcı kotası, süre|deneme → etkin → yenileme → bitti|Hesap hakkı iptal edildiğinde erişim durumu güncellensin.
telekom|Telekom hizmet destek kaydı|telekom, internet servis, destek|hat referansı, hizmet, çağrı no|alındı → atandı → takip → çözüldü|Aynı hat arızasıyla ilişkilendirilen çağrılar tek olay altında görünsün.
verisozluk|Veri sözlüğü ve sahiplik|katalog, data governance, şema|veri kümesi, alan, sahip|tanım → gözden geçirme → yayın → arşiv|Eski alan anlamı şema sürümünden bulunabilsin.
geri|Yedekleme ve geri yükleme kontrolü|backup, yedek, restore|yedek sürümü, ortam, doğrulama zamanı|planlandı → alındı → test → onay|Geri yükleme provası sonucu üretim kaydını değiştirmesin.
servis|API kullanım ve kota panosu|api, rate limit, kota|istemci, uç nokta, dönem|ölçüldü → eşik → incelendi → sıfırlandı|Farklı zaman dilimindeki istemciler aynı kota dönemiyle tutarlı kalsın.
`],
["emlak", "Emlak ve mülk yönetimi", "M", "RESO · Emlak veri sözlüğü", "https://www.reso.org/data-dictionary/", `
ilan|Emlak ilanı ve gösterim|emlak, ilan, konut, daire|mülk, medya, ilan durumu|taslak → onay → yayında → kapandı|Kapalı ilan arama ve rezervasyon sonuçlarından çıksın.
portfoy|Emlak portföyü ve ziyaret|portföy, danışman, gösterim|danışman, mülk, ziyaret|talep → plan → ziyaret → geri bildirim|Mülke erişim izni biten danışman özel notları açamasın.
kira|Kira sözleşmesi ve dönem takibi|kira, kiracı, yenileme|sözleşme sürümü, dönem, kiracı|taslak → imza → aktif → yenileme|Yenileme önceki kira dönemi kayıtlarını korusun.
aidat|Site aidatı ve makbuz takibi|site yönetimi, aidat, apartman|bağımsız bölüm, dönem, makbuz|tahakkuk → kısmi → kapandı → uzlaştırma|Kısmi ödeme kalan dönem borcunu doğru düşürsün.
bakim|Kiracı bakım talebi|tesis, arıza, bakım|mülk, talep, teknisyen|bildirim → atandı → onarım → kabul|Tamamlanan onarım kanıtı doğru dairenin kaydına bağlansın.
teslim|Daire teslim ve demirbaş tutanağı|anahtar, tutanak, demirbaş|birim, varlık listesi, tutanak sürümü|hazırlandı → incelendi → teslim → arşiv|Giriş ve çıkış durum fotoğrafları birbirinden ayrılabilsin.
deger|Emsal mülk karşılaştırma|değerleme, emsal, metrekare|emsal, ölçü birimi, satış tarihi|toplandı → doğrulandı → karşılaştırıldı → rapor|M² başına farkın hangi alan ölçümünden geldiği görülsün.
potansiyel|Alıcı ve kiracı aday takibi|lead, aday, konut talebi|aday, bölge tercihi, görüşme|alındı → nitelik → gösterim → sonuç|Tercih güncellemesi önceki görüşme notunu korusun.
otopark|Otopark ve ortak alan tahsisi|otopark, alan, tahsis|alan, hak sahibi, tarih|talep → ayrıldı → kullanım → boş|Örtüşen tahsisler zaman çizelgesinde engellensin.
enerji|Bina enerji belgesi arşivi|bina belgesi, enerji kimlik, EKB|bina, belge sürümü, son geçerlilik|yükle → kontrol → geçerli → arşiv|Süresi dolmuş belge güncel olarak sunulmasın.
`],
["profesyonel", "Profesyonel hizmetler ve araştırma", "N", "OpenAlex · Araştırma kayıtları", "https://help.openalex.org/data/works/", `
crm|Müşteri ve teklif süreçleri|crm, danışmanlık, teklif, satış|müşteri, fırsat, teklif sürümü|aday → görüşme → teklif → sonuç|Kabul edilen teklif sürümü değişiklikten etkilenmesin.
proje|Müşteri proje teslimi|ajans, müşteri portalı, teslimat|proje, kilometre taşı, teslim sürümü|plan → üretim → inceleme → kabul|Müşteri onayı ilgili teslim sürümüne bağlı kalsın.
saat|Faturalanabilir zaman çizelgesi|timesheet, zaman, danışman|müşteri, görev, süre|kaydedildi → onay → faturaya hazır → kapalı|Aynı süre kaydı iki fatura kalemine bağlanmasın.
sozlesme|Hukuk bürosu dosya yönetimi|avukat, dosya, sözleşme|dosya referansı, taraf, erişim rolü|açıldı → çalışılıyor → inceleme → arşiv|Dosyalara erişim görevlendirilmiş ekiple sınırlandırılsın.
arastirma|Araştırma yayın ve atıf panosu|araştırma, makale, doi, atıf|DOI, çalışmanın sürümü, kurum|alındı → eşleştirildi → kontrol → rapor|Aynı DOI varyantı tek araştırma çalışmasıyla eşleşsin.
katilim|Araştırma katılımcı randevusu|katılımcı, görüşme, anket|katılımcı kodu, oturum, onam sürümü|başvuru → teyit → oturum → kapandı|Temas bilgileri araştırma sonuçlarından ayrı tutulabilsin.
brief|Ajans kreatif brief ve onay|brief, ajans, kampanya, tasarım|müşteri briefi, varlık, sürüm|talep → üretim → inceleme → onay|Geri bildirim doğru varlık ve sürüm üzerinde görünsün.
mimari|Mimari proje revizyon takibi|mimarlık, pafta, çizim|pafta kodu, revizyon, müşteri|taslak → gönderildi → yorum → onay|Projede yanlış çizim sürümü onaylanmış gibi görünmesin.
danisma|Danışmanlık bilgi tabanı|bilgi bankası, makale, doküman|makale sürümü, konu, görünürlük|taslak → gözden geçirme → yayın → arşiv|Müşteriye açık dizinde iç ekip makaleleri yer almasın.
kontrol|İç denetim bulgusu ve aksiyon takibi|iç denetim, bulgu, aksiyon|bulgu, sorumlu, kapanış kanıtı|açık → atandı → düzeltildi → teyit|Kapanış ancak ilgili aksiyonun kanıtı kaydedilince tamamlanabilsin.
`],
["idari", "İK, kiralama ve idari hizmetler", "O", "HR Open Standards · İK veri değişimi", "https://www.hropenstandards.org/", `
aday|İşe alım ve aday takip sistemi|ats, iş başvurusu, ik, aday|pozisyon, başvuru, görüşme tarihi|başvuru → inceleme → görüşme → sonuç|Aday dosyası yalnız ilgili işe alım ekibine açılsın.
izin|İzin ve devamsızlık yönetimi|izin, mesai, insan kaynakları|personel, izin türü, gün aralığı|talep → onay → takvim → kapandı|Çakışan izin günleri bakiyeden iki kez düşülmesin.
vardiya|Vardiya ve puantaj|vardiya, çalışma saati, puantaj|personel, vardiya, giriş çıkış|plan → kaydedildi → düzeltildi → onay|Gece yarısını geçen vardiya doğru güne ve süreye bağlansın.
katilim|Çalışan işe giriş görevleri|onboarding, oryantasyon, personel|çalışan, görev, son tarih|hazırlandı → atandı → tamamlandı → kapandı|Başlangıç tarihi değişince açık görev tarihleri gözden geçirilsin.
kiralama|Ekipman kiralama ve iade|kiralama, araç, stok, depozito|ekipman, rezerv dönemi, iade tutanağı|müsait → ayrıldı → kirada → iade|Hasar incelemesindeki ekipman yeni müşteriye sunulmasın.
destek|Destek masası ve SLA takibi|helpdesk, bilet, sla, çağrı|talep no, kategori, süre hedefi|açık → atandı → yanıt → kapandı|Bekleme nedeni ve SLA duraklama süresi ayrı raporlansın.
tesis|Tesis temizlik ve görev planı|temizlik, tesis, vardiya|alan, görev sıklığı, kontrol kaydı|plan → yürütülüyor → kontrol → tamamlandı|Tamamlanmayan alan görevleri sonraki turda görünür olsun.
tedarik|İdari satın alma talep portalı|tedarik, satın alma, teklif toplama|talep, merkez, onay limiti|talep → onay → sipariş → teslim|Yetki limitini aşan talep doğru onaycıya yönlensin.
ziyaret|Ziyaretçi resepsiyon kaydı|resepsiyon, ziyaret, giriş|ziyaretçi referansı, ev sahibi, saat|planlandı → giriş yaptı → çıktı → arşiv|Açık ziyaret listesinde çıkışı alınan ziyaretçi kalmasın.
tasima|Ofis taşınma ve demirbaş takibi|ofis, taşınma, demirbaş|varlık kodu, kaynak alan, hedef alan|etiketlendi → taşımada → teslim → uzlaştırıldı|Hedefte taranmamış demirbaş teslim edilmiş sayılmasın.
`],
["kamu", "Kamu ve belediye hizmetleri", "P", "Open311 · Hizmet talepleri", "https://wiki.open311.org/GeoReport_v2/", `
basvuru|Belediye hizmet başvurusu|belediye, vatandaş, dilekçe|başvuru kodu, hizmet türü, bölge|alındı → atandı → incelendi → kapandı|Vatandaş yalnız kendi başvurusunun özel alanlarını görebilsin.
ihale|İhale ve sözleşme kayıtları|ihale, satın alma, ocds|ihale no, lot, sözleşme sürümü|plan → ilan → karar → sözleşme|Kamuya açık kayıtta yalnız yayıma ayrılmış alanlar yer alsın.
ariza|Altyapı ihbar haritası|çukur, yol, sokak, ihbar|koordinat, olay türü, ekip|alındı → teyit → müdahale → kapandı|Birleştirilen ihbarlar ana kayda bağlı kalsın.
ruhsat|İşyeri ruhsat başvuru ekranı|ruhsat, belediye izin, işyeri|başvuru no, belge listesi, işlem türü|başvuru → evrak → inceleme → karar|Eksik evrak listesi başvuru türüne göre değişsin.
rezervasyon|Kamusal tesis rezervasyonu|belediye tesisi, salon, saha|tesis, zaman aralığı, kullanıcı|talep → teyit → kullanım → tamamlandı|Aynı tesis çakışan saatlere teyit edilemesin.
veri|Açık veri yayın ve güncelleme|açık veri, portal, veri kümesi|veri kümesi, lisans, güncelleme tarihi|hazırlandı → incelendi → yayımlandı → arşiv|Sürüm güncellemesi ile indirme bağlantısı birlikte izlenebilsin.
duyuru|Belediye duyuru ve hizmet takvimi|duyuru, kent, etkinlik|duyuru, mahalle, zaman|taslak → plan → yayımlandı → bitti|Arşivlenmiş duyuru güncel hizmet saatini değiştirmesin.
toplanti|Meclis gündem ve karar arşivi|meclis, gündem, tutanak|oturum, gündem maddesi, karar|yayımlandı → görüşüldü → karar → arşiv|Karar, ilgili gündem maddesine ve tutanak sürümüne bağlansın.
destek|Yerel destek program başvurusu|sosyal yardım, belediye destek, hibe|başvuru, program, belge erişimi|başvuru → kontrol → kurul → bildirim|Başvuru sahibinin özel belgesi rapor çıktısına düşmesin.
saha|Belediye saha ekip iş emri|saha, belediye bakım, ekip|iş emri, bölge, ekip|açık → atandı → sahada → tamamlandı|Tamamlanan iş aynı ihbarda ikinci aktif görev yaratmasın.
`],
["etkinlik", "Kültür, spor ve etkinlik", "S", "Ticketmaster · Etkinlik, mekân ve bilet kataloğu", "https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/", `
bilet|Etkinlik ve bilet portalı|bilet, konser, etkinlik, tiyatro|etkinlik, bilet sınıfı, giriş kodu|yayında → ayrıldı → satın alındı → giriş|Aynı bilet ikinci girişte tanımlanıp işaretlensin.
kulup|Spor kulübü üye takibi|spor, kulüp, üyelik, spor salonu|üye, grup, üyelik dönemi|başvuru → aktif → durdu → kapandı|Üyelik süresi geçmiş kişi aktif katılımcı toplamına katılmasın.
lig|Turnuva ve lig fikstürü|turnuva, lig, maç|takım, karşılaşma, saha|taslak → plan → oynandı → sonuç|Puan tablosu yalnız onaylı maç sonuçlarını kullansın.
salon|Kültür ve spor alanı rezervasyonu|stüdyo, salon, saha, kort|mekân, zaman aralığı, rezervasyon|açık → ayrıldı → kullanıldı → kapandı|Bakım aralığına yeni rezervasyon alınmasın.
sergi|Sergi ve eser envanteri|sergi, sanat, müze, eser|eser, konum, sergi süresi|kayıt → plan → sergide → iade|Eserin sergi ve depo konumu aynı anda etkin olmasın.
gonullu|Etkinlik gönüllü vardiyası|gönüllü, festival, vardiya|gönüllü, görev, vardiya|başvuru → atandı → katıldı → kapandı|Aynı gönüllü çakışan vardiyalarda uyarı alsın.
program|Festival program ve sahne akışı|festival, sahne, konuşmacı|oturum, alan, saat|taslak → onay → yayın → güncelleme|Değişen saat yeni sürümde güncellensin.
eris|Etkinlik erişim ve ziyaretçi tercihleri|erişilebilir yer, refakatçi, etkinlik|ziyaretçi tercihi, alan bilgisi, oturum|bildirildi → eşleştirildi → teyit → kapandı|Tercih ayrıntıları yalnız görevli ekibe görünür olsun.
koleksiyon|Kültür koleksiyonu katalog portalı|koleksiyon, müze, arşiv|eser kimliği, kaynak, görünürlük|taslak → kataloglandı → yayımlandı → arşiv|Özel konum ve telif notları kamu kataloğunda görünmesin.
atolye|Yaratıcı atölye kayıt yönetimi|kurs, sanat atölyesi, kontenjan|atölye, katılımcı, bekleme listesi|açık → kayıt → katılım → tamamlandı|İptal edilen yer bekleme listesindeki sıradaki kişiye ayrılabilsin.
`],
["stkhizmet", "Dernek, vakıf ve kişisel hizmetler", "T", "Frappe · Üyelik, bağış ve gönüllü süreçleri", "https://docs.frappe.io/erpnext/non-profit", `
uyelik|Dernek üye ve aidat portalı|dernek, üyelik, aidat|üye, aidat dönemi, ödeme kaydı|başvuru → aktif → yenileme → arşiv|Yalnız aktif üyeler dönem aidatına dahil edilsin.
bagis|Vakıf bağış takibi|bağış, vakıf, kampanya, makbuz|bağış referansı, kampanya, bağışçı tercihi|taahhüt → alındı → uzlaştırıldı → rapor|Taahhüt ve gerçekleşen bağış aynı toplamda sayılmasın.
gonullu|Gönüllü başvuru ve görev dağıtımı|gönüllü, dernek, görev|gönüllü, uygunluk zamanı, görev|başvuru → yönlendirildi → aktif → kapandı|Onaylanmamış gönüllü özel görev bilgisine erişemesin.
hibe|Hibe değerlendirme ve raporlama|hibe, fon, kurul|başvuru, ölçüt, değerlendirme|açık → alındı → karar → izleme|Kurul kararı değerlendirilen başvuru sürümüne bağlansın.
etki|Sosyal etki izleme panosu|etki, çıktı, faydalanıcı|gösterge, dönem, ölçüm kaynağı|planlandı → toplandı → doğrulandı → rapor|Bilinmeyen değer ve sıfır ölçüm ayrıştırılsın.
tamir|Küçük cihaz tamir ve teslim|tamir, servis, telefon, garanti|cihaz, iş fişi, teslim durumu|alındı → teklif → tamir → teslim|Cihaz teslimi doğru fiş koduyla doğrulansın.
terzi|Terzi prova ve teslim takvimi|terzi, tadilat, prova|giysi, prova saati, teslim notu|alındı → prova → hazır → teslim|Hazır olmayan iş teslim listesinde yanlışlıkla kapanmasın.
asama|Meslek birliği belge başvurusu|oda, üyelik belgesi, meslek|üye referansı, belge türü, geçerlilik|talep → incelendi → verildi → geçersiz|Süresi dolan belge doğrulama ekranında ayırt edilsin.
esya|Eşya onarım atölyesi iş listesi|mobilya onarım, usta, atölye|eşya, hasar notu, iş paketi|kabul → teklif → işlem → teslim|Onaydan sonraki kapsam değişikliği işlem geçmişinde izlenebilsin.
yikama|Çamaşır ve kuru temizleme takibi|kuru temizleme, çamaşır, teslim|etiket, ürün, teslim tarihi|alındı → işleme → hazır → teslim|Aynı etiketin ikinci teslimi engellensin.
`],
["salon", "Güzellik, kuaför ve wellness", "T", "O*NET · Kuaförlük ve güzellik hizmeti görevleri", "https://www.onetonline.org/link/summary/39-5012.00", `
randevu|Salon randevu ve personel takvimi|kuaför, berber, güzellik, manikür, randevu|hizmet süresi, çalışan, uygunluk saati|talep → teyit → geldi → tamamlandı|Aynı çalışana çakışan iki randevu kaydedilmesin.
paket|Seans ve hizmet paketi takibi|seans, paket, spa, paket satın al|müşteri, paket, kalan seans|alındı → kullanım → duraklatıldı → kapandı|İptal edilen seans doğru bakiye hareketini oluştursun.
vardiya|Salon çalışan vardiyası|vardiya, personel, şube|çalışan, şube, çalışma saati|öneri → plan → çalışıldı → kapanış|Çalışan aynı anda iki şubede planlanamasın.
oda|Spa odası ve kabin rezervasyonu|spa, kabin, oda, masaj|oda, hizmet, hazırlık süresi|müsait → ayrıldı → hizmet → temizlik|Hazırlık süresi yeni rezervasyonla çakışmasın.
musteri|Salon ziyaret ve müşteri tercihleri|salon crm, tercih, ziyaret|müşteri, ziyaret, tercih izni|kayıt → ziyaret → güncelleme → arşiv|Yalnız yetkili çalışan özel tercihlere erişebilsin.
stok|Salon sarf ve raf ürünü takibi|boya, ürün, sarf, envanter|ürün, parti, tüketim miktarı|giriş → kullanım → sayım → uzlaştırma|Kullanım hareketi raf satışıyla çift kaydedilmesin.
bekleme|Boşalan saat ve bekleme listesi|bekleme, iptal, boş saat|hizmet, bekleyen müşteri, zaman tercihi|sırada → teklif edildi → kabul → kapandı|Aynı boş saat teklif süreleri boyunca ikinci kez ayrılmasın.
fiyat|Salon hizmet fiyat ve süre kataloğu|fiyat, hizmet listesi, hair salon|hizmet, şube, geçerlilik başlangıcı|taslak → onay → aktif → arşiv|Yeni fiyat önceki ziyaretin kayıtlı fiyatını değiştirmesin.
hediye|Hediye kartı bakiye takibi|hediye çeki, gift card, bakiye|kart kodu, bakiye, kullanım hareketi|verildi → kısmi → kullanıldı → kapandı|Aynı kart hareketi bakiyeden ikinci kez düşülmesin.
geri|Salon hizmet geri bildirimi|anket, yorum, memnuniyet|ziyaret, değerlendirme, çözüm notu|alındı → incelendi → yanıt → arşiv|Yorumun özel müşteri bilgileri genel rapora girmesin.
`],
["hane", "Ev hizmetleri ve hane yönetimi", "U", "ILO · Ev hizmetlerinde çalışma alanı", "https://www.ilo.org/topics-and-sectors/domestic-workers", `
temizlik|Ev temizlik rezervasyonu|ev temizliği, görevli, temizlik|ev referansı, görevli, ziyaret saati|talep → teyit → ziyaret → tamamlandı|Çakışan ziyaretler görevlinin takviminde engellensin.
bakim|Ev bakım ve tamir talebi|tesisat, usta, arıza, ev bakımı|ev, iş talebi, hizmet veren|talep → teklif → randevu → teslim|Ev sakini yalnız kendi konutunun işlerini takip etsin.
bahce|Ev bahçe bakım takvimi|bahçıvan, çim, bahçe|bahçe bölümü, görev, tekrar kuralı|plan → atama → yapıldı → tekrar|Tekrar üretilen görev aynı tarihte çift açılmasın.
evcil|Evcil hayvan ziyaret planı|pet, yürüyüş, evcil bakım|evcil referansı, ziyaret saati, bakıcı|talep → atandı → ziyaret → rapor|Bakıcı yalnız atandığı ziyaretin iletişim bilgilerini görsün.
gider|Hane harcama paylaşımı|ev bütçesi, ortak gider, ev arkadaşı|gider kalemi, üye, bölüşüm payı|kaydedildi → paylaşıldı → ödendi → kapandı|Payların toplamı işlem tutarını aşmasın.
garanti|Ev eşyası garanti arşivi|garanti, cihaz, seri no|cihaz, satın alma tarihi, garanti belgesi|kaydedildi → aktif → servis → arşiv|Süresi geçen garanti güncel uyarı listesinden ayrıştırılsın.
tasima|Hane taşınma ve kutu takibi|taşınma, koli, ev envanteri|kutu kodu, oda, teslim durumu|paketlendi → taşındı → ulaştı → açıldı|Eksik kutular hedef adres teslim listesinde açık kalsın.
liste|Hane görev paylaşımı|ev işleri, ortak görev, takvim|görev, sorumlu, tekrar aralığı|plan → atandı → yapıldı → doğrulandı|Tamamlanmış görev sonraki dönemin görevini kapatmasın.
enerji|Hane tüketim defteri|sayaç, doğalgaz, ev tüketimi|sayaç, okuma tarihi, birim|okundu → girildi → kontrol → özet|Sayaç değişimi tüketimde yapay artışa yol açmasın.
yetki|Ev hizmet erişim defteri|ziyaret izni, misafir, ev hizmeti|ziyaret, geçerlilik saati, onay|talep → onay → ziyaret → süre doldu|Süresi dolan erişim izni aktif listeden çıkarılsın.
`],
["uluslararasi", "Uluslararası kuruluşlar ve insani yardım", "V", "IATI · Uluslararası faaliyet veri standardı", "https://reference.iatistandard.org/en/iati-standard/", `
program|Uluslararası faaliyet portföyü|program, ülke, iati, kalkınma|faaliyet kodu, ülke, ortak|plan → yürütülüyor → izleme → kapandı|Çok ülkeli program toplamında aynı faaliyet iki kez sayılmasın.
ortak|Saha ortağı görev ve sözleşmeleri|paydaş, iş ortağı, uluslararası|ortak, anlaşma sürümü, görev|aday → anlaşma → yürütme → gözden geçirme|Ortak yalnız kendi program teslimlerine erişsin.
butce|Bağışçı bütçe ve harcama takibi|donor, bütçe, fon, proje|bağışçı, kalem, para birimi|taahhüt → tahsis → harcama → rapor|Tutarlar kaynak para birimi ve dönüşüm tarihiyle izlenebilsin.
stok|Yardım malzemesi dağıtım kaydı|yardım, dağıtım, koli, hane|paket, dağıtım noktası, işlem kodu|hazır → sevk → teslim → uzlaştırıldı|Aynı teslim kodu birden fazla teslim üretmesin.
gosterge|Program göstergesi ve kanıt arşivi|gösterge, m&e, saha raporu|gösterge, ölçüm dönemi, kanıt|plan → veri → doğrulama → rapor|Kanıt ve göstergenin son doğrulanmış değeri ilişkilendirilsin.
ceviri|Çok dilli saha duyurusu|çeviri, duyuru, lokalizasyon|duyuru, dil, sürüm|taslak → çeviri → kontrol → dağıtım|Yeni kaynak sürümü çeviri sahibine görünür olsun.
heyet|Heyet ve çalışma ziyareti takibi|delegasyon, toplantı, dış ilişkiler|heyet, oturum, davet|plan → davet → teyit → tamamlandı|Gizli katılımcı listesi genel programdan ayrıştırılsın.
tedarik|Saha tedarik teklif karşılaştırma|insani tedarik, ihale, saha|teklif, teslim noktası, ölçüt|çağrı → alındı → inceleme → karar|Karar için kullanılan teklif sürümleri kayda alınsın.
geribildirim|Program şikâyet ve geri bildirim hattı|şikâyet, hotline, geri bildirim|özel vaka kodu, kanal, sorumlu|alındı → atandı → ele alındı → kapandı|Anonim bildirimde kimlik alanı zorunlu olmasın.
egitim|Uluslararası ekip eğitim takvimi|eğitim, personel, ülke ofisi|grup, saat dilimi, oturum|plan → davet → katılım → kayıt|Aynı oturum farklı saat dilimlerinde tutarlı gösterilsin.
`],
];

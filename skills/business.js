// Gitmapp recipes for generated project drafts. Links identify the reviewed upstream skills.
const businessSkillSources = {
  "erp": "https://github.com/venetanji/erpnext-skills/blob/0fdf2f865430864469796e59262244bcd2d97562/skills/erpnext/SKILL.md",
  "commerce": "https://github.com/Shopify/agent-skills/blob/6b9ed0552d5116ee33d0e211dfa6681f2f5bdffe/shopify-admin/SKILL.md",
  "saas": "https://github.com/stripe/ai/blob/d4b19a989bf12bdbd4d42de1f9bfd3aec56fd9da/skills/stripe-best-practices/SKILL.md",
  "auto": "https://github.com/czlonkowski/n8n-skills/blob/ecdeca6f760b56bb1b11c0a7c961f11b69cb87d5/skills/n8n-workflow-patterns/SKILL.md"
};
const businessSkills = [
  ["lot-takibi","Sektör","Eczane ve kozmetikte lot takibi","Lot, miat ve satılabilir stok görünümü.","erp","Ürünü barkodla, partiyi lot ve son kullanma tarihiyle tanımla. Aynı ürünün iki partisini ayrı göster. Sevkte son kullanma tarihi en yakın uygun partiyi öner. Süresi geçmiş partinin satışını engelle."],
  ["restoran-ikmal","Sektör","Restoran mutfağında ikmal","Reçeteden malzeme ihtiyacını ve eksikleri hesaplar.","erp","Porsiyon sayısını reçetedeki birim miktarlarla çarp. Birim dönüşümünü göster. Depodaki kullanılabilir miktarı düşüp yalnız eksiği ikmal listesine ekle. İptal edilen talebi toplamdan çıkar."],
  ["magaza-iade","Sektör","Mağaza siparişinde kısmi iade","Ürün varyantı, sipariş satırı ve iade adedini eşleştirir.","commerce","İadeyi sipariş satırı ve varyanta bağla. Önceki iadelerle birlikte teslim edilen adedi aşmasını engelle. Yeniden satılabilir ürün ve hasarlı ürünün stok etkilerini ayrı göster."],
  ["erp-satinalma","ERP","Satın alma ve mal kabul","Sipariş, kısmi teslim ve açık miktarı izler.","erp","Sipariş satırına birim, sipariş miktarı ve depo ekle. Her kabulü ayrı hareket olarak kaydet. İkinci teslimde kalan miktarı yeniden hesapla. Aynı kabul belgesini ikinci kez işleme."],
  ["erp-depo","ERP","Depolar arası transfer","Çıkış, yoldaki miktar ve teslim almayı uzlaştırır.","erp","Kaynak ve hedef depoyu ayır. Sevkte miktarı yoldaki stoka taşı. Teslimde fiilen alınanı hedefe geçir. Yoldaki fark sıfırlanana kadar transferi açık tut."],
  ["erp-uretim","ERP","Üretim emri ve sarf","Malzeme listesi, fiili tüketim ve üretim farkını gösterir.","erp","Üretim emrine ürün ve reçete sürümü bağla. Planlanan ve fiili sarfı satır bazında karşılaştır. Kısmi üretimden sonra kalan hedefi göster. Tamamlanan emirde aynı mamul girişini tekrarlama."],
  ["saas-abonelik","SaaS","Abonelik yaşam döngüsü","Deneme, aktif, gecikmiş ve iptal durumlarını işler.","saas","Abonelikte planı, dönemi ve son doğrulanmış olayı sakla. Dönem sonunda iptal ile hemen iptali ayır. Geciken tahsilat ve sonradan başarılı ödeme için ayrı akış göster."],
  ["saas-paket","SaaS","Paket ve kullanım hakları","Özellik erişimi ve dönemsel kullanım kotasını modeller.","saas","Paket özellikleri ve kullanım hakkını tek tabloda tanımla. Kullanım sınırına ulaşmayı örnekle. Plan değişim tarihini ve geçerli hakları göster. Ödeme ekranından dönüşü tek başına tahsilat kanıtı sayma."],
  ["saas-tahsilat","SaaS","Yenileme ve tahsilat takibi","Başarısız yenilemeleri ve sonuçlarını izler.","saas","Abonelik, dönem faturası ve ödeme denemesini ayrı kayıtlar olarak tut. Başarısız denemeyi görev listesine ekle. Aynı faturanın sonraki başarılı denemesinde görevi kapat ve ikinci gelir yazma."],
  ["oto-siparis","Otomasyon","Sipariş olayını işleme","Gelen siparişi doğru iş akışına bir kez aktarır.","auto","Gelen olayın kimliğini ve gerekli alanları doğrula. Daha önce işlenen kimliği atla. İlgili siparişe görev oluştur. Örnek bir olayın iki tesliminde tek görev oluştuğunu göster."],
  ["oto-gecikme","Otomasyon","Geciken kargoyu yönlendirme","Teslim tarihi geçen gönderiyi sorumluya atar.","auto","Zamanlanmış kontrolde teslim edilmemiş ve vadesi geçmiş gönderileri seç. Gönderi başına tek açık takip görevi oluştur. Sonraki kontrolde aynı görevi güncelle. Teslim olayında kapat."],
  ["oto-hata","Otomasyon","Başarısız işleri yeniden deneme","Hata kuyruğu, yeniden deneme ve işlem geçmişi üretir.","auto","Her çalışmaya kimlik ver. Geçici hatada sınırlı sayıda yeniden dene. Kalıcı hatayı nedeni ve son denemesiyle inceleme kuyruğuna taşı. Tekrar çalıştırırken tamamlanmış adımları atla."]
].map(([id, group, n, d, source, p])=>({id, group, n, d, p, src:"gitmapp", source:businessSkillSources[source]}));

const sapProcesses = "https://learning.sap.com/courses/exploring-end-to-end-business-processes-in-sap";
const sapProduction = "https://learning.sap.com/courses/exploring-business-processes-in-sap-s-4hana-production-planning";
const gitSapSkills = [
  ["organizasyon","Holding ve yetki","Şirket, tesis, depo ve maliyet merkezini ortak kimliklerle bağla. Rol kapsamını şirket ve işlem türünde doğrula.","A şirketinin depo görevlisi B şirketinin stok belgesini doğrudan kimliğiyle açamaz."],
  ["ana-veri","Malzeme ve iş ortağı ana verisi","Malzeme, varyant, birim dönüşümü ve şirket bazlı tedarikçi koşullarını sürümlü tut.","1 koli 12 adetken 3 koli kabul 36 adet artırır. Sonraki birim değişikliği geçmiş belgeyi değiştirmez."],
  ["tedarik","Satın alma talebinden siparişe","Talep, onay ve sipariş satırlarını ilişkilendir. Talep miktarını aşan siparişi gerekçeli onaya gönder.","100 adetlik talebin 60 adedi siparişe dönüşürse açık talep 40 olur."],
  ["fatura","Üç yönlü fatura eşleştirme","Sipariş, mal kabul ve faturayı satır, miktar, birim ve para birimiyle eşleştir. Tolerans dışını incelemeye al.","100 sipariş, 85 teslim ve 100 fatura örneğinde 15 adet fark görünür."],
  ["stok","Depolar arası sevk ve teslim","Sevk, yoldaki stok, teslim, hasar ve ters hareketleri ayrı belgelerde izle.","80 sevk ve 75 teslim sonrasında 5 birim yoldadır. Aynı teslim tekrar gelince bakiye değişmez."],
  ["mrp","Malzeme ihtiyaç planlaması","Tarihli talep, kullanılabilir stok, kesinleşmiş giriş, emniyet stoku ve tedarik süresinden net öneri hesapla.","100 talep, 20 stok, zamanında 30 giriş ve 10 emniyet stoku için ihtiyaç 60 olur.",sapProduction],
  ["recete","Ürün ağacı ve reçete sürümü","Üretim tarihindeki geçerli reçeteyi seç. Alt bileşenleri aç, birimleri dönüştür ve döngüsel reçeteyi reddet.","Birim başına 2 kapak gereken 70 ürün için 140 kapak planlanır.",sapProduction],
  ["kapasite","İş merkezi ve kapasite","Operasyon sırası, hazırlık süresi, vardiya, bakım ve çalışma takvimine göre kapasiteyi hesapla.","8 saatlik vardiyada 1 saat bakım varsa 8 saatlik iş en az 1 saat taşar.",sapProduction],
  ["uretim","Üretim emri ve fiili sarf","Rezervasyon, sarf, kısmi mamul girişi, hurda ve tamamlamayı aynı emre bağla.","100 hedef, 80 sağlam ve 5 hurdayı ayrı göster. Tekrar gelen üretim bildirimi yeni giriş yaratmaz.",sapProduction],
  ["fason","Fason üretim mutabakatı","Fasoncu stoklarını malzeme ve birim bazında izle. Gönderim, tüketim, iade ve farkı aynı siparişe bağla.","100 kg krem ve 2000 kavanoz gönder. 1900 adet × 50 g teslimde açıklanacak 5 kg ve 100 kavanoz kalır.","https://help.sap.com/docs/SAP_ERP/b704a8db767040a08100adc846218964/dd61bd534f22b44ce10000000a174cb4.html"],
  ["lot","Parti soyağacı ve geri çağırma","Hammadde, ara ürün, mamul ve sevkiyat partileri arasında miktarlı bağlar kur. İleri ve geri sorgu sun.","İki mamule bölünen hammadde partisinden etkilenen iki sevkiyatı getir. İlgisiz partiyi dışarıda tut.","https://help.sap.com/docs/SAP_ERP/96bf9ad642cf4b26a29595e3d573fb8c/64feb753128eb44ce10000000a174cb4.html"],
  ["kalite","Kalite muayenesi ve serbest bırakma","Örnekleme sonucu, karar, karantina, red ve serbest stoku ayrı kaydet.","100 birimin 90 tanesi serbest ve 10 tanesi karantinadaysa 95 birimlik sevki karşılanmış gösterme."],
  ["satis","Siparişten teslimat ve faturaya","Müşteri siparişi, teslimat, mal çıkışı, fatura, iade ve açık miktarı satır bazında izle.","10 siparişin 6 adedi sevk edilirse teslimata bağlı faturaya en çok 6 birim taşı."],
  ["finans","Yevmiye, açık kalem ve ters kayıt","Borç ve alacak toplamlarını para birimi bazında doğrula. Tahsilatı açık kaleme bağla. İptali bağlantılı ters fişle yap.","1000 tutarındaki faturaya 300 tahsilatta 700 açık kalır. Tahsilat ters çevrilince açık tutar 1000 olur."],
  ["maliyet","Üretim maliyeti ve sapma","Malzeme, işçilik ve genel gideri emre bağla. Standart ve gerçekleşen maliyeti aynı çıktı miktarında karşılaştır.","100 sağlam ürün için 12000 gerçekleşen ve 10000 standart maliyet varsa birim sapma 20 olur."],
  ["grup","Şirketler arası mutabakat","İki şirketin belgelerini ortak işlem kimliği, para birimi ve dönemle eşleştir. Açık farkları konsolidasyon öncesi göster.","A şirketinde 500 alacak ve B şirketinde 480 borç varsa 20 farkı kapanmış gösterme."],
  ["bakim","Varlık bakımı ve hizmet emri","Arıza, iş emri, görevlendirme, duruş, yedek parça sarfı ve teknik tamamlama kaydet.","Aynı pompa için açık arızaya ikinci bildirim gelince mevcut emre bağlanabilsin."],
  ["proje","Proje bütçesi ve gerçekleşen maliyet","İş kırılımına bütçe, satın alma taahhüdü ve gerçekleşen maliyet bağla. Faturaya dönüşen taahhüdü serbest bırak.","100 bütçe ve 40 taahhüdün 30 birimi faturalanınca kalan bütçe 60 ve açık taahhüt 10 olur."]
].map(([id,n,d,check,source=sapProcesses])=>({
  id:"gitsap-"+id, group:"GitSap", n, d, check, source, src:"gitmapp",
  p:d+" Kabul senaryosu: "+check
}));
businessSkills.push(...gitSapSkills);

const oracleSources = {
 architecture:"https://docs.oracle.com/cd/E26401_01/doc.122/e22949/T120505T120508.htm",
 compiler:"https://docs.oracle.com/en/database/oracle/oracle-database/18/refrn/ALL_ERRORS.html",
 plan:"https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_XPLAN.html",
 queue:"https://docs.oracle.com/cd/E26401_01/doc.122/e22953/T174296T575591.htm",
 ap:"https://docs.oracle.com/cd/E26401_01/doc.122/e48763.pdf",
 sla:"https://docs.oracle.com/en/applications/e-business-suite/readiness/financial-management/12.2/whats-new/ebs-fin-wn-f47980.htm",
 fusion:"https://docs.oracle.com/en/cloud/saas/financials/25d/fausl/resolving-issues-with-transferring-journal-entries-to-general-ledger.html",
 ford:"https://www.gtech.com.tr/en/story/ford-otosan-budget-planning-and-financial-reporting-version-upgrade-project/",
 akbank:"https://www.oracle.com/customers/akbank/",
 enerjisa:"https://www.redington.com.tr/uploads/2021/05/51.pdf",
 kocsistem:"https://www.aa.com.tr/tr/isdunyasi/sirketler/kocsistem-ve-oracle-dan-guvenli-bulut-icin-turkiye-de-oracle-exadata-cloud-customer-is-birligi/674266"
};
const oracleSkills = [
 ["tiers","EBS 12.2 · İşlem izini katmanlar arasında takip","İş olayı, uygulama isteği, arka plan işi ve veritabanı kaydını ortak zaman aralığında eşleştir. İnteraktif ekran yanıtı ile asenkron işin tamamlanmasını ayır.","Kayıt ekranda görünürken rapor üretilmemişse, önce rapor isteğinin oluştuğunu ve durumunu doğrula.","architecture"],
 ["plsql","PL/SQL · Derleme hatasını yerelleştirme","Nesne sahibi, nesne tipi ve sürümle hata listesini eşleştir. ALL_ERRORS içindeki sıra, satır, konum ve mesajdan ilk anlamlı hatayı ve onu izleyen türev hataları ayır.","Aynı adlı paket ve paket gövdesinin hatalarını ayır; test ortamında düzeltmeden sonra derleme durumunu ve çağıran işin sonucunu doğrula.","compiler"],
 ["sql","Oracle Database · Yavaş sorgu teşhisi","Aynı iş yükü ve parametrelerle süre, satır ve yürütme planını karşılaştır. İlgili cursor planından tahmin ve varsa fiili satır sayısını oku. Eksik çalışma istatistiklerini belirt.","Plan değişikliği gözlendiğinde veri hacmi, filtre seçiciliği ve tekrar ölçümü olmadan indeks değişikliğini kesin çözüm olarak sunma.","plan"],
 ["ap","EBS 12.2 · Fatura blokajı","Sipariş, kabul ve faturayı satır ve birim bazında karşılaştır. Eşleştirme düzeyini, toleransı ve gerçek blokaj nedenini al.","Üç yönlü, sıfır toleranslı 100 sipariş / 85 teslim / 100 fatura örneğinde 15 birim farkı göster. İki yönlü eşleştirmede aynı teslim farkı tek başına blokaj kanıtı olamaz.","ap"],
 ["queue","EBS 12.2 · Bekleyen iş","İstek kimliği, faz, durum, planlanan başlangıç ve uygun yönetici sayısını birlikte değerlendir. Normal bekleme, zamanlama ve yönetici yokluğunu ayır.","Pending / Normal için yönetici yok sonucuna atlama. Inactive / No Manager için atama ve uygunluk kontrolünü öner.","queue"],
 ["sla","EBS · Muhasebeleşmeyen olay","İşlem kimliğinden muhasebe olayına ilerle. Taslak, geçersiz ve nihai kayıtları ayır. Mevcut sürümün desteklediği dönem kapanış raporunu kullan.","Nihai kayıt yokken GL fişinin kaybolduğu sonucuna varma. Kaynak olay ile rapor satırını eşleştir.","sla"],
 ["fusion","Fusion Financials · Deftere aktarım","Muhasebe durumunu, aktarım sürecini, içe aktarma raporunu ve hedef defteri ayrı kontrol et.","Nihai alt defter kaydı mevcutsa aktarım çıktısı ile hedef toplu kayıt kimliğini kontrol et; yeniden çalıştırmadan önce önceki sonucu doğrula.","fusion"],
 ["epm","Hyperion · Yükseltme doğrulaması","Eski ve yeni ortamda aynı dönem, senaryo, sürüm, birim ve hesap kesitini karşılaştır. Veri, metadata ve kimlik doğrulamasını ayrı test et.","Toplam eşleşse bile bir maliyet merkezinden diğerine kaymış tutarı üye bazında ortaya çıkar.","ford"],
 ["hfm","EPM · Konsolidasyon farkı","Kaynak bakiye, eşleme, çevrim, grup içi eliminasyon ve rapor döneminin her birini doğrula. Farkın ilk oluştuğu aşamayı belirle.","Aynı dönem ve para biriminde 500 alacak ile 480 borç arasındaki 20 fark için karşı taraf kayıtlarını iste.","enerjisa"],
 ["migration","Exadata · Veri geçişi mutabakatı","Kaynak ve hedefi aynı zaman kesitinde anahtar, belge sayısı, alan tipi, boş değer ve örnek sorgu sonuçlarıyla karşılaştır.","Satır sayıları eşitken bir belgenin anahtar veya tutarı değişmişse doğrulamayı başarısız say.","akbank"],
 ["capacity","Oracle altyapı · Hizmet sınırı","Uygulama, veritabanı ve yönetilen altyapı sorumlularını ayır. İşlem süresi ve veri tazeliği için aynı pencereye ait önce/sonra ölçümü iste.","Uygulama gecikmesi tek başına altyapı arızasını kanıtlamaz. Destek kaydına etkilenen işlem ve karşılaştırma aralığını ekle.","kocsistem"]
].map(([id,n,d,check,source])=>({id:"oracle-"+id,group:"Oracle",src:"gitmapp",n,d,check,source:oracleSources[source],
 p:d+" Örnek doğrulama: "+check+" Bulguyu, eksik kanıtı, sonraki kontrolü ve düzelmenin ölçütünü yaz. Canlı sisteme erişildiğini varsayma."}));
businessSkills.push(...oracleSkills,{
 id:"gitmapp-gt",group:"GitmappGT",n:"GT · Sigorta uygulaması teknik desteği",
 d:"Poliçe, zeyil, hasar ve ödeme akışlarını şema ve sinyallerle incele.",
 p:"Oracle veya SAP ürününü ve sürümünü doğrula. Bildirilen sistemin tablolarını, ilişkilerini ve olaylarını kullan. Poliçe, hasar, ödeme, mükerrer olay ve eksik bağlantı senaryolarında gözlem, hipotez, geliştirilecek değişiklik ve kabul testini ayrı göster. Gerçekleşmeyen testi başarılı gösterme.",
 check:"Ödeme bekleme sinyali tek başına hasarın neden beklediğini kanıtlamaz. İlgili olay kimliğini ve geçiş kaydını iste.",src:"gitmapp"
});

function businessSkillInstructions(ids) {
  if (!Array.isArray(ids)) return "";
  const selected = businessSkills.filter(skill => ids.includes(skill.id));
  if (!selected.length) return "";
  return "\nSeçili iş becerilerinden yalnız bu projeye ve istenen değişikliğe uyanları kullan. Dış bağlantı yoksa örnek veriyle çalış ve simülasyonu belirt.\n"+
    (selected.some(skill=>skill.group==="GitSap")?"GitSap: Seçilen süreçlerde ortak şirket, malzeme, belge ve satır kimlikleri kullan. Hareketleri kaynak belgeye bağla. Çift bildirimi ve ters kaydı örnek verilerle denetle.\n":"")+
    selected.map(skill => skill.n+" — "+skill.p).join("\n");
}
if (typeof module !== "undefined" && module.exports) module.exports = {businessSkills,businessSkillInstructions};

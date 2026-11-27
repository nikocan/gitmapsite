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

function businessSkillInstructions(ids) {
  if (!Array.isArray(ids)) return "";
  const selected = businessSkills.filter(skill => ids.includes(skill.id));
  if (!selected.length) return "";
  return "\nSeçili iş becerilerinden yalnız bu projeye ve istenen değişikliğe uyanları kullan. Dış bağlantı yoksa örnek veriyle çalış ve simülasyonu belirt.\n"+
    selected.map(skill => skill.n+" — "+skill.p).join("\n");
}
if (typeof module !== "undefined" && module.exports) module.exports = {businessSkills,businessSkillInstructions};

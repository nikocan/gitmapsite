const GitmappSkills = (() => {
  const stages = [
    {id:"plan", name:"Planla", summary:"Kapsamı, rolleri ve iş kurallarını belirle.", tasks:[
      ["kapsam", "İlk sürüm kapsamı", "Kullanıcı yolculuğunu, ilk sürüm sınırını ve varsa karar gerektiren varsayımları içeren kısa bir kapsam hazırla.", "Ana görev ile sonraya bırakılan ihtiyaçları ayrı listeler."],
      ["rol", "Roller ve sorumluluklar", "İş akışında kayıt açan, işleyen, inceleyen ve yöneten rolleri belirle. Okuma ve yazma yetkileri için bir matris hazırla.", "Rollerin görüp değiştirebildiği kayıtları tek tek gösterir."],
      ["kurallar", "Durum ve iş kuralları", "Geçerli durum geçişlerini, geri alma koşullarını ve istisnaları bir tabloyla tanımla.", "Geçişlerin hangi koşulda ve kim tarafından yapılabileceğini açıklar."],
      ["olcum", "Başarı ölçütleri", "Ana görevin tamamlanma oranı ve işlem süresi için olay adlarını, payı, paydayı ve ölçüm aralığını tanımla.", "Her ölçütün hangi olaylardan üretileceği anlaşılır."],
    ]},
    {id:"veri", name:"Veriyi kur", summary:"Kayıt yapısını ve örnek veriyi hazırla.", tasks:[
      ["model", "Veri modeli", "Alan türlerini, kimlikleri, ilişkileri ve zorunlu alanları tanımla. Modeli kullanan kayıt, güncelleme ve okuma yolunu ekle.", "İlişkili kayıtlar kimlikle bağlanır ve geçersiz alanlar reddedilir."],
      ["gecmis", "Kayıt ve işlem geçmişi", "Durum değişikliği için önceki ve sonraki değeri, zamanı ve işlemi yapan rolü saklayan geçmiş görünümü kur.", "Bir kaydın değişim sırası ve son durumu günlüğünden doğrulanır."],
      ["ornek", "Deneme verisi", "İş akışının her durumuna ait birbirine bağlı sentetik kayıtlar oluştur. Boş, bekleyen ve hatalı giriş senaryolarını da ekle.", "Deneme verisiyle temel akışlar yeniden çalıştırılabilir."],
      ["aktarim", "Veri içe ve dışa aktarma", "Alan eşleme önizlemesi, satır bazında hata mesajı, mükerrer kayıt kontrolü ve yetkiye uygun CSV çıktısı hazırla.", "Geçersiz satırlar gösterilir ve geçerli kayıt ikinci aktarımda çoğalmaz."],
    ]},
    {id:"arayuz", name:"Ekranları kur", summary:"Kullanıcının günlük işini ekrana taşı.", tasks:[
      ["form", "Kayıt formu", "Uygun alan türleri, otomatik odak, alan içi hata mesajı ve başarı durumu olan erişilebilir bir kayıt formu kur.", "Hatalı girişte kullanıcı girdiği geçerli değerleri kaybetmez."],
      ["liste", "Arama ve işlem listesi", "Durum ve tarihe göre filtrelenen, kimlikle aranan ve ayrıntıya açılan duyarlı bir liste kur.", "Arama, filtre ve sıfır sonuç durumları klavyeyle kullanılabilir."],
      ["detay", "Kayıt ayrıntısı ve zaman çizgisi", "İlişkili kayıtları, son durumu ve sonraki işlemi gösteren ayrıntı ekranı kur. Koşulsuz işlem düğmesi ekleme.", "Kullanıcı hangi kayıtta olduğunu ve uygulayabileceği işlemi görür."],
      ["pano", "Günlük operasyon panosu", "Açık ve bekleyen kayıtları durum bazında özetle. Bir karttan o sayıyı oluşturan filtreli listeye geçilebilsin.", "Pano toplamları ve filtrelenmiş liste sayıları aynı kaynaktan gelir."],
    ]},
    {id:"akis", name:"İş akışını bağla", summary:"Atamaları, istisnaları ve dış bağlantıları ekle.", tasks:[
      ["gecis", "Durum geçişi ve görev atama", "Geçerli geçişleri yetki ve durum önkoşullarıyla doğrula. Öncelik, sorumlu ve sonraki adımı kaydet.", "Tekrarlanan bir işlem kaydı veya atamayı çoğaltmaz."],
      ["bildirim", "Bildirim ve hatırlatma", "Bildirim olayını, alıcı tercihini ve gönderim durumunu modelle. Demo önizlemesinde örnek içerik ve gönderim geçmişi göster.", "Durumu değişen kaydın geçersiz hatırlatması kuyruktan çıkar."],
      ["istisna", "İstisna kuyruğu", "İş kuralına uymayan ve yarıda kalan işlemleri bir inceleme listesine al. Gerekçe kaydı ile yetkili yeniden deneme veya kapatma ekle.", "Başarısız işlem başarı hanesine yazılmaz ve tekrar denenebilir."],
      ["entegrasyon", "Dış sistem bağlantısı", "Bağlanacak sistemin alan eşlemesini, başarı ve hata durumlarını ve dış kimlik kontrolünü tanımla. Bağlantı yoksa deneme verisiyle arayüzü doğrula.", "Eşleşmeyen dış kayıt incelemeye düşer ve sessizce üzerine yazılmaz."],
    ]},
    {id:"test", name:"Test et ve hazırla", summary:"Kabul senaryosunu ve yayına geçişi kontrol et.", tasks:[
      ["kabul", "Uçtan uca kabul testi", "İlk kayıttan kapanışa normal akışı ve alan kabul koşulunu Given–When–Then senaryolarına çevir. Başarı ve hata sonuçlarını kaydet.", "Bir kişi senaryoyu deneme verisiyle baştan sona tekrar edebilir."],
      ["erisim", "Yetki ve mahremiyet kontrolü", "İzinli, izinsiz ve süresi bitmiş kullanıcı durumlarını deneme verisiyle sınayan kabul senaryoları kur. Kamuya açık çıktı alanlarını denetle.", "Yetkisiz rol özel kaydı okuyamaz veya değiştiremez."],
      ["cihaz", "Mobil ve erişilebilirlik testi", "Dar ekran, klavye akışı, görünür odak, etiket, boş durum ve hata durumunu ana görev üzerinde doğrula.", "Ana görev telefon boyutunda ve yalnız klavyeyle tamamlanır."],
      ["yayin", "Yayın ve devir kontrolü", "Yapılandırma, önizleme, veri yedekleme, geri alma ve ilk gün takibi için sorumlu ve doğrulama adımları olan bir kontrol listesi oluştur.", "Açık bağlantılar, deneme modu ve yayın ön koşulları listelenir."],
    ]},
  ];

  function normalize(text = "") {
    return String(text).toLocaleLowerCase("tr").normalize("NFD")
      .replace(/\p{M}/gu, "").replaceAll("ı", "i").replace(/[^a-z0-9]+/g, " ").trim();
  }

  const stopWords = new Set("bir bu için ile ve veya bana istiyorum olsun yap yapar yapmak oluştur oluşturmak kur kurmak istiyorum lazım uygulama uygulaması uygulamasını sistemi sistem portal portalı".split(" ").map(normalize));
  function tokens(text) {
    return [...new Set(normalize(text).split(" ").filter(part => part.length >= 2 && !stopWords.has(part)))];
  }

  function tokenMatches(term, word) {
    return term === word || (Math.min(term.length, word.length) >= 4 &&
      (term.startsWith(word) || word.startsWith(term)));
  }

  const workflowSources = {
    "lojistik/hat": ["GTFS · Tarife ve gerçek zamanlı veri", "https://gtfs.org/documentation/overview/"],
    "finans/fatura": ["GİB · e-Arşiv Fatura", "https://cdn.gib.gov.tr/api/gibportal-file/file/getFileResources?objectKey=arsiv%2Fyardim-kaynaklar%2Finfografikler%2Fpdfs%2Fe_arsiv_fatura.pdf"],
    "finans/abonelik": ["Stripe · Abonelik ve faturalama", "https://docs.stripe.com/billing"],
    "kamu/ihale": ["Open Contracting · İhale veri standardı", "https://standard.open-contracting.org/latest/en/"],
    "cevre/atik": ["EPA · Atık teslim zincirinde elektronik kayıt", "https://www.epa.gov/e-manifest"],
    "imalat/isemri": ["Frappe · Üretim iş emirleri ve iş kartları", "https://docs.frappe.io/erpnext/manufacturing"],
  };

  const sectors = SKILL_SECTOR_DATA.map(([id, name, nace, sourceName, source, rows]) => ({
    id, name, nace, sourceName, source,
    workflows: rows.trim().split("\n").map(row => {
      const [slug, name, tags, inputs, states, check] = row.split("|");
      const flowId = id + "/" + slug;
      const [flowSourceName, flowSource] = workflowSources[flowId] || [sourceName, source];
      return {id:flowId, sector:id, name, aliases:tags.split(", "), inputs, states, check, sourceName:flowSourceName, source:flowSource};
    }),
  }));
  const sectorById = new Map(sectors.map(sector => [sector.id, sector]));
  const workflows = sectors.flatMap(sector => sector.workflows);
  const workflowById = new Map(workflows.map(flow => [flow.id, flow]));
  const featured = ["salon/randevu","satis/magaza","yeme/adisyon","saglik/randevu","egitim/yoklama","lojistik/sevkiyat"];
  const defaultPlans = [...featured.map(id => workflowById.get(id)), ...workflows.filter(flow => !featured.includes(flow.id))];
  const workflowIndex = new Map(workflows.map(flow => [flow.id, {
    phrases: [flow.name, ...flow.aliases, ...sectorById.get(flow.sector).name.split(/, | ve /)].map(normalize),
    title: tokens(flow.name),
    words: tokens([flow.name, ...flow.aliases, sectorById.get(flow.sector).name, flow.inputs].join(" ")),
  }]));

  function relevance(flow, query, normalizedQuery) {
    const {phrases, title, words} = workflowIndex.get(flow.id);
    const hits = query.filter(term => words.some(word => tokenMatches(term, word)));
    const exact = phrases.includes(normalizedQuery) ? 12 : 0;
    return exact + hits.length * 4 + hits.filter(term => title.some(word => tokenMatches(term, word))).length * 2 -
      (query.length - hits.length) * 3;
  }

  function findWorkflows(query, sector = "") {
    const terms = tokens(query);
    const norm = normalize(query);
    const filtered = sector ? workflows.filter(flow => flow.sector === sector) : workflows;
    if (!norm) return filtered;
    if (!terms.length) return [];
    return filtered.map(flow => [flow, relevance(flow, terms, norm)]).filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1]).map(([flow]) => flow);
  }

  const skills = workflows.flatMap(flow => stages.flatMap(stage => stage.tasks.map(task => ({
    id: flow.id + "/" + stage.id + "/" + task[0],
    workflow: flow.id, sector: flow.sector, stage: stage.id, n: task[1],
    d: task[3], instruction: task[2],
  }))));
  const bySkill = new Map(skills.map(skill => [skill.id, skill]));
  const skillsByWorkflow = new Map(workflows.map(flow => [flow.id, []]));
  for (const skill of skills) skillsByWorkflow.get(skill.workflow).push(skill);
  const skillIndex = new Map(skills.map(skill => [skill.id, tokens([skill.n, skill.d, ...workflowIndex.get(skill.workflow).words].join(" "))]));

  function matchesSkill(skill, query) {
    return query.every(term => skillIndex.get(skill.id).some(word => tokenMatches(term, word)));
  }

  function flowContext(flow) {
    return `“${flow.name}”. Kayıtlar ve alanlar ${flow.inputs}. İş akışı ${flow.states}. Kabul koşulu: ${flow.check}`;
  }

  function skillPrompt(skill) {
    const flow = workflowById.get(skill.workflow);
    return `${flowContext(flow)} Görev: ${skill.n}. ${skill.instruction} Çıktı kontrolü: ${skill.d}`;
  }

  function planPrompt(flow, stage) {
    const heading = `Bu uygulamayı Stüdyo’da adım adım geliştir. ${flowContext(flow)}`;
    const steps = stage
      ? `Şu aşamaya odaklan: ${stage.name}.\n` + stage.tasks.map(task => "- " + task[2]).join("\n")
      : "Kurulum sırası:\n" + stages.map(step => `- ${step.name} · ${step.tasks.map(task => task[1]).join(", ")}.`).join("\n") +
        "\nİlk olarak kapsam, roller ve kayıt modelini netleştir. İlk çalışan sürümü örnek verilerle oluştur ve kalan adımları somut bir kontrol listesi olarak bırak.";
    return [heading, steps, "Açık bir uygulama varsa sayfalarını ve verisini koru. Gerçek bağlantı gerektiren işlemler için deneme akışını belirt. Sonunda çalışan kısmı, kabul kontrolünü ve bir sonraki işi açıkla."].join("\n");
  }

  function assistantPrompt(flow, stage) {
    const focus = stage ? "Sıradaki aşama “" + stage.name + "”. " : "";
    return [
      "Bu uygulamayı kurmam için sohbet içinde bana rehberlik et.",
      flowContext(flow),
      focus + "Önce kullanıcılar, mevcut uygulama ve gereken bağlantılar için en fazla üç soru sor. Yanıtları aldıktan sonra uygulanabilir sırayı, ilk çıktıyı ve kabul kontrolünü öner.",
    ].join("\n");
  }

  function activeGuidance(ids, request, budget) {
    const candidates = ids.map(id => bySkill.get(id)).filter(Boolean);
    if (!candidates.length) return "";
    // A selected workflow's specific terms must be present before injecting its instructions into another request.
    const terms = tokens(request);
    if (!terms.length) return "";
    const context = normalize(request);
    const relevant = candidates.map(skill => {
      const flow = workflowById.get(skill.workflow);
      const index = workflowIndex.get(flow.id);
      const title = normalize(flow.name);
      const explicit = context.includes(title) || flow.aliases.some(alias => {
        const phrase = normalize(alias);
        return phrase.includes(" ") && context.includes(phrase);
      });
      const matching = terms.filter(term => index.words.some(word => tokenMatches(term, word)));
      const taskHits = tokens(skill.n).filter(word => terms.some(term => tokenMatches(term, word))).length;
      return {skill, score:(explicit ? 20 : 0) + matching.length + taskHits, relevant:explicit || matching.length >= 2};
    }).filter(item => item.relevant).sort((a,b) => b.score - a.score);

    const lines = [];
    let remaining = budget;
    for (const {skill} of relevant) {
      const line = skillPrompt(skill);
      if (line.length + 1 > remaining) continue;
      lines.push(line);
      remaining -= line.length + 1;
      if (lines.length === 2) break;
    }
    return lines.join("\n");
  }

  return {stages, sectors, sectorById, workflows, workflowById, featured, defaultPlans, skills, bySkill, skillsByWorkflow,
    normalize, tokens, matchesSkill, findWorkflows, skillPrompt, planPrompt, assistantPrompt, activeGuidance};
})();

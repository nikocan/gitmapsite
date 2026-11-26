"""Sources for the interactive sector templates. Run from the repository root."""
from html import escape
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[2]
TEMPLATES = [
    dict(id="mimari", name="Mihenk Mimarlık", sector="Mimarlık & İç Mekân", icon="🏡", brand="#513f33", accent="#be946c", hero="İyi bir mekân, doğru soruyla başlar.", desc="Mimari hizmetleri inceleyin, proje alanını girin ve başlangıç bütçesiyle birlikte bir görüşme isteyin.", mode="quote", subject="Portföy ve hizmetler", quantity="Proje alanı (m²)", min=15, max=2000, value=90, action="Proje görüşmesi iste", options=[("İç mekân tasarımı","Konut ve ticari mekân konsepti · m²",440),("Uygulama projesi","Malzeme, çizim ve uygulama planı · m²",680),("Yerinde danışmanlık","Mevcut mekânı değerlendirme · m²",200)], use="Mimarlık ve iç mimarlık ofislerinde portföy sunumu ve ön teklif toplama", adapt="Portföy projelerinizi ve metrekare ücretlerinizi girin. Formu görüşme takviminize bağlayabilirsiniz."),
    dict(id="cicek", name="Mimoza Çiçek Evi", sector="Çiçekçilik & Hediyelik", icon="🌿", brand="#572d3e", accent="#cf8d9f", hero="Bir güne renk katın.", desc="Mevsim aranjmanlarını seçin, teslim tarihini belirleyin ve örnek siparişinizi oluşturun.", mode="order", subject="Çiçek koleksiyonu", quantity="Aranjman adedi", min=1, max=12, value=1, action="Siparişi kaydet", options=[("Gül & Şakayık","Pastel aranjman",1450),("Mevsim Demeti","Atölyenin mevsim seçkisi",900),("Beyaz Bahçe","Beyaz çiçekler ve okaliptüs",1250)], use="Çiçekçi, hediye atölyesi ve etkinlik floristi için ürün kataloğu ve sipariş toplama", adapt="Koleksiyonu, teslimat bölgelerini ve ürün fiyatlarını kendi mağazanıza göre uyarlayın."),
    dict(id="pilates", name="Forme Pilates", sector="Spor & Wellness", icon="♥", brand="#474f39", accent="#a9ab81", hero="Hareket için sakin bir alan.", desc="Ders türünü seçin, uygun seansı görün ve stüdyo için deneme rezervasyonu oluşturun.", mode="booking", subject="Dersler", quantity="Katılımcı sayısı", min=1, max=4, value=1, action="Seansı ayır", options=[("Reformer grup","4 kişilik grup · 50 dk",750),("Özel seans","Bire bir · 50 dk",1550),("Başlangıç mat dersi","Temel hareketler · 45 dk",490)], use="Pilates, yoga ve butik spor stüdyolarında ders tanıtımı ve seans rezervasyonu", adapt="Ders saatlerini, seans ücretlerini ve eğitmenlerinizi ekleyin."),
    dict(id="etkinlik", name="Avra Davet", sector="Etkinlik & Organizasyon", icon="✨", brand="#44302a", accent="#ce9e70", hero="Birlikte hatırlanacak bir akşam.", desc="Mekân paketlerini karşılaştırın, konuk sayısına göre bütçeyi hesaplayın ve teklif isteyin.", mode="quote", subject="Mekân paketleri", quantity="Konuk sayısı", min=10, max=300, value=60, action="Etkinlik teklifi iste", options=[("Avlu Akşamı","Açık hava yemek düzeni · kişi başı",1750),("Salon Daveti","Oturmalı davet · kişi başı",2300),("Atölye Günü","Kurumsal ekip buluşması · kişi başı",950)], use="Davet mekânı, organizasyon ajansı ve kurumsal etkinlik ekipleri için bütçe tahmini ve teklif toplama", adapt="Mekân kapasitesini, kişi başı fiyatları ve etkinlik paketlerini güncelleyin."),
    dict(id="detaygaraj", name="Atlas Detay Garajı", sector="Otomotiv & Detailing", icon="🔧", brand="#273440", accent="#8aacc6", hero="Aracınıza yakından bakarız.", desc="Araç bakım paketini seçin, servis süresini görün ve örnek randevu açın.", mode="booking", subject="Bakım paketleri", quantity="Araç sayısı", min=1, max=3, value=1, action="Servis randevusu oluştur", options=[("Dış Detay","Boya temizliği ve koruma · 2 saat",2300),("İç Detay","Koltuk, halı ve yüzeyler · 2 saat",2750),("Seramik Koruma","Yüzey hazırlığı ve kaplama · tam gün",9500)], use="Oto bakım garajı, kaplama atölyesi ve premium araç yıkama işletmelerinde servis randevusu", adapt="Servis seçeneklerini, servis süresini ve araç kabul saatlerini düzenleyin."),
    dict(id="kavurma", name="Kavun Kahve", sector="Kahve Kavurma & Gurme", icon="☕", brand="#4b382d", accent="#c29070", hero="Her fincanın bir kökeni var.", desc="Kavrumları karşılaştırın, paket adedini seçin ve mağazadan teslim siparişi oluşturun.", mode="order", subject="Kavrum seçkisi", quantity="Paket adedi", min=1, max=20, value=2, action="Kahve siparişi oluştur", options=[("Etiyopya Sidamo","Yasemin, bergamot · 250 g",465),("Kolombiya Huila","Karamel, kırmızı elma · 250 g",425),("Ev Harmanı","Kakao, fındık · 250 g",380)], use="Kahve kavurucuları, butik şarküteriler ve yerel gurme markalarında ürün keşfi ve teslim alma siparişi", adapt="Kökenleri, gramajları, tadım notlarını ve teslim alma koşullarını ekleyin."),
    dict(id="patik", name="Patik Veteriner", sector="Veteriner & Evcil Hayvan", icon="🩺", brand="#2f4d46", accent="#8cad93", hero="Küçük dostlara özenli bakım.", desc="Ziyaret türünü ve saati seçin, örnek bir evcil hayvan randevusu oluşturun.", mode="booking", subject="Ziyaret türleri", quantity="Evcil hayvan sayısı", min=1, max=3, value=1, action="Ziyaret talebi oluştur", options=[("Genel kontrol","Muayene randevusu · 30 dk",950),("Aşı ziyareti","Ön değerlendirme · 20 dk",800),("Ağız ve diş kontrolü","Ağız sağlığı değerlendirmesi · 30 dk",1250)], use="Veteriner kliniği ve evcil hayvan bakım merkezlerinde hizmet tanıtımı ve randevu talebi", adapt="Hizmetleri ve ajanda saatlerini kendi kliniğinize göre düzenleyin."),
    dict(id="fotostudyo", name="Lento Fotoğraf", sector="Fotoğraf & Prodüksiyon", icon="🎬", brand="#443655", accent="#ad95c5", hero="Dönüp bakmak isteyeceğiniz kareler.", desc="Çekim türünü seçin, seans adedine göre bütçe görün ve stüdyo talebi bırakın.", mode="quote", subject="Çekim paketleri", quantity="Seans adedi", min=1, max=10, value=1, action="Çekim teklifi iste", options=[("Stüdyo portresi","Tek kişilik stüdyo çekimi",2400),("Marka prodüksiyonu","Ürün ve yaşam stili çekimi",6250),("Aile portresi","3–5 kişilik grup çekimi",3900)], use="Fotoğraf, video ve içerik prodüksiyon stüdyolarında paket tanıtımı ve çekim teklifi toplama", adapt="Portföyünüzü, teslim sürelerinizi ve çekim paketlerinizi kendi stüdyonuza göre ekleyin."),
]

STYLE = """
:root{--pr:@brand@;--ac:@accent@;--bg:#f5f0e9;--sf:#fffbf6;--panel:var(--sf);--sf2:#ebe4da;--tx:#211c19;--tx2:#514a41;--ln:#d4c9bd;color:var(--tx);background:var(--bg);font-family:system-ui,sans-serif}
*{box-sizing:border-box}body{margin:0;line-height:1.55}a{color:inherit}button,input,select{font:inherit}h1,h2,h3,p{margin:0}section[id],form[id]{scroll-margin-top:15px}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #556bdd;outline-offset:3px}
header,main,footer{width:min(calc(100% - 48px),1250px);margin-inline:auto}header{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:18px}
header strong{font:500 clamp(21px,3vw,27px) Georgia,serif;line-height:1.1}header nav{display:flex;gap:20px;align-items:center}header a{text-decoration:none;font-size:14px}
.hero{display:grid;grid-template-columns:1fr 1.05fr;min-height:430px;background:var(--pr);color:white}
.hero-copy{padding:clamp(30px,5vw,72px);align-self:center;min-width:0}.sector{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#fff;font-weight:650}
.hero h1{font:500 clamp(39px,5.4vw,77px)/.98 Georgia,serif;letter-spacing:-.052em;margin:12px 0 18px;text-wrap:balance}.hero p{max-width:46ch;line-height:1.5;color:white;opacity:.91}
.hero a{display:inline-flex;margin-top:24px;padding:12px 17px;background:var(--sf);color:var(--tx);font-weight:700;text-decoration:none}
.hero-art{min-height:100%;background:var(--pr) url("./art/@id@.webp") center/cover no-repeat}
.workflow{display:grid;grid-template-columns:1.15fr 1fr;align-items:start;gap:clamp(18px,4vw,50px);padding-block:clamp(32px,5vw,66px)}
h2{font:500 clamp(25px,3.3vw,42px)/1.05 Georgia,serif;letter-spacing:-.03em;margin-bottom:14px}
article h3{font-size:16px}.offers{display:grid;gap:7px}.offer{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;width:100%;text-align:left;padding:14px;border:1px solid var(--ln);background:var(--sf);color:var(--tx);cursor:pointer}
.offer[aria-pressed=true]{box-shadow:inset 4px 0 var(--pr);border-color:var(--pr)}.offer strong,.offer small{display:block}.offer small,.totals small,.muted{color:var(--tx2)}
form,.history{background:var(--sf);border:1px solid var(--ln);padding:clamp(16px,3vw,27px)}label{display:grid;gap:4px;font-size:14px;font-weight:650}
input,select{width:100%;min-width:0;min-height:43px;border:1px solid var(--ln);padding:8px;background:var(--bg);color:var(--tx);border-radius:3px}
.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.fields .full{grid-column:1/-1}.totals{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:14px 0;padding:12px;background:var(--sf2);font-size:14px}.totals output{font-weight:800}
button[type=submit]{width:100%;min-height:45px;background:var(--pr);color:white;border:0;font-weight:700;cursor:pointer}
.history ul{padding-left:21px}.history li{padding:6px 0;overflow-wrap:anywhere}.history p:last-child:not(:empty){margin-top:12px}
footer{padding-block:19px;font-size:13px;color:var(--tx2)}
@media(max-width:720px){header,main,footer{width:min(calc(100% - 28px),1250px)}header{min-height:58px}header nav{gap:9px}header nav a:first-child{display:none}.hero{display:flex;flex-direction:column;min-height:0}.hero-art{min-height:225px;order:-1}.hero-copy{align-self:stretch;padding:22px}.hero h1{font-size:clamp(36px,10vw,52px)}.workflow{grid-template-columns:1fr;padding-block:26px}.totals{margin:12px 0}}
@media(max-width:350px){.fields{grid-template-columns:1fr}.offer{grid-template-columns:1fr}}
"""

SCRIPT = """
const form=document.querySelector("#task"), list=document.querySelector("#records"), statusLine=document.querySelector("#status");
const key="gitmapp-@id@";
let rows=[];
try{rows=JSON.parse(localStorage.getItem(key)||"[]")||[]}catch{}
/* gitmapp-task-records */
const options=@options@, mode="@mode@", money=new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:0});
const chosen=form.elements.service, quantity=form.elements.quantity, day=form.elements.day, slot=form.elements.slot;
const total=document.querySelector("#total"), offerButtons=[...document.querySelectorAll(".offer")];
const slots=["09:00","10:30","13:00","14:30","16:00"];
const localDay=new Date();day.min=[localDay.getFullYear(),String(localDay.getMonth()+1).padStart(2,"0"),String(localDay.getDate()).padStart(2,"0")].join("-");
function render(){
 list.replaceChildren();document.querySelector("#empty").hidden=rows.length>0;
 for(const row of rows){const item=document.createElement("li");item.textContent=row.text;list.append(item)}
}
function update(){
 const selected=Number(chosen.value), option=options[selected], n=quantity.valueAsNumber;
 offerButtons.forEach((button,i)=>button.setAttribute("aria-pressed",String(selected===i)));
 total.value=option&&quantity.validity.valid&&Number.isFinite(n)?money.format(option[2]*n):"—";
 if(slot){
  const previous=slot.value;
  const available=slots.filter(time=>!rows.some(row=>row.day===day.value&&row.slot===time));
  slot.replaceChildren(new Option(!day.value?"Önce tarih seçin":available.length?"Saat seçin":"Bu tarihte boş saat yok",""),...(day.value?available.map(time=>new Option(time,time)):[]));
  slot.disabled=!day.value;
  if(available.includes(previous))slot.value=previous;
 }
}
for(const [i,button] of offerButtons.entries())button.addEventListener("click",()=>{chosen.value=String(i);update()});
form.addEventListener("input",update);
form.addEventListener("submit",event=>{
 event.preventDefault();
 if(!form.reportValidity())return;
 const name=form.elements.customer.value.trim();
 if(!name){statusLine.textContent="Lütfen bir ad girin.";form.elements.customer.focus();return}
 if(slot&&rows.some(row=>row.day===day.value&&row.slot===slot.value)){update();statusLine.textContent="Bu saat dolu. Lütfen farklı bir saat seçin.";return}
 const date=day.value.split("-").reverse().join(".");
 const summary=[name,options[Number(chosen.value)][0],date,slot?.value,total.value].filter(Boolean).join(" · ");
 rows=[{day:day.value,slot:slot?.value,text:summary},...rows].slice(0,100);
 try{localStorage.setItem(key,JSON.stringify(rows))}catch{}
 form.dispatchEvent(new Event("gitmapp-save"));
 form.reset();render();update();statusLine.textContent=mode==="booking"?"Deneme randevusu kaydedildi.":mode==="order"?"Deneme siparişi kaydedildi.":"Deneme teklif talebi kaydedildi.";
});
render();update();
"""

def build(t):
    e = escape
    money = lambda n: f"{n:,}".replace(",", ".") + " ₺"
    cards = "".join(
        f'<button type="button" class="offer" aria-pressed="false"><span><strong>{e(name)}</strong><small>{e(note)}</small></span><b>{money(price)}</b></button>'
        for name, note, price in t["options"]
    )
    select = "".join(f'<option value="{i}">{e(option[0])}</option>' for i, option in enumerate(t["options"]))
    timing = '<label>Saat<select name="slot" required disabled></select></label>' if t["mode"] == "booking" else ""
    date_label = {"booking":"Randevu tarihi","quote":"Hedef tarih","order":"Teslim tarihi"}[t["mode"]]
    css = STYLE.replace("@brand@",t["brand"]).replace("@accent@",t["accent"]).replace("@id@",t["id"])
    js = SCRIPT.replace("@id@",t["id"]).replace("@mode@",t["mode"]).replace("@options@",json.dumps(t["options"],ensure_ascii=False).replace("<","\\u003c"))
    return f"""<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(t["name"])}</title><meta name="description" content="{e(t["desc"],quote=True)}">
<!-- Gitmapp hazır şablonu · Demo veriler kurgusaldır -->
<style>{css}</style></head>
<body><header><strong>{e(t["name"])}</strong><nav aria-label="Sayfa menüsü"><a href="#services">{e(t["subject"])}</a><a href="#task">{e(t["action"])}</a></nav></header>
<main><section class="hero"><div class="hero-copy"><span class="sector">{e(t["sector"])}</span><h1>{e(t["hero"])}</h1><p>{e(t["desc"])}</p><a href="#task">{e(t["action"])}</a></div><div class="hero-art" aria-hidden="true"></div></section>
<section class="workflow"><article id="services"><h2>{e(t["subject"])}</h2><div class="offers">{cards}</div></article>
<form id="task"><h2>{e(t["action"])}</h2><div class="fields"><label class="full">Seçenek<select name="service" required>{select}</select></label><label>{e(t["quantity"])}<input name="quantity" type="number" min="{t["min"]}" max="{t["max"]}" value="{t["value"]}" required></label><label>{date_label}<input name="day" type="date" required></label>{timing}<label class="full">Ad<input name="customer" maxlength="80" required></label></div><div class="totals"><small>Örnek toplam</small><output id="total" aria-live="polite"></output></div><button type="submit">{e(t["action"])}</button></form></section>
<section class="history"><h2>Deneme kayıtları</h2><p class="muted" id="empty">Henüz kayıt yok.</p><ul id="records"></ul><p role="status" id="status"></p></section></main>
<footer>Örnek işlemler bu tarayıcıda saklanır.</footer><script>{js}</script></body></html>
"""

def write():
    catalog = []
    for t in TEMPLATES:
        (ROOT / "templates" / (t["id"]+".html")).write_text(build(t), encoding="utf-8")
        features = [t["subject"], "Anlık tutar hesabı", {"booking":"Müsait saat seçimi","quote":"Teklif talebi","order":"Teslim alma siparişi"}[t["mode"]]]
        catalog.append(dict(id=t["id"],name=t["name"],sector=t["sector"],desc=t["desc"],feat=features,pr=t["brand"],ac=t["accent"],type="site",kind="site",emoji=t["icon"],workflow=True,premium=True,use=[t["use"],t["adapt"]]))
    start, end = "/* premium-workflows:start */", "/* premium-workflows:end */"
    path = ROOT / "index.html"
    content = path.read_text(encoding="utf-8")
    first, rest = content.split(start, 1)
    _, last = rest.split(end, 1)
    entries = "".join(" "+json.dumps(item,ensure_ascii=False)+",\n" for item in catalog)
    path.write_text(first+start+"\n"+entries+end+last, encoding="utf-8")

if __name__ == "__main__":
    write()

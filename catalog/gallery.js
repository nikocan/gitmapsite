const CATALOG_ART = "templates/art/catalog/";
const featuredTemplates = ["forma","pilates","mimari","oracle-teshis","kavurma","etkinlik","gitsap","molaseans","detaygaraj","cicek","patik","fotostudyo","akisoperasyon"];
const sectorExample = {
 "yeme-icme":"kavurma",saglik:"klinik",guzellik:"percem",spor:"pilates",egitim:"derslik",
 perakende:"forma",turizm:"konak","insaat-emlak":"mimari",uretim:"gitsap",lojistik:"rota",
 otomotiv:"detaygaraj","finans-hukuk":"oracle-teshis","kamu-stk":"sira",tarim:"cicek",
 "enerji-teknik":"usta","etkinlik-medya":"fotostudyo",kurumsal:"akisoperasyon"
};
function GalleryCover({t,photograph=true}){
 if(photograph&&(!t.appearance||t.editorial)&&catalogTemplate(t.id))
  return html`<img class="gallery-cover" src=${CATALOG_ART+t.id+".webp"} loading="lazy" decoding="async" alt=${t.name+" · ürün sunumu"}/>`;
 return html`<${TplThumb} t=${t}/>`;
}
function GalleryTile({title,meta,description,art,preview,action,tag,cls="",features=[],label}){
 const anchor=useRef(null),popup=useRef(null),timer=useRef(null);
 const [position,setPosition]=useState(null);
 const cancel=()=>clearTimeout(timer.current);
 const dismiss=()=>{cancel();setPosition(null)};
 function reveal(){
  cancel();
  if(!matchMedia("(hover:hover) and (pointer:fine)").matches)return;
  timer.current=setTimeout(()=>{
   const rect=anchor.current?.getBoundingClientRect();
   if(!rect||document.querySelector("dialog:modal"))return;
   const width=Math.min(304,innerWidth-24),height=Math.min(330,innerHeight-24);
   const right=rect.right+6,left=rect.left-width-6;
   const x=right+width<=innerWidth-12?right:left>=12?left:Math.max(12,Math.min(rect.left,innerWidth-width-12));
   const y=x===right||x===left?rect.top:rect.bottom+height<innerHeight?rect.bottom+6:rect.top-height-6;
   setPosition({left:x,top:Math.max(12,Math.min(y,innerHeight-height-12)),width});
  },380);
 }
 const leave=()=>{cancel();timer.current=setTimeout(dismiss,160)};
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useEffect(()=>{
  if(!position)return;
  const outside=e=>{if(!anchor.current?.contains(e.target)&&!popup.current?.contains(e.target))dismiss()};
  const escape=e=>{if(e.key==="Escape")dismiss()};
  document.addEventListener("pointerdown",outside,true);document.addEventListener("keydown",escape);
  window.addEventListener("scroll",dismiss,true);window.addEventListener("resize",dismiss);
  return ()=>{document.removeEventListener("pointerdown",outside,true);document.removeEventListener("keydown",escape);window.removeEventListener("scroll",dismiss,true);window.removeEventListener("resize",dismiss)};
 },[position]);
 const open=()=>{dismiss();action()};
 return html`<button type="button" ref=${anchor} class=${"gallery-tile "+cls} onClick=${open}
  aria-label=${label||title+" · Ayrıntılar"} onMouseEnter=${reveal} onMouseLeave=${leave}
  onFocus=${e=>{if(e.currentTarget.matches(":focus-visible"))reveal()}} onBlur=${dismiss}>
  <span class="gallery-art">${art}${tag&&html`<span class="gallery-tag">${tag}</span>`}</span>
  <span class="gallery-caption"><b>${title}</b><small>${meta}</small></span>
 </button>${position&&ReactDOM.createPortal(html`<aside ref=${popup} class="gallery-peek" style=${position} aria-label=${title+" hızlı bakış"} onMouseEnter=${cancel} onMouseLeave=${leave}>
  <div class="peek-art">${preview||art}</div><div class="peek-copy"><b>${title}</b><p>${description||meta}</p>
  ${features.length>0&&html`<small>${features.slice(0,3).join(" · ")}</small>`}</div>
 </aside>`,document.body)}`;
}
function TemplateTile({t,onDemo,reason}){
 return html`<${GalleryTile} title=${t.name} meta=${reason||t.sector+" · "+TPL_TYPES[t.type]} description=${t.desc} features=${t.feat}
  cls="tpc" art=${html`<${GalleryCover} t=${t}/>`} preview=${html`<${TplThumb} t=${t}/>`} action=${()=>onDemo({...t,showDetails:true})}/>`;
}
function CollectionNav({page,go}){
 const entries=[["magaza","Keşfet"],["sablonlar","Şablonlar"],["baglantilar","Eklentiler"],["bagdastiricilar","Bağdaştırıcılar"],["beceriler","Beceriler"],["muhendis","Oracle ve SAP"]];
 return html`<nav class="collection-nav" aria-label="Koleksiyonlar">${entries.map(([id,name])=>html`<button type="button" key=${id} aria-current=${page===id?"page":undefined} onClick=${()=>go(id)}>${name}</button>`)}</nav>`;
}
function CollectionHero({title,copy,image,caption,action,cta}){
 return html`<header class="collection-hero"><div><h1>${title}</h1><p>${copy}</p>${action&&html`<button type="button" class="hero-action" onClick=${action}>${cta}</button>`}</div>
 <figure><img src=${CATALOG_ART+image+".webp"} alt=${caption} fetchpriority="high"/></figure></header>`;
}
function ConnectorArt({c,adapter}){
 const src=CATALOG_ART+(adapter&&adapter!=="github"?"adapter-"+adapter:"conn-"+c.id)+".webp";
 return html`<img class="gallery-cover" loading="lazy" decoding="async" alt="" src=${src}/>`;
}
const accountAdapters=[
 ["github","GitHub","Depolar, dallar ve sürüm geçmişi","github"],["google","Google","Hesapla giriş ve kimlik doğrulama","calendar"],
 ["hostinger","Hostinger","Alan adı ve barındırma hizmetleri","gmdb"],["higgsfield","Higgsfield","Görsel ve video üretimi","youtube"],
 ["canva","Canva","Tasarımları açma ve düzenleme","instagram"]
];
function AdapterLibrary({go,auth,openSession}){
 const [selected,setSelected]=useState(null),[custom,setCustom]=useState(null),[saved,setSaved]=useState(connState);
 const extras=Object.entries(saved).filter(([id])=>id.startsWith("custom:")||id.startsWith("mcp:"));
 function save(id,value){const next={...connState()};if(value)next[id]=value;else delete next[id];LS.set("conns",next);setSaved(next);dispatchEvent(new Event("gm:conns"));setCustom(null)}
 return html`<div class="explore gallery-page"><${CollectionNav} page="bagdastiricilar" go=${go}/>
 <${CollectionHero} title="Bağdaştırıcılar" copy="Çalışma alanına hesaplarını, kendi API’lerini ve MCP sunucularını bağla." image="connectors" caption="Bağdaştırıcı çalışma alanı"/>
 <h2>Hesap bağlantıları</h2><div class="gallery-grid">${accountAdapters.map(entry=>{const [id,name,desc,scene]=entry,c=CONN.find(x=>x.id===scene);return html`<${GalleryTile} key=${id} title=${name} meta=${desc} description=${desc} art=${html`<${ConnectorArt} c=${c} adapter=${id}/>`} tag=${auth.user?.[id]?"Bağlı":""} action=${()=>setSelected(entry)}/>`})}</div>
 <h2>Özel bağlantılar</h2><div class="adapter-actions">${[["custom","Özel API ekle"],["mcp","MCP sunucusu ekle"],["reg","MCP kayıt defteri ekle"]].map(([k,n])=>html`<button type="button" key=${k} class="btn g s" onClick=${()=>setCustom(k)}>${n}</button>`)}</div>
 ${extras.map(([key,v])=>html`<button type="button" class="adapter-row" key=${key} onClick=${()=>setCustom({edit:key,...v})}><img src=${CATALOG_ART+"conn-api.webp"} alt="" width="56" height="36"/><b>${v.name}</b><small>${v.url}</small></button>`)}
 ${selected&&html`<${UiDialog} label=${selected[1]} width="440px" close=${()=>setSelected(null)}><div class="adapter-dialog"><h2>${selected[1]}</h2><p>${selected[2]}</p><p>${auth.user?.[selected[0]]?"Hesabına bağlı.":"Henüz bağlı bir hesap yok."}</p><button class="btn" onClick=${()=>{setSelected(null);openSession(selected[0])}}>Oturumda bağlantıyı yönet</button><button type="button" class="btn g" onClick=${()=>setSelected(null)}>Kapat</button></div></${UiDialog}>`}
 ${custom&&html`<${CustomConn} kind=${custom.edit?(custom.kind||custom.edit.split(":")[0]):custom} v=${custom.edit?custom:null} close=${()=>setCustom(null)} onSave=${save}/>`}</div>`;
}

function SkillCover({skill}){
 const example=tplsForSkill(skill.id)[0]?.id||sectorExample[skill.sector];
 const family={Oracle:"oracle-teshis",GitSap:"gitsap",GitmappGT:"engineering",ERP:"gitsap",Otomasyon:"automation",SaaS:"connectors",Sektör:"discover"};
 const base=example||family[skill.group]||({tasarim:"mimari",kalite:"analytics",hizli:"automation",is:"plugins"}[skill.kind])||"skills";
 const module=skillParts(skill.body)["MODÜLLER"]?.split(",")[0];
 return html`<span class="skill-art"><img loading="lazy" decoding="async" alt="" src=${CATALOG_ART+base+".webp"}/>${module&&html`<span>${module}</span>`}</span>`;
}

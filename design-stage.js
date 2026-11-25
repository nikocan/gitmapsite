// Only the preview gets source indices. Project files keep their original attributes.
const Stage = (() => {
  const parse = source => new DOMParser().parseFromString(source, "text/html");
  const elements = doc => Array.from(doc.body.querySelectorAll("*"));
  const serialize = doc => Array.from(doc.childNodes, node =>
    node.nodeType === 1 ? node.outerHTML : new XMLSerializer().serializeToString(node)
  ).join("\n");
  // Generated templates build their UI after load. Reapply only overrides whose
  // structural selector and original label still match the rendered component.
  function applyRuntimeEdits() {
    const entries = JSON.parse(document.querySelector("script[data-gitmapp-edits]").textContent);
    const previous=new Map();
    function apply() {
      // A single heading can be reused by several screens. Restore its inline
      // styles as soon as its view or label no longer matches the saved edit.
      for(const [item,record] of previous){
        const {el,styles}=record;
        const sameView=!item.view || document.querySelector(".nv.on")?.dataset.v===item.view;
        const sameLabel=item.original==null || [item.original,item.patch.text].includes(el.textContent);
        if(el.isConnected && sameView && sameLabel)continue;
        for(const [key,[value,priority]] of Object.entries(styles))el.style.setProperty(key,value,priority);
        if(el.isConnected && item.patch.text!==undefined && el.textContent===item.patch.text)el.textContent=item.original;
        previous.delete(item);
      }
      for (const item of entries) {
        if (item.view && document.querySelector(".nv.on")?.dataset.v !== item.view) continue;
        let el;try{el=document.querySelector(item.selector)}catch{continue}
        if (!el || el.localName !== item.tag) continue;
        if (item.original != null && el.textContent !== item.original && el.textContent !== item.patch.text) continue;
        if(!previous.has(item)){
          const styles={};
          for(const key of Object.keys(item.patch.styles || {}))styles[key]=[el.style.getPropertyValue(key),el.style.getPropertyPriority(key)];
          previous.set(item,{el,styles});
        }
        for (const [key,value] of Object.entries(item.patch.styles || {})) {
          if (el.style.getPropertyValue(key)!==value || el.style.getPropertyPriority(key)!=="important") el.style.setProperty(key,value,"important");
        }
        if (item.patch.text!==undefined && !el.children.length && el.textContent!==item.patch.text) el.textContent=item.patch.text;
      }
    }
    let queued=false;
    const observer=new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(()=>{queued=false;apply()})}});
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
    apply();
  }
  function runtimeEdit(doc,pick,patch) {
    let data=doc.querySelector("script[data-gitmapp-edits]");
    if(!data){
      data=doc.createElement("script"); data.type="application/json"; data.dataset.gitmappEdits=""; data.textContent="[]"; doc.head.append(data);
      const runner=doc.createElement("script");runner.textContent="("+applyRuntimeEdits.toString()+")()";doc.head.append(runner);
    }
    const entries=JSON.parse(data.textContent);
    const item=entries.find(x=>x.selector===pick.selector && x.view===pick.view && (x.original===pick.original || x.patch.text===pick.original));
    if(item)item.patch={...item.patch,...patch,styles:{...item.patch.styles,...patch.styles}};
    else entries.push({selector:pick.selector,tag:pick.tag,original:pick.original,view:pick.view,patch});
    data.textContent=JSON.stringify(entries).replace(/</g,"\\u003c");
    return serialize(doc);
  }
  function picker(view) {
    let marked, active=true;
    if(view)document.addEventListener("DOMContentLoaded",()=>{
      active=false;
      try{Array.from(document.querySelectorAll(".nv[data-v]")).find(b=>b.dataset.v===view)?.click()}finally{active=true}
    });
    function selector(el) {
      const parts=[];
      while(el && el!==document.body) {
        if(el.id && document.querySelectorAll("#"+CSS.escape(el.id)).length===1) {parts.unshift("#"+CSS.escape(el.id));break}
        let part=el.localName;
        const stable=Array.from(el.attributes).find(a=>/^data-(?:v|open|new|go|id|sort)$/.test(a.name));
        if(stable)part+="["+stable.name+"="+CSS.escape(stable.value||" ")+"]";
        const siblings=el.parentElement?Array.from(el.parentElement.children):[];
        part+=":nth-child("+(siblings.indexOf(el)+1)+")";parts.unshift(part);el=el.parentElement;
      }
      return (el===document.body?"body > ":"")+parts.join(" > ");
    }
    document.addEventListener("click", event => {
      if(!active)return;
      const node = event.target.closest("svg") || event.target;
      if (!node || node===document.body || !document.body.contains(node)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (marked) marked.removeAttribute("data-gm-picked");
      marked = node;
      node.setAttribute("data-gm-picked", "");
      const css = getComputedStyle(node);
      const color = value => {
        const rgb = value.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
        return rgb ? "#" + rgb.slice(1).map(v => Number(v).toString(16).padStart(2,"0")).join("") : "";
      };
      const dynamic=!node.hasAttribute("data-gm-source");
      parent.postMessage({gm:"pick", index:dynamic?null:Number(node.dataset.gmSource), tag:node.localName,
        selector:dynamic?selector(node):null, view:dynamic && node.closest("#pg,#ttl")?document.querySelector(".nv.on")?.dataset.v||null:null,
        original:dynamic && !node.children.length?node.textContent.slice(0,4000):null,
        sample:dynamic?node.textContent.slice(0,320):"", children:node.children.length,
        color:color(css.color), background:color(css.backgroundColor),
        parent:node.parentElement.closest("[data-gm-source]")?.dataset.gmSource,
        activeView:document.querySelector(".nv.on")?.dataset.v || null
      }, "*");
    }, true);
    window.addEventListener("message", event => {
      if(event.source===parent && event.data?.gm==="navigate"){active=!event.data.on;if(marked)marked.removeAttribute("data-gm-picked");return}
      if (event.source !== parent || event.data?.gm !== "focus-source" || !Number.isInteger(event.data.index)) return;
      const node = document.querySelector('[data-gm-source="'+event.data.index+'"]');
      if (node) node.dispatchEvent(new MouseEvent("click", {bubbles:true,cancelable:true}));
    });
  }
  function preview(source,view) {
    const doc = parse(source);
    elements(doc).forEach((el,i) => el.setAttribute("data-gm-source", i));
    const style = doc.createElement("style");
    style.textContent = "[data-gm-source]:hover{cursor:crosshair!important}[data-gm-picked]{outline:2px solid #b4ca00!important;outline-offset:-2px}";
    doc.head.append(style);
    const script = doc.createElement("script");
    script.textContent = "(" + picker.toString() + ")(" + JSON.stringify(view||null).replace(/</g,"\\u003c") + ")";
    doc.head.prepend(script);
    return serialize(doc);
  }
  function target(doc, selection) {
    if (selection?.selector) {
      if(!/^[a-z][a-z0-9-]*$/.test(selection.tag))return null;
      const node = doc.createElementNS(selection.tag==="svg"?"http://www.w3.org/2000/svg":"http://www.w3.org/1999/xhtml",selection.tag);
      node.textContent=selection.original??selection.sample;
      if(selection.children)node.append(doc.createElement("span"));
      return node;
    }
    if (!Number.isInteger(selection?.index)) return null;
    const el = elements(doc)[selection.index];
    return el?.localName === selection.tag && !["script","style","template","link","meta"].includes(el.localName) ? el : null;
  }
  function edit(source, selection, patch) {
    const doc = parse(source), el = target(doc,selection);
    if (!el) throw Error("Seçim değişti. Öğeyi yeniden seçin.");
    if(selection.selector)return runtimeEdit(doc,selection,patch);
    if (patch.text !== undefined && !el.children.length) el.textContent = patch.text;
    for (const [property,value] of Object.entries(patch.styles || {})) el.style.setProperty(property,value,"important");
    return serialize(doc);
  }
  function theme(source,t,brand,accent,icons) {
    const doc = parse(source);
    let style = doc.querySelector("style[data-gitmapp-theme]");
    if (!style) { style = doc.createElement("style"); style.dataset.gitmappTheme=""; doc.head.append(style); }
    style.dataset.voice = brand;
    style.dataset.accent = accent;
    style.dataset.icons = icons;
    style.dataset.theme = t.id;
    style.textContent = `:root{--pr:${accent}!important;--ac:${t.p.ac}!important;--bg:${t.p.bg}!important;--sf:${t.p.sf}!important;--tx:${t.p.tx}!important;--r:${t.r}px!important;--font:"${t.font}",system-ui!important}body{background:${t.bgCss||t.p.bg};color:${t.p.tx};font-family:var(--font),sans-serif}button:not([class]),.btn{border-radius:var(--r)}svg[stroke]:not([fill="currentColor"]){stroke-width:${icons==="fine"?1.25:icons==="bold"?2.5:1.8};stroke-linecap:round;stroke-linejoin:round}`;
    return serialize(doc);
  }
  return {parse,preview,target,edit,theme};
})();

function StageInspector({source,picked,commit,focusSource,ask,toast,download,stage,title,showSkills}) {
  const doc = React.useMemo(()=>Stage.parse(source),[source]);
  const node = Stage.target(doc,picked);
  const themeStyle = doc.querySelector("style[data-gitmapp-theme]");
  const [tab,setTab] = useState("element");
  const [theme,setTheme] = useState(themeStyle?.dataset.theme || "minimal");
  const [accent,setAccent] = useState(themeStyle?.dataset.accent || themeById(theme).p.pr);
  const [icons,setIcons] = useState(themeStyle?.dataset.icons || "regular");
  const [voice,setVoice] = useState(themeStyle?.dataset.voice || "");
  const pending = useRef(0);
  const [thinking,setThinking] = useState(false);
  useEffect(()=>{setThinking(false);return ()=>{pending.current++}},[source,picked]);
  async function suggest() {
    const id = ++pending.current;
    setThinking(true);
    try {
      const proposal = await ask(request,node,themeStyle?.dataset.voice || "");
      if (pending.current === id) {setPatch(proposal);toast("Öneriyi kontrol edip uygulayın")}
    } catch(e) {if(pending.current === id)toast(e.message)}
    finally {if(pending.current === id)setThinking(false)}
  }
  const [request,setRequest] = useState("");
  const [file,setFile] = useState("");
  const [patch,setPatch] = useState({});
  useEffect(()=>{setPatch({});setRequest("");if(picked)setTab("element")},[picked,source]);
  useEffect(()=>{setTheme(themeStyle?.dataset.theme || "minimal");setVoice(themeStyle?.dataset.voice || "");setAccent(themeStyle?.dataset.accent||themeById(themeStyle?.dataset.theme||"minimal").p.pr);setIcons(themeStyle?.dataset.icons||"regular")},[source]);
  const field=(name,value)=>setPatch(p=>({...p,styles:{...p.styles,[name]:value}}));
  const apply=()=>{try{commit(Stage.edit(source,picked,patch))}catch(e){toast(e.message)}};
  const select=(label,property,choices)=>html`<label>${label}<select value=${patch.styles?.[property]||""} onChange=${e=>field(property,e.target.value)}><option value="" disabled>Seçin</option>${choices.map(([v,n])=>html`<option key=${v} value=${v}>${n}</option>`)}</select></label>`;
  async function handoff() {
    if(file.trim() && !/^https:\/\/(?:www\.)?figma\.com\/(?:design|file)\/[\w-]+(?:[/?#]|$)/.test(file.trim())) {toast("Figma tasarım dosyasının bağlantısını girin");return}
    try {
      await navigator.clipboard.writeText(`Eklediğim index.html dosyasını yerel sunucuda aç. Figma MCP ile ${stage==="phone"?"telefon":stage==="tablet"?"tablet":"masaüstü"} görünümünü düzenlenebilir katmanlar olarak ${file.trim()||"yeni bir Figma Design dosyasına"} aktar. Proje: ${title||"Adsız proje"}. Tamamlanınca dosya bağlantısını paylaş.`);
      download();toast("İstem kopyalandı. İstemcide HTML dosyasını ekleyin.");
    } catch {toast("Panoya erişilemedi. HTML dosyasını ayrıca indirebilirsiniz.")}
  }
  return html`<aside class="stage-tools" aria-label="Tasarım özellikleri"><div class="stage-tabs">${[["element","Öğe"],["brand","Marka"],["figma","Figma"]].map(([k,n])=>html`<button key=${k} aria-pressed=${tab===k} onClick=${()=>setTab(k)}>${n}</button>`)}</div>
    ${tab==="element" ? (!node ? html`<p>Düzenlemek istediğiniz öğeye dokunun.</p>` : html`<div class="stage-fields">
      <div class="stage-line"><b>${"<"+node.localName+">"}</b>${picked.parent!=null&&html`<button onClick=${()=>focusSource(Number(picked.parent))}>Üst kapsayıcı ↑</button>`}</div>
      ${!node.children.length && node.namespaceURI==="http://www.w3.org/1999/xhtml" && !["input","img","br","hr"].includes(node.localName) && html`<label>Metin<input maxLength="4000" value=${patch.text??node.textContent} onInput=${e=>setPatch(p=>({...p,text:e.target.value}))}/></label>`}
      <div class="stage-pair">${[["color","Yazı",picked.color],["background-color","Dolgu",picked.background]].map(([k,n,v])=>html`<label key=${k}>${n}<input type="color" value=${patch.styles?.[k]||v||"#ffffff"} onInput=${e=>field(k,e.target.value)}/></label>`)}</div>
      <div class="stage-pair">${select("Köşe","border-radius",[["0","Düz"],["8px","8 px"],["16px","16 px"],["999px","Kapsül"]])}${select("İç boşluk","padding",[["4px","4 px"],["8px","8 px"],["16px","16 px"],["24px","24 px"]])}</div>
      ${node.children.length>0 && html`<label>Öğe yerleşimi<select value=${patch.styles?.["flex-direction"]||""} onChange=${e=>{field("display","flex");field("flex-direction",e.target.value)}}><option disabled value="">Seçin</option><option value="row">Yatay sıra</option><option value="column">Dikey sütun</option></select></label>`}
      ${node.closest("svg") && select("İkon çizgisi","stroke-width",[["1","İnce"],["2","Normal"],["3","Kalın"]])}
      ${Object.keys(patch.styles||{}).length>0 && html`<small>${Object.entries(patch.styles).map(([k,v])=>k+" "+v).join(" · ")}</small>`}
      <button class="primary" disabled=${!Object.keys(patch).length} onClick=${apply}>Değişiklikleri uygula</button>
      <label>Seçimi yapay zekâyla düzenle<input maxLength="1000" placeholder="Örn. düğmeyi daha belirgin yap" value=${request} onInput=${e=>setRequest(e.target.value)}/></label>
      <button disabled=${!request.trim()||thinking} onClick=${suggest}>${thinking?"Öneri hazırlanıyor…":"Yapay zekâ önerisi al"}</button></div>`)
    :tab==="brand"?html`<div class="stage-fields"><label>Tema<select value=${theme} onChange=${e=>{setTheme(e.target.value);setAccent(themeById(e.target.value).p.pr)}}>${THEMES.map(t=>html`<option key=${t.id} value=${t.id}>${t.name}</option>`)}</select></label><div class="stage-palette">${Object.values(themeById(theme).p).map((c,i)=>html`<i key=${i} style=${{background:c}} title=${c}></i>`)}</div>
      <div class="stage-pair"><label>Marka rengi<input type="color" value=${accent} onInput=${e=>setAccent(e.target.value)}/></label><label>İkon stili<select value=${icons} onChange=${e=>setIcons(e.target.value)}><option value="fine">İnce</option><option value="regular">Normal</option><option value="bold">Kalın</option></select></label></div>
      <label>Marka dili<input maxLength="180" value=${voice} placeholder="Örn. yalın, sıcak ve güven veren" onInput=${e=>setVoice(e.target.value)}/></label>
      <button class="primary" onClick=${()=>commit(Stage.theme(source,themeById(theme),voice,accent,icons))}>Projeye uygula</button><button onClick=${showSkills}>Çalışma becerileri</button></div>`
    :html`<div class="stage-fields"><a href="https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/" target="_blank" rel="noopener">Figma MCP’yi bağla ↗</a><p>Cursor veya VS Code’da Figma hesabınızı bağlayın. İndirdiğiniz HTML dosyasını istemciye ekleyip aktarım istemini yapıştırın.</p><label>Hedef dosya (isteğe bağlı)<input type="url" value=${file} onInput=${e=>setFile(e.target.value)} placeholder="https://www.figma.com/design/…"/></label><button class="primary" onClick=${handoff}>HTML indir ve istemi kopyala</button><button onClick=${download}>HTML indir</button></div>`}
  </aside>`;
}

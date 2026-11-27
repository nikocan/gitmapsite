// Kept inline when a template is opened in Studio so the project remains a standalone HTML file.
const catalogTemplateTheme = `
<style data-catalog-theme>
#gm-template-mode{position:fixed;z-index:10001;right:12px;bottom:12px;width:auto;min-height:40px;padding:7px 12px;border:1px solid #8b978b;border-radius:999px;background:#fbfaf4;color:#202821;font:600 13px system-ui;cursor:pointer}
html[data-gm-mode=dark] #gm-template-mode{background:#242e28;color:#f0f4e9}
html[data-gm-mode=dark]{color-scheme:dark}
html[data-gm-mode=dark]:not([data-gm-native]){--paper:#121915;--ink:#f1f5e9;--pr:#aac599;--bg:#121915;--sf:#1e2822;--sf2:#27332c;--tx:#f1f5e9;--tx2:#d0dbcc;--tx3:#b9c7b9;--ln:#4e6052;background:#121915;color:#f1f5e9}
html[data-gm-mode=dark]:not([data-gm-native]) :is(body,header,footer,.nav,.history,.surface,form){background-color:#18211b;color:#f1f5e9}
html[data-gm-mode=dark]:not([data-gm-native]) :is(.surface,form,.history,input,select,textarea){border-color:#66786b}
html[data-gm-mode=dark]:not([data-gm-native]) :is(input,select,textarea){background:#27352d;color:#f1f5e9}
html[data-gm-mode=dark]:not([data-gm-native]) :is(.lead,small,footer,label){color:#d0dbcc}
html[data-gm-mode=dark]:not([data-gm-native]) :is(button,.btn){background:#c7dab8;color:#19251b}
</style>
<script data-catalog-mode>
(()=>{
 const root=document.documentElement,native=document.querySelector("#th");
 if(native)root.dataset.gmNative="";
 const preview=window.parent!==window && document.documentElement.hasAttribute("data-gm-preview");
 let saved;
 if(!preview)try{saved=localStorage.getItem("gm-template-mode:"+document.title)}catch{}
 const button=document.createElement("button");
 button.type="button";button.id="gm-template-mode";
 const setMode=mode=>{
  if(mode!=="light"&&mode!=="dark")return;
  root.dataset.gmMode=mode;
  if(native&&root.dataset.theme!==mode)native.click();
  const dark=mode==="dark";
  button.textContent=dark?"Açık görünüm":"Koyu görünüm";
  button.setAttribute("aria-pressed",String(dark));
 };
 setMode(saved||root.dataset.gmInitialMode||(native&&root.dataset.theme)||"light");
 if(!native&&!preview){
  document.body.append(button);
  button.onclick=()=>{
   setMode(root.dataset.gmMode==="dark"?"light":"dark");
   try{localStorage.setItem("gm-template-mode:"+document.title,root.dataset.gmMode)}catch{}
  };
 }
 if(preview)window.addEventListener("message",e=>{
  if(e.source===parent&&e.data?.type==="gitmapp-template-mode")setMode(e.data.mode);
 });
})();
</script>`;

function prepareCatalogTemplate(source,preview=false,mode){
 if(source.includes("data-catalog-theme"))return source;
 const attributes=(preview?' data-gm-preview':'')+(["light","dark"].includes(mode)?' data-gm-initial-mode="'+mode+'"':'');
 const html=attributes?source.replace(/<html\b/i,"<html"+attributes):source;
 const end=html.toLowerCase().lastIndexOf("</body>");
 return end<0?html+catalogTemplateTheme:html.slice(0,end)+catalogTemplateTheme+html.slice(end);
}

function templatePreviewStorage(key, scope, initial) {
 return '<script data-gm-template-storage>(' + function(key, scope, initial) {
  if (typeof initial === "string") localStorage.setItem(key, initial);
  const set = localStorage.setItem.bind(localStorage);
  const remove = localStorage.removeItem.bind(localStorage);
  const clear = localStorage.clear.bind(localStorage);
  const notify = value => parent.postMessage({gm:"template-storage",scope,key,value},"*");
  localStorage.setItem = (name,value) => {
   set(name,value);
   if (name === key) notify(String(value));
  };
  localStorage.removeItem = name => {
   remove(name);
   if (name === key) notify(null);
  };
  localStorage.clear = () => { clear(); notify(null); };
 }.toString() + ')(' + JSON.stringify(key) + ',' + JSON.stringify(scope).replaceAll("<","\\u003c") +
 ',' + JSON.stringify(initial).replaceAll("<","\\u003c") + ');<\/script>';
}

// Run a standalone app in an isolated preview and inspect the DOM after load.
function gtTestHtml(source){
 return new Promise((resolve,reject)=>{
  const frame=document.createElement("iframe");
  frame.hidden=true;frame.sandbox="allow-scripts";
  const id=crypto.randomUUID();
  const finish=(fn,result)=>{clearTimeout(timer);removeEventListener("message",receive);frame.remove();fn(result)};
  const receive=e=>{
   if(e.source===frame.contentWindow&&e.data?.id===id&&Array.isArray(e.data.tests))
    finish(resolve,e.data.tests.slice(0,4).map(x=>({name:String(x.name).slice(0,80),pass:x.pass===true})));
  };
  const timer=setTimeout(()=>finish(reject,new Error("Önizleme testi zaman aşımına uğradı.")),6000);
  addEventListener("message",receive);
  const probe='<script>(()=>{let errors=0;addEventListener("error",()=>errors++,true);addEventListener("unhandledrejection",()=>errors++);addEventListener("load",()=>setTimeout(()=>parent.postMessage({id:'+JSON.stringify(id)+',tests:[{name:"Sayfa başlığı",pass:!!document.title.trim()},{name:"Görünür sayfa içeriği",pass:!!document.body?.innerText.trim()},{name:"Başlangıç hatası yok",pass:errors===0}]},"*"),200))})();<\/script>';
  const policy='<meta http-equiv="Content-Security-Policy" content="default-src '+ "'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'"+'">';
  const head=/<head(?:\s[^>]*)?>/i;
  frame.srcdoc=head.test(source)?source.replace(head,m=>m+policy+probe):policy+probe+source;
  document.body.append(frame);
 });
}
const gtSectorProjects = [
 {name:"Sigorta", flow:"Hasar ihbarı, poliçe kontrolü, eksper ataması ve ödeme mutabakatı"},
 {name:"Üretim", flow:"Satın alma talebi, sipariş, mal kabul ve fatura eşleştirme"},
 {name:"Perakende", flow:"Sipariş, stok rezervasyonu, sevkiyat ve iade"}
];
function gtSectorQuestion(project){
 return project.flow+" için holding şirketleri arasında yürütülebilecek bir geliştirme planı hazırla. Yüklenen proje bağlamındaki kanıtları belirt, eksik entegrasyonları açık soru olarak kaydet. Her aşamada sorumlu rolü, şirket bazlı veri erişimini, önkoşulları ve paralel ilerleyebilecek işleri göster. Veri modeli, API, arayüz ve entegrasyon görevlerine ayrı kabul testleri ata. Yinelenen olay ve kesinti sonrası devam senaryolarını ekle.";
}
function GitmappGT({request,onAlerts,appId,aiBody,source,errors,busy,buildGT,openEngineering}){
 const [open,setOpen]=useState(false),[enabled,setEnabled]=useState(false);
 const [ctx,setCtx]=useState(null),[rev,setRev]=useState(0),[question,setQuestion]=useState(""),[reply,setReply]=useState("");
 const [status,setStatus]=useState(""),[job,setJob]=useState(false),[tests,setTests]=useState([]),[voice,setVoice]=useState(false);
 const [note,setNote]=useState("");
 const mounted=useRef(true),serial=useRef(0),version=useRef(-1),speech=useRef(null),dialog=useRef(null);
 useEffect(()=>()=>{mounted.current=false;serial.current++;speech.current?.abort();if(window.speechSynthesis&&speechSynthesis.speaking)speechSynthesis.cancel()},[]);
 useEffect(()=>{if(open){dialog.current?.showModal()}},[open]);
 function update(snapshot,revision){
  serial.current++;setJob(false);setCtx(snapshot);setRev(revision);setReply("");setTests([]);
 }
 useEffect(()=>{
  if(!enabled||!appId)return;
  let active=true;
  async function poll(){try{
   const result=await api("GET","/api/apps/"+encodeURIComponent(appId)+"/gt");
   if(active&&result.revision>version.current){version.current=result.revision;update(result.snapshot,result.revision);setStatus("")}
  }catch(e){if(active)setStatus(e.message)}}
  poll();const timer=setInterval(poll,10000);
  return ()=>{active=false;clearInterval(timer)};
 },[enabled,appId]);
 const signals=(ctx?.signals||[]).filter(s=>s.count>0&&s.severity!=="info");
 const alerts=signals.length+errors.length;
 const seenRequest=useRef(request);
 useEffect(()=>{if(seenRequest.current!==request){seenRequest.current=request;setEnabled(true);setOpen(true)}},[request]);
 useEffect(()=>{onAlerts(alerts)},[alerts,onAlerts]);
 async function load(file){
  if(!file)return;
  try{
   if(file.size>64000)throw Error("Şema dosyası en fazla 64 KB olabilir.");
   const snapshot=gtSnapshot(JSON.parse(await file.text()));
   if(!mounted.current)return;
   if(appId){
    const r=await api("PUT","/api/apps/"+encodeURIComponent(appId)+"/gt",{revision:rev,snapshot});
    if(!mounted.current||r.revision<version.current)return;
    version.current=r.revision;update(r.snapshot,r.revision);
   }else update(snapshot,rev+1);
   setStatus("Bağlam yüklendi.");
  }catch(e){if(mounted.current)setStatus(e.message)}
 }
 function sample(){
  const a=document.createElement("a"),url=URL.createObjectURL(new Blob([JSON.stringify(GT_SAMPLE,null,2)],{type:"application/json"}));
  a.href=url;a.download="gt-ornek-baglam.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
 }
 function listen(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){setStatus("Bu tarayıcı ses tanımayı desteklemiyor.");return}
  if(speech.current){speech.current.stop();return}
  const r=new SR();speech.current=r;r.lang="tr-TR";r.onresult=e=>setQuestion(speechText(e.results));
  r.onerror=e=>setStatus("Ses girişi: "+e.error);r.onend=()=>{speech.current=null;setVoice(false)};
  try{r.start();setVoice(true)}catch(e){speech.current=null;setStatus(e.message)}
 }
 async function work(fn){
  const ticket=++serial.current;setJob(true);setStatus("");
  try{await fn(()=>mounted.current&&ticket===serial.current)}
  catch(e){if(mounted.current&&ticket===serial.current)setStatus(e.message)}
  finally{if(mounted.current&&ticket===serial.current)setJob(false)}
 }
 function ask(){work(async valid=>{
  setReply("");
  const data=await api("POST","/api/ai/gt",{...aiBody(),appId:appId||undefined,snapshot:appId?undefined:ctx,question,previewErrors:errors});
  if(valid())setReply(data.reply);
 })}
 async function test(src,valid){if(!src)throw Error("Test edilecek uygulama bulunamadı.");const results=await gtTestHtml(src);if(valid())setTests(results)}
 function create(){work(async valid=>{
  setTests([]);
  const brief="GitmappGT geliştirme görevi: "+question+"\nTeknik öneri: "+reply.slice(0,1800)+"\nSistem: "+ctx.platform+"; modüller: "+ctx.modules.join(", ")+". İlgili kabul senaryosunu taslakta uygulanabilir hale getir.";
  const generated=await buildGT(brief.slice(0,3950));if(valid())await test(generated,valid)
 })}
 function close(){speech.current?.abort();if(window.speechSynthesis)window.speechSynthesis.cancel();setOpen(false)}
 return open&&ReactDOM.createPortal(html`<dialog class="gt-dialog" ref=${dialog} onCancel=${close}><div class="gt-head"><h2>GitmappGT</h2><button type="button" onClick=${()=>{close();openEngineering()}}>Oracle ve SAP atölyesi</button><button type="button" onClick=${close}>Kapat</button></div>
 <p>${appId?"Proje bağlamı · sürüm "+rev:"Taslak bağlamı · bu oturum"} · ${ctx?ctx.platform+" · "+ctx.tables.length+" tablo":"Şema bekleniyor"}</p>
 <details open=${!ctx}><summary>Sistem bağlamı</summary><p>Tablo ve sütun adları, ilişkiler ve toplu olay sayaçları içeren JSON yükleyin. Örnek dosya sigorta senaryosunu gösterir.</p><button onClick=${sample}>Örnek JSON indir</button> <label>Şema ve sinyalleri yükle<input type="file" accept=".json" onChange=${e=>{load(e.target.files[0]);e.target.value=""}}/></label>
 ${ctx&&html`<p>${ctx.modules.join(" · ")}</p><ul>${ctx.tables.map(t=>html`<li key=${t.name}>${t.name} · ${t.columns.join(", ")}</li>`)}</ul>`}</details>
 ${alerts>0&&html`<section role="status"><b>Açık sinyaller</b><ul>${signals.map(s=>html`<li key=${s.code}>${s.code} · ${s.severity} · ${s.count}</li>`)}${errors.map((s,i)=>html`<li key=${i}>Önizleme · ${s}</li>`)}</ul></section>`}
 <details><summary>Sektörel proje başlat</summary><p>Bir iş akışı seçerek teknik soruyu doldurun. Kapsamı ekibinize göre düzenleyebilirsiniz.</p>
 ${gtSectorProjects.map(project=>html`<button type="button" key=${project.name} disabled=${job||Boolean(question.trim())} onClick=${()=>{setQuestion(gtSectorQuestion(project));setReply("");setTests([])}}>${project.name} · ${project.flow}</button>`)}
 </details>
 <label>Teknik soru<textarea maxlength="1500" value=${question} onInput=${e=>{serial.current++;setJob(false);setQuestion(e.target.value);setReply("");setTests([])}} disabled=${job} placeholder="Hasar ödemeleri hangi aşamada bekliyor?"></textarea></label>
 <button disabled=${job} onClick=${listen}>${voice?"Dinlemeyi bitir":"Sesle sor"}</button> <button disabled=${job||!ctx||!question.trim()} onClick=${ask}>GT’ye sor</button>
 ${reply&&html`<p class="gt-answer">${reply}</p><button onClick=${()=>{if(!window.speechSynthesis){setStatus("Sesli okuma desteklenmiyor.");return}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(reply);u.lang="tr-TR";speechSynthesis.speak(u)}}>Yanıtı dinle</button> <button disabled=${job||busy} onClick=${create}>Taslakta geliştir ve test et</button>`}
 ${appId&&html`<details><summary>Doğrulanmış çözüm kaydı</summary><label>Belirti, uygulanan çözüm ve test sonucu<textarea maxlength="600" value=${note} onInput=${e=>setNote(e.target.value)}></textarea></label><button disabled=${job||note.trim().length<4} onClick=${()=>work(async valid=>{await api("POST","/api/apps/"+encodeURIComponent(appId)+"/gt/notes",{note});if(valid()){setNote("");setStatus("Çözüm proje bilgisine eklendi.")}})}>Proje bilgisine ekle</button></details>`}
 <details><summary>Uygulama testi</summary><button disabled=${job||!source} onClick=${()=>work(valid=>test(source,valid))}>Açık taslağı test et</button><label>Test için HTML yükle<input type="file" accept=".html" disabled=${job} onChange=${e=>{const f=e.target.files[0];e.target.value="";if(f)work(async valid=>{setTests([]);if(f.size>400000)throw Error("HTML en fazla 400 KB olabilir.");await test(await f.text(),valid)})}}/></label></details>
 ${tests.length>0&&html`<ul aria-label="Test sonuçları">${tests.map(t=>html`<li key=${t.name}>${t.pass?"Geçti":"Başarısız"} · ${t.name}</li>`)}</ul>`}
 <p role="status">${job?"Çalışıyor…":status}</p></dialog>`,document.body);
}

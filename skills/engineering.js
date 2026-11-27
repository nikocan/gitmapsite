const engineeringProfiles = {
 Oracle: {language:"PL/SQL",ext:"sql",filename:"fatura_kontrol.sql",template:"oracle-teshis",
  code:"DECLARE\n  l_total NUMBER;\nBEGIN\n  SELECT amount INTO l_total FROM invoices WHERE invoice_id = :invoice_id;\nEXCEPTION\n  WHEN OTHERS THEN NULL;\nEND;\n/",
  log:"ORA-01403: no data found\nFatura kontrolü, adım 2"},
 SAP: {language:"ABAP",ext:"abap",filename:"z_siparis.abap",template:"gitsap",
  code:"REPORT z_siparis.\nDATA ls_order TYPE vbak.\nPARAMETERS p_vbeln TYPE vbak-vbeln.\nSELECT SINGLE * FROM vbak INTO @ls_order WHERE vbeln = @p_vbeln.\nWRITE: / ls_order-netwr.",
  log:"ST22 · ITAB_LINE_NOT_FOUND\nSipariş detayları açılırken tablo satırı bulunamadı."}
};
const engineeringRules = {
 Oracle:[
  ["code",/\bWHEN\s+OTHERS\s+THEN\s+NULL\s*;/i,"Hata sessizce yutuluyor","Beklenen istisnaları ayrı ele al. Beklenmeyen hata için RAISE ile çağırana bilgi ver."],
  ["code",/\bSELECT\s+\*/i,"Gereğinden fazla kolon okunabilir","Kullanılan kolonları belirt ve yürütme planını karşılaştır."],
  ["log",/\bORA-01403\b/i,"Kayıt bulunamadı","SELECT INTO koşulunu boş sonuçla test et. NO_DATA_FOUND için beklenen davranışı belirt."],
  ["log",/\bORA-01422\b/i,"Tek satır beklenen sorgu birden fazla satır döndürdü","Filtreyi ve benzersizlik koşulunu kontrol et. Aynı anahtarla iki satırı test et."],
  ["log",/\bORA-00060\b/i,"Karşılıklı kilit beklemesi","Deadlock izindeki oturumları ve kilit alma sıralarını karşılaştır."],
  ["log",/\bORA-00001\b/i,"Benzersizlik kısıtı ihlali","Kısıt adını ve yinelenen iş anahtarını kontrol et. Tekrar gönderimi test et."]
 ],
 SAP:[
  ["code",/\bSELECT\s+(?:SINGLE\s+)?\*/i,"Tüm alanlar okunuyor","Open SQL seçimine yalnızca gereken kolonları al. ST05 ile okuma hacmini karşılaştır."],
  ["log",/\bITAB_LINE_NOT_FOUND\b/i,"Dahili tabloda satır bulunamadı","ST22 kaynak satırındaki anahtarı incele. Eksik tablo satırını ayrı bir ABAP Unit senaryosuyla test et."],
  ["log",/\bDBSQL_DUPLICATE_KEY_ERROR\b/i,"Veritabanı anahtarı yinelendi","Tablonun birincil anahtarını ve aynı LUW içindeki ikinci yazımı incele."],
  ["log",/\bTIME_OUT\b/i,"İşlem süre sınırına ulaştı","ST22 çağrı yığınını ve ST05 izini aynı zaman aralığında incele."],
  ["log",/\bOBJECTS_OBJREF_NOT_ASSIGNED\b/i,"Nesne referansı atanmadı","Dump satırındaki referansın oluşum yolunu kontrol et. Boş referans senaryosunu test et."]
 ]
};
function inspectEngineering(platform,code,log){
 const masked=platform==="Oracle"?code.replace(/\/\*[\s\S]*?(?:\*\/|$)|--[^\n]*|'(?:''|[^'])*'/g,m=>m.replace(/[^\n]/g," ")):
  code.replace(/^\*[^\n]*|"[^\n]*|'(?:''|[^'])*'|\x60(?:\x60\x60|[^\x60])*\x60/gm,m=>m.replace(/[^\n]/g," "));
 return engineeringRules[platform].flatMap(([source,pattern,title,advice])=>{
  const input=source==="code"?masked:log,match=pattern.exec(input);
  if(!match)return [];
  const line=input.slice(0,match.index).split("\n").length;
  return [{source:source==="code"?"Kod":"Günlük",line,title,advice,evidence:(source==="code"?code:log).split("\n")[line-1].trim().slice(0,210)}];
 });
}
function EngineeringPage({go,onTpl,auth}){
 const [platform,setPlatform]=useState("Oracle");
 return html`<div class="explore gallery-page"><${CollectionNav} page="muhendis" go=${go}/>
 <${CollectionHero} title="Geliştirici atölyesi" copy="Oracle ve SAP kodunu düzenle, hata günlüklerini incele ve önerilen değişikliği karşılaştır." image="engineering" caption="Oracle ve SAP geliştirme çalışma alanı"/>
 <div class="eng-tabs seg" aria-label="Mühendislik platformu">${Object.entries(engineeringProfiles).map(([key,item])=>html`<button key=${key} type="button" aria-pressed=${key===platform} class=${key===platform?"on":""} onClick=${()=>setPlatform(key)}>${key} · ${item.language}</button>`)}</div>
 ${Object.keys(engineeringProfiles).map(k=>html`<div key=${k} hidden=${platform!==k}><${EngineeringEditor} platform=${k} onTpl=${onTpl} auth=${auth}/></div>`)}</div>`;
}
function EngineeringEditor({platform,onTpl,auth}){
 const profile=engineeringProfiles[platform];
 const draftKey="engineering:"+String(auth.user?.id||"guest")+":"+platform;
 const [saved]=useState(()=>LS.get(draftKey,null));
 const [code,setCode]=useState(saved?.code||""),[log,setLog]=useState(saved?.log||"");
 const [goal,setGoal]=useState(saved?.goal||""),[name,setName]=useState(saved?.name||profile.filename);
 const [savedMessage,setSavedMessage]=useState("");
 const [checked,setChecked]=useState(false),[proposal,setProposal]=useState(null),[previous,setPrevious]=useState(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const file=useRef(null),request=useRef(null),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;request.current?.abort()}},[]);
 function invalidate(){setSavedMessage("");request.current?.abort();request.current=null;setBusy(false);setChecked(false);setProposal(null);setPrevious(null);setError("")}
 async function importFile(e){
  const f=e.target.files?.[0];e.target.value="";if(!f)return;
  if(f.size>128000){setError("Dosya en fazla 128 KB olabilir.");return}
  try{const value=await f.text();if(!mounted.current)return;if(value.length>24000){setError("Düzenleyici en fazla 24.000 karakter alır.");return}
   if(code&&!confirm("Açık kod dosyadan gelen içerikle değiştirilsin mi?"))return;
   invalidate();setCode(value);setName(f.name);
  }catch{setError("Dosya okunamadı.")}
 }
 function example(){if((code||log||goal)&&!confirm("Bu atölyedeki içerik örnekle değiştirilsin mi?"))return;
  invalidate();setCode(profile.code);setLog(profile.log);setName(profile.filename);setGoal("");setChecked(true)}
 function saveDraft(){
  const ok=LS.set(draftKey,{code,log,goal,name});
  setSavedMessage(ok?"Taslak bu tarayıcıya kaydedildi.":"Tarayıcı taslağı kaydedemedi. Dosyayı indirebilirsin.");
 }
 function download(){const url=URL.createObjectURL(new Blob([code],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 async function ask(){
  if(request.current)return;
  const ctrl=new AbortController();request.current=ctrl;setBusy(true);setError("");setProposal(null);setPrevious(null);setChecked(true);
  try{const response=await api("POST","/api/ai/engineering",{platform,code,log,goal},ctrl.signal);
   if(request.current!==ctrl)return;
   setProposal(response);if(response.credits!=null)auth.patch({credits:response.credits});
  }catch(e){if(!ctrl.signal.aborted)setError(e.message)}finally{if(request.current===ctrl){request.current=null;setBusy(false)}}
 }
 const issues=checked?inspectEngineering(platform,code,log):[];
 return html`<div class="eng-work"><section class="eng-panel"><div class="eng-head"><h2>Kod düzenleyici</h2><button type="button" class="chip" onClick=${example}>Örnek yükle</button></div>
 <div class="eng-file"><span>${name}</span><button type="button" class="chip" onClick=${()=>file.current.click()}>Dosya aç</button><input type="file" ref=${file} hidden accept=${"."+profile.ext+",.txt,.pls,.pks,.pkb"} onChange=${importFile}/><button type="button" class="chip" disabled=${!code} onClick=${download}>İndir</button></div>
 <textarea class="eng-code" aria-label=${platform+" kaynak kodu"} spellcheck="false" maxlength="24000" placeholder=${profile.language+" kodunu buraya yaz veya dosya aç…"} value=${code} onInput=${e=>{invalidate();setCode(e.target.value)}}></textarea>
 <div class="adapter-actions"><button class="chip" type="button" onClick=${saveDraft}>Taslağı bu cihazda kaydet</button><small role="status">${savedMessage}</small></div>
 <label class="eng-field">Hata günlüğü<textarea class="in" rows="3" maxlength="6000" placeholder=${platform==="Oracle"?"ORA kodu ve ilgili kayıt satırları":"ST22 kısa dökümü veya uygulama günlüğü"} value=${log} onInput=${e=>{invalidate();setLog(e.target.value)}}></textarea></label>
 <button class="btn g" type="button" disabled=${!code.trim()&&!log.trim()} onClick=${()=>setChecked(true)}>Yerel kontrolü çalıştır</button></section>
 <section class="eng-panel"><div class="eng-head"><h2>Kod asistanı</h2><${Icon} n="code" s=${23}/></div>
 <label class="eng-field">Geliştirme isteği<textarea class="in" rows="3" maxlength="1500" value=${goal} placeholder="Beklenen davranışı veya geliştirmek istediğin işlevi yaz…" onInput=${e=>{invalidate();setGoal(e.target.value)}}></textarea></label>
 <small class="eng-note">Öneri istediğinde kod, günlük ve istek Gitmapp’in yapay zekâ sağlayıcısına gönderilir. Hesabının model tarifesi uygulanır.</small>
 <button type="button" class="btn" disabled=${busy||!(code.trim()||log.trim()||goal.trim())} onClick=${ask}>${busy?"Öneri hazırlanıyor…":"Kod önerisi al"}</button>
 ${error&&html`<p role="alert" class="eng-error">${error}</p>`}
 ${checked&&html`<section class="eng-findings" aria-live="polite"><h3>Yerel kontrol · ${issues.length} bulgu</h3>
 ${!issues.length&&html`<p>Tanımlı kurallarla eşleşme bulunmadı.</p>`}
 ${issues.map(f=>html`<article key=${f.title}><small>${f.source} · Satır ${f.line}</small><b>${f.title}</b><code>${f.evidence}</code><p>${f.advice}</p></article>`)}</section>`}
 ${proposal&&html`<section class="eng-result" aria-live="polite"><h3>Önerilen değişiklik</h3><p>${proposal.review}</p>
 ${proposal.code&&html`<pre tabindex="0" aria-label="Önerilen kaynak kod">${proposal.code}</pre>`}<h4>Doğrulama adımları</h4><ol>${proposal.tests.map((t,i)=>html`<li key=${i}>${t}</li>`)}</ol>
 ${proposal.code&&previous===null&&proposal.code!==code&&html`<button class="btn" onClick=${()=>{setSavedMessage("");setPrevious(code);setCode(proposal.code);setChecked(false)}}>Öneriyi editöre uygula</button>`}
 ${previous!==null&&html`<button class="btn g" onClick=${()=>{setSavedMessage("");setCode(previous);setPrevious(null);setChecked(false)}}>Değişikliği geri al</button>`}</section>`}
 <div class="eng-demo"><button class="chip" onClick=${()=>onTpl(catalogTemplate(profile.template))}>${platform} teşhis senaryosunu Stüdyo’da aç</button></div></section></div>`;
}

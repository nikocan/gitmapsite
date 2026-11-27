// Shared interchange format for project-scoped metadata and operational signals.
const GT_SAMPLE = {
 platform:"Oracle", modules:["Police","Hasar","Odeme"],
 tables:[{name:"POLICE",columns:["ID","DURUM"]},{name:"HASAR",columns:["ID","POLICE_ID","DURUM"]},{name:"ODEME",columns:["ID","HASAR_ID","DURUM"]}],
 links:[["HASAR.POLICE_ID","POLICE.ID"],["ODEME.HASAR_ID","HASAR.ID"]],
 signals:[{code:"PAYMENT_PENDING",severity:"warning",count:3}]
};
function gtSnapshot(value){
 const fail=()=>{throw new Error("Geçersiz bağlam. Örnek dosyanın alanlarını ve tablo bağlantılarını kontrol edin.")};
 function list(v,max){if(!Array.isArray(v)||v.length>max)fail();return v}
 function name(v){if(typeof v!=="string"||!/^[_\p{L}][_\p{L}\p{N}$# -]{0,63}$/u.test(v))fail();return v}
 function unique(values){if(new Set(values).size!==values.length)fail();return values}
 if(!value||!["Oracle","SAP","Karma"].includes(value.platform))fail();
 const tables=list(value.tables,100).map(t=>({name:name(t.name),columns:unique(list(t.columns,60).map(name))}));
 unique(tables.map(t=>t.name));
 const columns=new Set(tables.flatMap(t=>t.columns.map(c=>t.name+"."+c)));
 const links=list(value.links,200).map(pair=>{if(!Array.isArray(pair)||pair.length!==2||!pair.every(x=>columns.has(x)))fail();return pair});
 const signals=list(value.signals,80).map(s=>{
  if(!["info","warning","critical"].includes(s.severity)||!Number.isSafeInteger(s.count)||s.count<0)fail();
  return {code:name(s.code),severity:s.severity,count:s.count};
 });
 unique(signals.map(s=>s.code));
 return {platform:value.platform,modules:unique(list(value.modules,40).map(name)),tables,links,signals};
}
if(typeof module!=="undefined"&&module.exports)module.exports={gtSnapshot,GT_SAMPLE};

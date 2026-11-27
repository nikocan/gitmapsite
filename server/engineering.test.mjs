import test from "node:test";
import {toAnthropic} from "./anthropic.mjs";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {once} from "node:events";
import {createServer} from "node:http";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";

test("Engineering rejects invalid input and incomplete proposals and preserves platform-specific source",async t=>{
 const seen=[];
 let answer={review:"Sorguyu daralt.",code:"SELECT carrid FROM scarr INTO TABLE @DATA(lt_ids).",tests:["Taşıyıcı filtresini doğrula."]};
 const router=createServer(async(req,res)=>{
  res.setHeader("Content-Type","application/json");
  if(req.url.endsWith("/models"))return res.end(JSON.stringify({data:[{id:"demo-mini"}]}));
  let body="";for await(const part of req)body+=part;
  seen.push(JSON.parse(body));
  res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(answer)},finish_reason:"stop"}]}));
 });
 router.listen(0,"127.0.0.1");await once(router,"listening");t.after(()=>router.close());
 const dir=await mkdtemp(join(tmpdir(),"gitmapp-engineering-"));
 const server=spawn(process.execPath,[fileURLToPath(new URL("server.mjs",import.meta.url))],{
  env:{...process.env,PORT:"0",DB_PATH:join(dir,"db"),AI_BASE:"http://127.0.0.1:"+router.address().port,AI_KEY:"local-test",AI_MODELS:"demo-mini"},
  stdio:["ignore","pipe","inherit"]
 });
 t.after(async()=>{if(server.exitCode===null&&server.signalCode===null){const end=once(server,"exit");server.kill();await end}await rm(dir,{recursive:true,force:true})});
 const [startup]=await once(server.stdout,"data");
 const base="http://127.0.0.1:"+startup.toString().match(/API :(\d+)/)[1];
 const send=body=>fetch(base+"/api/ai/engineering",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
 for(const body of [{platform:"SQL",code:"x"},{platform:"SAP",code:" "},{platform:"Oracle",code:"x".repeat(24001)}])
  assert.equal((await send(body)).status,400);
 assert.equal(seen.length,0);
 for(const [platform,code] of [["SAP","SELECT * FROM scarr."],["Oracle","BEGIN NULL; END;"]]){
  const r=await send({platform,code,goal:"İncele."});assert.equal(r.status,200);
  const result=await r.json();assert.equal(result.code,answer.code);assert.deepEqual(result.tests,answer.tests);
  const request=seen.at(-1);
  assert.deepEqual(toAnthropic(request).output_config.format.schema.required,["review","code","tests"]);
  const {messages}=request;assert.ok(messages[0].content.includes(platform));assert.equal(JSON.parse(messages[1].content).code,code);
 }
 answer={review:"Yarım öneri",code:"",tests:[]};
 assert.equal((await send({platform:"Oracle",log:"ORA-01403"})).status,502);
});

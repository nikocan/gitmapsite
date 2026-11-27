import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

test("Design skills select a model, keep manual choices and save reusable instructions per account", async t => {
  const calls = [];
  const model = "qwen2.5-coder:3b";
  const recipe = "Menü aralıklarını dar ekran için azalt.";
  const router = createServer(async (req,res)=>{
    res.setHeader("Content-Type","application/json");
    if(req.url.endsWith("/models"))return res.end(JSON.stringify({data:[{id:model},{id:"demo-mini"}]}));
    let body="";
    for await(const chunk of req)body+=chunk;
    calls.push(JSON.parse(body));
    res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({gap:8,recipe,skillName:"Mobil menüyü düzenle"})}}]}));
  });
  router.listen(0, "127.0.0.1");
  await once(router, "listening");
  t.after(() => router.close());
  const dir = await mkdtemp(join(tmpdir(), "gitmapp-context-"));
  const server = spawn(process.execPath, [fileURLToPath(new URL("server.mjs", import.meta.url))], {
    env: { ...process.env, DB_PATH: join(dir, "db"), PORT: "0", SKILL_MODEL: model, AI_MODELS:model+",demo-mini",
      AI_KEY: "local-test", AI_BASE: "http://127.0.0.1:" + router.address().port },
    stdio: ["ignore", "pipe", "inherit"],
  });
  t.after(async () => {
    if (server.exitCode === null && server.signalCode === null) {
      const end = once(server, "exit");
      server.kill();
      await end;
    }
    await rm(dir, { recursive: true, force: true });
  });
  const [start] = await once(server.stdout, "data");
  const port = start.toString().match(/API :(\d+)/)[1];
  const call=(path,body,token)=>fetch("http://127.0.0.1:"+port+"/api/"+path,{
    method:body?"POST":"GET",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:body&&JSON.stringify(body)
  });
  async function register(email){
    const response=await call("auth/register",{email,password:"dummy-passphrase"});
    assert.equal(response.status,200);
    return (await response.json()).token;
  }
  const owner=await register("owner@example.test"),other=await register("other@example.test");
  const task={prompt:"Menü çok geniş",tag:"nav",autoModel:true};
  const first=await call("ai/design",task,owner);
  assert.equal(first.status,200);
  const result=await first.json();
  assert.equal(result.model,model);
  assert.deepEqual(result.values,{gap:8});
  const saved={name:"Dar menü",instruction:result.recipe};
  assert.equal((await call("design-skills",saved)).status,401);
  for(let i=0;i<2;i++)assert.equal((await call("design-skills",saved,owner)).status,200);
  assert.equal((await call("design-skills",{...saved,instruction:"Yeni"},owner)).status,409);
  for(const [token,count] of [[owner,1],[other,0]]){
    const {skills}=await (await call("design-skills",null,token)).json();
    assert.equal(skills.filter(s=>s.name===saved.name).length,count);
  }
  const second=await call("ai/design",{...task,skill:saved.name,autoModel:false,model:"demo-mini"},owner);
  assert.equal(second.status,200);
  assert.equal((await second.json()).model,"demo-mini");
  assert.equal(calls.length,2);
  assert.ok(calls[1].messages[1].content.includes(recipe));
});

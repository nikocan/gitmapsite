import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const server = fileURLToPath(new URL("server.mjs", import.meta.url));
async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "gitmapp-admin-"));
  const env = { ...process.env, PORT:"0", DB_PATH:join(dir,"db"), ADMIN_EMAIL:"owner@example.test",
    SECRET:randomBytes(32).toString("hex"), GITHUB_CLIENT_ID:"", GOOGLE_CLIENT_ID:"" };
  const cli = command => execFileSync(process.execPath,[server,command],{env,encoding:"utf8"});
  const password = cli("create-admin").match(/Şifre: (\S+)/)[1];
  const child = spawn(process.execPath,[server],{env,stdio:["ignore","pipe","inherit"]});
  t.after(async () => {
    if (child.exitCode===null && child.signalCode===null) { const end=once(child,"exit"); child.kill(); await end; }
    rmSync(dir,{recursive:true,force:true});
  });
  const ready = await Promise.race([
    once(child.stdout,"data").then(([buffer])=>buffer.toString()),
    once(child,"exit").then(()=>{throw new Error("API başlamadı");})
  ]);
  const port=ready.match(/API :(\d+)/)[1];
  async function request(method,path,body,token) {
    const response=await fetch("http://127.0.0.1:"+port+"/api/"+path,{method,
      headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},
      body:body?JSON.stringify(body):undefined});
    return {status:response.status,...await response.json()};
  }
  const login = pw => request("POST","auth/login",{email:env.ADMIN_EMAIL,password:pw});
  const admin=await login(password);
  assert.equal(admin.user.admin,true);
  const member=await request("POST","auth/register",{email:"customer@example.test",password:randomBytes(16).toString("hex"),name:"Müşteri"});
  return {request,admin:admin.token,member,login,cli,password};
}

test("admin routes require a verified manager, provisioning is repeatable and a password reset ends older sessions", async t => {
  const {request,admin,member,login,cli,password}=await fixture(t);
  for(const path of ["admin/overview","admin/users","admin/projects","admin/orders","admin/radar","admin/ai-check"]){
    assert.equal((await request("GET",path)).status,401);
    assert.equal((await request("GET",path,null,member.token)).status,403);
    assert.equal((await request("GET",path,null,admin)).status,200);
  }
  assert.equal((await request("POST","admin/credits",{email:member.user.email,amount:1},member.token)).status,403);
  assert.doesNotMatch(cli("create-admin"),/Şifre:/);
  assert.equal((await login(password)).status,200);
  const next=cli("reset-admin").match(/Şifre: (\S+)/)[1];
  assert.equal((await login(password)).status,401);
  assert.equal((await request("GET","admin/overview",null,admin)).status,401);
  assert.equal((await login(next)).user.admin,true);
});

test("manager directories, credit ledger, order data and shared settings stay consistent",async t=>{
  const {request,admin,member}=await fixture(t);
  const managed=(method,path,body)=>request(method,"admin/"+path,body,admin);
  const project=await request("POST","apps",{title:"Test Takvimi",html:"<h1>Takvim</h1>"},member.token);
  assert.equal((await managed("GET","projects?q=Takvim")).rows[0].owner,member.user.email);
  assert.equal((await managed("GET","users?q=customer")).total,1);
  assert.equal((await managed("GET","overview")).stats.projects,1);
  const edit="projects/"+project.app.id;
  assert.equal((await managed("PATCH",edit,{listed:true})).status,409);
  await request("POST","apps/"+project.app.id+"/publish",{slug:"takvim"},member.token);
  assert.equal((await request("PATCH","admin/"+edit,{listed:true},member.token)).status,403);
  assert.equal((await managed("PATCH",edit,{listed:true})).status,200);
  const published=await managed("GET","projects?status=published");
  assert.equal(published.rows[0].listed,1);
  assert.equal((await managed("GET","projects?status=draft")).total,0);
  assert.equal((await managed("PATCH",edit,{listed:false})).status,200);
  assert.equal((await managed("GET","projects?status=published")).rows[0].status,"published");
  const credit={email:member.user.email,amount:5,reason:"Yükleme"};
  assert.equal((await managed("POST","credits",{...credit,reason:"a".repeat(121)})).status,400);
  assert.equal((await managed("POST","credits",credit)).credits,member.user.credits+5);
  assert.equal((await managed("GET","users?q=customer")).rows[0].credits,member.user.credits+5);
  const id="GM-TEST0001";
  await request("POST","orders",{id,name:"Ekip",email:member.user.email,total:120,monthly:10});
  assert.deepEqual((await managed("GET","orders?page=1&q=TEST")).orders[0].ai,[]);
  assert.equal((await managed("PATCH","orders/"+id,{status:"Test",live:"https://example.test/app"})).order.status,"Test");
  assert.equal((await managed("GET","orders?page=1")).stats.revenue,120);
  assert.equal((await managed("PATCH","orders/"+id,{live:"geçersiz"})).status,400);
  assert.equal((await managed("PATCH","orders/"+id,{status:"İptal"})).order.live,"https://example.test/app");
  assert.equal((await managed("GET","orders?page=1")).stats.revenue,0);
  assert.equal((await managed("DELETE","orders/"+id)).status,200);
  assert.equal((await managed("PATCH","orders/"+id,{status:"Test"})).status,404);
  const business={whatsapp:"905321234567",hostingerRef:"https://example.test/partner"};
  assert.equal((await request("PATCH","admin/settings",{business},member.token)).status,403);
  assert.equal((await managed("PATCH","settings",{business})).status,200);
  const prices={site:3000,is:5000,platform:8000,mobil:1200,bakim:150,ai:55,hosting:65};
  assert.equal((await managed("PATCH","settings",{prices})).status,200);
  const settings=await request("GET","settings");
  assert.deepEqual(settings,{status:200,business,prices});
});

test("optional profile fields can be saved and cleared", async t => {
  const {request,member}=await fixture(t);
  const save=body=>request("PATCH","me/profile",body,member.token);

  const updated=await save({nickname:"Mete",instructions:""});
  assert.equal(updated.status,200);
  assert.equal(updated.user.nickname,"Mete");
  assert.equal(updated.user.instructions,"");

  const instructions=await save({nickname:"",instructions:"  Kısa yanıtlar yaz.  "});
  assert.equal(instructions.status,200);
  assert.equal(instructions.user.nickname,"");
  assert.equal(instructions.user.instructions,"Kısa yanıtlar yaz.");

  const cleared=await save({instructions:""});
  assert.equal(cleared.status,200);
  assert.equal(cleared.user.instructions,"");
});

test("manager cost ledger validates tariffs and updates an integration without double counting", async t=>{
  const {request,admin,member}=await fixture(t);
  const report="admin/costs?month=2026-11";
  assert.equal((await request("GET",report,null,member.token)).status,403);
  const line={month:"2026-11",name:"SMS",quantity:100,unit:.45};
  for(const quantity of [30,100])assert.equal((await request("PUT","admin/costs/integration",{...line,quantity},admin)).status,200);
  assert.equal((await request("PUT","admin/costs/rate",{model:"demo",input:-1,output:2,cached:0},admin)).status,400);
  assert.equal((await request("PUT","admin/costs/settings",{pack_size:0,pack_price:20},admin)).status,400);
  assert.equal((await request("PUT","admin/costs/settings",{budget:100,weekly:681.05,balance:24.23},admin)).status,200);
  const summary=await request("GET",report,null,admin);
  assert.equal(summary.total,45);
  assert.equal(summary.settings.balance,24.23);
  assert.equal(summary.integrations.length,1);
  assert.equal((await request("GET","admin/costs?month=2026-12",null,admin)).total,0);
});

test("yapay zekâ sağlayıcıları panelden yönetilir: yalnızca yönetici, anahtar gizli kalır, anında geçerli, sıfırlanabilir", async t => {
  const {request,admin,member}=await fixture(t);
  assert.equal((await request("GET","admin/ai",null,member.token)).status,403);
  const st=await request("GET","admin/ai",null,admin);
  assert.equal(st.status,200);
  assert.ok(st.fields.find(f=>f.name==="OPENROUTER_API_KEY"));
  const key="sk-or-v1-"+randomBytes(16).toString("hex");
  const saved=await request("PUT","admin/ai",{name:"OPENROUTER_API_KEY",value:key},admin);
  const f=saved.fields.find(x=>x.name==="OPENROUTER_API_KEY");
  assert.equal(f.source,"panel"); assert.equal(f.value,null); assert.equal(f.last4,key.slice(-4));
  assert.doesNotMatch(JSON.stringify(saved),new RegExp(key));
  assert.deepEqual(saved.fallbacks,["openrouter"]);
  const health=await request("GET","health");
  assert.deepEqual(health.aiFallbacks,["openrouter"]);
  assert.equal((await request("PUT","admin/ai",{name:"OPENROUTER_API_KEY",value:"bozuk anahtar"},admin)).status,400);
  assert.equal((await request("PUT","admin/ai",{name:"AI_BASE",value:"http://insecure"},admin)).status,400);
  assert.equal((await request("PUT","admin/ai",{name:"BASKA",value:"x"},admin)).status,400);
  const reset=await request("PUT","admin/ai",{name:"OPENROUTER_API_KEY",value:""},admin);
  assert.notEqual(reset.fields.find(x=>x.name==="OPENROUTER_API_KEY").source,"panel");
});

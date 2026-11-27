import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { registerVersions } from "./version-control.mjs";

function fixture(t, ghApi = () => assert.fail("unexpected GitHub request")) {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE apps(id TEXT PRIMARY KEY, owner_id TEXT, title TEXT, html TEXT, github_repo TEXT);
    INSERT INTO apps VALUES('a','owner','Katalog','<p>ilk</p>',NULL);`);
  const user = { id: "owner", github_token: "fixture", github_login: "owner" };
  const routes = new Map();
  const need = (condition, status, message) => {
    if (!condition) throw Object.assign(new Error(message), { status });
  };
  registerVersions({ db, ghApi, need, slugify: () => "katalog",
    route: (method, path, fn) => routes.set(method + " " + path, fn),
    ownApp: (_, id) => db.prepare("SELECT * FROM apps WHERE id=?").get(id) });
  const direct = (method, path, query = "", actor = user) =>
    routes.get(method + " " + path)({ params:{}, url:new URL("https://example.test" + path + query), body:{}, user:actor });
  function run(method, path, body = {}, actor = user) {
    const url = new URL("https://example.test/api/apps/:id/git" + path);
    return routes.get(method + " " + url.pathname)({ params:{id:"a"}, url, body, user:actor });
  }
  return { db, run, direct };
}

test("local branch snapshots share history, preserve the project and reject stale writes", async t => {
  const { db, run } = fixture(t);
  const { branches } = await run("GET", "");
  assert.deepEqual(branches, ["main"]);
  const main = await run("GET", "/branch?name=main");
  const branch = { name:"tema/mobil", base:"main", head:main.head };
  await run("POST", "/branches", branch);
  await assert.rejects(run("POST", "/branches", branch), {status:409});
  await assert.rejects(run("POST", "/branches", {...branch,name:"tema"}), {status:409});
  await assert.rejects(run("POST", "/branches", {...branch,name:"../hata"}), {status:400});
  const commit = {name:branch.name, head:main.head, message:"Menü", html:"<nav>Menü</nav>"};
  const next = await run("POST", "/commits", commit);
  await assert.rejects(run("POST", "/commits", {...commit,html:"eski taslak"}), {status:409});
  await assert.rejects(run("POST", "/commits", {...commit,head:next.head}), {status:409});
  const checked = await run("GET", "/branch?name=tema%2Fmobil");
  assert.deepEqual(checked.history.map(c=>c.sha), [next.head,main.head]);
  assert.equal(checked.html, commit.html);
  assert.equal((await run("GET", "/branch?name=main")).html, main.html);
  assert.equal(db.prepare("SELECT html FROM apps").get().html, main.html);
  await assert.rejects(run("GET", "", {}, {id:"other"}), {status:403});
  await assert.rejects(run("GET", "", {}, null), {status:401});
  db.exec("DELETE FROM apps");
  assert.equal(db.prepare("SELECT count(*) n FROM project_commits").get().n, 0);
});

test("GitHub operates on the bound repository and selected ref, preserving other files and concurrent edits", async t => {
  const head="a".repeat(40), written="b".repeat(40), diverged="c".repeat(40);
  let tip=head, conflict=false, updated=0;
  const base="/repos/owner/export", ok=data=>({ok:true,status:200,data});
  const { run, db }=fixture(t, async (token, method, path, body)=>{
    assert.equal(token,"fixture");
    switch(method+" "+path){
      case "GET "+base: return ok({default_branch:"trunk"});
      case "GET "+base+"/branches?per_page=100&page=1": return ok([{name:"trunk"},{name:"tasarim/mobil"}]);
      case "GET "+base+"/git/ref/heads/trunk": return ok({ref:"refs/heads/trunk",object:{type:"commit",sha:head}});
      case "POST "+base+"/git/refs":
        assert.deepEqual(body,{ref:"refs/heads/tasarim/mobil",sha:head});return ok({});
      case "GET "+base+"/git/ref/heads/tasarim/mobil": return ok({ref:"refs/heads/tasarim/mobil",object:{type:"commit",sha:tip}});
      case "GET "+base+"/contents/index.html?ref="+head:
        return ok({type:"file",encoding:"none",size:1100000,sha:"blob"});
      case "GET "+base+"/git/blobs/blob": return ok({encoding:"base64",content:Buffer.from("x".repeat(1100000)).toString("base64")});
      case "GET "+base+"/commits?per_page=20&sha="+head: return ok([{sha:head,commit:{message:"Başlangıç",author:{date:"2026-11-25T00:00:00Z"}}}]);
      case "GET "+base+"/git/commits/"+head: return ok({tree:{sha:"base-tree"}});
      case "POST "+base+"/git/trees":
        assert.deepEqual(body,{base_tree:"base-tree",tree:[{path:"index.html",mode:"100644",type:"blob",content:"yeni"}]});return ok({sha:"next-tree"});
      case "POST "+base+"/git/commits":
        assert.deepEqual(body,{message:"Menü",parents:[head],tree:"next-tree"});return ok({sha:written});
      case "PATCH "+base+"/git/refs/heads/tasarim/mobil":
        assert.deepEqual(body,{sha:written,force:false});
        if(conflict){tip=diverged;return {ok:false,status:422,data:{}}}
        updated++;tip=written;return ok({});
      default: assert.fail("unexpected route: "+method+" "+path);
    }
  });
  db.prepare("UPDATE apps SET github_repo=?").run("https://github.com/owner/export");
  const catalog=await run("GET","?source=github");
  assert.equal(catalog.defaultBranch,"trunk");
  await run("POST","/branches?source=github",{name:"tasarim/mobil",base:"trunk",head,repo:"owner/export"});
  const state=await run("GET","/branch?source=github&name=tasarim%2Fmobil&repo=owner%2Fexport");
  assert.equal(state.html.length,1100000);
  const body={name:"tasarim/mobil",head,repo:"owner/export",message:"Menü",html:"yeni"};
  conflict=true;
  await assert.rejects(run("POST","/commits?source=github",body),{status:409});
  assert.equal(tip,diverged);
  await assert.rejects(run("POST","/commits?source=github",body),{status:409});
  assert.equal(updated,0);
  tip=head;conflict=false;
  assert.equal((await run("POST","/commits?source=github",body)).head,written);
  assert.equal(updated,1);
});

test("creating a GitHub repository is explicit and reuses its reserved destination after a lost response", async t => {
  let remote=null, created=0;
  const {run}=fixture(t,async (token, method, path, body)=>{
    if(method==="GET")return remote ? {ok:true,data:remote} : {ok:false,status:404};
    assert.equal(method,"POST");assert.equal(path,"/user/repos");
    assert.equal(body.private,false);assert.equal(body.auto_init,true);
    created++;
    remote={full_name:"owner/"+body.name, html_url:"https://github.com/owner/"+body.name};
    throw new Error("lost response");
  });
  assert.equal((await run("GET","?source=github")).setup,"repository");
  await assert.rejects(run("POST","/repository"),/lost response/);
  assert.equal((await run("POST","/repository")).repo,remote.full_name);
  assert.equal((await run("POST","/repository")).repo,remote.full_name);
  assert.equal(created,1);
  const switched={id:"owner",github_login:"another",github_token:"other"};
  await assert.rejects(run("GET","?source=github",{},switched),{status:409});
});

test("explicitly linking an existing repository checks ownership and push access and leaves the Pages destination alone", async t => {
  let writable=false, nonEmpty=true;
  const { db,run }=fixture(t,async (_,method,path)=>{
    assert.equal(method,"GET");
    if(path==="/repos/owner/website/branches?per_page=1")return {ok:true,data:nonEmpty?[{name:"trunk"}]:[]};
    assert.equal(path,"/repos/owner/website");
    return {ok:true,data:{owner:{login:"owner"},full_name:"owner/website",html_url:"https://github.com/owner/website",permissions:{push:writable}}};
  });
  const pages="https://github.com/owner/original";
  db.prepare("UPDATE apps SET github_repo=?").run(pages);
  const link=()=>run("POST","/link",{repo:"https://github.com/owner/website"});
  await assert.rejects(run("POST","/link",{repo:"someone/website"}),{status:400});
  await assert.rejects(link(),{status:403});
  writable=true;nonEmpty=false;
  await assert.rejects(link(),{status:409});
  nonEmpty=true;
  assert.equal((await link()).repo,"owner/website");
  await assert.rejects(run("POST","/branches?source=github",{base:"main",head:"old",name:"next",repo:"owner/original"}),{status:409});
  assert.equal(db.prepare("SELECT github_repo FROM apps").get().github_repo,pages);
  await run("POST","/unlink",{repo:"owner/website"});
  assert.equal(db.prepare("SELECT count(*) n FROM project_git_remotes").get().n,0);
});

test("repository picker lists writable, active repositories and filters by search", async t => {
  const ok=data=>({ok:true,status:200,data});
  const { direct }=fixture(t, async (token, method, path)=>{
    assert.equal(method+" "+path,"GET /user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator");
    return ok([
      {full_name:"owner/salon",name:"salon",private:false,default_branch:"trunk",description:"Kuaför randevu",permissions:{push:true},html_url:"https://github.com/owner/salon"},
      {full_name:"owner/eski",name:"eski",archived:true,permissions:{push:true}},
      {full_name:"baska/okuma",name:"okuma",permissions:{push:false}},
      {full_name:"owner/kafe",name:"kafe",private:true,permissions:{push:true}}]);
  });
  const all=await direct("GET","/api/me/github/repos");
  assert.deepEqual(all.repos.map(r=>r.full_name),["owner/salon","owner/kafe"]);
  assert.equal(all.repos[0].default_branch,"trunk");
  assert.equal(all.repos[1].default_branch,"main");
  const found=await direct("GET","/api/me/github/repos","?q=randevu");
  assert.deepEqual(found.repos.map(r=>r.name),["salon"]);
  const none=await direct("GET","/api/me/github/repos","",{id:"owner"});
  assert.deepEqual(none,{setup:"account",repos:[]});
  await assert.rejects(direct("GET","/api/me/github/repos","",null),{status:401});
});

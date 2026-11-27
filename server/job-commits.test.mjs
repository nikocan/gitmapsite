// v5.86 — Sunucu tarafı iş kaydı ve üç yönlü birleştirme
import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { registerVersions } from "./version-control.mjs";
import { merge3 } from "./merge3.mjs";

const page = (body) => "<!doctype html><html><head><title>Salon</title></head><body>\n<h1>Salon</h1>\n<section id=randevu>\n<p>Randevu al</p>\n</section>\n<section id=odeme>\n<p>Ödeme</p>\n</section>\n<footer>\n<img alt=logo src=eski.png>\n</footer>\n" + body + "\n<p>" + "x".repeat(200) + "</p>\n</body></html>";
const BASE = page("");

function fixture(t, ghApi = () => assert.fail("GitHub beklenmiyordu"), db = new DatabaseSync(":memory:")) {
  if (!db.prepare("SELECT name FROM sqlite_master WHERE name='apps'").get()) db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE apps(id TEXT PRIMARY KEY, owner_id TEXT, title TEXT, html TEXT, github_repo TEXT);
    CREATE TABLE users(id TEXT PRIMARY KEY, github_token TEXT, github_login TEXT);
    INSERT INTO users VALUES('owner','tok','owner');
    INSERT INTO apps VALUES('a','owner','Salon',${JSON.stringify(BASE).replace(/^"|"$/g, "'").replace(/\\n/g, "\n")},NULL);`);
  const user = { id: "owner", github_token: "tok", github_login: "owner" };
  const routes = new Map();
  const need = (c, status, message) => { if (!c) throw Object.assign(new Error(message), { status }); };
  const vc = registerVersions({ db, ghApi, need, slugify: () => "salon", route: (m, p, fn) => routes.set(m + " " + p, fn),
    ownApp: (_, id) => db.prepare("SELECT * FROM apps WHERE id=?").get(id), userById: (id) => db.prepare("SELECT * FROM users WHERE id=?").get(id) });
  const run = (method, path, body = {}) => { const url = new URL("https://x.test/api/apps/:id/git" + path); const key = method + " " + url.pathname.replace(/\/jobs\/[^/]+/, "/jobs/:job");
    return routes.get(key)({ params: { id: "a", job: url.pathname.match(/\/jobs\/([^/]+)/)?.[1] }, url, body, user }); };
  // Bir üretim işini sekme kapalıyken taklit eder: yalnızca sunucu kancaları çalışır, istemci commit atmaz
  const job = async (id, branch, head, html, msg = "İstek") => { const h = vc.jobHooks(user, { appId: "a", source: "gitmapp", branch, head, message: msg }); h.start({ id }); return h.done({ id }, { html }); };
  return { db, run, vc, user, job };
}
const head = async (run, n) => (await run("GET", "/branch?name=" + encodeURIComponent(n))).head;

test("üç çalışma: sekme kapalıyken her sonuç kendi dalına kaydedilir, tekrar işlem ikinci commit üretmez", async (t) => {
  const { run, db, job } = fixture(t);
  await run("GET", "");
  const m = await head(run, "main");
  for (const b of ["kapora", "odeme", "logo"]) await run("POST", "/branches", { name: b, base: "main", head: m });
  const kapora = BASE.replace("<p>Randevu al</p>", "<p>Randevu al</p>\n<p>Kapora: <b id=kapora data-tl=250>250 TL</b></p>");
  const r1 = await job("job1kapora000000", "kapora", m, kapora, "Randevuya 250 TL kapora ekle");
  const r2 = await job("job2odeme0000000", "odeme", m, BASE.replace("<p>Ödeme</p>", "<p>Ödeme: <span id=tutar></span></p>\n<script>tutar.textContent=kapora.dataset.tl+' TL'</script>"));
  const r3 = await job("job3logo00000000", "logo", m, BASE.replace("eski.png", "yeni.png"));
  for (const r of [r1, r2, r3]) assert.equal(r.status, "saved");
  assert.equal(await head(run, "kapora"), r1.sha);
  assert.equal((await run("GET", "/branch?name=kapora")).html, kapora);
  assert.equal(await head(run, "main"), m, "ana dal korunur");
  // aynı iş ikinci sekmeden yeniden işlenir
  const again = await job("job1kapora000000", "kapora", m, kapora);
  assert.equal(again.sha, r1.sha);
  assert.equal(db.prepare("SELECT count(*) n FROM project_commits WHERE parent=?").get(m).n, 3);
  const list = await run("GET", "/jobs");
  assert.equal(list.jobs.length, 3); assert.ok(list.jobs.every((j) => !("html" in j)));
});

test("iş sürerken dal ilerlerse iki değişiklik de korunur, iş inceleme dalına alınır", async (t) => {
  const { run, job } = fixture(t);
  await run("GET", ""); const m = await head(run, "main");
  await run("POST", "/branches", { name: "kapora", base: "main", head: m });
  const ext = await run("POST", "/commits", { name: "kapora", head: m, message: "Dışarıdan", html: BASE.replace("Salon</h1>", "Salon Lara</h1>") });
  const r = await job("job4kapora000000", "kapora", m, BASE.replace("Randevu al", "Randevu al · 250 TL kapora"));
  assert.equal(r.status, "review"); assert.match(r.review_branch, /^kapora-inceleme-/);
  assert.equal(await head(run, "kapora"), ext.head, "dış değişiklik ezilmedi");
  assert.match((await run("GET", "/branch?name=" + r.review_branch)).html, /250 TL kapora/);
});

test("bozuk sonuç dala yazılmaz; sunucu yeniden başlarsa bekleyen kayıt sürdürülür", async (t) => {
  const { run, db, job, vc } = fixture(t);
  await run("GET", ""); const m = await head(run, "main");
  const bad = await job("job5broken000000", "main", m, "<html><body><script>yarım");
  assert.equal(bad.status, "rejected"); assert.equal(await head(run, "main"), m);
  // sonuç üretildi, kayıt bitmeden sunucu düştü
  db.prepare("INSERT INTO job_commits(job_id,user_id,app_id,source,branch,base_head,message,html,status,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
    .run("job6restart00000", "owner", "a", "gitmapp", "main", m, "Logo", BASE.replace("eski.png", "yeni.png"), "saving", 1, 1);
  db.prepare("INSERT INTO job_commits(job_id,user_id,app_id,source,branch,base_head,message,status,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .run("job7halfway00000", "owner", "a", "gitmapp", "main", m, "Yarım", "running", 1, 1);
  const again = fixture(t, undefined, db);
  await new Promise((r) => setTimeout(r, 1700));
  assert.equal(again.vc.jobRow("job6restart00000").status, "saved");
  assert.equal(again.vc.jobRow("job7halfway00000").status, "dropped");
  assert.match((await again.run("GET", "/branch?name=main")).html, /yeni\.png/);
});

test("birleştirme üç yönlü: kapora ve ödeme birlikte girer, eski inceleme ile birleştirilemez, çakışma bildirilir", async (t) => {
  const { run, job, db } = fixture(t);
  await run("GET", ""); const m = await head(run, "main");
  for (const b of ["kapora", "odeme", "logo"]) await run("POST", "/branches", { name: b, base: "main", head: m });
  await job("job8kapora000000", "kapora", m, BASE.replace("<p>Randevu al</p>", "<p>Randevu al</p>\n<p>Kapora: <b id=kapora data-tl=250>250 TL</b></p>"));
  await job("job9odeme0000000", "odeme", m, BASE.replace("<p>Ödeme</p>", "<p>Ödeme: <span id=tutar>250 TL</span></p>"));
  await job("job9logo00000000", "logo", m, BASE.replace("eski.png", "yeni.png"));
  // birlikte dene: hiçbir dal değişmez
  const before = await head(run, "main");
  const pv = await run("GET", "/merge-preview?branches=kapora,odeme&into=main");
  assert.ok(pv.ok); assert.match(pv.html, /data-tl=250/); assert.match(pv.html, /id=tutar>250 TL/);
  assert.equal(await head(run, "main"), before);
  // inceleme sonrası main ilerledi → eski incelemeyle birleştirme reddedilir
  const cmp = await run("GET", "/compare?from=kapora&into=main");
  const o = await run("GET", "/compare?from=odeme&into=main");
  await run("POST", "/merge", { from: "logo", into: "main" });
  await assert.rejects(run("POST", "/merge", { from: "kapora", into: "main", head: cmp.head, intoHead: cmp.intoHead }), { status: 409 });
  await run("POST", "/merge", { from: "kapora", into: "main" });
  await run("POST", "/merge", { from: "odeme", into: "main", head: o.head });
  const html = db.prepare("SELECT html FROM apps").get().html;
  assert.match(html, /data-tl=250/, "kapora korunur (eskiden ödeme birleşince silinirdi)");
  assert.match(html, /id=tutar>250 TL/); assert.match(html, /yeni\.png/, "logo da korunur");
  // aynı satırı farklı değiştiren iki dal
  const m2 = await head(run, "main");
  await run("POST", "/branches", { name: "a1", base: "main", head: m2 }); await run("POST", "/branches", { name: "a2", base: "main", head: m2 });
  await job("jobAa10000000000", "a1", m2, html.replace("<h1>Salon</h1>", "<h1>Salon A</h1>"));
  await job("jobAa20000000000", "a2", m2, html.replace("<h1>Salon</h1>", "<h1>Salon B</h1>"));
  await run("POST", "/merge", { from: "a1", into: "main" });
  await assert.rejects(run("POST", "/merge", { from: "a2", into: "main" }), { status: 409, message: /Çakışma/ });
});

test("GitHub: zaman aşımında ilk istek uygulanmışsa yeniden denemede ikinci commit oluşmaz; ilerlemiş dal ezilmez", async (t) => {
  const refs = new Map([["main", "0".repeat(40)]]); const commits = new Map([["0".repeat(40), { message: "ilk", tree: "t0" }]]); let n = 0, dropPatch = true, posts = 0;
  const ok = (data) => ({ ok: true, status: 200, data });
  const gh = async (tok, method, p, body) => {
    const R = "/repos/owner/salon";
    if (method === "GET" && p === R) return ok({ full_name: "owner/salon" });
    if (method === "GET" && p.startsWith(R + "/git/ref/heads/")) { const b = decodeURIComponent(p.slice((R + "/git/ref/heads/").length)); return refs.has(b) ? ok({ ref: "refs/heads/" + b, object: { type: "commit", sha: refs.get(b) } }) : { ok: false, status: 404 }; }
    if (method === "GET" && p.startsWith(R + "/commits?")) { const b = decodeURIComponent(new URL("http://x" + p).searchParams.get("sha")); const out = []; let c = refs.get(b); while (c && out.length < 15) { out.push({ sha: c, commit: { message: commits.get(c).message } }); c = commits.get(c).parent; } return ok(out); }
    if (method === "GET" && p.startsWith(R + "/git/commits/")) { const c = commits.get(p.split("/").pop()); return ok({ tree: { sha: c.tree }, message: c.message }); }
    if (method === "POST" && p === R + "/git/trees") return ok({ sha: "tree" + ++n });
    if (method === "POST" && p === R + "/git/commits") { posts++; const sha = String(n).padStart(40, "c"); commits.set(sha, { message: body.message, tree: body.tree, parent: body.parents[0] }); return ok({ sha }); }
    if (method === "PATCH" && p.startsWith(R + "/git/refs/heads/")) { const b = decodeURIComponent(p.slice((R + "/git/refs/heads/").length)); refs.set(b, body.sha); if (dropPatch) { dropPatch = false; throw new Error("zaman aşımı"); } return ok({}); }
    if (method === "POST" && p === R + "/git/refs") { refs.set(body.ref.replace("refs/heads/", ""), body.sha); return ok({}); }
    return assert.fail(method + " " + p);
  };
  const { db, vc, user } = fixture(t, gh);
  db.exec("UPDATE apps SET github_repo='https://github.com/owner/salon'");
  const h = vc.jobHooks(user, { appId: "a", source: "github", repo: "owner/salon", branch: "main", head: "0".repeat(40), message: "Logo" });
  h.start({ id: "gh1logo000000000" });
  const first = await h.done({ id: "gh1logo000000000" }, { html: BASE.replace("eski.png", "yeni.png") });
  assert.equal(first.status, "failed"); assert.match(first.error, /yanıt vermedi/);
  const r = await vc.saveJob("gh1logo000000000");
  assert.equal(r.status, "saved"); assert.equal(posts, 1, "ikinci commit oluşmadı"); assert.equal(refs.get("main"), r.sha);
  // dal dışarıdan ilerledi
  const ext = "e".repeat(40); commits.set(ext, { message: "dış", tree: "te", parent: r.sha }); refs.set("main", ext);
  const h2 = vc.jobHooks(user, { appId: "a", source: "github", repo: "owner/salon", branch: "main", head: r.sha, message: "Kapora" });
  h2.start({ id: "gh2kapora0000000" });
  const r2 = await h2.done({ id: "gh2kapora0000000" }, { html: BASE.replace("Randevu al", "Randevu al · 250 TL") });
  assert.equal(r2.status, "review"); assert.equal(refs.get("main"), ext); assert.equal(refs.get(r2.review_branch), r2.sha);
});

test("merge3 bağımsız değişiklikleri birleştirir", () => {
  const b = "a\nb\nc\nd", r = merge3(b, "a\nB\nc\nd", "a\nb\nc\nD");
  assert.equal(r.html, "a\nB\nc\nD"); assert.equal(r.conflicts.length, 0);
  assert.equal(merge3(b, "a\nX\nc\nd", "a\nY\nc\nd").conflicts.length, 1);
});

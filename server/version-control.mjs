import { randomBytes } from "node:crypto";
import { merge3, matchLines } from "./merge3.mjs";

export const MAX_PROJECT_HTML = 1_500_000;
const changed = "Dal başka bir işlemle güncellendi. Dalı yenileyip değişiklikleri karşılaştırın.";
const encode = encodeURIComponent;
function checkBranch(name, need) {
  need(typeof name === "string" && name.length > 0 && name.length <= 250 &&
    !/[\x00-\x20\x7f~^:?*\[\\]/.test(name) && !name.includes("..") && !name.includes("@{") &&
    !name.startsWith("-") && !name.endsWith(".") && !["@", "HEAD"].includes(name) &&
    name.split("/").every(part => part && !part.startsWith(".") && !part.endsWith(".lock")),
    400, "Geçerli bir dal adı girin. Örnek: tasarim/yeni-menu");
  return name;
}

// A project uses its own exported repository. An imported upstream may belong to another person.
export function linkedRepo(app, user, need) {
  const match = /^https:\/\/github\.com\/([\w-]+)\/([\w.-]+)$/.exec(app.github_repo || "");
  need(match && match[1].toLowerCase() === user.github_login?.toLowerCase() && ![".", ".."].includes(match[2]),
    409, "Bu projenin deposuyla eşleşen GitHub hesabını bağlayın.");
  return match[1] + "/" + match[2];
}

export function registerVersions({ db, route, ownApp, need, ghApi, slugify, confirmRemoteCommit, userById }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_git_remotes (
      app_id TEXT PRIMARY KEY REFERENCES apps(id) ON DELETE CASCADE, url TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS project_git_names (
      app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE, login TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY(app_id,login));
    CREATE TABLE IF NOT EXISTS project_commits (
      app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      sha TEXT NOT NULL, parent TEXT, message TEXT NOT NULL, html TEXT NOT NULL,
      created TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), PRIMARY KEY(app_id,sha));
    CREATE TABLE IF NOT EXISTS project_branches (
      app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE, name TEXT NOT NULL, head TEXT NOT NULL,
      PRIMARY KEY(app_id,name), FOREIGN KEY(app_id,head) REFERENCES project_commits(app_id,sha));
  `);
  const sql = statement => db.prepare(statement);
  const localHead = (id, name) => sql("SELECT head FROM project_branches WHERE app_id=? AND name=?").get(id, name)?.head;
  const insertCommit = (id, parent, message, html) => {
    const sha = randomBytes(20).toString("hex");
    sql("INSERT INTO project_commits(app_id,sha,parent,message,html) VALUES(?,?,?,?,?)").run(id, sha, parent, message, html);
    return sha;
  };
  function transaction(fn) {
    db.exec("BEGIN IMMEDIATE");
    try { const value = fn(); db.exec("COMMIT"); return value; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  function project(ctx) {
    need(ctx.user, 401, "Sürüm kontrolünü kullanmak için giriş yapın.");
    const app = ownApp(ctx.user, ctx.params.id);
    need(app.owner_id === ctx.user.id, 403, "Sürüm kontrolü proje sahibine aittir.");
    return app;
  }
  async function github(user, method, path, body) {
    need(user.github_token, 412, "GitHub hesabınızı bağlayın.");
    const result = await ghApi(user.github_token, method, path, body);
    if (result.ok) return result.data;
    if (result.status === 401) need(false, 412, "GitHub oturumunun süresi doldu. Hesabı yeniden bağlayın.");
    if (result.status === 403 || result.status === 429) need(false, result.status, "GitHub işlemi engelledi. Depo iznini, dal korumasını ve istek sınırını kontrol edin.");
    if (result.status === 409 || result.status === 422) need(false, 409, "GitHub değişikliği kabul etmedi. Dal adını, dal korumasını ve son commit’i kontrol edin.");
    if (result.status === 404) need(false, 404, "GitHub deposu, dalı veya dosyası bulunamadı.");
    need(false, 502, "GitHub şu anda yanıt veremiyor.");
  }
  function source(ctx) {
    const value = ctx.url.searchParams.get("source") || "gitmapp";
    need(["gitmapp","github"].includes(value), 400, "Sürüm kaynağı geçersiz.");
    return value;
  }
  function localInit(app) {
    if (localHead(app.id, "main")) return;
    transaction(() => {
      if (localHead(app.id, "main")) return;
      const sha = insertCommit(app.id, null, "Projenin ilk kaydı", app.html);
      sql("INSERT INTO project_branches VALUES(?,?,?)").run(app.id, "main", sha);
    });
  }
  function binding(app, ctx) {
    const custom = sql("SELECT url FROM project_git_remotes WHERE app_id=?").get(app.id);
    const url = custom?.url || app.github_repo;
    if (!url) return null;
    const repo = linkedRepo({github_repo:url}, ctx.user, need);
    return { repo, custom:!!custom };
  }
  function target(app, ctx) {
    const current = binding(app, ctx);
    need(current && ctx.body.repo === current.repo, 409, "Bağlı depo değişti. Sürüm panelini yenileyin.");
    return "/repos/" + current.repo;
  }
  // v5.77 — Yeni sohbet penceresindeki depo seçici: bağlı hesabın yazabildiği depolar (Claude Code tarzı ortam seçimi)
  route("GET", "/api/me/github/repos", async ctx => {
    need(ctx.user, 401, "Depoları görmek için giriş yapın.");
    if (!ctx.user.github_token) return { setup:"account", repos:[] };
    const q = String(ctx.url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 80);
    const list = await github(ctx.user, "GET", "/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator");
    const repos = (Array.isArray(list) ? list : [])
      .filter(r => r && r.full_name && !r.archived && !r.disabled && r.permissions?.push !== false)
      .filter(r => !q || r.full_name.toLowerCase().includes(q) || String(r.description || "").toLowerCase().includes(q))
      .slice(0, 50)
      .map(r => ({ full_name:r.full_name, name:r.name, private:!!r.private, default_branch:r.default_branch || "main",
        description:String(r.description || "").slice(0, 140), pushed_at:r.pushed_at || null, url:r.html_url }));
    return { login:ctx.user.github_login || null, repos };
  });
  const root = "/api/apps/:id/git";
  route("POST", root + "/link", async ctx => {
    const app = project(ctx);
    const input = String(ctx.body.repo || "").trim().replace(/\.git\/?$/i, "");
    const match = /^(?:https:\/\/github\.com\/)?([\w-]+)\/([\w.-]+?)\/?$/.exec(input);
    need(match && match[1].toLowerCase() === ctx.user.github_login?.toLowerCase() && ![".", ".."].includes(match[2]),
      400, "Bağlı GitHub hesabınıza ait bir depo girin. Örnek: kullanici/proje");
    const path = "/repos/" + match[1] + "/" + match[2];
    const info = await github(ctx.user, "GET", path);
    need(info.owner?.login.toLowerCase() === ctx.user.github_login.toLowerCase() && info.permissions?.push && !info.archived && !info.disabled,
      403, "Bu depo için yazma yetkisi gerekli.");
    const branches = await github(ctx.user, "GET", path + "/branches?per_page=1");
    need(branches.length, 409, "Bu depo henüz boş. İlk commit içeren bir depo seçin veya panelden yeni depo oluşturun.");
    sql("INSERT INTO project_git_remotes VALUES(?,?) ON CONFLICT(app_id) DO UPDATE SET url=excluded.url").run(app.id, info.html_url);
    return { repo:info.full_name };
  });
  route("POST", root + "/unlink", ctx => {
    const app = project(ctx);
    const url = "https://github.com/" + String(ctx.body.repo || "");
    need(sql("DELETE FROM project_git_remotes WHERE app_id=? AND url=?").run(app.id, url).changes, 409, "Depo bağlantısı değişti. Paneli yenileyin.");
    return { ok:true };
  });
  route("POST", root + "/repository", async ctx => {
    const app = project(ctx);
    if (app.github_repo) return { repo: linkedRepo(app, ctx.user, need) };
    const login = ctx.user.github_login;
    need(login && ctx.user.github_token, 412, "GitHub hesabınızı bağlayın.");
    // Reserve the generated destination before the API call so a lost response can be retried.
    sql("INSERT OR IGNORE INTO project_git_names VALUES(?,?,?)").run(app.id, login, "gitmapp-" + slugify(app.title) + "-" + randomBytes(8).toString("hex"));
    const {name} = sql("SELECT name FROM project_git_names WHERE app_id=? AND login=?").get(app.id, login);
    const path = "/repos/" + login + "/" + name;
    let repo;
    const existing = await ghApi(ctx.user.github_token, "GET", path);
    if (existing.ok) repo = existing.data;
    else {
      need(existing.status === 404, existing.status === 401 ? 412 : 502, "Depo bilgisi okunamadı. GitHub bağlantısını kontrol edin.");
      repo = await github(ctx.user, "POST", "/user/repos", { name, private: false, auto_init: true, description: app.title + " · Gitmapp" });
    }
    need(repo.full_name?.toLowerCase() === (login + "/" + name).toLowerCase(), 409, "GitHub hesabı ve hedef depo eşleşmiyor.");
    sql("UPDATE apps SET github_repo=? WHERE id=? AND github_repo IS NULL").run(repo.html_url, app.id);
    return { repo: linkedRepo(project(ctx), ctx.user, need) };
  });

  route("GET", root, async ctx => {
    const app = project(ctx);
    if (source(ctx) === "gitmapp") {
      localInit(app);
      return { repo: null, defaultBranch: "main", branches: sql("SELECT name FROM project_branches WHERE app_id=? ORDER BY name").all(app.id).map(b => b.name) };
    }
    if (!ctx.user.github_token) return { setup:"account" };
    const remote = binding(app, ctx);
    if (!remote) return { setup:"repository" };
    const {repo} = remote;
    const base = "/repos/" + repo;
    const page = Number(ctx.url.searchParams.get("page") || 1);
    need(Number.isSafeInteger(page) && page >= 1, 400, "Geçersiz sayfa.");
    const [info, branches] = await Promise.all([github(ctx.user, "GET", base), github(ctx.user, "GET", base + "/branches?per_page=100&page=" + page)]);
    return { repo, custom:remote.custom, defaultBranch: info.default_branch, branches: branches.map(b => b.name), more: branches.length === 100 };
  });

  async function remoteHead(user, base, name) {
    const ref = await github(user, "GET", base + "/git/ref/heads/" + name.split("/").map(encode).join("/"));
    need(ref.ref === "refs/heads/" + name && ref.object?.type === "commit", 404, "Dal bulunamadı.");
    return ref.object.sha;
  }
  route("GET", root + "/branch", async ctx => {
    const app = project(ctx);
    const name = checkBranch(ctx.url.searchParams.get("name"), need);
    if (source(ctx) === "gitmapp") {
      localInit(app);
      const head = localHead(app.id, name);
      need(head, 404, "Dal bulunamadı.");
      const {html} = sql("SELECT html FROM project_commits WHERE app_id=? AND sha=?").get(app.id, head);
      const history = sql(`WITH RECURSIVE chain(sha,parent,message,created,depth) AS (
        SELECT sha,parent,message,created,1 FROM project_commits WHERE app_id=? AND sha=?
        UNION ALL SELECT c.sha,c.parent,c.message,c.created,p.depth+1 FROM chain p JOIN project_commits c ON c.app_id=? AND c.sha=p.parent WHERE p.depth<20
      ) SELECT sha,message,created FROM chain ORDER BY depth`).all(app.id, head, app.id);
      return { head, html, history };
    }
    const remote = binding(app, ctx);
    need(remote && remote.repo === ctx.url.searchParams.get("repo"), 409, "Bağlı depo değişti. Paneli yenileyin.");
    const base = "/repos/" + remote.repo;
    const head = await remoteHead(ctx.user, base, name);
    const [file, history] = await Promise.all([
      ghApi(ctx.user.github_token, "GET", base + "/contents/index.html?ref=" + head),
      github(ctx.user, "GET", base + "/commits?per_page=20&sha=" + head)
    ]);
    need(file.ok || file.status === 404, 502, "index.html GitHub’dan okunamadı.");
    let html = null;
    if (file.ok) {
      need(file.data?.type === "file" && file.data.size <= MAX_PROJECT_HTML * 4, 422, "Bu index.html Stüdyo’da açılamıyor.");
      const blob = file.data.encoding === "none" ? await github(ctx.user, "GET", base + "/git/blobs/" + file.data.sha) : file.data;
      need(blob.encoding === "base64" && typeof blob.content === "string", 422, "GitHub dosya içeriğini döndürmedi.");
      html = Buffer.from(blob.content, "base64").toString("utf8");
      need(html.length <= MAX_PROJECT_HTML, 413, "index.html Stüdyo boyut sınırını aşıyor.");
    }
    return { head, html, history: history.map(c => ({ sha:c.sha, message:c.commit.message, created:c.commit.author?.date })) };
  });

  route("POST", root + "/branches", async ctx => {
    const app = project(ctx), { body } = ctx;
    const baseName = checkBranch(body.base, need), name = checkBranch(body.name, need);
    if (source(ctx) === "gitmapp") {
      return transaction(() => {
        const head = localHead(app.id, baseName);
        need(head && head === body.head, 409, changed);
        const conflict = sql(`SELECT 1 FROM project_branches WHERE app_id=? AND
          (name=? OR instr(name,?||'/')=1 OR instr(?,name||'/')=1)`).get(app.id, name, name, name);
        need(!conflict, 409, "Bu dal adı mevcut bir dalla çakışıyor.");
        sql("INSERT INTO project_branches VALUES(?,?,?)").run(app.id, name, head);
        return { name, head };
      });
    }
    const base = target(app, ctx);
    const head = await remoteHead(ctx.user, base, baseName);
    need(head === body.head, 409, changed);
    await github(ctx.user, "POST", base + "/git/refs", { ref: "refs/heads/" + name, sha: head });
    return { name, head };
  });

  route("POST", root + "/commits", async ctx => {
    const app = project(ctx), { body } = ctx;
    const name = checkBranch(body.name, need);
    const message = typeof body.message === "string" ? body.message.trim() : "";
    need(message && message.length <= 200, 400, "1–200 karakterlik bir commit mesajı yazın.");
    need(typeof body.html === "string" && body.html.length > 0 && body.html.length <= MAX_PROJECT_HTML, 400, "Geçerli bir Stüdyo dosyası gerekli.");
    if (source(ctx) === "gitmapp") {
      return transaction(() => {
        const head = localHead(app.id, name);
        need(head && head === body.head, 409, changed);
        const old = sql("SELECT html FROM project_commits WHERE app_id=? AND sha=?").get(app.id, head);
        need(old.html !== body.html, 409, "Commit edilecek bir değişiklik yok.");
        const next = insertCommit(app.id, head, message, body.html);
        sql("UPDATE project_branches SET head=? WHERE app_id=? AND name=?").run(next, app.id, name);
        return { head: next };
      });
    }
    confirmRemoteCommit?.(app, body.html);
    const base = target(app, ctx);
    const head = await remoteHead(ctx.user, base, name);
    need(head === body.head, 409, changed);
    const parent = await github(ctx.user, "GET", base + "/git/commits/" + head);
    const tree = await github(ctx.user, "POST", base + "/git/trees", { base_tree: parent.tree.sha, tree: [{ path:"index.html", mode:"100644", type:"blob", content:body.html }] });
    need(tree.sha !== parent.tree.sha, 409, "Commit edilecek bir değişiklik yok.");
    const commit = await github(ctx.user, "POST", base + "/git/commits", { message, tree:tree.sha, parents:[head] });
    await github(ctx.user, "PATCH", base + "/git/refs/heads/" + name.split("/").map(encode).join("/"), { sha:commit.sha, force:false });
    return { head:commit.sha };
  });

  // v5.80 — Oturum dalları: Gitmapp'te karşılaştır ve birleştir, GitHub'da PR durumu, PR aç ve birleştir
  const ancestors = (id, head, limit = 400) => {
    const seen = new Set(); let cur = head;
    const parent = sql("SELECT parent FROM project_commits WHERE app_id=? AND sha=?");
    while (cur && !seen.has(cur) && seen.size < limit) { seen.add(cur); cur = parent.get(id, cur)?.parent; }
    return seen;
  };
  route("GET", root + "/compare", async ctx => {
    const app = project(ctx);
    const from = checkBranch(ctx.url.searchParams.get("from"), need);
    const into = checkBranch(ctx.url.searchParams.get("into") || "main", need);
    if (source(ctx) === "gitmapp") {
      localInit(app);
      const fh = localHead(app.id, from), ih = localHead(app.id, into);
      need(fh && ih, 404, "Dal bulunamadı.");
      const intoSet = ancestors(app.id, ih), fromSet = ancestors(app.id, fh);
      const ahead = [...fromSet].filter(x => !intoSet.has(x)).length, behind = [...intoSet].filter(x => !fromSet.has(x)).length;
      return { source:"gitmapp", from, into, ahead, behind, merged: intoSet.has(fh), head: fh, intoHead: ih };
    }
    const remote = binding(app, ctx);
    need(remote && remote.repo === ctx.url.searchParams.get("repo"), 409, "Bağlı depo değişti. Paneli yenileyin.");
    const base = "/repos/" + remote.repo, owner = remote.repo.split("/")[0];
    const [cmp, pulls] = await Promise.all([
      github(ctx.user, "GET", base + "/compare/" + encode(into) + "..." + encode(from)),
      github(ctx.user, "GET", base + "/pulls?state=all&per_page=5&head=" + encode(owner + ":" + from))
    ]);
    const pr = (Array.isArray(pulls) ? pulls : []).find(p => p.head?.ref === from) || null;
    return { source:"github", from, into, ahead: cmp.ahead_by || 0, behind: cmp.behind_by || 0, merged: !!pr?.merged_at,
      pr: pr ? { number: pr.number, state: pr.merged_at ? "merged" : pr.state, url: pr.html_url, title: pr.title, draft: !!pr.draft, base: pr.base?.ref || into } : null };
  });
  // v5.86 — ortak atadan üç yönlü birleşim; hedef, kaynağın atasıysa ileri sarma
  const commitHtml = (id, sha) => sql("SELECT html FROM project_commits WHERE app_id=? AND sha=?").get(id, sha)?.html ?? "";
  function mergeBase(id, a, b) {
    const set = ancestors(id, a); const parent = sql("SELECT parent FROM project_commits WHERE app_id=? AND sha=?");
    let cur = b, n = 0; while (cur && !set.has(cur) && n++ < 400) cur = parent.get(id, cur)?.parent; return set.has(cur) ? cur : null;
  }
  function mergedHtml(id, fh, ih) {
    const lca = mergeBase(id, fh, ih);
    if (lca === ih) return commitHtml(id, fh);
    const r = merge3(lca ? commitHtml(id, lca) : "", commitHtml(id, ih), commitHtml(id, fh));
    need(!r.conflicts.length, 409, "Çakışma: iki çalışma aynı satırları farklı biçimde değiştirmiş (" + r.conflicts.length + " yer). Önce birlikte deneyip birini güncelle.");
    return r.html;
  }
  // Birleşimin önizlemesi: hiçbir dalı değiştirmeden birleşik dosyayı döndürür
  route("GET", root + "/merge-preview", async ctx => {
    const app = project(ctx);
    need(source(ctx) === "gitmapp", 400, "GitHub dallarının birleşik önizlemesi henüz yok.");
    localInit(app);
    const names = String(ctx.url.searchParams.get("branches") || "").split(",").filter(Boolean).map(n => checkBranch(n, need));
    const into = checkBranch(ctx.url.searchParams.get("into") || "main", need);
    need(names.length >= 1 && names.length <= 5, 400, "1–5 dal seçin.");
    let head = localHead(app.id, into); need(head, 404, "Dal bulunamadı.");
    let html = commitHtml(app.id, head); const heads = { [into]: head };
    for (const n of names) {
      const fh = localHead(app.id, n); need(fh, 404, "Dal bulunamadı: " + n); heads[n] = fh;
      if (ancestors(app.id, head).has(fh)) continue;
      const lca = mergeBase(app.id, fh, head);
      const r = merge3(lca ? commitHtml(app.id, lca) : "", html, commitHtml(app.id, fh));
      if (r.conflicts.length) return { ok: false, conflict: n, conflicts: r.conflicts.slice(0, 5), heads };
      html = r.html;
    }
    return { ok: true, html, heads };
  });
  // v5.87 — Açık çalışmalar arasındaki ilişkiler: bir çalışmanın eklediği değer/öğe/işlevi başka biri kullanıyorsa öneri; aynı satırları değiştirenler olası çakışma
  const SYM_KIND = { v: "değerini", id: "öğesini", fn: "işlevini", ls: "kaydını" };
  function provided(text) {
    const out = new Map(), add = (k, n) => { if (n && n.length >= 3 && !out.has(n)) out.set(n, k); };
    for (const m of text.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) add("v", m[1]);
    for (const m of text.matchAll(/\bid=["']?([A-Za-z][\w-]*)/g)) add("id", m[1]);
    for (const m of text.matchAll(/\b(?:function|class)\s+([A-Za-z_$][\w$]*)/g)) add("fn", m[1]);
    for (const m of text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) add("v", m[1]);
    for (const m of text.matchAll(/localStorage\.setItem\(\s*["'`]([^"'`]+)/g)) add("ls", m[1]);
    return out;
  }
  const hasWord = (text, w) => new RegExp("(^|[^\\w$-])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\w$-])").test(text);
  const usesId = (text, id) => { const e = id.replace(/[-]/g, "\\-"); return new RegExp("getElementById\\(\\s*[\"'`]" + e + "[\"'`]|[\"'`(\\s,]#" + e + "(?![\\w-])|\\bfor=[\"']?" + e + "\\b").test(text); };
  function addedText(id, fromHead, intoHead) {
    const lca = mergeBase(id, fromHead, intoHead);
    const a = String(lca ? commitHtml(id, lca) : "").split("\n"), b = commitHtml(id, fromHead).split("\n");
    const kept = new Set(matchLines(a, b).map(p => p[1]));
    return b.filter((_, i) => !kept.has(i)).join("\n");
  }
  route("GET", root + "/relations", async ctx => {
    const app = project(ctx);
    if (source(ctx) !== "gitmapp") return { works: [], relations: [], conflicts: [], unsupported: true };
    localInit(app);
    const into = checkBranch(ctx.url.searchParams.get("into") || "main", need);
    const ih = localHead(app.id, into); need(ih, 404, "Dal bulunamadı.");
    const intoSet = ancestors(app.id, ih), baseText = commitHtml(app.id, ih);
    const hidden = new Set(String(ctx.url.searchParams.get("hide") || "").split(",").filter(Boolean));
    const works = sql(`SELECT b.name, b.head, c.created FROM project_branches b JOIN project_commits c ON c.app_id=b.app_id AND c.sha=b.head WHERE b.app_id=? AND b.name<>? ORDER BY c.created DESC LIMIT 12`).all(app.id, into)
      .filter(w => !intoSet.has(w.head))
      .map(w => {
        const first = sql("SELECT message, status FROM job_commits WHERE app_id=? AND (branch=? OR review_branch=?) ORDER BY created ASC LIMIT 1").get(app.id, w.name, w.name);
        const last = sql("SELECT status FROM job_commits WHERE app_id=? AND (branch=? OR review_branch=?) ORDER BY created DESC LIMIT 1").get(app.id, w.name, w.name);
        const msg = sql("SELECT message FROM project_commits WHERE app_id=? AND sha=?").get(app.id, w.head)?.message || w.name;
        const added = addedText(app.id, w.head, ih);
        return { branch: w.name, head: w.head, title: (first?.message || msg).slice(0, 90), status: last?.status || null, review: /-inceleme-[0-9a-f]{6}$/.test(w.name), added };
      });
    const relations = [], conflicts = [];
    for (const a of works) {
      const prov = provided(a.added);
      for (const b of works) {
        if (a === b) continue;
        for (const [sym, k] of prov) {
          if (hasWord(baseText, sym) || provided(b.added).has(sym)) continue;
          if (k === "id" ? !usesId(b.added, sym) : !hasWord(b.added, sym)) continue;
          const key = a.branch + ">" + b.branch;
          if (hidden.has(key)) continue;
          relations.push({ key, provider: a.branch, user: b.branch, symbol: sym, kind: k, reason: "“" + b.title + "”, “" + a.title + "” çalışmasının eklediği " + sym + " " + SYM_KIND[k] + " kullanıyor." });
          break;
        }
      }
    }
    for (let i = 0; i < works.length; i++) for (let j = i + 1; j < works.length; j++) {
      const a = works[i], b = works[j];
      const la = mergeBase(app.id, a.head, ih), first = la === ih ? commitHtml(app.id, a.head) : merge3(la ? commitHtml(app.id, la) : "", baseText, commitHtml(app.id, a.head));
      const ah = typeof first === "string" ? first : first.html;
      const lb = mergeBase(app.id, b.head, ih);
      const r = merge3(lb ? commitHtml(app.id, lb) : "", ah, commitHtml(app.id, b.head));
      if (r.conflicts.length) conflicts.push({ a: a.branch, b: b.branch, count: r.conflicts.length, reason: "“" + a.title + "” ve “" + b.title + "” aynı yeri farklı biçimde değiştiriyor." });
    }
    return { into, intoHead: ih, works: works.map(({ added, ...w }) => w), relations, conflicts };
  });

  route("POST", root + "/merge", async ctx => {
    const app = project(ctx), { body } = ctx;
    need(source(ctx) === "gitmapp", 400, "GitHub dalları çekme isteğiyle birleştirilir.");
    const from = checkBranch(body.from, need), into = checkBranch(body.into || "main", need);
    need(from !== into, 400, "Bir dal kendisiyle birleştirilemez.");
    localInit(app);
    return transaction(() => {
      const fh = localHead(app.id, from), ih = localHead(app.id, into);
      need(fh && ih, 404, "Dal bulunamadı.");
      need(!body.head || body.head === fh, 409, changed);
      // v5.86 — inceleme sonrası hedef dal ilerlediyse eski önizleme/test geçersizdir
      need(!body.intoHead || body.intoHead === ih, 409, "“" + into + "” dalı sen incelerken ilerledi. Birleşimi yeniden önizle ve kontrol et.");
      need(!ancestors(app.id, ih).has(fh), 409, "Bu dal zaten birleştirilmiş.");
      const html = mergedHtml(app.id, fh, ih);
      const next = insertCommit(app.id, ih, "Birleştir: " + from + " → " + into, html);
      sql("UPDATE project_branches SET head=? WHERE app_id=? AND name=?").run(next, app.id, into);
      // Birleştirilen dalın başı da birleştirme commit'ini gösterir: dal "birleştirildi" olarak görünür, üzerinde devam edilebilir
      sql("UPDATE project_branches SET head=? WHERE app_id=? AND name=?").run(next, app.id, from);
      if (into === "main") sql("UPDATE apps SET html=? WHERE id=?").run(html, app.id);
      return { head: next, into, from };
    });
  });
  // ---------- v5.86 — Sunucu tarafı iş kaydı: sekme kapalı olsa da üretilen sonuç doğru dala yazılır ----------
  db.exec(`CREATE TABLE IF NOT EXISTS job_commits(job_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, app_id TEXT NOT NULL, source TEXT NOT NULL, repo TEXT,
    branch TEXT NOT NULL, base_head TEXT NOT NULL, message TEXT NOT NULL, html TEXT, status TEXT NOT NULL, sha TEXT, review_branch TEXT, error TEXT,
    tries INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, updated INTEGER NOT NULL)`);
  const JC_COLS = "job_id,app_id,source,repo,branch,base_head,message,status,sha,review_branch,error,tries,created,updated";
  const jobRow = id => sql("SELECT " + JC_COLS + " FROM job_commits WHERE job_id=?").get(id) || null;
  const jcSet = (id, f) => { const k = Object.keys(f); sql("UPDATE job_commits SET " + k.map(x => x + "=?").join(",") + ",updated=? WHERE job_id=?").run(...k.map(x => f[x]), Date.now(), id); };
  const MARK = id => "Gitmapp-Job: " + id;
  const reviewName = (row) => row.branch.slice(0, 80) + "-inceleme-" + row.job_id.slice(0, 6);
  // Sunucu tarafı kontrol: yarıda kesilmiş ya da bozuk sonuç dala yazılmaz
  const shapeOk = h => typeof h === "string" && h.trim().length >= 200 && /<\/(html|body)>\s*$/i.test(h.trim()) && (h.match(/<script\b/gi) || []).length === (h.match(/<\/script>/gi) || []).length && (h.match(/<style\b/gi) || []).length === (h.match(/<\/style>/gi) || []).length;

  function jobSpec(user, spec) {
    if (!spec || typeof spec !== "object" || !user) return null;
    const app = ownApp(user, String(spec.appId || ""));
    need(app.owner_id === user.id, 403, "Sürüm kontrolü proje sahibine aittir.");
    const src = spec.source === "github" ? "github" : "gitmapp";
    const branch = checkBranch(spec.branch, need);
    need(typeof spec.head === "string" && /^[0-9a-f]{7,64}$/i.test(spec.head), 400, "Başlangıç sürümü geçersiz.");
    if (src === "github") { const remote = binding(app, { user }); need(remote && remote.repo === spec.repo, 409, "Bağlı depo değişti. Sürüm panelini yenileyin."); }
    const message = String(spec.message || "Stüdyo değişikliği").replace(/\s+/g, " ").trim().slice(0, 120) || "Stüdyo değişikliği";
    return { app_id: app.id, source: src, repo: src === "github" ? spec.repo : null, branch, base_head: spec.head, message };
  }
  function localSave(row, html) {
    return transaction(() => {
      const cur = jobRow(row.job_id); if (["saved", "review", "nochange"].includes(cur?.status)) return cur;
      const head = localHead(row.app_id, row.branch);
      if (!head) { jcSet(row.job_id, { status: "failed", error: "Dal bulunamadı.", html: null }); return jobRow(row.job_id); }
      if (commitHtml(row.app_id, row.base_head) === html) { jcSet(row.job_id, { status: "nochange", sha: head, html: null, error: null }); return jobRow(row.job_id); }
      const sha = insertCommit(row.app_id, row.base_head, row.message, html);
      if (head === row.base_head) {
        sql("UPDATE project_branches SET head=? WHERE app_id=? AND name=?").run(sha, row.app_id, row.branch);
        jcSet(row.job_id, { status: "saved", sha, html: null, error: null });
      } else {
        // Dal bu iş sürerken ilerledi: diğer değişiklikleri ezme, sonucu ayrı inceleme dalında sakla
        const name = reviewName(row);
        sql("INSERT OR REPLACE INTO project_branches VALUES(?,?,?)").run(row.app_id, name, sha);
        jcSet(row.job_id, { status: "review", sha, review_branch: name, html: null, error: "“" + row.branch + "” dalı bu iş sürerken ilerledi." });
      }
      return jobRow(row.job_id);
    });
  }
  async function remoteSave(row, html, user, app) {
    const remote = binding(app, { user }); need(remote && remote.repo === row.repo, 409, "Bağlı depo değişti.");
    const base = "/repos/" + remote.repo, mark = MARK(row.job_id);
    const head = await remoteHead(user, base, row.branch);
    // Önceki deneme (ör. zaman aşımı) aslında uygulanmış mı? Dalın son commit'lerinde iş işaretini ara
    if (head !== row.base_head) {
      const recent = await ghApi(user.github_token, "GET", base + "/commits?per_page=15&sha=" + encode(row.branch));
      const hit = recent.ok && Array.isArray(recent.data) ? recent.data.find(c => String(c.commit?.message || "").includes(mark)) : null;
      const top = hit ? null : await github(user, "GET", base + "/git/commits/" + head);
      if (hit || String(top?.message || "").includes(mark)) return { status: "saved", sha: hit ? hit.sha : head };
    }
    confirmRemoteCommit?.(app, html);
    const parent = await github(user, "GET", base + "/git/commits/" + row.base_head);
    const tree = await github(user, "POST", base + "/git/trees", { base_tree: parent.tree.sha, tree: [{ path: "index.html", mode: "100644", type: "blob", content: html }] });
    if (tree.sha === parent.tree.sha) return { status: "nochange", sha: row.base_head };
    const commit = await github(user, "POST", base + "/git/commits", { message: row.message + "\n\n" + mark, tree: tree.sha, parents: [row.base_head] });
    if (head === row.base_head) {
      try { await github(user, "PATCH", base + "/git/refs/heads/" + row.branch.split("/").map(encode).join("/"), { sha: commit.sha, force: false }); return { status: "saved", sha: commit.sha }; }
      catch (e) { if ((e.code ?? e.status) !== 409) throw e; }
    }
    const name = reviewName(row);
    const made = await ghApi(user.github_token, "POST", base + "/git/refs", { ref: "refs/heads/" + name, sha: commit.sha });
    if (!made.ok && made.status !== 422) need(false, 502, "İnceleme dalı oluşturulamadı.");
    return { status: "review", sha: commit.sha, review_branch: name, error: "“" + row.branch + "” dalı bu iş sürerken ilerledi." };
  }
  const saving = new Map();
  function saveJob(id) {
    if (saving.has(id)) return saving.get(id);
    const p = (async () => {
      const full = sql("SELECT * FROM job_commits WHERE job_id=?").get(id);
      if (!full || !full.html || !["saving", "failed"].includes(full.status)) return jobRow(id);
      jcSet(id, { status: "saving", tries: full.tries + 1 });
      if (!shapeOk(full.html)) { jcSet(id, { status: "rejected", error: "Sonuç yarıda kesilmiş ya da bozuk geldi; dala yazılmadı." }); return jobRow(id); }
      try {
        if (full.source === "gitmapp") return localSave(full, full.html);
        const user = userById?.(full.user_id); const app = user && sql("SELECT * FROM apps WHERE id=?").get(full.app_id);
        need(user && app, 404, "Proje bulunamadı.");
        const r = await remoteSave(full, full.html, user, app);
        jcSet(id, { status: r.status, sha: r.sha || null, review_branch: r.review_branch || null, error: r.error || null, html: null });
      } catch (e) {
        const known = typeof (e.code ?? e.status) === "number";
        jcSet(id, { status: "failed", error: known ? e.message : "GitHub yanıt vermedi. Yeniden denemede önce ilk isteğin uygulanıp uygulanmadığı kontrol edilir." });
      }
      return jobRow(id);
    })().finally(() => saving.delete(id));
    saving.set(id, p); return p;
  }
  // aiJob kancaları: iş başlarken kayıt satırı açılır, bitince sonuç dala yazılır
  function jobHooks(user, rawSpec) {
    const spec = jobSpec(user, rawSpec); if (!spec) return null;
    return {
      start(j) { sql("INSERT OR IGNORE INTO job_commits(job_id,user_id,app_id,source,repo,branch,base_head,message,status,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(j.id, user.id, spec.app_id, spec.source, spec.repo, spec.branch, spec.base_head, spec.message, "running", Date.now(), Date.now()); },
      async done(j, result) {
        const cur = jobRow(j.id); if (!cur) return null;
        if (!["running", "dropped"].includes(cur.status)) return cur.status === "failed" ? saveJob(j.id) : cur; // aynı iş ikinci kez işlenirse tek kayıt
        if (!result?.html) { jcSet(j.id, { status: "nochange", error: null }); return jobRow(j.id); }
        jcSet(j.id, { status: "saving", html: result.html });
        return saveJob(j.id);
      },
      fail(j) { const r = jobRow(j.id); if (r && r.status === "running") jcSet(j.id, { status: "dropped", error: "İş tamamlanamadı; dala bir şey yazılmadı." }); }
    };
  }
  // Sunucu yeniden başladıysa: sonucu üretilmiş ama kaydı bitmemiş işler sürdürülür; yarıda kalan üretimler düşürülür
  sql("UPDATE job_commits SET status='dropped', error='Sunucu yeniden başladı; iş tamamlanamadı.', updated=? WHERE status='running'").run(Date.now());
  setTimeout(() => { for (const r of sql("SELECT job_id FROM job_commits WHERE status='saving'").all()) saveJob(r.job_id).catch(() => {}); }, 1500).unref?.();

  route("GET", root + "/jobs", ctx => {
    const app = project(ctx); const br = ctx.url.searchParams.get("branch");
    const rows = br ? sql("SELECT " + JC_COLS + " FROM job_commits WHERE app_id=? AND branch=? ORDER BY created DESC LIMIT 50").all(app.id, br)
      : sql("SELECT " + JC_COLS + " FROM job_commits WHERE app_id=? ORDER BY created DESC LIMIT 100").all(app.id);
    return { jobs: rows };
  });
  route("GET", root + "/jobs/:job", ctx => {
    const app = project(ctx); const r = jobRow(String(ctx.params.job)); need(r && r.app_id === app.id, 404, "Kayıt bulunamadı."); return r;
  });
  route("POST", root + "/jobs/:job/retry", async ctx => {
    const app = project(ctx); const r = jobRow(String(ctx.params.job)); need(r && r.app_id === app.id, 404, "Kayıt bulunamadı.");
    need(r.status === "failed", 409, r.status === "saving" ? "Kayıt sürüyor." : "Bu iş zaten sonuçlandı.");
    return saveJob(r.job_id);
  });

  route("POST", root + "/pulls", async ctx => {
    const app = project(ctx), { body } = ctx;
    const head = checkBranch(body.head, need), baseRef = checkBranch(body.base || "main", need);
    const title = String(body.title || "").trim().slice(0, 200) || head;
    const text = String(body.body || "").slice(0, 8000);
    const path = target(app, ctx);
    // v5.87 — tekrar tıklama ya da ağ hatası yinelenen PR açmasın: aynı dal için açık PR varsa onu güncelle
    const owner = path.split("/")[2];
    const open = await github(ctx.user, "GET", path + "/pulls?state=open&per_page=5&head=" + encode(owner + ":" + head));
    const found = (Array.isArray(open) ? open : []).find(p => p.head?.ref === head && (p.base?.ref || baseRef) === baseRef);
    if (found) {
      const upd = await github(ctx.user, "PATCH", path + "/pulls/" + found.number, { title, body: text });
      return { number: found.number, url: upd.html_url || found.html_url, state: upd.state || found.state, updated: true };
    }
    const pr = await github(ctx.user, "POST", path + "/pulls", { title, head, base: baseRef, body: text });
    return { number: pr.number, url: pr.html_url, state: pr.state };
  });
  route("POST", root + "/pulls/:n/merge", async ctx => {
    const app = project(ctx);
    const n = Number(ctx.params.n);
    need(Number.isSafeInteger(n) && n > 0, 400, "Geçersiz çekme isteği.");
    const path = target(app, ctx);
    const r = await github(ctx.user, "PUT", path + "/pulls/" + n + "/merge", { merge_method: "merge" });
    return { merged: !!r.merged, sha: r.sha || null };
  });
  return { jobHooks, saveJob, jobRow };
}

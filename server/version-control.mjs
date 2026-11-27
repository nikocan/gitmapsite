import { randomBytes } from "node:crypto";

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

export function registerVersions({ db, route, ownApp, need, ghApi, slugify, confirmRemoteCommit }) {
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

  // Dal haritası: her dalın ana dala göre konumu, yükü, PR'ı ve canlıya çıkış hattı.
  const insightCache = new Map();
  const ago = iso => iso ? Date.now() - Date.parse(iso) : Infinity;
  const DAY = 86400000;
  const refPath = name => name.split("/").map(encode).join("/");
  function activity(lastDate, ahead, isDefault) {
    if (!isDefault && ahead === 0) return "birlesti";
    const age = ago(lastDate);
    return age < 3 * DAY ? "aktif" : age < 14 * DAY ? "beklemede" : "durgun";
  }
  function relation(ahead, behind) {
    if (!ahead && !behind) return "esit";
    if (ahead && !behind) return "onde";
    if (!ahead && behind) return "geride";
    return "ayristi";
  }
  function lineDiff(base, head) {
    const count = text => { const m = new Map(); for (const l of String(text || "").split("\n")) { const k = l.trim(); if (k) m.set(k, (m.get(k) || 0) + 1); } return m; };
    const a = count(base), b = count(head);
    let additions = 0, deletions = 0;
    for (const [k, n] of b) additions += Math.max(0, n - (a.get(k) || 0));
    for (const [k, n] of a) deletions += Math.max(0, n - (b.get(k) || 0));
    return { additions, deletions };
  }
  function localInsights(app) {
    localInit(app);
    const rows = sql("SELECT name, head FROM project_branches WHERE app_id=? ORDER BY name").all(app.id);
    const commit = sql("SELECT sha,parent,message,created FROM project_commits WHERE app_id=? AND sha=?");
    const htmlOf = sha => sql("SELECT html FROM project_commits WHERE app_id=? AND sha=?").get(app.id, sha)?.html || "";
    const chain = head => { const out = []; let sha = head; while (sha && out.length < 400) { const c = commit.get(app.id, sha); if (!c) break; out.push(c); sha = c.parent; } return out; };
    const mainHead = localHead(app.id, "main");
    const mainChain = chain(mainHead), mainSet = new Set(mainChain.map(c => c.sha));
    const branches = rows.map(({ name, head }) => {
      const own = chain(head), isDefault = name === "main";
      const forkAt = own.findIndex(c => mainSet.has(c.sha));
      const ahead = isDefault ? 0 : forkAt < 0 ? own.length : forkAt;
      const base = isDefault || forkAt < 0 ? null : own[forkAt].sha;
      const behind = isDefault ? 0 : base ? mainChain.findIndex(c => c.sha === base) : mainChain.length;
      const last = own[0];
      const diff = isDefault ? { additions:0, deletions:0 } : lineDiff(htmlOf(mainHead), htmlOf(head));
      const changed = diff.additions + diff.deletions;
      return { name, head, isDefault, ahead, behind, relation:relation(ahead, behind), state:activity(last?.created, ahead, isDefault),
        mergeBase: base, additions:diff.additions, deletions:diff.deletions,
        files: changed ? [{ name:"index.html", status:"modified", additions:diff.additions, deletions:diff.deletions }] : [],
        last: last ? { sha:last.sha, message:last.message, date:last.created, author:null } : null,
        commits: own.slice(0, isDefault ? 8 : Math.min(ahead, 8)).map(c => ({ sha:c.sha, message:c.message, date:c.created, author:null })), pr:null };
    });
    const live = app.pages_url || (app.status === "published" && app.slug ? "https://" + app.slug + ".app.gitmapp.com" : null);
    return { source:"gitmapp", repo:null, defaultBranch:"main", branches,
      pipeline:{ commit: branches.find(b => b.isDefault)?.last || null,
        saved: app.updated || null, published: app.published_at || null, status: app.status || "draft", live, runs:[], deployments:[] } };
  }
  async function githubInsights(app, ctx) {
    if (!ctx.user.github_token) return { setup:"account" };
    const remote = binding(app, ctx);
    if (!remote) return { setup:"repository" };
    const base = "/repos/" + remote.repo, token = ctx.user.github_token;
    const soft = async path => { try { const r = await ghApi(token, "GET", path); return r.ok ? r.data : null; } catch { return null; } };
    const [info, list] = await Promise.all([github(ctx.user, "GET", base), github(ctx.user, "GET", base + "/branches?per_page=30")]);
    const main = info.default_branch;
    const [mainLog, pulls, runs, deps] = await Promise.all([
      soft(base + "/commits?per_page=8&sha=" + encode(main)),
      soft(base + "/pulls?state=all&per_page=30&sort=updated&direction=desc"),
      soft(base + "/actions/runs?per_page=10"),
      soft(base + "/deployments?per_page=5")]);
    const prOf = name => {
      const all = (pulls || []).filter(p => p.head?.ref === name && p.head?.repo?.full_name === remote.repo);
      const p = all.find(x => x.state === "open") || all[0];
      return p ? { number:p.number, title:p.title, state:p.merged_at ? "merged" : p.state, draft:!!p.draft, url:p.html_url, author:p.user?.login || null } : null;
    };
    const short = c => c && ({ sha:c.sha, message:String(c.commit?.message || "").split("\n")[0].slice(0, 200), date:c.commit?.author?.date || c.commit?.committer?.date || null, author:c.author?.login || c.commit?.author?.name || null });
    const others = list.filter(b => b.name !== main).slice(0, 12);
    const compared = await Promise.all(others.map(b => soft(base + "/compare/" + refPath(main) + "..." + refPath(b.name))));
    const head = mainLog?.[0];
    const branches = [{ name:main, head:list.find(b => b.name === main)?.commit?.sha || head?.sha || null, isDefault:true, ahead:0, behind:0, relation:"esit",
      state:activity(head?.commit?.author?.date, 0, true), mergeBase:null, additions:0, deletions:0, files:[],
      last:short(head), commits:(mainLog || []).map(short), pr:null }];
    others.forEach((b, i) => {
      const c = compared[i];
      if (!c) { branches.push({ name:b.name, head:b.commit?.sha || null, isDefault:false, ahead:null, behind:null, relation:"bilinmiyor", state:"bilinmiyor", files:[], commits:[], last:null, pr:prOf(b.name), additions:0, deletions:0 }); return; }
      const files = (c.files || []).slice(0, 30).map(f => ({ name:f.filename, status:f.status, additions:f.additions, deletions:f.deletions }));
      const commits = (c.commits || []).slice(-8).reverse().map(short);
      const last = c.ahead_by ? short(c.commits[c.commits.length - 1]) : short(c.merge_base_commit);
      branches.push({ name:b.name, head:b.commit?.sha || null, isDefault:false, ahead:c.ahead_by, behind:c.behind_by, relation:relation(c.ahead_by, c.behind_by),
        state:activity(last?.date, c.ahead_by, false), mergeBase:c.merge_base_commit?.sha || null,
        additions:(c.files || []).reduce((n, f) => n + (f.additions || 0), 0), deletions:(c.files || []).reduce((n, f) => n + (f.deletions || 0), 0),
        files, commits, last, pr:prOf(b.name), compareUrl:c.html_url || null });
    });
    const deployments = await Promise.all((deps || []).slice(0, 3).map(async d => {
      const st = (await soft(base + "/deployments/" + d.id + "/statuses?per_page=1"))?.[0];
      return { id:d.id, environment:d.environment, ref:d.ref, sha:d.sha, created:d.created_at, state:st?.state || "pending", url:st?.environment_url || null, updated:st?.created_at || d.updated_at };
    }));
    return { source:"github", repo:remote.repo, url:info.html_url, defaultBranch:main, more:list.length === 30 || list.length - 1 > others.length, branches,
      pipeline:{ commit:short(head), live:deployments.find(d => d.state === "success" && d.url)?.url || app.pages_url || null, published:app.published_at || null, status:app.status || "draft",
        runs:(runs?.workflow_runs || []).map(r => ({ id:r.id, name:r.name || r.display_title, branch:r.head_branch, sha:r.head_sha, event:r.event, status:r.status, conclusion:r.conclusion,
          started:r.run_started_at || r.created_at, updated:r.updated_at, url:r.html_url })), deployments, actions:!!runs } };
  }
  route("GET", root + "/insights", async ctx => {
    const app = project(ctx), src = source(ctx);
    const key = app.id + ":" + src + ":" + ctx.user.id, hit = insightCache.get(key);
    if (src === "github" && hit && Date.now() - hit.at < 45000 && ctx.url.searchParams.get("fresh") !== "1") return { ...hit.data, cached:true };
    const data = src === "gitmapp" ? localInsights(app) : await githubInsights(app, ctx);
    data.checked = new Date().toISOString();
    if (src === "github" && !data.setup) { insightCache.set(key, { at:Date.now(), data }); if (insightCache.size > 500) insightCache.delete(insightCache.keys().next().value); }
    return data;
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
}

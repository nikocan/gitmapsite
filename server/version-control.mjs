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
}

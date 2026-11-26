const SOURCES = [
  { hosts: ["developer.mozilla.org"], name: "MDN", url: "https://developer.mozilla.org/en-US/blog/rss.xml" },
  { hosts: ["www.smashingmagazine.com", "smashingmagazine.com"], name: "Smashing Magazine", url: "https://www.smashingmagazine.com/feed/" },
];
const TOPICS = ["dashboard-template", "design-system", "icon-pack", "portfolio-template"];
const HOURS = [6, 12, 24, 48, 168];
const defaultSettings = { enabled: true, hours: 24, design: false, monthlyCredits: 30 };
const hour = 3_600_000;

function field(xml, tag) {
  const value = new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + tag + ">", "i").exec(xml)?.[1] || "";
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, c) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" })[c]).trim();
}

export function feedEntries(xml, source) {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0, 8).flatMap(([, item]) => {
    const title = field(item, "title").slice(0, 180);
    try {
      const url = new URL(field(item, "link"));
      if (!title || url.protocol !== "https:" || !source.hosts.includes(url.hostname) || url.username || url.password) return [];
      return [{ id: url.href, url: url.href, title, source: source.name, kind: "web" }];
    } catch { return []; }
  });
}

async function readFeed(source) {
  const res = await fetch(source.url, { redirect: "error", signal: AbortSignal.timeout(12000), headers: { "User-Agent": "gitmapp-radar" } });
  if (!res.ok) throw new Error("RSS " + res.status);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let xml = "";
  try {
    while (xml.length < 262144 && (xml.match(/<\/item>/gi)?.length || 0) < 8) {
      const { done, value } = await reader.read();
      if (done) break;
      xml += decoder.decode(value, { stream: true });
    }
  } finally { await reader.cancel().catch(() => {}); }
  if (!/<rss\b/i.test(xml)) throw new Error("RSS biçimi okunamadı");
  const entries = feedEntries(xml, source);
  if (!entries.length && /<item\b/i.test(xml)) throw new Error("RSS bağlantıları okunamadı");
  return entries;
}

export function registerRadar({ db, route, need, ghRead, githubToken, createDesign }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS radar_agent(id INTEGER PRIMARY KEY CHECK(id=1), settings TEXT NOT NULL,
      last_run INTEGER, lock_until INTEGER DEFAULT 0, report TEXT DEFAULT '{}');
    CREATE TABLE IF NOT EXISTS radar_candidates(id TEXT PRIMARY KEY, kind TEXT NOT NULL,
      data TEXT NOT NULL, seen INTEGER NOT NULL, dismissed INTEGER DEFAULT 0);
  `);
  const settingsStmt = db.prepare("SELECT * FROM radar_agent WHERE id=1");
  db.prepare("INSERT OR IGNORE INTO radar_agent(id,settings) VALUES(1,?)").run(JSON.stringify(defaultSettings));
  const upsert = db.prepare(`INSERT INTO radar_candidates(id,kind,data,seen) VALUES(?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET data=excluded.data,seen=excluded.seen`);
  const toState = () => {
    const row = settingsStmt.get();
    const entries = db.prepare("SELECT data FROM radar_candidates WHERE dismissed=0 ORDER BY seen DESC, id LIMIT 60").all();
    return { settings: JSON.parse(row.settings), lastRun: row.last_run, running: row.lock_until > Date.now(),
      report: JSON.parse(row.report), entries: entries.map(({ data }) => JSON.parse(data)) };
  };
  async function repos() {
    const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const results = await Promise.allSettled(TOPICS.map(async topic => {
      const params = new URLSearchParams({ q: `topic:${topic} stars:>=10 is:public archived:false pushed:>=${since}`, sort: "updated", per_page: "8" });
      const r = await ghRead(githubToken, "/search/repositories?" + params);
      if (!r.ok || !Array.isArray(r.data?.items)) throw new Error("GitHub " + r.status);
      return r.data.items.filter(x => !x.private && /^[\w.-]+\/[\w.-]+$/.test(x.full_name))
        .map(x => ({ id: "gh:" + x.id, kind: "github", source: "GitHub", title: x.full_name,
          url: "https://github.com/" + x.full_name, description: String(x.description || "").slice(0, 320),
          stars: x.stargazers_count, license: x.license?.spdx_id || "", topic }));
    }));
    return { entries: [...new Map(results.flatMap(r => r.status === "fulfilled" ? r.value : []).map(e => [e.id, e])).values()],
      failures: results.filter(r => r.status === "rejected").length };
  }
  let running = false;
  async function scan(manual = false) {
    const row = settingsStmt.get();
    const settings = JSON.parse(row.settings);
    const started = Date.now();
    // The update lock also protects against overlapping calls from separate API processes.
    if (running || (!manual && (!settings.enabled || (row.last_run || 0) + settings.hours * hour > started))) return;
    const lease = started + 10 * 60_000;
    const lock = db.prepare("UPDATE radar_agent SET lock_until=? WHERE id=1 AND lock_until<=?").run(lease, started);
    if (!lock.changes) return;
    running = true;
    const report = { sources: {}, produced: null };
    try {
      const results = await Promise.allSettled([repos(), ...SOURCES.map(readFeed)]);
      const entries = [];
      for (const [i, result] of results.entries()) {
        const label = i === 0 ? "GitHub" : SOURCES[i - 1].name;
        if (result.status === "rejected") {
          report.sources[label] = { count: 0, failures: 1 };
          continue;
        }
        const rows = i === 0 ? result.value.entries : result.value;
        entries.push(...rows);
        report.sources[label] = { count: rows.length, failures: i === 0 ? result.value.failures : 0 };
      }
      for (const entry of entries) upsert.run(entry.id, entry.kind, JSON.stringify(entry), started);
      db.prepare("DELETE FROM radar_candidates WHERE seen<?").run(started - 90 * 24 * hour);
      if (settings.design) {
        try { report.produced = await createDesign(settings, started); }
        catch (e) { report.designError = e.code && e.code < 500 ? e.message : "Tasarım sağlayıcısından sonuç alınamadı."; }
      }
    } finally {
      db.prepare("UPDATE radar_agent SET last_run=?,lock_until=0,report=? WHERE id=1 AND lock_until=?").run(started, JSON.stringify(report), lease);
      running = false;
    }
  }

  route("GET", "/api/admin/radar-agent", toState);
  route("PUT", "/api/admin/radar-agent", ({ body }) => {
    need(typeof body.enabled === "boolean" && typeof body.design === "boolean", 400, "Ajan ayarları geçersiz");
    need(HOURS.includes(body.hours) && [10,30,60,120].includes(body.monthlyCredits), 400, "Aralık veya kredi bütçesi geçersiz");
    const { enabled, design, hours, monthlyCredits } = body;
    db.prepare("UPDATE radar_agent SET settings=? WHERE id=1").run(JSON.stringify({ enabled, design, hours, monthlyCredits }));
    return toState();
  });
  route("POST", "/api/admin/radar-agent/run", () => {
    void scan(true).catch(console.error);
    return toState();
  });
  route("POST", "/api/admin/radar-agent/dismiss", ({ body }) => {
    need(typeof body.id === "string" && body.id.length < 1000, 400, "Kaynak kimliği geçersiz");
    db.prepare("UPDATE radar_candidates SET dismissed=1 WHERE id=?").run(body.id);
    return toState();
  });
  return () => {
    const tick = () => { void scan().catch(console.error); };
    const timer = setInterval(tick, 60_000);
    timer.unref();
  };
}

import { createHash } from "node:crypto";

const fields = ["usability", "functionality", "presentation"];
const fingerprint = app => {
  const { radarOrigin, source } = JSON.parse(app.meta || "{}");
  return createHash("sha256").update(JSON.stringify([app.html, app.title, radarOrigin, source])).digest("hex");
};
export const fromRadar = app => !!JSON.parse(app.meta || "{}").radarOrigin;

export function registerRadarRelease({ db, route, need, isAdmin, ownApp, appRow }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS radar_reviews(app_id TEXT PRIMARY KEY REFERENCES apps(id) ON DELETE CASCADE,
      fingerprint TEXT NOT NULL, review TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS radar_releases(app_id TEXT PRIMARY KEY REFERENCES apps(id) ON DELETE CASCADE,
      html TEXT NOT NULL, review TEXT NOT NULL);
  `);
  const reviewRow = db.prepare("SELECT * FROM radar_reviews WHERE app_id=?");
  const releaseRow = db.prepare("SELECT * FROM radar_releases WHERE app_id=?");
  const review = app => {
    if (!fromRadar(app)) return null;
    const row = reviewRow.get(app.id);
    return row && row.fingerprint === fingerprint(app) ? JSON.parse(row.review) : null;
  };
  const release = id => releaseRow.get(id);
  function approve(app, body) {
    need(fromRadar(app), 400, "Bu proje Radar üretim akışına ait değil.");
    need(body.rights === true && body.security === true, 400, "Yayın haklarını ve güvenlik incelemesini doğrulayın.");
    need(fields.every(k => Number.isInteger(body[k]) && body[k] >= 1 && body[k] <= 5), 400, "Her kalite puanı 1 ile 5 arasında olmalı.");
    const value = { score:Math.round((body.usability * 0.3 + body.functionality * 0.5 + body.presentation * 0.2) * 20),
      rights:true, security:true, date:new Date().toISOString() };
    for (const field of fields) value[field] = body[field];
    need(value.score >= 70, 409, "Yayın için kalite puanı en az 70 olmalı.");
    db.prepare(`INSERT INTO radar_reviews(app_id,fingerprint,review) VALUES(?,?,?)
      ON CONFLICT(app_id) DO UPDATE SET fingerprint=excluded.fingerprint,review=excluded.review`).run(app.id, fingerprint(app), JSON.stringify(value));
  }
  function requireApproval(app) {
    if (!fromRadar(app)) return null;
    const value = review(app);
    need(value, 409, "Bu taslak güncel bir Radar yayın incelemesi gerektiriyor.");
    return value;
  }
  function snapshot(app, value) {
    if (!value) return;
    db.prepare(`INSERT INTO radar_releases(app_id,html,review) VALUES(?,?,?)
      ON CONFLICT(app_id) DO UPDATE SET html=excluded.html,review=excluded.review`).run(app.id, app.html, JSON.stringify(value));
  }
  route("POST", "/api/admin/radar-review/:id", ({ user, params, body }) => {
    need(isAdmin(user), 403, "Yönetici yetkisi gerekiyor.");
    const app = ownApp(user, params.id);
    approve(app, body);
    return { app:appRow(app) };
  });
  return { review, release, requireApproval, snapshot };
}

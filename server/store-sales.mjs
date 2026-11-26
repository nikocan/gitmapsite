export function registerStoreSales({ db, route, need }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS store_sales(app_id TEXT REFERENCES apps(id) ON DELETE CASCADE,
      buyer_id TEXT REFERENCES users(id) ON DELETE CASCADE, amount INTEGER NOT NULL,
      requested TEXT DEFAULT (datetime('now')), paid TEXT, reference TEXT,
      PRIMARY KEY(app_id,buyer_id));
  `);
  const lookup = db.prepare("SELECT * FROM store_sales WHERE app_id=? AND buyer_id=?");
  const listing = db.prepare("SELECT id,owner_id,price FROM apps WHERE slug=? AND status='published' AND listed=1");
  const publicSale = row => row ? { amount:row.amount, status:row.paid ? "paid" : "pending" } : null;
  const forBuyer = (user, slug) => {
    need(user, 401, "Satın alma talebi için giriş yapın.");
    const app = listing.get(slug);
    need(app, 404, "Uygulama bulunamadı.");
    return app;
  };
  route("GET", "/api/store/:slug/sale", ({ user, params }) => {
    const app = forBuyer(user, params.slug);
    return { sale:publicSale(lookup.get(app.id, user.id)) };
  });
  route("POST", "/api/store/:slug/sale", ({ user, params }) => {
    const app = forBuyer(user, params.slug);
    need(app.price > 0 && app.owner_id !== user.id, 400, "Bu ürün için satın alma talebi açılamaz.");
    db.prepare("INSERT OR IGNORE INTO store_sales(app_id,buyer_id,amount) VALUES(?,?,?)").run(app.id, user.id, app.price);
    return { sale:publicSale(lookup.get(app.id, user.id)) };
  });
  route("GET", "/api/admin/store-sales", ({ url }) => {
    const page = Math.max(1, Math.min(1000, Number.parseInt(url.searchParams.get("page"), 10) || 1));
    const rows = db.prepare(`SELECT s.app_id,s.buyer_id,s.amount,s.requested,s.paid,s.reference,a.title,u.email
      FROM store_sales s JOIN apps a ON a.id=s.app_id JOIN users u ON u.id=s.buyer_id
      ORDER BY s.paid IS NOT NULL,s.requested DESC,s.app_id,s.buyer_id LIMIT 31 OFFSET ?`).all((page - 1) * 30);
    return { rows:rows.slice(0, 30), more:rows.length > 30 };
  });
  route("POST", "/api/admin/store-sales/confirm", ({ body }) => {
    const reference = typeof body.reference === "string" ? body.reference.trim() : "";
    need(reference.length >= 4 && reference.length <= 120, 400, "Ödeme referansı 4 ile 120 karakter arasında olmalı.");
    need(typeof body.appId === "string" && typeof body.buyerId === "string", 400, "Satın alma talebi geçersiz.");
    const row = lookup.get(body.appId, body.buyerId);
    need(row, 404, "Satın alma talebi bulunamadı.");
    db.prepare("UPDATE store_sales SET paid=datetime('now'),reference=? WHERE app_id=? AND buyer_id=? AND paid IS NULL")
      .run(reference, body.appId, body.buyerId);
    return { sale:publicSale(lookup.get(body.appId, body.buyerId)) };
  });
  return (appId, buyerId) => !!lookup.get(appId, buyerId)?.paid;
}

// Kredi paketleri, ödemeler (Stripe Checkout + Havale/EFT) ve kredi kuralları.
// Bir ödeme yalnızca bir kez krediye dönüşür: durum "pending" → "paid" geçişi tek SQL koşuluyla yapılır.
import crypto from "node:crypto";

const DEFAULT_PACKS = [
  { id: "p100", credits: 100, bonus: 0, price: 14900, label: "Başlangıç", popular: 0, sort: 1 },
  { id: "p300", credits: 300, bonus: 30, price: 39900, label: "Popüler", popular: 1, sort: 2 },
  { id: "p1000", credits: 1000, bonus: 150, price: 119000, label: "Profesyonel", popular: 0, sort: 3 },
];
const STATUS = ["pending", "paid", "cancelled", "refunded", "failed"];

export function registerPayments({ db, route, need, HttpErr, encKey, decKey, cfg, tiers, isAdmin }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS credit_packs(id TEXT PRIMARY KEY, credits INTEGER NOT NULL, bonus INTEGER DEFAULT 0, price INTEGER NOT NULL,
      label TEXT, popular INTEGER DEFAULT 0, active INTEGER DEFAULT 1, sort INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE SET NULL, pack_id TEXT, credits INTEGER NOT NULL,
      amount INTEGER NOT NULL, currency TEXT DEFAULT 'try', method TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      created TEXT DEFAULT (datetime('now')), paid TEXT, notified TEXT, reference TEXT, session TEXT, intent TEXT, note TEXT);
    CREATE INDEX IF NOT EXISTS payments_user ON payments(user_id, created);
    CREATE INDEX IF NOT EXISTS payments_status ON payments(status, created);
  `);
  const q = (sql) => db.prepare(sql);
  if (!q("SELECT COUNT(*) n FROM credit_packs").get().n) for (const p of DEFAULT_PACKS)
    q("INSERT INTO credit_packs(id,credits,bonus,price,label,popular,sort) VALUES(?,?,?,?,?,?,?)").run(p.id, p.credits, p.bonus, p.price, p.label, p.popular, p.sort);

  // ---------- Ayarlar (server_settings: billing) ----------
  const DEF = { iban: "", accountName: "", bank: "", card: true, havale: true, signupCredits: +(process.env.SIGNUP_CREDITS || 25), refCredits: +(process.env.REF_CREDITS || 50), tiers: null, stripeSecret: "", stripeWebhook: "" };
  const readS = () => { const r = q("SELECT v FROM server_settings WHERE k='billing'").get(); let v = {}; try { v = r ? JSON.parse(r.v) : {}; } catch { } return { ...DEF, ...v }; };
  const writeS = (v) => q("INSERT INTO server_settings(k,v) VALUES('billing',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").run(JSON.stringify(v));
  const secret = (s, k) => { const env = k === "stripeSecret" ? process.env.STRIPE_SECRET_KEY : process.env.STRIPE_WEBHOOK_SECRET; if (env) return env; try { return s[k] ? decKey(s[k]) : ""; } catch { return ""; } };
  const applyTiers = () => { const s = readS(); if (s.tiers) for (const k of ["hizli", "dengeli", "guclu"]) if (Number.isInteger(s.tiers[k]) && s.tiers[k] >= 0) tiers[k] = s.tiers[k]; };
  applyTiers();
  const stripeKey = () => secret(readS(), "stripeSecret");
  const cardOn = () => { const s = readS(); return s.card !== false && !!stripeKey(); };
  const havaleOn = () => { const s = readS(); return s.havale !== false && !!s.iban; };

  // ---------- Yardımcılar ----------
  const packs = (all = false) => q("SELECT * FROM credit_packs " + (all ? "" : "WHERE active=1 ") + "ORDER BY sort,price").all()
    .map((p) => ({ id: p.id, credits: p.credits, bonus: p.bonus || 0, price: p.price, label: p.label || "", popular: !!p.popular, active: !!p.active, sort: p.sort }));
  const pubPay = (p) => p && { id: p.id, credits: p.credits, amount: p.amount, currency: p.currency, method: p.method, status: p.status, created: p.created, paid: p.paid, notified: p.notified, reference: p.method === "havale" ? p.reference : undefined };
  const newId = () => "GM" + Date.now().toString(36).toUpperCase().slice(-6) + crypto.randomBytes(2).toString("hex").toUpperCase();
  const log = (uid, amount, reason) => q("INSERT INTO credit_log(user_id,amount,reason) VALUES(?,?,?)").run(uid, amount, reason);

  // Ödemeyi tamamla: krediyi yükle (tek sefer)
  function finalize(id, reference, extra = {}) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const p = q("SELECT * FROM payments WHERE id=?").get(id);
      if (!p || p.status !== "pending") { db.exec("COMMIT"); return { done: false, payment: p }; }
      q("UPDATE payments SET status='paid', paid=datetime('now'), reference=COALESCE(?,reference), intent=COALESCE(?,intent) WHERE id=? AND status='pending'").run(reference || null, extra.intent || null, id);
      if (p.user_id) { q("UPDATE users SET credits=COALESCE(credits,0)+? WHERE id=?").run(p.credits, p.user_id); log(p.user_id, p.credits, "Kredi satın alma · " + p.id + (p.method === "stripe" ? " · kart" : " · havale")); }
      db.exec("COMMIT"); return { done: true, payment: q("SELECT * FROM payments WHERE id=?").get(id) };
    } catch (e) { db.exec("ROLLBACK"); throw e; }
  }

  async function stripe(method, path, form) {
    const key = stripeKey(); need(key, 503, "Kart ile ödeme henüz yapılandırılmadı.");
    let r; try {
      r = await fetch((process.env.STRIPE_API_BASE || "https://api.stripe.com/v1") + path, { method, headers: { Authorization: "Bearer " + key, "Content-Type": "application/x-www-form-urlencoded" }, body: form ? new URLSearchParams(form).toString() : undefined, signal: AbortSignal.timeout(20000) });
    } catch { throw new HttpErr(504, "Ödeme sağlayıcısına ulaşılamadı, tekrar deneyin."); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new HttpErr(502, "Stripe: " + String(j.error?.message || r.status).slice(0, 200));
    return j;
  }
  const safeReturn = (u) => { try { const x = new URL(String(u || "")); if (cfg.cors.includes(x.origin)) return x.origin + x.pathname; } catch { } return cfg.site + "/"; };

  async function verifyStripe(p) {
    if (!p || p.method !== "stripe" || p.status !== "pending" || !p.session) return p;
    const s = await stripe("GET", "/checkout/sessions/" + encodeURIComponent(p.session));
    if (s.payment_status === "paid") return finalize(p.id, s.payment_intent || s.id, { intent: s.payment_intent }).payment;
    if (s.status === "expired") { q("UPDATE payments SET status='failed', note='Ödeme süresi doldu' WHERE id=? AND status='pending'").run(p.id); return q("SELECT * FROM payments WHERE id=?").get(p.id); }
    return p;
  }

  // ---------- Herkese açık / kullanıcı ----------
  route("GET", "/api/billing", ({ user }) => {
    const s = readS();
    const out = { packs: packs(), methods: { card: cardOn(), havale: havaleOn() ? { iban: s.iban, name: s.accountName, bank: s.bank } : null }, tiers: { ...tiers }, signupCredits: s.signupCredits };
    if (user) {
      out.balance = q("SELECT credits FROM users WHERE id=?").get(user.id)?.credits ?? 0;
      out.payments = q("SELECT * FROM payments WHERE user_id=? ORDER BY created DESC LIMIT 20").all(user.id).map(pubPay);
      out.log = q("SELECT created,amount,reason FROM credit_log WHERE user_id=? ORDER BY id DESC LIMIT 40").all(user.id);
      out.month = q("SELECT COALESCE(-SUM(amount),0) n FROM credit_log WHERE user_id=? AND amount<0 AND created>=datetime('now','start of month')").get(user.id).n;
    }
    return out;
  });

  route("POST", "/api/billing/checkout", async ({ user, body }) => {
    need(user, 401, "Kredi yüklemek için giriş yapın.");
    const pack = q("SELECT * FROM credit_packs WHERE id=? AND active=1").get(String(body.pack || ""));
    need(pack, 404, "Paket bulunamadı.");
    const method = body.method === "havale" ? "havale" : "stripe";
    need(method === "havale" ? havaleOn() : cardOn(), 400, method === "havale" ? "Havale/EFT şu an kullanılamıyor." : "Kart ile ödeme şu an kullanılamıyor.");
    const open = q("SELECT COUNT(*) n FROM payments WHERE user_id=? AND status='pending' AND created>datetime('now','-1 day')").get(user.id).n;
    need(open < 5, 429, "Bekleyen çok fazla ödeme talebin var. Önce onları tamamla ya da iptal et.");
    const id = newId(); const credits = pack.credits + (pack.bonus || 0);
    q("INSERT INTO payments(id,user_id,pack_id,credits,amount,method,reference) VALUES(?,?,?,?,?,?,?)").run(id, user.id, pack.id, credits, pack.price, method, method === "havale" ? id : null);
    if (method === "havale") { const s = readS(); return { payment: pubPay(q("SELECT * FROM payments WHERE id=?").get(id)), havale: { iban: s.iban, name: s.accountName, bank: s.bank } }; }
    const back = safeReturn(body.returnUrl);
    try {
      const ses = await stripe("POST", "/checkout/sessions", {
        mode: "payment", client_reference_id: id, customer_email: user.email, "metadata[payment_id]": id, "payment_intent_data[metadata][payment_id]": id,
        "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "try", "line_items[0][price_data][unit_amount]": String(pack.price),
        "line_items[0][price_data][product_data][name]": "Gitmapp " + credits + " kredi" + (pack.bonus ? " (" + pack.bonus + " bonus dahil)" : ""),
        success_url: back + "#hesabim?odeme=" + id, cancel_url: back + "#hesabim?odeme=" + id + "&iptal=1", locale: "tr",
      });
      q("UPDATE payments SET session=? WHERE id=?").run(ses.id, id);
      return { payment: pubPay(q("SELECT * FROM payments WHERE id=?").get(id)), url: ses.url };
    } catch (e) { q("UPDATE payments SET status='failed', note=? WHERE id=?").run(String(e.message).slice(0, 200), id); throw e; }
  });

  const mine = (user, id) => { need(user, 401, "Giriş yapın."); const p = q("SELECT * FROM payments WHERE id=?").get(id); need(p && (p.user_id === user.id || isAdmin(user)), 404, "Ödeme bulunamadı."); return p; };
  route("POST", "/api/billing/payments/:id/verify", async ({ user, params }) => ({ payment: pubPay(await verifyStripe(mine(user, params.id))) }));
  route("POST", "/api/billing/payments/:id/notify", ({ user, params }) => {
    const p = mine(user, params.id); need(p.method === "havale" && p.status === "pending", 400, "Bu ödeme için bildirim yapılamaz.");
    q("UPDATE payments SET notified=datetime('now') WHERE id=?").run(p.id); return { payment: pubPay(q("SELECT * FROM payments WHERE id=?").get(p.id)) };
  });
  route("POST", "/api/billing/payments/:id/cancel", ({ user, params }) => {
    const p = mine(user, params.id); need(p.status === "pending", 400, "Yalnızca bekleyen ödemeler iptal edilebilir.");
    q("UPDATE payments SET status='cancelled', note='Kullanıcı iptal etti' WHERE id=? AND status='pending'").run(p.id); return { payment: pubPay(q("SELECT * FROM payments WHERE id=?").get(p.id)) };
  });

  // Stripe bildirimi: imza doğrulanır, ödeme tamamlanır
  route("POST", "/api/payments/stripe/webhook", ({ req }) => {
    const whs = secret(readS(), "stripeWebhook"); need(whs, 503, "Webhook yapılandırılmadı.");
    const raw = req.rawBody || Buffer.alloc(0); const sig = String(req.headers["stripe-signature"] || "");
    const parts = Object.fromEntries(sig.split(",").map((x) => x.split("=")).filter((x) => x.length === 2).map(([k, v]) => [k, v])); const t = +parts.t;
    const v1s = sig.split(",").filter((x) => x.startsWith("v1=")).map((x) => x.slice(3));
    const want = crypto.createHmac("sha256", whs).update(t + "." + raw.toString("utf8")).digest("hex");
    need(t && Math.abs(Date.now() / 1000 - t) < 600 && v1s.some((v) => v.length === want.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(want))), 400, "İmza geçersiz");
    let ev; try { ev = JSON.parse(raw.toString("utf8")); } catch { need(false, 400, "Geçersiz gövde"); }
    const o = ev.data?.object || {};
    if ((ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") && o.payment_status === "paid") {
      const id = o.metadata?.payment_id || o.client_reference_id; const p = id && q("SELECT * FROM payments WHERE id=? AND session=?").get(id, o.id);
      if (p && p.amount === o.amount_total) finalize(p.id, o.payment_intent || o.id, { intent: o.payment_intent });
    }
    if (ev.type === "checkout.session.expired") { const id = o.metadata?.payment_id; if (id) q("UPDATE payments SET status='failed', note='Ödeme süresi doldu' WHERE id=? AND status='pending'").run(id); }
    return { received: true };
  });

  // ---------- Yönetim ----------
  route("GET", "/api/admin/billing", ({ url }) => {
    const s = readS(); const st = url.searchParams.get("status"); const term = String(url.searchParams.get("q") || "").trim().toLowerCase();
    const where = [], args = [];
    if (STATUS.includes(st)) { where.push("p.status=?"); args.push(st); }
    if (term) { where.push("(LOWER(u.email) LIKE ? OR p.id LIKE ?)"); args.push("%" + term + "%", "%" + term.toUpperCase() + "%"); }
    const rows = q("SELECT p.*, u.email, u.name FROM payments p LEFT JOIN users u ON u.id=p.user_id " + (where.length ? "WHERE " + where.join(" AND ") : "") + " ORDER BY (p.status='pending' AND p.notified IS NOT NULL) DESC, p.created DESC LIMIT 200").all(...args);
    const sum = (w) => q("SELECT COUNT(*) n, COALESCE(SUM(amount),0) a, COALESCE(SUM(credits),0) c FROM payments WHERE " + w).get();
    const used = (w) => q("SELECT COALESCE(-SUM(amount),0) n FROM credit_log WHERE amount<0 AND " + w).get().n;
    return {
      rows: rows.map((r) => ({ ...pubPay(r), reference: r.reference, email: r.email, name: r.name, note: r.note, session: r.session ? "…" + r.session.slice(-6) : null })),
      stats: { month: sum("status='paid' AND paid>=datetime('now','start of month')"), all: sum("status='paid'"), pending: sum("status='pending'"), notified: q("SELECT COUNT(*) n FROM payments WHERE status='pending' AND notified IS NOT NULL").get().n,
        usedMonth: used("created>=datetime('now','start of month')"), balance: q("SELECT COALESCE(SUM(credits),0) n FROM users").get().n },
      packs: packs(true),
      settings: { iban: s.iban, accountName: s.accountName, bank: s.bank, card: s.card !== false, havale: s.havale !== false, signupCredits: s.signupCredits, refCredits: s.refCredits, tiers: { ...tiers },
        stripe: { secret: !!stripeKey(), secretFromEnv: !!process.env.STRIPE_SECRET_KEY, mode: stripeKey().startsWith("sk_live") ? "live" : stripeKey() ? "test" : null, last4: stripeKey() ? stripeKey().slice(-4) : null,
          webhook: !!secret(s, "stripeWebhook"), webhookUrl: cfg.api + "/api/payments/stripe/webhook" } },
    };
  });
  route("POST", "/api/admin/billing/settings", ({ body }) => {
    const s = readS(); const n = { ...s };
    for (const k of ["iban", "accountName", "bank"]) if (typeof body[k] === "string") n[k] = body[k].trim().slice(0, 120);
    if (n.iban) { n.iban = n.iban.replace(/\s+/g, "").toUpperCase(); need(/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(n.iban), 400, "IBAN geçersiz görünüyor."); n.iban = n.iban.replace(/(.{4})/g, "$1 ").trim(); }
    for (const k of ["card", "havale"]) if (typeof body[k] === "boolean") n[k] = body[k];
    for (const k of ["signupCredits", "refCredits"]) if (body[k] != null) { const v = Math.floor(+body[k]); need(Number.isFinite(v) && v >= 0 && v <= 100000, 400, "Kredi miktarı 0–100000 olmalı."); n[k] = v; }
    if (body.tiers && typeof body.tiers === "object") { const t = {}; for (const k of ["hizli", "dengeli", "guclu"]) { const v = Math.floor(+body.tiers[k]); need(Number.isFinite(v) && v >= 0 && v <= 1000, 400, "İşlem kredisi 0–1000 olmalı."); t[k] = v; } n.tiers = t; }
    if (typeof body.stripeSecret === "string") { const v = body.stripeSecret.trim(); need(!v || /^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$/.test(v), 400, "Stripe gizli anahtarı sk_test_… ya da sk_live_… ile başlamalı."); n.stripeSecret = v ? encKey(v) : ""; }
    if (typeof body.stripeWebhook === "string") { const v = body.stripeWebhook.trim(); need(!v || /^whsec_[A-Za-z0-9]{10,}$/.test(v), 400, "Webhook imza anahtarı whsec_… ile başlamalı."); n.stripeWebhook = v ? encKey(v) : ""; }
    writeS(n); applyTiers(); return { ok: true };
  });
  route("POST", "/api/admin/billing/stripe-test", async () => {
    const j = await stripe("GET", "/balance"); return { ok: true, mode: stripeKey().startsWith("sk_live") ? "live" : "test", currencies: (j.available || []).map((b) => b.currency) };
  });
  route("POST", "/api/admin/billing/packs", ({ body }) => {
    need(Array.isArray(body.packs) && body.packs.length >= 1 && body.packs.length <= 8, 400, "1 ile 8 arasında paket olmalı.");
    const clean = body.packs.map((p, i) => {
      const credits = Math.floor(+p.credits), bonus = Math.floor(+(p.bonus || 0)), price = Math.round(+p.price * 100);
      need(credits > 0 && credits <= 1000000 && bonus >= 0 && bonus <= 1000000, 400, "Kredi miktarları geçersiz.");
      need(price >= 1000 && price <= 100000000, 400, "Fiyat en az 10 ₺ olmalı (Stripe alt sınırı).");
      const id = /^[a-z0-9_-]{2,20}$/i.test(p.id || "") ? p.id : "p" + credits + "-" + crypto.randomBytes(2).toString("hex");
      return { id, credits, bonus, price, label: String(p.label || "").slice(0, 30), popular: p.popular ? 1 : 0, active: p.active === false ? 0 : 1, sort: i + 1 };
    });
    need(new Set(clean.map((p) => p.id)).size === clean.length, 400, "Paket kimlikleri benzersiz olmalı.");
    db.exec("BEGIN IMMEDIATE");
    try {
      const keep = new Set(clean.map((p) => p.id));
      for (const p of packs(true)) if (!keep.has(p.id)) q("UPDATE credit_packs SET active=0, sort=99 WHERE id=?").run(p.id); // eski ödemeler için silinmez, gizlenir
      for (const p of clean) q("INSERT INTO credit_packs(id,credits,bonus,price,label,popular,active,sort) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET credits=excluded.credits,bonus=excluded.bonus,price=excluded.price,label=excluded.label,popular=excluded.popular,active=excluded.active,sort=excluded.sort").run(p.id, p.credits, p.bonus, p.price, p.label, p.popular, p.active, p.sort);
      db.exec("COMMIT");
    } catch (e) { db.exec("ROLLBACK"); throw e; }
    return { packs: packs(true) };
  });
  const adminPay = (id) => { const p = q("SELECT * FROM payments WHERE id=?").get(id); need(p, 404, "Ödeme bulunamadı."); return p; };
  route("POST", "/api/admin/billing/payments/:id/confirm", ({ params, body }) => {
    const p = adminPay(params.id); need(p.status === "pending", 400, "Yalnızca bekleyen ödeme onaylanabilir.");
    const ref = String(body.reference || "").trim().slice(0, 120) || "Yönetici onayı";
    return { payment: pubPay(finalize(p.id, ref).payment) };
  });
  route("POST", "/api/admin/billing/payments/:id/verify", async ({ params }) => ({ payment: pubPay(await verifyStripe(adminPay(params.id))) }));
  route("POST", "/api/admin/billing/payments/:id/cancel", ({ params }) => {
    const p = adminPay(params.id); need(p.status === "pending", 400, "Yalnızca bekleyen ödeme iptal edilebilir.");
    q("UPDATE payments SET status='cancelled', note='Yönetici iptal etti' WHERE id=? AND status='pending'").run(p.id); return { ok: true };
  });
  route("POST", "/api/admin/billing/payments/:id/refund", async ({ params, body }) => {
    const p = adminPay(params.id); need(p.status === "paid", 400, "Yalnızca tamamlanmış ödeme iade edilebilir.");
    if (p.method === "stripe" && body.stripe !== false) { need(p.intent, 400, "Stripe ödeme kimliği yok; iadeyi Stripe panelinden yapıp burada “yalnızca kayıt” seçin."); await stripe("POST", "/refunds", { payment_intent: p.intent, "metadata[payment_id]": p.id }); }
    db.exec("BEGIN IMMEDIATE");
    try {
      if (!q("UPDATE payments SET status='refunded', note=? WHERE id=? AND status='paid'").run("İade · " + String(body.note || "").slice(0, 100), p.id).changes) { db.exec("COMMIT"); return { ok: false }; }
      if (p.user_id) { const bal = q("SELECT COALESCE(credits,0) c FROM users WHERE id=?").get(p.user_id)?.c || 0; const take = Math.min(bal, p.credits);
        if (take) { q("UPDATE users SET credits=credits-? WHERE id=?").run(take, p.user_id); log(p.user_id, -take, "İade · " + p.id); } }
      db.exec("COMMIT");
    } catch (e) { db.exec("ROLLBACK"); throw e; }
    return { ok: true };
  });

  return { signupCredits: () => readS().signupCredits, refCredits: () => readS().refCredits };
}

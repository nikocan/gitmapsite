import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const server = fileURLToPath(new URL("server.mjs", import.meta.url));
const WHSEC = "whsec_" + "t".repeat(24);

// Sahte Stripe: oturum oluşturur, sorgulanınca "paid" döner, iade kaydeder
async function fakeStripe() {
  const sessions = new Map(); const refunds = [];
  const s = http.createServer(async (req, res) => {
    let body = ""; for await (const c of req) body += c; const f = Object.fromEntries(new URLSearchParams(body));
    const send = (o, code = 200) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.method === "POST" && req.url === "/v1/checkout/sessions") { const id = "cs_test_" + crypto.randomBytes(4).toString("hex"); sessions.set(id, { id, amount_total: +f["line_items[0][price_data][unit_amount]"], payment_status: "unpaid", status: "open", meta: f["metadata[payment_id]"] }); return send({ id, url: "https://checkout.stripe.test/" + id }); }
    const m = req.url.match(/^\/v1\/checkout\/sessions\/(.+)$/); if (m) { const x = sessions.get(decodeURIComponent(m[1])); return x ? send({ ...x, payment_intent: "pi_" + x.id }) : send({ error: { message: "yok" } }, 404); }
    if (req.url === "/v1/refunds") { refunds.push(f); return send({ id: "re_1", status: "succeeded" }); }
    if (req.url === "/v1/balance") return send({ available: [{ currency: "try", amount: 0 }] });
    send({ error: { message: "?" } }, 404);
  });
  s.listen(0, "127.0.0.1"); await once(s, "listening");
  return { base: "http://127.0.0.1:" + s.address().port + "/v1", sessions, refunds, close: () => s.close() };
}

async function fixture(t, extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), "gitmapp-pay-"));
  const env = { ...process.env, PORT: "0", DB_PATH: join(dir, "db"), ADMIN_EMAIL: "owner@example.test", SECRET: crypto.randomBytes(32).toString("hex"), GITHUB_CLIENT_ID: "", GOOGLE_CLIENT_ID: "", STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "", ...extra };
  const pw = execFileSync(process.execPath, [server, "create-admin"], { env, encoding: "utf8" }).match(/Şifre: (\S+)/)[1];
  const child = spawn(process.execPath, [server], { env, stdio: ["ignore", "pipe", "inherit"] });
  t.after(async () => { if (child.exitCode === null) { const end = once(child, "exit"); child.kill(); await end; } rmSync(dir, { recursive: true, force: true }); });
  const port = (await once(child.stdout, "data"))[0].toString().match(/API :(\d+)/)[1];
  const base = "http://127.0.0.1:" + port;
  const req = async (method, path, body, token, headers = {}) => { const r = await fetch(base + "/api/" + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}), ...headers }, body: body == null ? undefined : typeof body === "string" ? body : JSON.stringify(body) }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
  const admin = (await req("POST", "auth/login", { email: env.ADMIN_EMAIL, password: pw })).token;
  const user = await req("POST", "auth/register", { email: "alici@example.test", password: crypto.randomBytes(12).toString("hex"), name: "Alıcı" });
  return { req, admin, user, base };
}
const balance = async (req, tok) => (await req("GET", "billing", null, tok)).balance;

test("varsayılan paketler, kayıt kredisi ve ödeme yöntemleri ayarlanana kadar kapalı", async (t) => {
  const { req, admin, user } = await fixture(t);
  const b = await req("GET", "billing", null, user.token);
  assert.equal(b.packs.length, 3); assert.equal(b.packs[1].bonus, 30); assert.equal(b.methods.card, false); assert.equal(b.methods.havale, null);
  assert.equal(b.balance, 25); assert.equal(b.log[0].reason, "Hoş geldin kredisi");
  assert.equal((await req("POST", "billing/checkout", { pack: "p100", method: "havale" }, user.token)).status, 400);
  assert.equal((await req("GET", "admin/billing", null, user.token)).status, 403);
  // Kayıt kredisi ve işlem ücretleri panelden değişir
  assert.equal((await req("POST", "admin/billing/settings", { signupCredits: 40, tiers: { hizli: 2, dengeli: 4, guclu: 9 } }, admin)).status, 200);
  const u2 = await req("POST", "auth/register", { email: "yeni@example.test", password: "uzun-bir-sifre-1" });
  assert.equal(u2.user.credits, 40);
  assert.deepEqual((await req("GET", "billing")).tiers, { hizli: 2, dengeli: 4, guclu: 9 });
  assert.equal((await req("POST", "admin/billing/settings", { iban: "TR12 3456" }, admin)).status, 400);
});

test("havale: talep → bildirim → yönetici onayı krediyi bir kez yükler, iade geri alır", async (t) => {
  const { req, admin, user } = await fixture(t);
  assert.equal((await req("POST", "admin/billing/settings", { iban: "TR33 0006 1005 1978 6457 8413 26", accountName: "Gitmapp", bank: "Test Bankası" }, admin)).status, 200);
  const c = await req("POST", "billing/checkout", { pack: "p300", method: "havale" }, user.token);
  assert.equal(c.status, 200); assert.equal(c.payment.credits, 330); assert.equal(c.payment.amount, 39900); assert.match(c.havale.iban, /^TR33 0006/);
  assert.equal((await req("POST", "billing/payments/" + c.payment.id + "/notify", {}, user.token)).payment.notified != null, true);
  const list = await req("GET", "admin/billing?status=pending", null, admin);
  assert.equal(list.rows[0].id, c.payment.id); assert.equal(list.stats.notified, 1);
  assert.equal((await req("POST", "admin/billing/payments/" + c.payment.id + "/confirm", { reference: "Dekont 123" }, admin)).payment.status, "paid");
  assert.equal(await balance(req, user.token), 25 + 330);
  assert.equal((await req("POST", "admin/billing/payments/" + c.payment.id + "/confirm", {}, admin)).status, 400); // ikinci onay yok
  assert.equal(await balance(req, user.token), 355);
  const st = (await req("GET", "admin/billing", null, admin)).stats; assert.equal(st.month.a, 39900); assert.equal(st.month.c, 330);
  assert.equal((await req("POST", "admin/billing/payments/" + c.payment.id + "/refund", { stripe: false }, admin)).ok, true);
  assert.equal(await balance(req, user.token), 25);
  // Kullanıcı kendi bekleyen talebini iptal eder; başkasınınkine erişemez
  const d = await req("POST", "billing/checkout", { pack: "p100", method: "havale" }, user.token);
  const other = await req("POST", "auth/register", { email: "baska@example.test", password: "uzun-bir-sifre-2" });
  assert.equal((await req("POST", "billing/payments/" + d.payment.id + "/cancel", {}, other.token)).status, 404);
  assert.equal((await req("POST", "billing/payments/" + d.payment.id + "/cancel", {}, user.token)).payment.status, "cancelled");
});

test("stripe: oturum açılır, dönüşte doğrulama ve imzalı webhook krediyi yalnız bir kez yükler", async (t) => {
  const fs = await fakeStripe(); t.after(() => fs.close());
  const { req, admin, user } = await fixture(t, { STRIPE_API_BASE: fs.base });
  assert.equal((await req("POST", "admin/billing/settings", { stripeSecret: "sk_test_" + "x".repeat(20), stripeWebhook: WHSEC }, admin)).status, 200);
  const adm = await req("GET", "admin/billing", null, admin); assert.equal(adm.settings.stripe.mode, "test"); assert.equal(adm.settings.stripe.webhook, true);
  assert.equal(JSON.stringify(adm).includes("xxxxxxxxxx"), false); // anahtar dışarı sızmaz
  assert.equal((await req("GET", "billing")).methods.card, true);
  const c = await req("POST", "billing/checkout", { pack: "p100", method: "card", returnUrl: "https://evil.example/" }, user.token);
  assert.match(c.url, /checkout\.stripe\.test/);
  const ses = [...fs.sessions.values()][0]; assert.equal(ses.amount_total, 14900);
  assert.equal((await req("POST", "billing/payments/" + c.payment.id + "/verify", {}, user.token)).payment.status, "pending");
  // Sahte imzalı webhook reddedilir
  const ev = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: ses.id, payment_status: "paid", amount_total: 14900, payment_intent: "pi_x", metadata: { payment_id: c.payment.id }, client_reference_id: c.payment.id } } });
  const ts = Math.floor(Date.now() / 1000);
  assert.equal((await req("POST", "payments/stripe/webhook", ev, null, { "Stripe-Signature": "t=" + ts + ",v1=" + "0".repeat(64) })).status, 400);
  const sig = crypto.createHmac("sha256", WHSEC).update(ts + "." + ev).digest("hex");
  assert.equal((await req("POST", "payments/stripe/webhook", ev, null, { "Stripe-Signature": "t=" + ts + ",v1=" + sig })).received, true);
  assert.equal(await balance(req, user.token), 125);
  await req("POST", "payments/stripe/webhook", ev, null, { "Stripe-Signature": "t=" + ts + ",v1=" + sig }); // tekrar gelen bildirim
  ses.payment_status = "paid"; await req("POST", "billing/payments/" + c.payment.id + "/verify", {}, user.token);
  assert.equal(await balance(req, user.token), 125);
  // Dönüşte doğrulama yolu (webhook gelmese de)
  const c2 = await req("POST", "billing/checkout", { pack: "p100", method: "card" }, user.token);
  [...fs.sessions.values()].at(-1).payment_status = "paid";
  assert.equal((await req("POST", "billing/payments/" + c2.payment.id + "/verify", {}, user.token)).payment.status, "paid");
  assert.equal(await balance(req, user.token), 225);
  assert.equal((await req("POST", "admin/billing/payments/" + c2.payment.id + "/refund", {}, admin)).ok, true);
  assert.equal(fs.refunds.length, 1); assert.equal(await balance(req, user.token), 125);
});

test("paket düzenleme: fiyat alt sınırı, gizlenen paket satın alınamaz", async (t) => {
  const { req, admin, user } = await fixture(t);
  assert.equal((await req("POST", "admin/billing/packs", { packs: [{ credits: 50, price: 5 }] }, admin)).status, 400);
  const r = await req("POST", "admin/billing/packs", { packs: [{ id: "mini", credits: 50, price: 79.9, label: "Mini" }, { id: "p300", credits: 300, bonus: 60, price: 399, popular: true }] }, admin);
  assert.equal(r.packs.find((p) => p.id === "p100").active, false);
  const pub = await req("GET", "billing"); assert.deepEqual(pub.packs.map((p) => p.id), ["mini", "p300"]); assert.equal(pub.packs[0].price, 7990);
  await req("POST", "admin/billing/settings", { iban: "TR33 0006 1005 1978 6457 8413 26" }, admin);
  assert.equal((await req("POST", "billing/checkout", { pack: "p100", method: "havale" }, user.token)).status, 404);
});

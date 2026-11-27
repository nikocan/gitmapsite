import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { auditHtml, intentOf, fill, privateIp } from "./outreach.mjs";

const server = fileURLToPath(new URL("server.mjs", import.meta.url));

test("site analizi sorunları ölçer, niyet ve alan doldurma çalışır", () => {
  const old = auditHtml({ html: "<title>Eski</title><font>x</font> © 2015 info@lokanta.test", finalUrl: "http://lokanta.test/", status: 200, ms: 4200, bytes: 1000 }, 2026);
  assert.ok(old.problems.some((p) => p.includes("telefona uyumlu"))); assert.ok(old.problems.some((p) => p.includes("2015"))); assert.ok(old.problems.some((p) => p.includes("https")));
  assert.deepEqual(old.emails, ["info@lokanta.test"]); assert.ok(old.score >= 80);
  const good = auditHtml({ html: '<meta name="viewport" content="width=device-width"><meta name="description" content="Kadıköy\'de ev yemekleri, online rezervasyon"> randevu wa.me/90 © 2026', finalUrl: "https://iyi.test/", status: 200, ms: 400, bytes: 1000 }, 2026);
  assert.ok(good.score < old.score);
  assert.equal(intentOf("Fiyat bilgisi alabilir miyim?"), "ilgili"); assert.equal(intentOf("İlgilenmiyoruz, teşekkürler"), "ret"); assert.equal(intentOf("Şu an değil, ileride"), "sonra");
  assert.equal(fill("Merhaba {{isletme}}{{yok}}", { isletme: "Lokanta" }), "Merhaba Lokanta");
  assert.ok(privateIp("10.1.2.3") && privateIp("127.0.0.1") && privateIp("::1") && !privateIp("8.8.8.8"));
});

test("Haritalar'dan aday → analiz → dizi → yanıt → teklif → ödeme → sipariş", async (t) => {
  // Sahte Google Places + işletme sitesi
  const fake = http.createServer(async (req, res) => {
    let b = ""; for await (const c of req) b += c;
    if (req.url === "/v1/places:searchText") { assert.equal(req.headers["x-goog-api-key"], "AIza" + "x".repeat(35)); const port = fake.address().port; res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ places: [
      { id: "p1", displayName: { text: "Lokanta Deniz" }, formattedAddress: "Kadıköy, İstanbul", nationalPhoneNumber: "0216 000 00 00", websiteUri: "http://127.0.0.1:" + port + "/site", rating: 4.6, userRatingCount: 320, googleMapsUri: "https://maps.google.com/?cid=1" },
      { id: "p2", displayName: { text: "Sitesiz Ocakbaşı" }, rating: 4.2, userRatingCount: 80 }] })); }
    if (req.url === "/site") { res.writeHead(200, { "Content-Type": "text/html" }); return res.end("<title>Lokanta Deniz</title><p>© 2016</p><a href='mailto:iletisim@lokantadeniz.test'>Yaz</a>"); }
    res.writeHead(404); res.end();
  });
  fake.listen(0, "127.0.0.1"); await once(fake, "listening");
  const dir = mkdtempSync(join(tmpdir(), "gitmapp-out-")), outbox = join(dir, "mail");
  const env = { ...process.env, PORT: "0", DB_PATH: join(dir, "db"), ADMIN_EMAIL: "owner@example.test", SECRET: crypto.randomBytes(32).toString("hex"), AI_KEY: "", MAIL_OUTBOX_DIR: outbox, OUTREACH_ALLOW_LOCAL: "1", PLACES_API_BASE: "http://127.0.0.1:" + fake.address().port + "/v1", STRIPE_SECRET_KEY: "", GOOGLE_PLACES_API_KEY: "", OUTREACH_TICK_MS: "3600000" };
  const pw = execFileSync(process.execPath, [server, "create-admin"], { env, encoding: "utf8" }).match(/Şifre: (\S+)/)[1];
  const child = spawn(process.execPath, [server], { env, stdio: ["ignore", "pipe", "inherit"] });
  t.after(async () => { fake.close(); if (child.exitCode === null) { const end = once(child, "exit"); child.kill(); await end; } rmSync(dir, { recursive: true, force: true }); });
  const base = "http://127.0.0.1:" + (await once(child.stdout, "data"))[0].toString().match(/API :(\d+)/)[1];
  const req = async (method, path, body, token) => { const r = await fetch(base + "/api/" + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body == null ? undefined : JSON.stringify(body) }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
  const admin = (await req("POST", "auth/login", { email: env.ADMIN_EMAIL, password: pw })).token;

  assert.equal((await req("POST", "admin/outreach/search", { sector: "restoran", city: "İstanbul" }, admin)).status, 400); // anahtar yok
  assert.equal((await req("POST", "admin/outreach/settings", { placesKey: "AIza" + "x".repeat(35), sender: "Nahit · Gitmapp", company: "Gitmapp Yazılım", address: "İstanbul", newInbound: true }, admin)).status, 200);
  const research = await req("POST", "admin/outreach/research", { city: "İstanbul", sectors: ["restoran", "kafe"] }, admin);
  assert.equal(research.rows.length, 2); assert.equal(research.rows[0].noSite, 1);
  const s = await req("POST", "admin/outreach/search", { sector: "restoran", city: "İstanbul" }, admin); assert.equal(s.added, 2);
  assert.equal((await req("POST", "admin/outreach/search", { sector: "restoran", city: "İstanbul" }, admin)).dup, 2);
  let d = await req("GET", "admin/outreach", null, admin); const L = d.rows.find((r) => r.name === "Lokanta Deniz"), N = d.rows.find((r) => r.name === "Sitesiz Ocakbaşı");
  const a = (await req("POST", "admin/outreach/leads/" + L.id + "/audit", null, admin)).lead;
  assert.equal(a.email, "iletisim@lokantadeniz.test"); assert.equal(a.stage, "analiz"); assert.ok(a.audit.problems.some((p) => p.includes("2016")));
  assert.equal((await req("POST", "admin/outreach/leads/" + N.id + "/audit", null, admin)).lead.audit.nosite, true);
  const pv = await req("GET", "admin/outreach/leads/" + L.id + "/preview", null, admin);
  assert.match(pv.subject, /Lokanta Deniz/); assert.match(pv.text, /templates\/restoran\.html/); assert.match(pv.text, /unsub/);
  const st = await req("POST", "admin/outreach/start", { ids: [L.id, N.id] }, admin);
  assert.equal(st.sent, 1); assert.ok(st.errors[0].includes("e-posta adresi yok"));
  const mails = readdirSync(outbox).map((f) => JSON.parse(readFileSync(join(outbox, f), "utf8")));
  assert.equal(mails.length, 1); assert.equal(mails[0].to, "iletisim@lokantadeniz.test");
  // Gelen yanıt webhook'u: ilgileniyor → ödeme aşaması, otomatik yanıt kapalıyken taslak oluşur
  d = await req("GET", "admin/outreach", null, admin);
  const secret = d.settings.inboundUrl.split("/").pop();
  assert.equal((await req("POST", "out/inbound/" + "0".repeat(secret.length), { from: "x@y.test", text: "a" })).status, 403);
  const inb = await req("POST", "out/inbound/" + secret, { from: "Deniz <iletisim@lokantadeniz.test>", subject: "Re", text: "Merhaba, fiyat ne kadar?\n\nOn Mon wrote: eski" });
  assert.equal(inb.intent, "ilgili"); assert.equal(inb.lead.stage, "odeme"); assert.equal(inb.reply, "taslak");
  const det = await req("GET", "admin/outreach/leads/" + L.id, null, admin);
  const draft = det.messages.find((m) => m.status === "taslak"); assert.match(draft.body, /api\/out\/offer\//);
  assert.equal((await req("POST", "admin/outreach/messages/" + draft.id + "/approve", null, admin)).status, 200);
  // Teklif sayfası ve havale ile teklif → yönetici onayı → Siparişler
  const token = draft.body.match(/out\/offer\/([a-f0-9]{32})/)[1];
  assert.match(await (await fetch(base + "/api/out/offer/" + token)).text(), /Web sitesi yenileme/);
  const hv = await fetch(base + "/api/out/offer/" + token + "/site", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "m=havale" });
  assert.equal(hv.status, 200);
  const offer = (await req("GET", "admin/outreach/leads/" + L.id, null, admin)).offers[0]; assert.equal(offer.amount, 990000);
  assert.equal((await req("POST", "admin/outreach/offers/" + offer.id + "/paid", { reference: "DEKONT1" }, admin)).status, 200);
  const done = await req("GET", "admin/outreach/leads/" + L.id, null, admin);
  assert.equal(done.lead.stage, "odendi"); assert.equal(done.order.status, "Ödendi · yapım bekliyor");
  assert.equal((await req("GET", "admin/outreach", null, admin)).revenue.a, 990000);
  // Listeden çıkma
  await fetch(base + "/api/out/unsub/" + token);
  assert.equal((await req("GET", "admin/outreach/leads/" + L.id, null, admin)).lead.opt_out, 1);
  assert.equal((await req("POST", "admin/outreach/leads/" + L.id + "/send", null, admin)).status, 400);
  assert.equal((await req("GET", "admin/outreach", null)).status, 401);
});

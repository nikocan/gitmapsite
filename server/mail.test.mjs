import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { smtpSend, buildMessage, layout } from "./mail.mjs";

test("SMTP istemcisi: AUTH LOGIN, alıcı ve UTF-8 konu/gövde doğru gider", async (t) => {
  const got = { cmds: [], data: "" };
  const srv = net.createServer((s) => {
    s.setEncoding("utf8"); let inData = false, buf = "", n = 0;
    s.write("220 fake ESMTP\r\n");
    s.on("data", (d) => { buf += d; let i;
      while ((i = buf.indexOf("\r\n")) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 2);
        if (inData) { if (l === ".") { inData = false; s.write("250 OK queued\r\n"); } else got.data += l + "\n"; continue; }
        got.cmds.push(l); n++;
        if (/^EHLO/.test(l)) s.write("250-fake\r\n250 AUTH LOGIN\r\n");
        else if (l === "AUTH LOGIN") s.write("334 VXNlcm5hbWU6\r\n");
        else if (n === 3) s.write("334 UGFzc3dvcmQ6\r\n");
        else if (n === 4) s.write(Buffer.from(l, "base64").toString() === "gizli" ? "235 ok\r\n" : "535 bad\r\n");
        else if (l === "DATA") { inData = true; s.write("354 go\r\n"); }
        else if (l === "QUIT") { s.write("221 bye\r\n"); s.end(); }
        else s.write("250 ok\r\n");
      } });
  });
  srv.listen(0, "127.0.0.1"); await once(srv, "listening"); t.after(() => srv.close());
  const cfg = { host: "127.0.0.1", port: srv.address().port, plain: true, user: "bildirim@ornek.com", pass: "gizli" };
  const { html, text } = layout({ title: "Şifreni sıfırla", intro: "Merhaba Çağrı", button: "Aç", url: "https://gitmapp.com/#x" });
  const r = await smtpSend(cfg, { from: "Gitmapp <bildirim@ornek.com>", to: "ali@ornek.com", raw: buildMessage({ from: "Gitmapp <bildirim@ornek.com>", to: "ali@ornek.com", subject: "Şifre sıfırlama", html, text }) });
  assert.equal(r.ok, true);
  assert.ok(got.cmds.includes("MAIL FROM:<bildirim@ornek.com>")); assert.ok(got.cmds.includes("RCPT TO:<ali@ornek.com>"));
  assert.match(got.data, /Subject: =\?UTF-8\?B\?/);
  const part = got.data.split("Content-Transfer-Encoding: base64\n\n")[1].split("\n--")[0];
  assert.match(Buffer.from(part.replace(/\n/g, ""), "base64").toString(), /Merhaba Çağrı/);
  await assert.rejects(smtpSend({ ...cfg, pass: "yanlis" }, { from: "a@b.co", to: "c@d.co", raw: "x" }), /şifre hatalı/);
});

test("uçtan uca e-posta akışı: kayıt → doğrulama, şifremi unuttum → sıfırlama (tek kullanım), talep bildirimi", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "gitmapp-mail-")); const out = join(dir, "outbox");
  const child = spawn(process.execPath, [fileURLToPath(new URL("server.mjs", import.meta.url))], { env: { ...process.env, PORT: "0", DB_PATH: join(dir, "db"), SECRET: randomBytes(32).toString("hex"), GITHUB_CLIENT_ID: "", GOOGLE_CLIENT_ID: "", MAIL_OUTBOX_DIR: out, ADMIN_EMAIL: "patron@example.test", SITE_URL: "https://gitmapp.com" }, stdio: ["ignore", "pipe", "inherit"] });
  t.after(async () => { if (child.exitCode === null) { const end = once(child, "exit"); child.kill(); await end; } rmSync(dir, { recursive: true, force: true }); });
  const port = (await once(child.stdout, "data"))[0].toString().match(/API :(\d+)/)[1]; const base = "http://127.0.0.1:" + port;
  const req = async (m, p, body, tok) => { const r = await fetch(base + "/api/" + p, { method: m, headers: { "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, ...(await r.json()) }; };
  const mails = async (n) => { for (let i = 0; i < 40; i++) { let f = []; try { f = readdirSync(out).sort(); } catch { } if (f.length >= n) return f.map((x) => JSON.parse(readFileSync(join(out, x), "utf8"))); await new Promise((r) => setTimeout(r, 50)); } throw new Error("e-posta gelmedi"); };
  const link = (m, re) => m.text.match(re)[0];
  const u = await req("POST", "auth/register", { email: "ayse@example.test", password: "ilk-sifre-123", name: "Ayşe" });
  assert.equal(u.user.verified, false);
  let box = await mails(1); assert.equal(box[0].to, "ayse@example.test"); assert.match(box[0].subject, /doğrula/);
  const v = await fetch(base + link(box[0], /\/api\/auth\/verify\?t=\S+/), { redirect: "manual" });
  assert.equal(v.status, 302); assert.match(v.headers.get("location"), /#eposta-dogrulandi$/);
  assert.equal((await req("GET", "auth/me", null, u.token)).user.verified, true);
  assert.equal((await fetch(base + "/api/auth/verify?t=sahte", { redirect: "manual" })).headers.get("location").endsWith("#eposta-hata"), true);
  // Olmayan hesap: aynı yanıt, e-posta yok
  assert.equal((await req("POST", "auth/forgot", { email: "yok@example.test" })).ok, true);
  assert.equal((await req("POST", "auth/forgot", { email: "ayse@example.test" })).ok, true);
  box = await mails(2); assert.equal(box.length, 2); const reset = decodeURIComponent(link(box[1], /#sifre-sifirla\?t=\S+/).split("t=")[1]);
  assert.equal((await req("POST", "auth/reset", { token: reset, password: "kisa" })).status, 400);
  const r = await req("POST", "auth/reset", { token: reset, password: "yeni-sifre-456" }); assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal((await req("GET", "auth/me", null, u.token)).user, null, "eski oturum kapandı");
  assert.equal((await req("POST", "auth/reset", { token: reset, password: "baska-sifre-789" })).status, 400, "bağlantı tek kullanımlık");
  assert.equal((await req("POST", "auth/login", { email: "ayse@example.test", password: "yeni-sifre-456" })).status, 200);
  box = await mails(3); assert.match(box[2].subject, /Şifren değiştirildi/);
  // Talep: müşteriye ve yöneticiye bildirim
  const o = await req("POST", "orders", { id: "GM-TEST1", name: "Ali", email: "ali@example.test", total: 1500 });
  assert.equal(o.mailed, true);
  box = await mails(5); const to = box.slice(3).map((m) => m.to).sort(); assert.deepEqual(to, ["ali@example.test", "patron@example.test"]);
  assert.ok(box.slice(3).every((m) => /GM-TEST1/.test(m.text)));
  // Yönetici uçları korunur
  assert.equal((await req("GET", "admin/mail", null, r.token)).status, 403);
});

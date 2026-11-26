import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const server = fileURLToPath(new URL("server.mjs", import.meta.url));
test("GitHub kurulumu: yönetici OAuth uygulamasını panelden kaydeder (yanlış secret reddedilir), kullanıcı erişim anahtarıyla bağlanır", async (t) => {
  const SECRET_OK = "a".repeat(40);
  const fake = http.createServer(async (req, res) => { let b = ""; for await (const c of req) b += c; res.writeHead(req.url.startsWith("/github/user") && req.headers.authorization.includes("bozuk") ? 401 : 200, { "Content-Type": "application/json", ...(req.url.startsWith("/github/user") ? { "x-oauth-scopes": req.headers.authorization.includes("norepo") ? "read:user" : "repo, read:user" } : {}) });
    if (req.url.startsWith("/oauth")) { const j = JSON.parse(b); return res.end(JSON.stringify({ error: j.client_secret === SECRET_OK ? "bad_verification_code" : "incorrect_client_credentials" })); }
    if (req.url.startsWith("/github/user")) { if (req.headers.authorization.includes("bozuk")) return res.end("{}"); return res.end(JSON.stringify({ login: "nahit" })); }
    res.end("{}"); });
  fake.listen(0, "127.0.0.1"); await once(fake, "listening"); const fb = "http://127.0.0.1:" + fake.address().port;
  const dir = mkdtempSync(join(tmpdir(), "gitmapp-gh-"));
  const env = { ...process.env, PORT: "0", DB_PATH: join(dir, "db"), ADMIN_EMAIL: "owner@example.test", SECRET: randomBytes(32).toString("hex"), GITHUB_CLIENT_ID: "", GITHUB_CLIENT_SECRET: "", GOOGLE_CLIENT_ID: "", TEST_GH_OAUTH: fb + "/oauth", TEST_CONN_BASE: fb };
  const pw = execFileSync(process.execPath, [server, "create-admin"], { env, encoding: "utf8" }).match(/Şifre: (\S+)/)[1];
  const child = spawn(process.execPath, [server], { env, stdio: ["ignore", "pipe", "inherit"] });
  t.after(async () => { fake.close(); if (child.exitCode === null) { const end = once(child, "exit"); child.kill(); await end; } rmSync(dir, { recursive: true, force: true }); });
  const port = (await once(child.stdout, "data"))[0].toString().match(/API :(\d+)/)[1];
  const req = async (m, p, body, tok) => { const r = await fetch("http://127.0.0.1:" + port + "/api/" + p, { method: m, headers: { "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, ...(await r.json()) }; };
  const admin = (await req("POST", "auth/login", { email: "owner@example.test", password: pw })).token;
  assert.equal((await req("GET", "health")).github, false);
  let s = await req("GET", "admin/github", null, admin); assert.equal(s.configured, false); assert.match(s.callback, /\/api\/auth\/oauth\/github\/callback$/);
  assert.equal((await req("PUT", "admin/github", { id: "Ov23liABCDEFGHIJ", secret: "b".repeat(40) }, admin)).status, 400);
  assert.equal((await req("PUT", "admin/github", { id: "yanlis", secret: SECRET_OK }, admin)).status, 400);
  s = await req("PUT", "admin/github", { id: "Ov23liABCDEFGHIJ", secret: SECRET_OK }, admin); assert.equal(s.configured, true); assert.equal(s.verified, true); assert.equal(s.source, "panel");
  assert.equal((await req("GET", "health")).github, true);
  const st = await fetch("http://127.0.0.1:" + port + "/api/auth/oauth/github/start", { redirect: "manual" }); assert.match(st.headers.get("location"), /client_id=Ov23liABCDEFGHIJ/);
  const u = await req("POST", "auth/register", { email: "u@example.test", password: "sifre-12345", name: "U" });
  assert.equal((await req("GET", "admin/github", null, u.token)).status, 403);
  assert.equal((await req("PUT", "connect/github-token", { token: "ghp_bozukbozukbozukbozukbozuk" }, u.token)).status, 400);
  assert.equal((await req("PUT", "connect/github-token", { token: "ghp_norepo1234567890123456789" }, u.token)).status, 400);
  const c = await req("PUT", "connect/github-token", { token: "ghp_gecerli1234567890123456789" }, u.token); assert.equal(c.ok, true); assert.equal(c.user.github, "nahit");
  s = await req("DELETE", "admin/github", null, admin); assert.equal(s.configured, false);
});

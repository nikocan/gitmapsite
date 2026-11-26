import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const server = fileURLToPath(new URL("server.mjs", import.meta.url));
// Sahte sağlayıcılar: /hostinger/... ve /higgsfield/... yolları
async function fakeProviders(state) {
  const s = http.createServer((req, res) => {
    const J = (c, o, h = {}) => { res.writeHead(c, { "Content-Type": "application/json", ...h }); res.end(JSON.stringify(o)); };
    if (req.url.startsWith("/hostinger/api/billing/v1/subscriptions")) return req.headers.authorization === "Bearer " + state.hostinger ? J(200, [{ id: 1 }]) : J(401, {});
    if (req.url.startsWith("/higgsfield/requests/")) return req.headers.authorization === "Key " + state.higgsfield ? J(404, {}) : J(401, {});
    J(404, {});
  });
  s.listen(0, "127.0.0.1"); await once(s, "listening");
  return { base: "http://127.0.0.1:" + s.address().port, close: () => s.close() };
}
test("bağlantı sağlığı: geçerli anahtar ok, iptal edilen anahtar hata + yeniden bağla önerisi, hatalar önce sıralanır", async (t) => {
  const state = { hostinger: "h".repeat(24), higgsfield: "k".repeat(20) };
  const fake = await fakeProviders(state);
  const dir = mkdtempSync(join(tmpdir(), "gitmapp-conn-"));
  const child = spawn(process.execPath, [server], { env: { ...process.env, PORT: "0", DB_PATH: join(dir, "db"), SECRET: randomBytes(32).toString("hex"), GITHUB_CLIENT_ID: "", GOOGLE_CLIENT_ID: "", TEST_CONN_BASE: fake.base }, stdio: ["ignore", "pipe", "inherit"] });
  t.after(async () => { fake.close(); if (child.exitCode === null) { const end = once(child, "exit"); child.kill(); await end; } rmSync(dir, { recursive: true, force: true }); });
  const port = (await once(child.stdout, "data"))[0].toString().match(/API :(\d+)/)[1];
  const req = async (m, p, body, tok) => { const r = await fetch("http://127.0.0.1:" + port + "/api/" + p, { method: m, headers: { "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, ...(await r.json()) }; };
  assert.equal((await req("GET", "me/connectors/health")).status, 401);
  const u = await req("POST", "auth/register", { email: "c@example.test", password: randomBytes(12).toString("hex"), name: "C" });
  assert.equal((await req("PUT", "connect/higgsfield", { key: state.higgsfield }, u.token)).ok, true);
  assert.equal((await req("PUT", "connect/hostinger", { token: state.hostinger }, u.token)).ok, true);
  let h = await req("GET", "me/connectors/health?fresh=1", null, u.token);
  const by = (id) => h.items.find((x) => x.id === id);
  assert.equal(by("github").status, "off");
  assert.equal(by("github").fix, "connect");
  assert.equal(by("login"), undefined, "şifreli hesapta tek yol uyarısı yok");
  assert.equal(by("hostinger").status, "ok");
  {
    assert.equal(by("higgsfield").status, "ok");
    state.higgsfield = "iptal-edildi-anahtar"; // sağlayıcı tarafında anahtar iptal edildi
    const cached = await req("GET", "me/connectors/health", null, u.token);
    assert.equal(cached.cached, true);
    h = await req("GET", "me/connectors/health?fresh=1", null, u.token);
    assert.equal(by("higgsfield").status, "error");
    assert.equal(by("higgsfield").fix, "reconnect");
    assert.equal(h.items[0].status, "error", "hatalar en üstte sıralanır");
  }
});

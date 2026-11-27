import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const server = fileURLToPath(new URL("server.mjs", import.meta.url));
async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "gitmapp-taste-"));
  const env = { ...process.env, PORT: "0", DB_PATH: join(dir, "db"), ADMIN_EMAIL: "owner@example.test",
    SECRET: randomBytes(32).toString("hex"), GITHUB_CLIENT_ID: "", GOOGLE_CLIENT_ID: "" };
  const child = spawn(process.execPath, [server], { env, stdio: ["ignore", "pipe", "inherit"] });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) { const end = once(child, "exit"); child.kill(); await end; }
    rmSync(dir, { recursive: true, force: true });
  });
  const ready = await Promise.race([
    once(child.stdout, "data").then(([b]) => b.toString()),
    once(child, "exit").then(() => { throw new Error("API başlamadı"); })
  ]);
  const port = ready.match(/API :(\d+)/)[1];
  const request = async (method, path, body, token) => {
    const r = await fetch("http://127.0.0.1:" + port + "/api/" + path, { method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, ...await r.json() };
  };
  const reg = email => request("POST", "auth/register", { email, password: randomBytes(16).toString("hex"), name: "Deneme" });
  return { request, reg };
}

test("keşif hafızası hesapta saklanır, temizlenir ve kişiye özeldir", async t => {
  const { request, reg } = await fixture(t);
  assert.equal((await request("GET", "me/taste")).status, 401);
  const a = await reg("a@example.test"), b = await reg("b@example.test");
  const empty = await request("GET", "me/taste", null, a.token);
  assert.equal(empty.taste, null);
  assert.equal(empty.on, true);

  const taste = { n: 5, t: 123, sec: { guzellik: 2.5, bad: -1, ["x".repeat(90)]: 1 }, th: { lux: 1 }, kind: { app: 1 }, terms: { kuaför: 1.2 }, items: { percem: 1.5 },
    col: [{ c: "#AA3366", w: 1 }, { c: "red", w: 1 }, { c: "#112233", w: 0.5, bg: 1 }], q: ["kuaför", "kuaför", " randevu ", 7], last: { id: "percem", title: "Perçem", at: 5 }, evil: "<script>" };
  const put = await request("PUT", "me/taste", { taste }, a.token);
  assert.equal(put.ok, true);
  const got = await request("GET", "me/taste", null, a.token);
  assert.deepEqual(got.taste.sec, { guzellik: 2.5 });
  assert.deepEqual(got.taste.col, [{ c: "#aa3366", w: 1 }, { c: "#112233", w: 0.5, bg: 1 }]);
  assert.deepEqual(got.taste.q, ["kuaför", "randevu"]);
  assert.equal(got.taste.last.id, "percem");
  assert.equal(got.taste.evil, undefined);
  assert.equal(got.taste.n, 5);

  assert.equal((await request("GET", "me/taste", null, b.token)).taste, null, "başka kullanıcı göremez");

  const off = await request("PUT", "me/taste", { on: false, taste }, a.token);
  assert.equal(off.on, false);
  const offGot = await request("GET", "me/taste", null, a.token);
  assert.equal(offGot.on, false);
  assert.deepEqual(offGot.taste.sec, {}, "kapatılınca veri silinir");

  assert.equal((await request("DELETE", "me/taste", null, a.token)).ok, true);
  assert.equal((await request("GET", "me/taste", null, a.token)).taste, null);
});

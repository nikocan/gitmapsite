import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { insights } from "./ux.mjs";

const server = fileURLToPath(new URL("server.mjs", import.meta.url));

test("öneri motoru: hızlı çıkış, tur bırakma, belirsiz öğe ve hata önerileri üretir", () => {
  const out = insights({ pages: [{ view: "depo", leaves: 10, quickPct: 80 }], tours: [{ id: "genel", start: 10, done: 2, dropStep: 3 }], help: [{ label: "Dallar", n: 6 }], errors: [{ msg: "x is undefined", view: "studio", n: 12 }], feedback: [{ text: "a" }] });
  assert.equal(out[0].level, "yuksek");
  assert.ok(out.some((x) => /depo.*%80/.test(x.text)) && out.some((x) => /4\. adımda/.test(x.text)) && out.some((x) => /Dallar/.test(x.text)) && out.some((x) => /x is undefined/.test(x.text)));
});

test("API: kullanım olayları kaydedilir, yönetici analizi ve öneri döner, müşteri göremez", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "gitmapp-ux-"));
  const env = { ...process.env, PORT: "0", DB_PATH: join(dir, "db"), ADMIN_EMAIL: "owner@example.test", SECRET: crypto.randomBytes(32).toString("hex"), GITHUB_CLIENT_ID: "", GOOGLE_CLIENT_ID: "" };
  const pw = execFileSync(process.execPath, [server, "create-admin"], { env, encoding: "utf8" }).match(/Şifre: (\S+)/)[1];
  const child = spawn(process.execPath, [server], { env, stdio: ["ignore", "pipe", "inherit"] });
  t.after(async () => { if (child.exitCode === null) { const end = once(child, "exit"); child.kill(); await end; } rmSync(dir, { recursive: true, force: true }); });
  const base = "http://127.0.0.1:" + (await once(child.stdout, "data"))[0].toString().match(/API :(\d+)/)[1];
  const req = async (method, path, body, token) => { const r = await fetch(base + "/api/" + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body == null ? undefined : JSON.stringify(body) }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
  const ev = (o) => req("POST", "events", { session_id: o.s || "s1", ...o });
  for (let k = 0; k < 6; k++) { const s = "s" + k; await ev({ s, type: "view", category: "ana" }); await ev({ s, type: "view", category: "depo", query: "ana", meta: { ms: 12000 } }); await ev({ s, type: "view", category: "ana", query: "depo", meta: { ms: 2000 } }); }
  for (let k = 0; k < 4; k++) { await ev({ type: "tour", category: "genel", query: "start" }); await ev({ type: "tour", category: "genel", query: "exit", meta: { i: 2 } }); }
  await ev({ type: "tour", category: "genel", query: "done" });
  for (let k = 0; k < 3; k++) await ev({ type: "help_click", query: "Dallar", category: "studio" });
  await ev({ type: "ui_error", query: "x is undefined", category: "studio" }); await ev({ type: "ui_error", query: "x is undefined", category: "studio" });
  await ev({ type: "feedback", query: "Yayınla düğmesini bulamadım", category: "studio" });
  assert.equal((await ev({ type: "kotu-tur" })).status, 400);
  const admin = (await req("POST", "auth/login", { email: env.ADMIN_EMAIL, password: pw })).token;
  const user = (await req("POST", "auth/register", { email: "u@example.test", password: "uzun-bir-sifre-1" })).token;
  assert.equal((await req("GET", "admin/ux", null, user)).status, 403);
  const d = await req("GET", "admin/ux?days=7", null, admin);
  assert.equal(d.status, 200);
  const depo = d.pages.find((p) => p.view === "depo"); assert.equal(depo.visits, 6); assert.equal(depo.quickPct, 100); assert.equal(depo.avgMs, 2000);
  assert.equal(d.pages.find((p) => p.view === "ana").avgMs, 12000);
  assert.deepEqual([d.flows[0].from, d.flows[0].to, d.flows[0].n].sort(), ["ana", "depo", 6].sort());
  const g = d.tours.find((x) => x.id === "genel"); assert.deepEqual([g.start, g.done, g.dropStep], [4, 1, 2]);
  assert.equal(d.help[0].label, "Dallar"); assert.equal(d.errors[0].n, 2); assert.equal(d.feedback[0].text, "Yayınla düğmesini bulamadım");
  assert.ok(d.insights.some((x) => /depo/.test(x.text) && x.level === "yuksek")); assert.ok(d.insights.some((x) => /3\. adımda/.test(x.text)));
  assert.equal(d.totals.feedback, 1);
});

import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

test("Copilot forwards each browser project and branch to the model", async t => {
  const contexts = JSON.parse(await readFile(new URL("../validation/asistan-tarayıcı.json", import.meta.url)));
  const received = [];
  const router = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    received.push(JSON.parse(raw).messages);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: "Test yanıtı" } }] }));
  });
  router.listen(0, "127.0.0.1");
  await once(router, "listening");
  t.after(() => router.close());
  const dir = await mkdtemp(join(tmpdir(), "gitmapp-context-"));
  const server = spawn(process.execPath, [fileURLToPath(new URL("server.mjs", import.meta.url))], {
    env: { ...process.env, DB_PATH: join(dir, "db"), PORT: "0", COPILOT_MODEL: "test",
      AI_KEY: "local-test", AI_BASE: "http://127.0.0.1:" + router.address().port },
    stdio: ["ignore", "pipe", "inherit"],
  });
  t.after(async () => {
    if (server.exitCode === null && server.signalCode === null) {
      const end = once(server, "exit");
      server.kill();
      await end;
    }
    await rm(dir, { recursive: true, force: true });
  });
  const [start] = await once(server.stdout, "data");
  const port = start.toString().match(/API :(\d+)/)[1];
  for (const [proje] of contexts) {
    const messages = [{ role: "user", content: "Ana ekranı iyileştir" }];
    const response = await fetch("http://127.0.0.1:" + port + "/api/ai/copilot", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: { studyo: { proje } }, messages }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reply, "Test yanıtı");
    const [system, question] = received.at(-1);
    assert.ok(system.content.includes(JSON.stringify(proje)));
    assert.deepEqual(question, messages[0]);
  }
  assert.equal(received.length, 4);
});

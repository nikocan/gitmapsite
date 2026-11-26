import test from "node:test";
import assert from "node:assert/strict";
import { scriptErrors } from "./quality.mjs";

test("sözdizimi hatası bulunur ve satırı yaklaşık verilir", () => {
  const html = "<!doctype html>\n<html><body>\n<h1>x</h1>\n<script>\nconst a = 1;\nconst t = 'Ankara'nda kaldık';\n</script></body></html>";
  const e = scriptErrors(html);
  assert.equal(e.length, 1);
  assert.match(e[0].message, /Unexpected identifier|Invalid or unexpected token/);
  assert.equal(e[0].line, 6);
});
test("geçerli betik, harici betik, modül ve JSON atlanır", () => {
  const html = `<script src="https://cdn.tailwindcss.com"></script><script type="module">import x from "y";</script><script type="application/ld+json">{"a":1}</script><script>const ok = [1,2].map(x => x * 2);</script>`;
  assert.deepEqual(scriptErrors(html), []);
});

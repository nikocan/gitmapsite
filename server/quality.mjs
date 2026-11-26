import vm from "node:vm";

// Üretilen dosyadaki satır içi JavaScript'in sözdizimini sunucuda denetler (çalıştırmaz, yalnızca derler).
export function scriptErrors(html) {
  const out = []; const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(String(html || "")))) {
    const attrs = m[1] || "", code = m[2] || "";
    if (/\bsrc\s*=/i.test(attrs) || /type\s*=\s*["']?(module|application\/(ld\+)?json|text\/(template|babel|x-))/i.test(attrs) || !code.trim()) continue;
    try { new vm.Script(code, { filename: "index.html" }); }
    catch (e) {
      if (!(e instanceof SyntaxError)) continue;
      const before = html.slice(0, m.index + m[0].indexOf(">") + 1).split("\n").length - 1;
      const ln = +(String(e.stack || "").match(/index\.html:(\d+)/) || [])[1] || 1; const lines = code.split("\n");
      out.push({ message: e.message, line: before + ln, snippet: lines.slice(Math.max(0, ln - 3), ln + 2).join("\n").slice(0, 600) });
      if (out.length >= 3) break;
    }
  }
  return out;
}

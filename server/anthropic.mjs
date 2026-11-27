// Anthropic Messages API çeviricisi: sunucunun geri kalanı OpenAI "chat/completions" biçiminde konuşur;
// Anthropic adresine giden istekler burada yerel Messages API'ye çevrilir. Neden: Anthropic'in OpenAI uyumlu
// katmanı istem önbelleğini (cache_control) desteklemiyor; yerel API'de önbellek tekrar okunan girdiyi ~%90 ucuzlatır.
// Yanıt (ve canlı akış) yeniden OpenAI biçimine çevrilir; kullanım bilgisine önbellek okuma/yazma da eklenir.

export const anthropicBase = () => (process.env.ANTHROPIC_BASE || "https://api.anthropic.com/v1").replace(/\/+$/, "");
export const isAnthropicUrl = (u) => String(u || "").startsWith(anthropicBase() + "/") || String(u || "") === anthropicBase();

function keyFrom(headers = {}) {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return h["x-api-key"] || String(h.authorization || "").replace(/^Bearer\s+/i, "");
}
const nativeHeaders = (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" });

function part(p) {
  if (typeof p === "string") return { type: "text", text: p };
  if (p?.type === "text") return { type: "text", text: String(p.text ?? ""), ...(p.cache_control ? { cache_control: p.cache_control } : {}) };
  if (p?.type === "image_url") {
    const url = String(p.image_url?.url || p.image_url || "");
    const m = url.match(/^data:(image\/[\w.+-]+);base64,(.+)$/s);
    return m ? { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } } : { type: "image", source: { type: "url", url } };
  }
  return { type: "text", text: String(p?.text ?? "") };
}
const blocks = (c) => (Array.isArray(c) ? c : [c]).map(part).filter((b) => b.type !== "text" || b.text.trim());

// OpenAI istek gövdesi → Anthropic Messages gövdesi
export function toAnthropic(body) {
  const system = [], messages = [];
  for (const m of body.messages || []) {
    if (m.role === "system" || m.role === "developer") { system.push(...blocks(m.content)); continue; }
    const role = m.role === "assistant" ? "assistant" : "user"; const b = blocks(m.content); if (!b.length) continue;
    const last = messages[messages.length - 1];
    if (last && last.role === role) last.content.push(...b); else messages.push({ role, content: b }); // ardışık aynı rol birleştirilir
  }
  if (!messages.length || messages[0].role !== "user") messages.unshift({ role: "user", content: [{ type: "text", text: "Devam et." }] });
  const last = messages[messages.length - 1];
  if (last.role === "assistant") { const t = last.content[last.content.length - 1]; if (t?.type === "text") t.text = t.text.replace(/\s+$/, ""); } // ön doldurma sonda boşluk kabul etmez
  const out = { model: body.model, max_tokens: Math.max(1, Math.min(+body.max_tokens || 4096, 128000)), messages };
  if (system.length) out.system = system;
  if (body.temperature != null) out.temperature = Math.max(0, Math.min(1, +body.temperature));
  if (body.stream) out.stream = true;
  return out;
}
const finishOf = (r) => r === "max_tokens" ? "length" : r === "tool_use" ? "tool_calls" : "stop";
// Anthropic kullanım bilgisi → OpenAI biçimi (+ önbellek ayrıntısı). prompt_tokens önbellekten okunan ve yazılanı da içerir.
export function usageOf(u = {}) {
  const input = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0), output = u.output_tokens || 0;
  return { prompt_tokens: input, completion_tokens: output, total_tokens: input + output, prompt_tokens_details: { cached_tokens: u.cache_read_input_tokens || 0, cache_write_tokens: u.cache_creation_input_tokens || 0 } };
}
export function fromAnthropic(j) {
  const text = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  return { id: j.id, object: "chat.completion", model: j.model, choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: finishOf(j.stop_reason) }], usage: usageOf(j.usage) };
}
// Hata durum kodunu yedek zincirinin anlayacağı biçime getir: bakiye yetersiz → 402, aşırı yük → 503
function errorStatus(status, text) {
  if (/credit balance|billing|insufficient/i.test(text)) return 402;
  if (status === 529) return 503;
  return status;
}
function sseTransform(res) {
  const enc = new TextEncoder(), dec = new TextDecoder(); let buf = "", usage = {}, finish = null;
  const line = (o) => enc.encode("data: " + JSON.stringify(o) + "\n\n");
  return new ReadableStream({
    async start(ctl) {
      try {
        for await (const chunk of res.body) {
          buf += dec.decode(chunk, { stream: true }); let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!l.startsWith("data:")) continue;
            let e; try { e = JSON.parse(l.slice(5).trim()); } catch { continue; }
            if (e.type === "message_start") usage = { ...(e.message?.usage || {}) };
            else if (e.type === "content_block_delta" && e.delta?.type === "text_delta") ctl.enqueue(line({ choices: [{ index: 0, delta: { content: e.delta.text } }] }));
            else if (e.type === "message_delta") { if (e.usage) usage = { ...usage, ...e.usage }; if (e.delta?.stop_reason) finish = finishOf(e.delta.stop_reason); }
            else if (e.type === "error") ctl.enqueue(line({ error: { message: e.error?.message || "Anthropic akış hatası" } }));
          }
        }
        ctl.enqueue(line({ choices: [{ index: 0, delta: {}, finish_reason: finish || "stop" }], usage: usageOf(usage) }));
        ctl.enqueue(enc.encode("data: [DONE]\n\n"));
      } catch (e) { ctl.enqueue(line({ error: { message: String(e.message || e) } })); }
      ctl.close();
    },
  });
}
// fetch yerine geçer: yalnızca Anthropic adresi için çağrılır
export async function anthropicFetch(url, init = {}) {
  const u = new URL(String(url)); const key = keyFrom(init.headers);
  if (/\/models$/.test(u.pathname)) { if (!u.searchParams.has("limit")) u.searchParams.set("limit", "100"); return fetch(u, { headers: nativeHeaders(key), signal: init.signal }); }
  if (!/\/chat\/completions$/.test(u.pathname)) return fetch(url, init);
  let body; try { body = JSON.parse(init.body || "{}"); } catch { return new Response(JSON.stringify({ error: { message: "Geçersiz istek gövdesi" } }), { status: 400 }); }
  const r = await fetch(anthropicBase() + "/messages", { method: "POST", signal: init.signal, headers: nativeHeaders(key), body: JSON.stringify(toAnthropic(body)) });
  if (!r.ok) { const t = await r.text(); return new Response(t, { status: errorStatus(r.status, t), headers: { "Content-Type": "application/json" } }); }
  if (body.stream) return new Response(sseTransform(r), { status: 200, headers: { "Content-Type": "text/event-stream" } });
  return new Response(JSON.stringify(fromAnthropic(await r.json())), { status: 200, headers: { "Content-Type": "application/json" } });
}
// En yeni sürümü seç: claude-sonnet-5-5 > claude-sonnet-4-5-20250929
export function latest(ids, re) {
  const ver = (id) => (String(id).replace(/\d{8}$/, "").match(/\d+/g) || []).map(Number);
  return ids.filter((i) => re.test(i)).sort((a, b) => { const x = ver(a), y = ver(b); for (let k = 0; k < Math.max(x.length, y.length); k++) { const d = (y[k] || 0) - (x[k] || 0); if (d) return d; } return a.length - b.length; })[0] || null;
}

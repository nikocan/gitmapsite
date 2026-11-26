// E-posta gönderimi: SMTP (Hostinger e-postası gibi; 465 SSL ya da 587 STARTTLS) veya Resend API.
// Bağımlılıksız küçük bir SMTP istemcisi; testlerde MAIL_OUTBOX_DIR ile dosyaya yazar.
import tls from "node:tls";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const enc = (s) => /^[\x20-\x7e]*$/.test(s) ? s : "=?UTF-8?B?" + Buffer.from(s).toString("base64") + "?=";
const b64lines = (s) => Buffer.from(s).toString("base64").replace(/.{76}/g, "$&\r\n");
const addr = (s) => String(s || "").match(/<([^>]+)>/)?.[1] || String(s || "").trim();
const cleanHeader = (s) => String(s || "").replace(/[\r\n]+/g, " ").slice(0, 300);

export function buildMessage({ from, to, subject, html, text, replyTo }) {
  const b = "gm-" + crypto.randomBytes(12).toString("hex"); const dom = addr(from).split("@")[1] || "gitmapp.com";
  const h = [`From: ${cleanHeader(from)}`, `To: ${cleanHeader(to)}`, `Subject: ${enc(cleanHeader(subject))}`, `Date: ${new Date().toUTCString()}`, `Message-ID: <${crypto.randomUUID()}@${dom}>`, "MIME-Version: 1.0", ...(replyTo ? [`Reply-To: ${cleanHeader(replyTo)}`] : []), `Content-Type: multipart/alternative; boundary="${b}"`];
  return h.join("\r\n") + "\r\n\r\n" + `--${b}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64lines(text || "")}\r\n--${b}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64lines(html || "")}\r\n--${b}--\r\n`;
}

// Satır tabanlı SMTP konuşması; çok satırlı yanıtları ("250-...") birleştirir
function conn(sock) {
  let buf = "", waiters = [], lines = [], ready = [], err = null;
  const feed = () => { let i; while ((i = buf.indexOf("\r\n")) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 2); lines.push(l); if (/^\d{3} /.test(l) || /^\d{3}$/.test(l)) { const all = lines; lines = []; const resp = { code: +l.slice(0, 3), text: all.join("\n") }; const w = waiters.shift(); if (w) w.res(resp); else ready.push(resp); } } };
  const on = (s) => { s.setEncoding("utf8"); s.on("data", (d) => { buf += d; feed(); }); s.on("error", (e) => { err = e; waiters.splice(0).forEach((w) => w.rej(e)); }); s.on("close", () => { const e = err || new Error("SMTP bağlantısı kapandı"); waiters.splice(0).forEach((w) => w.rej(e)); }); };
  on(sock);
  return {
    read: () => new Promise((res, rej) => ready.length ? res(ready.shift()) : err ? rej(err) : waiters.push({ res, rej })),
    async cmd(line, ok) { sock.write(line + "\r\n"); const r = await this.read(); if (ok && !ok.includes(r.code)) throw new Error(`SMTP ${r.code}: ${r.text.split("\n").pop().slice(4, 200)}`); return r; },
    swap(s) { sock.removeAllListeners("data"); sock = s; buf = ""; on(s); }, get sock() { return sock; },
  };
}
export async function smtpSend(cfg, { from, to, raw }) {
  const port = +cfg.port || 465, secure = port === 465 || cfg.secure === true, host = cfg.host;
  const timeout = +cfg.timeout || 20000;
  let sock = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
  sock.setTimeout(timeout, () => sock.destroy(new Error("SMTP zaman aşımı")));
  const c = conn(sock);
  try {
    let r = await c.read(); if (r.code !== 220) throw new Error("SMTP karşılama hatası: " + r.text.slice(0, 120));
    r = await c.cmd("EHLO gitmapp", [250]);
    if (!secure && !cfg.plain) { // cfg.plain yalnızca testlerde (şifresiz yerel sahte sunucu)
      if (!/STARTTLS/i.test(r.text)) throw new Error("Sunucu STARTTLS desteklemiyor; 465 portunu dene");
      await c.cmd("STARTTLS", [220]);
      const t = tls.connect({ socket: c.sock, servername: host }); await new Promise((ok, no) => { t.once("secureConnect", ok); t.once("error", no); });
      t.setTimeout(timeout, () => t.destroy(new Error("SMTP zaman aşımı"))); c.swap(t);
      await c.cmd("EHLO gitmapp", [250]);
    }
    if (cfg.user) { await c.cmd("AUTH LOGIN", [334]); await c.cmd(Buffer.from(cfg.user).toString("base64"), [334]); await c.cmd(Buffer.from(cfg.pass || "").toString("base64"), [235]).catch((e) => { throw new Error("SMTP kullanıcı adı ya da şifre hatalı (" + e.message + ")"); }); }
    await c.cmd(`MAIL FROM:<${addr(from)}>`, [250]);
    await c.cmd(`RCPT TO:<${addr(to)}>`, [250, 251]);
    await c.cmd("DATA", [354]);
    await c.cmd(raw.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..") + "\r\n.", [250]);
    c.sock.write("QUIT\r\n"); c.sock.end();
    return { ok: true, via: "smtp" };
  } catch (e) { try { c.sock.destroy(); } catch { } throw e; }
}

export async function sendMail(cfg, msg) {
  const from = cfg.from || (cfg.user ? `Gitmapp <${cfg.user}>` : "Gitmapp <noreply@gitmapp.com>");
  if (cfg.outbox) { fs.mkdirSync(cfg.outbox, { recursive: true }); fs.writeFileSync(path.join(cfg.outbox, Date.now() + "-" + crypto.randomBytes(3).toString("hex") + ".json"), JSON.stringify({ from, ...msg })); return { ok: true, via: "outbox" }; }
  if (cfg.resend) {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + cfg.resend, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text, ...(msg.replyTo ? { reply_to: msg.replyTo } : {}) }), signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error("Resend " + r.status + ": " + (await r.text()).slice(0, 160)); return { ok: true, via: "resend" };
  }
  if (cfg.host) return smtpSend(cfg, { from, to: msg.to, raw: buildMessage({ from, ...msg }) });
  throw new Error("E-posta gönderimi yapılandırılmadı");
}

// Şablonlar: koyu temalı, tek sütun, düğmeli; düz metin sürümü de var
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export function layout({ title, intro, button, url, rows = [], foot }) {
  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#0b0b0f;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#ecebf2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0f;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#14141c;border:1px solid #26263a;border-radius:18px;padding:28px">
<tr><td style="font-size:15px;font-weight:700;color:#e4ff3d;letter-spacing:.02em">gitmapp</td></tr>
<tr><td style="padding-top:18px;font-size:22px;font-weight:700;color:#ffffff">${esc(title)}</td></tr>
<tr><td style="padding-top:10px;font-size:15px;line-height:1.6;color:#c2c1d2">${esc(intro)}</td></tr>
${rows.length ? `<tr><td style="padding-top:14px"><table role="presentation" width="100%" style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:6px 0;color:#8a8aa0;font-size:13px">${esc(k)}</td><td style="padding:6px 0;color:#ecebf2;font-size:13px;text-align:right">${esc(v)}</td></tr>`).join("")}</table></td></tr>` : ""}
${url ? `<tr><td style="padding-top:22px"><a href="${esc(url)}" style="display:inline-block;background:#e4ff3d;color:#0b0b0f;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:12px">${esc(button)}</a></td></tr>
<tr><td style="padding-top:14px;font-size:12px;color:#6d6d82;word-break:break-all">Düğme çalışmazsa bu bağlantıyı aç: ${esc(url)}</td></tr>` : ""}
<tr><td style="padding-top:22px;border-top:1px solid #26263a;margin-top:22px;font-size:12px;color:#6d6d82;line-height:1.5">${esc(foot || "Bu e-postayı Gitmapp hesabınla ilgili bir işlem yaptığın için aldın.")}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [title, "", intro, ...rows.map(([k, v]) => k + ": " + v), ...(url ? ["", button + ": " + url] : []), "", foot || "Bu e-postayı Gitmapp hesabınla ilgili bir işlem yaptığın için aldın."].join("\n");
  return { html, text };
}

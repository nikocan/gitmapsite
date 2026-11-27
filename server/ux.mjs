// Kullanım ve UX analizi: sayfa geçişleri, kalma süreleri, tur hunisi, anlatıcı modu tıklamaları, tarayıcı hataları,
// kullanıcı geri bildirimleri ve bunlardan otomatik çıkarılan iyileştirme önerileri (yönetici paneli).
export const UX_EVENTS = ["view", "tour", "help_click", "ui_error", "feedback"];

export function insights({ pages, tours, help, errors, feedback }) {
  const out = [];
  for (const p of pages) if (p.leaves >= 5 && p.quickPct >= 50) out.push({ level: p.quickPct >= 70 ? "yuksek" : "orta", text: `“${p.view}” sayfasından çıkışların %${p.quickPct}'i 5 saniye içinde oluyor; kullanıcı aradığını bulamıyor olabilir. Başlık, açıklama ve ilk eylem düğmesini netleştir.` });
  for (const t of tours) {
    if (t.start >= 3 && t.done / t.start < 0.4) out.push({ level: "orta", text: `“${t.id}” turunu başlatanların yalnız %${Math.round((t.done / t.start) * 100)}'i bitiriyor${t.dropStep != null ? `; en çok ${t.dropStep + 1}. adımda bırakılıyor. O adımın metnini kısalt ya da hedef öğeyi görünür yap` : ""}.` });
  }
  for (const h of help.slice(0, 3)) if (h.n >= 3) out.push({ level: h.n >= 10 ? "orta" : "bilgi", text: `Anlatıcı modunda “${h.label}” ${h.n} kez açıklama için basıldı; etiketi daha açık yazmayı ya da yanına kısa bir ipucu koymayı düşün.` });
  for (const e of errors.slice(0, 3)) if (e.n >= 2) out.push({ level: e.n >= 10 ? "yuksek" : "orta", text: `Kullanıcı tarayıcısında “${e.msg.slice(0, 90)}” hatası ${e.n} kez görüldü (${e.view || "bilinmeyen sayfa"}). Geliştiriciye iletilmeli.` });
  if (feedback.length) out.push({ level: "bilgi", text: `${feedback.length} yeni kullanıcı geri bildirimi var; aşağıda listelendi.` });
  const order = { yuksek: 0, orta: 1, bilgi: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]).slice(0, 12);
}

export function registerUx({ db, route }) {
  const q = (sql) => db.prepare(sql);
  route("GET", "/api/admin/ux", ({ url }) => {
    const days = Math.max(1, Math.min(90, Number.parseInt(url.searchParams.get("days"), 10) || 7));
    const since = `datetime('now','-${days} days')`;
    const W = `created>${since}`;
    const pages = q(`SELECT category view, COUNT(*) visits, COUNT(DISTINCT session_id) sessions FROM events WHERE type='view' AND ${W} AND category IS NOT NULL GROUP BY category ORDER BY visits DESC LIMIT 40`).all();
    // Kalma süresi: bir sonraki 'view' olayı önceki sayfayı (query) ve orada geçen süreyi (meta.ms) taşır
    const dwell = Object.fromEntries(q(`SELECT query view, COUNT(*) leaves, AVG(CAST(json_extract(meta,'$.ms') AS REAL)) avgMs, SUM(CAST(json_extract(meta,'$.ms') AS REAL) < 5000) quick FROM events WHERE type='view' AND ${W} AND query IS NOT NULL AND json_valid(meta) GROUP BY query`).all().map((r) => [r.view, r]));
    for (const p of pages) { const d = dwell[p.view]; p.leaves = d?.leaves || 0; p.avgMs = d ? Math.round(d.avgMs) : null; p.quickPct = d?.leaves ? Math.round((d.quick / d.leaves) * 100) : null; }
    const flows = q(`SELECT query "from", category "to", COUNT(*) n FROM events WHERE type='view' AND ${W} AND query IS NOT NULL GROUP BY query, category ORDER BY n DESC LIMIT 15`).all();
    const tourRows = q(`SELECT category id, query action, COUNT(*) n FROM events WHERE type='tour' AND ${W} GROUP BY category, query`).all();
    const tours = [...new Set(tourRows.map((r) => r.id))].map((id) => {
      const n = (a) => tourRows.find((r) => r.id === id && r.action === a)?.n || 0;
      const drop = q(`SELECT CAST(json_extract(meta,'$.i') AS INTEGER) i, COUNT(*) n FROM events WHERE type='tour' AND category=? AND query='exit' AND ${W} AND json_valid(meta) GROUP BY i ORDER BY n DESC LIMIT 1`).get(id);
      return { id, start: n("start"), done: n("done"), exit: n("exit"), dropStep: drop ? drop.i : null };
    }).sort((a, b) => b.start - a.start);
    const help = q(`SELECT query label, COUNT(*) n FROM events WHERE type='help_click' AND ${W} AND query IS NOT NULL GROUP BY query ORDER BY n DESC LIMIT 15`).all();
    const errors = q(`SELECT query msg, category view, COUNT(*) n, MAX(created) last FROM events WHERE type='ui_error' AND ${W} GROUP BY query ORDER BY n DESC LIMIT 20`).all();
    const feedback = q(`SELECT query text, category view, created FROM events WHERE type='feedback' AND ${W} ORDER BY id DESC LIMIT 30`).all();
    const totals = q(`SELECT COUNT(DISTINCT session_id) sessions, SUM(type='view') views, SUM(type='tour' AND query='start') tours, SUM(type='ui_error') errors, SUM(type='feedback') feedback FROM events WHERE ${W} AND type IN ('view','tour','ui_error','feedback')`).get();
    for (const k of Object.keys(totals)) totals[k] = totals[k] || 0;
    return { days, totals, pages, flows, tours, help, errors, feedback, insights: insights({ pages, tours, help, errors, feedback }) };
  });
}

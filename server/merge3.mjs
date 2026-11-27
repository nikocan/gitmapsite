// v5.86 — Üç yönlü satır birleştirme (diff3). Gitmapp dallarında birleştirme artık kaynak dosyayı
// hedefin üstüne kopyalamıyor: ortak atadan bu yana iki tarafın değişiklikleri harmanlanıyor,
// aynı satırları farklı biçimde değiştiren iki taraf "çakışma" olarak bildiriliyor.

// Myers O((N+M)D) farkı: a ile b arasında eşleşen satır çiftleri [i, j] (artan sırada)
export function matchLines(a, b) {
  const n = a.length, m = b.length, max = n + m, off = max + 1;
  const v = new Int32Array(2 * max + 3); v[off + 1] = 0;
  const trace = [];
  let found = n === 0 && m === 0;
  for (let d = 0; d <= max && !found; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v[off + k] = x;
      if (x >= n && y >= m) { found = true; break; }
    }
  }
  if (n === 0 || m === 0) return [];
  // geri izleme
  const pairs = [];
  let x = n, y = m;
  for (let d = trace.length - 1; d >= 0 && (x > 0 || y > 0); d--) {
    const vv = trace[d], k = x - y;
    const prevK = k === -d || (k !== d && vv[off + k - 1] < vv[off + k + 1]) ? k + 1 : k - 1;
    const px = vv[off + prevK], py = px - prevK;
    while (x > px && y > py) { x--; y--; pairs.push([x, y]); }
    if (d > 0) { x = px; y = py; }
  }
  while (x > 0 && y > 0 && a[x - 1] === b[y - 1]) { x--; y--; pairs.push([x, y]); }
  return pairs.reverse();
}

const same = (p, q) => p.length === q.length && p.every((x, i) => x === q[i]);

// base: ortak ata, ours: hedef dal, theirs: birleştirilen dal
export function merge3(base, ours, theirs) {
  if (ours === theirs) return { html: ours, conflicts: [] };
  if (base === ours) return { html: theirs, conflicts: [] };
  if (base === theirs) return { html: ours, conflicts: [] };
  const O = String(base).split("\n"), A = String(ours).split("\n"), B = String(theirs).split("\n");
  const ma = new Map(matchLines(O, A)), mb = new Map(matchLines(O, B));
  const out = [], conflicts = [];
  let io = 0, ia = 0, ib = 0;
  for (;;) {
    let o = io;
    while (o < O.length && !(ma.has(o) && mb.has(o))) o++;
    const ea = o < O.length ? ma.get(o) : A.length, eb = o < O.length ? mb.get(o) : B.length;
    const co = O.slice(io, o), ca = A.slice(ia, ea), cb = B.slice(ib, eb);
    if (same(ca, co)) out.push(...cb);
    else if (same(cb, co)) out.push(...ca);
    else if (same(ca, cb)) out.push(...ca);
    else { conflicts.push({ line: out.length + 1, ours: ca.join("\n").slice(0, 400), theirs: cb.join("\n").slice(0, 400) }); out.push(...ca); }
    if (o >= O.length) break;
    out.push(O[o]); io = o + 1; ia = ea + 1; ib = eb + 1;
  }
  return { html: out.join("\n"), conflicts };
}

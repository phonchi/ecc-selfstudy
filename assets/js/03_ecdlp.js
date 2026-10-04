/* 第 3 章：kP 的軌跡、Hasse 直方圖 */
HC.ready(() => {
  /* ---------- 共用：分解與質數判定（小整數） ---------- */
  const factor = n => {
    const f = [];
    for (let d = 2; d * d <= n; d++) while (n % d === 0) { f.push(d); n /= d; }
    if (n > 1) f.push(n);
    return f;
  };
  const isPrime = n => n > 1 && factor(n).length === 1;
  const factorStr = n => {
    const c = {};
    factor(n).forEach(d => { c[d] = (c[d] || 0) + 1; });
    return Object.entries(c).map(([d, e]) => (e > 1 ? `${d}^${e}` : d)).join('·') || '1';
  };
  const sup = { 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷' };
  const pretty = s => s.replace(/\^(\d)/g, (_, e) => sup[e] || '^' + e);

  /* ======================================================
     元件 1：kP 的軌跡
     ====================================================== */
  const CURVES = {
    toyA: { a: 2n, b: 3n, p: 97n, name: 'E_A' },
    toyB: { a: -3n, b: 6n, p: 97n, name: 'E_B' },
  };
  for (const c of Object.values(CURVES)) {
    c.pts = ECC.points(c.a, c.b, c.p).slice(1);         // 去掉 O
    c.N = c.pts.length + 1;
    c.ord = c.pts.map(P => ECC.order(P, c.a, c.p));
    c.byOrd = {};
    c.ord.forEach((o, i) => { (c.byOrd[o] = c.byOrd[o] || []).push(i); });
  }
  const selC = $('w03curve'), selS = $('w03start'), status = $('w03status');
  const sv = HC.svg('w03cloud', { w: 520, h: 520, xd: [-2, 98], yd: [-2, 98], pad: { l: 30, r: 10, t: 10, b: 26 } });
  let C = CURVES.toyA, startIdx = 0, player = null, frames = [];
  let seed = 20261004;
  const rnd = n => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) % n; };

  function drawCloud() {
    const g0 = sv.clearLayer('grid');
    for (let v = 0; v <= 96; v += 16) {
      sv.add('line', { cls: 'gridl', x1: sv.X(v), y1: sv.Y(-2), x2: sv.X(v), y2: sv.Y(98) }, g0);
      sv.add('line', { cls: 'gridl', x1: sv.X(-2), y1: sv.Y(v), x2: sv.X(98), y2: sv.Y(v) }, g0);
      sv.txtPx(sv.X(v), sv.H - 8, String(v), { anchor: 'middle' }, g0);
      sv.txtPx(sv.pad.l - 5, sv.Y(v) + 3.5, String(v), { anchor: 'end' }, g0);
    }
    const g = sv.clearLayer('cloud');
    sv.clearLayer('trail');
    C.pts.forEach((P, i) => {
      const d = sv.dot(Number(P[0]), Number(P[1]), { r: 3.6 }, g);
      d.dataset.i = i;
    });
    sv.layer('mark');
  }
  sv.el.addEventListener('click', ev => {
    const q = sv.toData(ev);
    let best = 0, bd = Infinity;
    C.pts.forEach((P, i) => {
      const d = (Number(P[0]) - q.x) ** 2 + (Number(P[1]) - q.y) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    selS.value = '';
    setStart(best);
  });

  function buildFrames() {
    const P = C.pts[startIdx], f = [];
    let R = P, m = 1;
    while (R !== null) { f.push({ m, R }); R = ECC.add(R, P, C.a, C.p); m++; }
    f.push({ m, R: null });
    return f;
  }
  function apply(fr, i) {
    const g = sv.clearLayer('trail');
    const ptsSoFar = frames.slice(0, i + 1).map(x => x.R).filter(Boolean);
    for (let j = 1; j < ptsSoFar.length; j++) {
      const A = ptsSoFar[j - 1], B = ptsSoFar[j];
      sv.seg(Number(A[0]), Number(A[1]), Number(B[0]), Number(B[1]), { cls: 'trail-line' + (j === ptsSoFar.length - 1 ? ' last' : '') }, g);
    }
    ptsSoFar.forEach((Q, j) => sv.dot(Number(Q[0]), Number(Q[1]), { cls: j === 0 ? 'pt P' : 'pt trail', r: j === 0 ? 6 : 4 }, g));
    if (fr.R) {
      const last = ptsSoFar[ptsSoFar.length - 1];
      sv.dot(Number(last[0]), Number(last[1]), { cls: 'pt R', r: 6 }, g);
      sv.dot(Number(last[0]), Number(last[1]), { cls: 'pt third', r: 10 }, g);
      status.innerHTML = `${fr.m}P = ${HC.pt(fr.R)}${fr.m === 1 ? '（起點）' : ''}`;
    } else {
      const o = fr.m, ok = C.N % o === 0;
      status.innerHTML = `${o}P = O。所以 ord(P) = <b>${o}</b>；N = ${C.N} = ${o} · ${C.N / o}，${ok ? '整除 ✓' : '不整除 ✗'}`;
    }
  }
  const blank = () => {
    sv.clearLayer('trail');
    const P = C.pts[startIdx];
    sv.dot(Number(P[0]), Number(P[1]), { cls: 'pt P', r: 6 }, sv.layer('trail'));
    status.innerHTML = `起點 P = ${HC.pt(P)}。按「播放」或「下一步」依序加上 P。`;
  };
  function setStart(i) {
    startIdx = i;
    frames = buildFrames();
    if (!player) {
      player = new HC.Player({ frames, apply, delay: 140 });
      HC.bindPlayer(player, { play: $('w03play'), step: $('w03step'), reset: $('w03reset'), onReset: blank });
    } else { player.load(frames); $('w03play').textContent = '▶ 播放'; }
    blank();
    sideOrders();
  }
  function sideInfo() {
    const N = C.N, f = factor(N), n = f[f.length - 1];
    $('w03info').innerHTML = [
      ['曲線', C.name], ['p', C.p.toString()], ['N = #E', String(N)], ['N 分解', pretty(factorStr(N))],
      ['最大質因數 n', String(n)], ['餘因子 h', String(N / n)], ['Hasse 區間', `[${(98 - 2 * Math.sqrt(97)).toFixed(2)}, ${(98 + 2 * Math.sqrt(97)).toFixed(2)}]`],
    ].map(([l, v]) => `<div class="ic-row"><span class="ic-label">${l}</span><span class="ic-value">${v}</span></div>`).join('');
  }
  function sideOrders() {
    const cur = C.ord[startIdx];
    $('w03orders').innerHTML = `<div class="ic-row"><span class="ic-label">階 1</span><span class="ic-value">1（O）</span></div>`
      + Object.keys(C.byOrd).map(Number).sort((x, y) => x - y)
        .map(o => `<div class="ic-row ord-row${o === cur ? ' cur' : ''}"><span class="ic-label">階 ${o}</span><span class="ic-value">${C.byOrd[o].length} 個點</span></div>`).join('');
  }
  function fillStartSelect() {
    const opts = ['<option value="">（點擊點雲）</option>'];
    Object.keys(C.byOrd).map(Number).sort((x, y) => x - y).forEach(o => {
      const i = C.byOrd[o][0];
      opts.push(`<option value="${i}">階 ${o}：${HC.pt(C.pts[i])}</option>`);
    });
    selS.innerHTML = opts.join('');
  }
  function loadCurve() {
    C = CURVES[selC.value];
    drawCloud(); sideInfo(); fillStartSelect();
    const o = Object.keys(C.byOrd).map(Number).sort((x, y) => x - y);
    const i = C.byOrd[o[Math.min(1, o.length - 1)]][0];
    selS.value = String(i);
    setStart(i);
  }
  selC.addEventListener('change', loadCurve);
  selS.addEventListener('change', () => { if (selS.value !== '') setStart(Number(selS.value)); });
  $('w03rand').addEventListener('click', () => { selS.value = ''; setStart(rnd(C.pts.length)); });
  loadCurve();

  /* ======================================================
     元件 2：Hasse 直方圖
     ====================================================== */
  const selP = $('w03p'), selA = $('w03a'), hstat = $('w03hstatus');
  const hv = HC.svg('w03hist', { w: 620, h: 300, pad: { l: 36, r: 12, t: 16, b: 34 } });
  let hist = null;

  function compute(p, a) {
    const P = BigInt(p), A = BigInt(a), byN = new Map();
    let ns = 0;
    for (let b = 0; b < p; b++) {
      if (ECC.mod(4n * A ** 3n + 27n * BigInt(b) ** 2n, P) === 0n) continue;   // 奇異曲線
      ns++;
      const N = ECC.points(A, BigInt(b), P).length;
      if (!byN.has(N)) byN.set(N, []);
      byN.get(N).push(b);
    }
    return { p, a, byN, ns };
  }
  function drawHist() {
    const { p, byN } = hist, r = 2 * Math.sqrt(p), lo = p + 1 - r, hi = p + 1 + r;
    const maxC = Math.max(...[...byN.values()].map(v => v.length));
    hv.xd = [Math.floor(lo) - 3, Math.ceil(hi) + 3];
    hv.yd = [0, maxC + 1];
    const step = p > 200 ? 10 : 5;
    const g0 = hv.clearLayer('grid');
    for (let v = Math.ceil(hv.xd[0] / step) * step; v <= hv.xd[1]; v += step) {
      hv.add('line', { cls: 'gridl', x1: hv.X(v), y1: hv.pad.t, x2: hv.X(v), y2: hv.pad.t + hv.ih }, g0);
      hv.txtPx(hv.X(v), hv.pad.t + hv.ih + 14, String(v), { anchor: 'middle' }, g0);
    }
    const ystep = maxC > 12 ? 4 : maxC > 6 ? 2 : 1;
    for (let c = 0; c <= maxC + 1; c += ystep) {
      hv.add('line', { cls: 'gridl', x1: hv.pad.l, y1: hv.Y(c), x2: hv.pad.l + hv.iw, y2: hv.Y(c) }, g0);
      hv.txtPx(hv.pad.l - 5, hv.Y(c) + 3.5, String(c), { anchor: 'end' }, g0);
    }
    hv.txtPx(hv.pad.l + hv.iw, hv.H - 4, 'N = #E(F_p)', { anchor: 'end' }, g0);
    const g = hv.clearLayer('band');
    hv.add('rect', { cls: 'hasse-band', x: hv.X(lo), y: hv.pad.t, width: hv.X(hi) - hv.X(lo), height: hv.ih }, g);
    for (const v of [lo, hi]) hv.add('line', { cls: 'hasse-edge', x1: hv.X(v), y1: hv.pad.t, x2: hv.X(v), y2: hv.pad.t + hv.ih }, g);
    hv.add('line', { cls: 'mirror', x1: hv.X(p + 1), y1: hv.pad.t, x2: hv.X(p + 1), y2: hv.pad.t + hv.ih }, g);
    hv.txtPx(hv.X(p + 1) + 4, hv.pad.t + 10, 'p+1', {}, g);
    const gb = hv.clearLayer('bars'), bw = Math.max(2, hv.X(1) - hv.X(0) - 1.5);
    for (const [N, bs] of [...byN.entries()].sort((x, y) => x[0] - y[0])) {
      const cls = N === p ? 'bar alt3' : isPrime(N) ? 'bar alt' : 'bar';
      const r0 = hv.add('rect', { cls, x: hv.X(N) - bw / 2, y: hv.Y(bs.length), width: bw, height: hv.Y(0) - hv.Y(bs.length) }, gb);
      r0.dataset.n = N;
      r0.addEventListener('click', () => pick(N));
    }
  }
  function pick(N) {
    const bs = hist.byN.get(N);
    hv.el.querySelectorAll('.bar').forEach(r => r.classList.toggle('sel', Number(r.dataset.n) === N));
    const tag = N === hist.p ? '，<b>異常曲線</b>（N = p）' : isPrime(N) ? '，N 是質數' : `，N = ${pretty(factorStr(N))}`;
    hstat.innerHTML = `N = ${N}（t = p + 1 − N = ${hist.p + 1 - N}）${tag}。共 ${bs.length} 個 b：${bs.join(', ')}`;
  }
  function loadHist() {
    hist = compute(Number(selP.value), Number(selA.value));
    drawHist();
    const { p, byN, ns } = hist, Ns = [...byN.keys()], r = 2 * Math.sqrt(p);
    const cnt = f => [...byN.entries()].filter(([N]) => f(N)).reduce((s, [, v]) => s + v.length, 0);
    $('w03hinfo').innerHTML = [
      ['p', String(p)], ['a', String(hist.a)], ['非奇異的 b', `${ns} 個`],
      ['Hasse 區間', `[${(p + 1 - r).toFixed(2)}, ${(p + 1 + r).toFixed(2)}]`],
      ['最小 N', String(Math.min(...Ns))], ['最大 N', String(Math.max(...Ns))],
      ['不同的 N', `${Ns.length} 種`], ['N 為質數', `${cnt(isPrime)} 條`], ['N = p（異常）', `${cnt(N => N === p)} 條`],
    ].map(([l, v]) => `<div class="ic-row"><span class="ic-label">${l}</span><span class="ic-value">${v}</span></div>`).join('');
    const anom = byN.get(p);
    if (anom) pick(p);
    else hstat.innerHTML = `${ns} 條曲線的 N 全部落在 Hasse 區間內。點一下長條看是哪些 b。`;
  }
  selP.addEventListener('change', loadHist);
  selA.addEventListener('change', loadHist);
  loadHist();
});

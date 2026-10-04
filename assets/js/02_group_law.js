/* 第 2 章：實數曲線上的割線法則、F_97 上的加法 */
HC.ready(() => {
  /* ---------- 實數圖 ---------- */
  const sv = HC.svg('w02real', { w: 620, h: 420, xd: [-3, 3.5], yd: [-5, 5], pad: { l: 30, r: 10, t: 10, b: 24 } });
  sv.grid(13, 10, { axes: true, fmt: v => (Number.isInteger(v) ? String(v) : '') });
  const aIn = $('w02a'), bIn = $('w02b');
  let a = -2, b = 2, mode = 'add';
  let P = { x: -1.2, s: 1 }, Q = { x: 0.9, s: 1 };
  const f = x => x ** 3 + a * x + b;
  const yOf = pt => pt.s * Math.sqrt(Math.max(0, f(pt.x)));

  // 曲線上 f ≥ 0 的區間，端點以二分法求根
  function intervals() {
    const xs = [], N = 1300, [x0, x1] = sv.xd;
    for (let i = 0; i <= N; i++) xs.push(x0 + (x1 - x0) * i / N);
    const iv = [];
    let start = null;
    const root = (l, r) => { for (let k = 0; k < 50; k++) { const m = (l + r) / 2; (f(l) >= 0) === (f(m) >= 0) ? (l = m) : (r = m); } return (l + r) / 2; };
    for (let i = 0; i < xs.length; i++) {
      const ok = f(xs[i]) >= 0;
      if (ok && start === null) start = i === 0 ? xs[0] : root(xs[i - 1], xs[i]);
      if (!ok && start !== null) { iv.push([start, root(xs[i - 1], xs[i])]); start = null; }
    }
    if (start !== null) iv.push([start, x1]);
    return iv;
  }
  function drawCurve() {
    const g = sv.clearLayer('curve');
    for (const [l, r] of intervals()) {
      const up = [], n = 200;
      for (let i = 0; i <= n; i++) { const x = l + (r - l) * i / n; up.push([x, Math.sqrt(Math.max(0, f(x)))]); }
      const clip = ([x, y]) => [sv.X(x), sv.Y(Math.max(-6, Math.min(6, y)))];
      const d = arr => 'M' + arr.map(p => clip(p).join(',')).join(' L');
      if (r >= sv.xd[1] - 1e-9) {          // 無界分支：上下兩半分開畫，不在畫面邊界接起來
        sv.path(d(up), {}, g);
        sv.path(d(up.map(([x, y]) => [x, -y])), {}, g);
      } else {                              // 有界的蛋形分支：繞一圈
        sv.path(d(up.concat(up.slice().reverse().map(([x, y]) => [x, -y]))) + ' Z', {}, g);
      }
    }
  }
  // 把滑鼠位置吸到曲線上：x 若落在 f < 0 的地方，移到最近的合法 x
  function snap(d) {
    const iv = intervals();
    let x = d.x, best = null;
    for (const [l, r] of iv) {
      const c = Math.max(l, Math.min(r, x));
      if (best === null || Math.abs(c - x) < Math.abs(best - x)) best = c;
    }
    return { x: best ?? x, s: d.y >= 0 ? 1 : -1 };
  }

  const fmt = v => (Math.abs(v) < 1e-9 ? '0' : v.toFixed(3));
  function compute() {
    const x1 = P.x, y1 = yOf(P);
    let x2 = Q.x, y2 = yOf(Q);
    if (mode === 'dbl') { x2 = x1; y2 = y1; }
    if (mode === 'neg') { x2 = x1; y2 = -y1; }
    if (Math.abs(x1 - x2) < 1e-9 && Math.abs(y1 + y2) < 1e-9) return { x1, y1, x2, y2, O: true };
    const lam = mode === 'dbl' || (Math.abs(x1 - x2) < 1e-9) ? (3 * x1 * x1 + a) / (2 * y1) : (y2 - y1) / (x2 - x1);
    const x3 = lam * lam - x1 - x2, y3 = lam * (x1 - x3) - y1;
    return { x1, y1, x2, y2, lam, x3, y3 };
  }
  let hP, hQ;
  function drawPts() {
    const g = sv.clearLayer('pts'), c = compute();
    const vals = $('w02vals');
    if (c.O) {
      sv.seg(c.x1, -6, c.x1, 6, { cls: 'chord' }, g);
      $('w02status').innerHTML = 'P 與 −P 在同一條鉛直線上：第三個交點是無窮遠點，所以 <b>P + (−P) = O</b>。';
      vals.innerHTML = `<div class="ic-row"><span class="ic-label">P</span><span class="ic-value">(${fmt(c.x1)}, ${fmt(c.y1)})</span></div><div class="ic-row"><span class="ic-label">−P</span><span class="ic-value">(${fmt(c.x2)}, ${fmt(c.y2)})</span></div><div class="ic-row"><span class="ic-label">和</span><span class="ic-value hl">O</span></div>`;
    } else {
      const { lam, x3, y3 } = c, L = x => lam * (x - c.x1) + c.y1;
      sv.seg(sv.xd[0], L(sv.xd[0]), sv.xd[1], L(sv.xd[1]), { cls: 'chord' }, g);
      const inView = x3 > sv.xd[0] && x3 < sv.xd[1] && Math.abs(y3) < 5;
      if (inView) {
        sv.seg(x3, -y3, x3, y3, { cls: 'mirror' }, g);
        sv.dot(x3, -y3, { cls: 'pt third', r: 6 }, g);
        sv.dot(x3, y3, { cls: 'pt R', r: 6 }, g);
        sv.txt(x3, y3, mode === 'dbl' ? '2P' : 'P+Q', { dx: 16, dy: -8 }, g);
      }
      $('w02status').innerHTML = (mode === 'dbl' ? '切線' : '割線') + `與曲線的第三個交點是 (${fmt(x3)}, ${fmt(-y3)})，鏡射後得到 <b>${mode === 'dbl' ? '2P' : 'P + Q'} = (${fmt(x3)}, ${fmt(y3)})</b>` + (inView ? '。' : '（在畫面外）。');
      vals.innerHTML = `<div class="ic-row"><span class="ic-label">P</span><span class="ic-value">(${fmt(c.x1)}, ${fmt(c.y1)})</span></div>`
        + (mode === 'add' ? `<div class="ic-row"><span class="ic-label">Q</span><span class="ic-value">(${fmt(c.x2)}, ${fmt(c.y2)})</span></div>` : '')
        + `<div class="ic-row"><span class="ic-label">λ</span><span class="ic-value">${fmt(lam)}</span></div>`
        + `<div class="ic-row"><span class="ic-label">x₃ = λ² − x₁ − x₂</span><span class="ic-value">${fmt(x3)}</span></div>`
        + `<div class="ic-row"><span class="ic-label">y₃</span><span class="ic-value hl">${fmt(y3)}</span></div>`;
    }
    hP = sv.dot(P.x, yOf(P), { cls: 'pt P', r: 9 }, g);
    sv.txt(P.x, yOf(P), mode === 'neg' ? 'P' : 'P', { dx: -14, dy: -10 }, g);
    if (mode === 'add') { hQ = sv.dot(Q.x, yOf(Q), { cls: 'pt Q', r: 9 }, g); sv.txt(Q.x, yOf(Q), 'Q', { dx: 14, dy: -10 }, g); HC.drag(hQ, sv, d => { Q = snap(d); drawPts(); }); }
    if (mode === 'neg') { sv.dot(P.x, -yOf(P), { cls: 'pt Q', r: 7 }, g); sv.txt(P.x, -yOf(P), '−P', { dx: 16, dy: 4 }, g); }
    HC.drag(hP, sv, d => { P = snap(d); drawPts(); });
  }
  function onCurveChange() {
    a = Number(aIn.value); b = Number(bIn.value);
    $('w02aV').textContent = a.toFixed(1); $('w02bV').textContent = b.toFixed(1);
    const D = 4 * a ** 3 + 27 * b ** 2;
    $('w02disc').innerHTML = `<div class="ic-row"><span class="ic-label">4a³ + 27b²</span><span class="ic-value${Math.abs(D) < 0.05 ? ' hl' : ''}">${D.toFixed(3)}</span></div>`
      + `<div class="ic-note">${Math.abs(D) < 0.05 ? '接近 0：曲線出現尖點或自交點，不是橢圓曲線。' : D < 0 ? '小於 0：三次式有三個實根，曲線有兩個分支。' : '大於 0：只有一個實根，曲線只有一個分支。'}</div>`;
    drawCurve();
    P = snap({ x: P.x, y: P.s }); Q = snap({ x: Q.x, y: Q.s });
    drawPts();
  }
  aIn.addEventListener('input', onCurveChange); bIn.addEventListener('input', onCurveChange);
  const modeBtns = { add: $('w02add'), dbl: $('w02dbl'), neg: $('w02neg') };
  for (const [m, btn] of Object.entries(modeBtns)) btn.addEventListener('click', () => {
    mode = m; Object.values(modeBtns).forEach(x => x.classList.toggle('on', x === btn)); drawPts();
  });
  onCurveChange();

  /* ---------- F_97 ---------- */
  const p = 97n, A = 2n, Bc = 3n;
  const pts = ECC.points(A, Bc, p).slice(1);
  const fv = HC.svg('w02fp', { w: 620, h: 560, xd: [0, 96], yd: [0, 96], pad: { l: 32, r: 12, t: 12, b: 24 } });
  fv.grid(8, 8, { fmt: v => String(Math.round(v)) });
  const cloud = fv.layer('cloud');
  pts.forEach(([x, y]) => {
    const c = fv.dot(Number(x), Number(y), { cls: 'pt', r: 4.2 }, cloud);
    c.dataset.x = x; c.dataset.y = y; c.style.cursor = 'pointer';
  });
  let fP = pts[3], fQ = pts[40], pick = 0;
  function fpDraw() {
    const g = fv.clearLayer('sel');
    const info = ECC.addInfo(fP, fQ, A, p);
    const showLine = $('w02fpLine').checked;
    if (info.lam !== undefined && showLine) {
      for (let x = 0n; x < p; x++) {
        const y = ECC.mod(info.lam * (x - fP[0]) + fP[1], p);
        fv.dot(Number(x), Number(y), { cls: 'pt line', r: 2.4 }, g);
      }
    }
    if (info.R) {
      const third = ECC.neg(info.R, p);
      fv.dot(Number(third[0]), Number(third[1]), { cls: 'pt third', r: 8 }, g);
      fv.seg(Number(third[0]), Number(third[1]), Number(info.R[0]), Number(info.R[1]), { cls: 'mirror' }, g);
      fv.dot(Number(info.R[0]), Number(info.R[1]), { cls: 'pt R', r: 7 }, g);
    }
    fv.dot(Number(fP[0]), Number(fP[1]), { cls: 'pt P', r: 7 }, g);
    fv.dot(Number(fQ[0]), Number(fQ[1]), { cls: 'pt Q', r: 7 }, g);
    const [x1, y1] = fP, [x2, y2] = fQ;
    let calc;
    if (info.kind === 'inverse') calc = '<div class="ic-note">Q = −P：x 相同、y 互為相反數，和為 O。</div>';
    else if (info.kind === 'double') {
      const num = ECC.mod(3n * x1 * x1 + A, p), den = ECC.mod(2n * y1, p), inv = ECC.invFermat(den, p);
      calc = row('λ = (3x₁² + a)/(2y₁)', `${num} · ${den}⁻¹`) + row(`${den}⁻¹ mod 97`, inv) + row('λ', info.lam);
    } else {
      const num = ECC.mod(y2 - y1, p), den = ECC.mod(x2 - x1, p), inv = ECC.invFermat(den, p);
      calc = row('λ = (y₂ − y₁)/(x₂ − x₁)', `${num} · ${den}⁻¹`) + row(`${den}⁻¹ mod 97`, inv) + row('λ', info.lam);
    }
    if (info.R) calc += row('x₃ = λ² − x₁ − x₂', info.R[0]) + row('y₃ = λ(x₁ − x₃) − y₁', info.R[1]);
    $('w02fpCalc').innerHTML = row('P', HC.pt(fP)) + row('Q', HC.pt(fQ)) + calc;
    $('w02fpStatus').innerHTML = info.R ? `${info.kind === 'double' ? '2P' : 'P + Q'} = <b>${HC.pt(info.R)}</b>。橙色小點是「直線」 y = λ(x − x₁) + y₁ mod 97，空心圈是它與曲線的第三個交點 ${HC.pt(ECC.neg(info.R, p))}，鏡射（y → 97 − y）得到答案。` : 'P + Q = <b>O</b>（無窮遠點，不在圖上）。';
  }
  const row = (k, v) => `<div class="ic-row"><span class="ic-label">${k}</span><span class="ic-value">${v}</span></div>`;
  cloud.addEventListener('click', e => {
    const c = e.target.closest('circle'); if (!c) return;
    const pt = [BigInt(c.dataset.x), BigInt(c.dataset.y)];
    if (pick === 0) { fP = pt; pick = 1; } else { fQ = pt; pick = 0; }
    fpDraw();
  });
  $('w02fpDbl').addEventListener('click', () => { fQ = fP; fpDraw(); });
  let s = 5;
  $('w02fpRnd').addEventListener('click', () => { s = (s * 37 + 11) % pts.length; fP = pts[s]; s = (s * 37 + 11) % pts.length; fQ = pts[s]; fpDraw(); });
  $('w02fpLine').addEventListener('change', fpDraw);
  fpDraw();
});

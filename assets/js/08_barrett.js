/* 第 8 章：Barrett 逐步演示 */
HC.ready(() => {
  const C = {
    t241: { m: 241n, b: 4n, x: 57855n, name: '241' },
    t4567: { m: 4567n, b: 10n, name: '4567' },
    n256: { m: ECC.fromHex('ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551'), b: 1n << 64n, name: 'P-256 的 n' },
    p256: { m: ECC.P.p256, b: 1n << 64n, name: 'P-256 的 p' },
    p521: { m: ECC.P.p521, b: 1n << 64n, name: 'P-521 的 p' },
  };
  const sel = $('w08mod'), steps = $('w08steps'), status = $('w08status');
  const sv = HC.svg('w08line', { w: 620, h: 130, pad: { l: 20, r: 20, t: 20, b: 34 } });
  let seed = 7;
  const rnd = bound => {
    let x = 0n;
    for (let i = 0; i < bound.toString(2).length + 16; i += 30) { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; x = (x << 30n) | BigInt(seed >>> 2); }
    return x % bound;
  };
  const small = c => c.m < 100000n;
  const fmt = (v, c) => (small(c) ? v.toString() : HC.hexShort(v, 10));
  const baseName = b => (b === 1n << 64n ? '2^64' : b.toString());

  function frames(c, x) {
    const S = ECC.barrettSetupB(c.m, c.b), t = ECC.barrettTrace(x, S), K = S.k, bn = baseName(c.b);
    const f = [];
    const rows = [];
    const add = (label, val, msg, line) => { rows.push([label, val]); f.push({ rows: rows.slice(), msg, line }); };
    add('x', fmt(x, c), `輸入 x = ${fmt(x, c)}，小於 b^${2 * K}。`, null);
    add('q₁ = ⌊x / b^{k−1}⌋', fmt(t.q1, c), `丟掉 x 最低的 ${K - 1} 位（以 ${bn} 為基底），不必做除法。`, null);
    add('q₂ = q₁·μ', fmt(t.q2, c), '一次乘法：q₁ 乘上預先算好的 μ。', null);
    add('q₃ = ⌊q₂ / b^{k+1}⌋', fmt(t.q3, c), `再丟掉 ${K + 1} 位，得到商的估計值 q₃。真正的商 Q = ${fmt(t.Q, c)}，差 ${t.Q - t.q3}。`, 'q3');
    add('r = x − q₃m', fmt(t.r0, c), `只用低 ${K + 1} 位相減${t.wrapped ? '（結果為負，加回 b^{k+1}）' : ''}；r 落在 [0, 3m)。`, 'r');
    t.subs.forEach((v, i) => add(`− m（第 ${i + 1} 次）`, fmt(v, c), `r ≥ m，減一次 m。`, 's' + (i + 1)));
    const ok = t.r === x % c.m;
    add('結果', fmt(t.r, c), `修正 ${t.fixes} 次後 r = ${fmt(t.r, c)}，與 x mod m 比對：<b>${ok ? '相同 ✓' : '不同 ✗'}</b>`, 'done');
    return { f, t };
  }

  // 數線：以 Q·m 為原點、m 為單位。x 的位置是 (x mod m)/m，q₃·m 在 q₃ − Q。
  function drawLine(t, upto) {
    const g = sv.clearLayer('marks');
    sv.xd = [-2.6, 1.6]; sv.yd = [0, 1];
    sv.add('line', { cls: 'ax', x1: sv.X(-2.6), y1: sv.Y(0.5), x2: sv.X(1.6), y2: sv.Y(0.5) }, g);
    for (let j = -2; j <= 1; j++) {
      sv.add('line', { cls: 'gridl', x1: sv.X(j), y1: sv.Y(0.2), x2: sv.X(j), y2: sv.Y(0.8) }, g);
      sv.txtPx(sv.X(j), sv.H - 8, j === 0 ? 'Q·m' : `(Q${j > 0 ? '+' : '−'}${Math.abs(j)})·m`, { anchor: 'middle' }, g);
    }
    const S = 1n << 40n;
    const xpos = Number((t.r * S) / curM) / Number(S);
    sv.add('circle', { cls: 'pt R', cx: sv.X(xpos), cy: sv.Y(0.5), r: 6 }, g);
    sv.txtPx(sv.X(xpos), sv.Y(0.5) - 12, 'x', { anchor: 'middle', cls: 'vlab' }, g);
    if (upto < 1) return;
    const q = Number(t.q3 - t.Q);
    sv.add('circle', { cls: 'pt P', cx: sv.X(q), cy: sv.Y(0.5), r: 6 }, g);
    sv.txtPx(sv.X(q), sv.Y(0.5) + 22, 'q₃·m', { anchor: 'middle', cls: 'vlab' }, g);
    if (upto < 2) return;
    sv.add('line', { cls: 'chord', x1: sv.X(q), y1: sv.Y(0.66), x2: sv.X(xpos), y2: sv.Y(0.66) }, g);
    sv.txtPx((sv.X(q) + sv.X(xpos)) / 2, sv.Y(0.66) - 6, 'r = x − q₃m', { anchor: 'middle' }, g);
    for (let k = 1; k <= Math.min(upto - 2, t.fixes); k++)
      sv.add('circle', { cls: 'pt third', cx: sv.X(q + k), cy: sv.Y(0.5), r: 9 }, g);
  }
  let curM = 1n;

  let player = null, cur = null;
  const apply = (fr, i) => {
    steps.innerHTML = fr.rows.map(([l, v], j) => `<div class="frow wl${j === fr.rows.length - 1 ? ' new' : ''}"><div class="fl">${l}</div><div class="fv bigval">${v}</div></div>`).join('');
    status.innerHTML = fr.msg;
    const stage = { null: 0, q3: 1, r: 2, s1: 3, s2: 4, done: 2 + cur.t.fixes };
    drawLine(cur.t, fr.line === null ? 0 : stage[fr.line]);
  };
  function load(newX) {
    const c = C[sel.value];
    curM = c.m;
    const x = newX ? rnd(c.m) * rnd(c.m) : (c.x ?? rnd(c.m) * rnd(c.m));
    cur = frames(c, x);
    const S = ECC.barrettSetupB(c.m, c.b);
    $('w08pre').innerHTML = `<div class="ic-row"><span class="ic-label">m</span><span class="ic-value">${fmt(c.m, c)}</span></div>`
      + `<div class="ic-row"><span class="ic-label">b</span><span class="ic-value">${baseName(c.b)}</span></div>`
      + `<div class="ic-row"><span class="ic-label">k</span><span class="ic-value">${S.k}</span></div>`
      + `<div class="ic-row"><span class="ic-label">μ</span><span class="ic-value">${fmt(S.mu, c)}</span></div>`;
    stats(c, S);
    if (!player) {
      player = new HC.Player({ frames: cur.f, apply, delay: 1100 });
      HC.bindPlayer(player, { play: $('w08play'), step: $('w08step'), reset: $('w08reset'), onReset: blank });
    } else player.load(cur.f);
    blank();
  }
  const blank = () => { steps.innerHTML = '<div class="where">（尚未開始）</div>'; status.innerHTML = '按「下一步」開始。'; drawLine(cur.t, 0); };
  function stats(c, S) {
    const cnt = [0, 0, 0];
    let label;
    if (c.m < 1000n) {                       // 小模數：窮舉所有 0 ≤ x < m²
      for (let x = 0n; x < c.m * c.m; x++) cnt[ECC.barrettTrace(x, S).fixes]++;
      label = `全部 ${c.m * c.m} 個 x &lt; m²`;
    } else {
      let s = 99;
      const r2 = bound => { let x = 0n; for (let i = 0; i < bound.toString(2).length + 16; i += 30) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; x = (x << 30n) | BigInt(s >>> 2); } return x % bound; };
      for (let i = 0; i < 2000; i++) cnt[ECC.barrettTrace(r2(c.m) * r2(c.m), S).fixes]++;
      label = '隨機 2000 個乘積';
    }
    $('w08statTitle').innerHTML = '修正次數：' + label;
    $('w08stats').innerHTML = cnt.map((n, i) => `<div class="ic-row"><span class="ic-label">修正 ${i} 次</span><span class="ic-value${i === 2 && n ? ' hl' : ''}">${n}</span></div>`).join('');
  }
  sel.addEventListener('change', () => load(false));
  $('w08rand').addEventListener('click', () => load(true));
  
  load(false);
});

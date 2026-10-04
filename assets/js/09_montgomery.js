/* 第 9 章：REDC 逐輪演示、Montgomery 與 Barrett 對照 */
HC.ready(() => {
  const N256 = ECC.fromHex('ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
  const B64 = 1n << 64n;
  const C = {
    t4567: { m: 4567n, b: 10n, T: 1234n * 3211n },
    t241: { m: 241n, b: 16n },
    p256: { m: ECC.P.p256, b: B64 },
    n256: { m: N256, b: B64 },
    p521: { m: ECC.P.p521, b: B64 },
  };
  let seed = 11;
  const rnd = bound => {
    let x = 0n;
    for (let i = 0; i < bound.toString(2).length + 16; i += 30) { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; x = (x << 30n) | BigInt(seed >>> 2); }
    return x % bound;
  };
  const digitsOf = (x, b, n) => { const d = []; for (let i = 0; i < n; i++) { d.push(x % b); x /= b; } return d; };
  const dw = b => (b === 10n ? 1 : b === 16n ? 1 : 16);
  const cell = (d, b, cls) => `<span class="word ${cls}">${b === 10n ? d.toString() : d.toString(16).padStart(dw(b), '0')}</span>`;
  const rowHTML = (x, b, n, clsFn) => '<div class="words">' + digitsOf(x, b, n).map((d, i) => [d, i]).reverse().map(([d, i]) => cell(d, b, clsFn(i, d))).join('') + '</div>';
  const show = (v, c) => (c.m < 100000n ? v.toString() : HC.hexShort(v, 10));
  const bname = b => (b === B64 ? '2^64' : b.toString());

  /* ---------- REDC 逐輪 ---------- */
  const sel = $('w09mod'), steps = $('w09steps'), status = $('w09status');
  let player = null;
  function framesFor(c, T) {
    const S = ECC.montSetupB(c.m, c.b), t = ECC.redcTrace(T, S), n = 2 * S.k + 1, f = [];
    const base = (A, zeroUpTo, cur) => rowHTML(A, c.b, n, (i, d) => (i < zeroUpTo ? 'zero' : i === cur ? 'cur' : i >= S.k ? 'hi' : ''));
    f.push({ html: [['T', base(T, 0, 0)]], msg: `T = ${show(T, c)} 小於 mR。藍色是高 ${S.k + 1} 個字組，最低 ${S.k} 個字組要逐一消成 0。` });
    t.rounds.forEach((r, i) => {
      f.push({ html: [[`第 ${i} 輪`, base(r.A, i + 1, i + 1 < S.k ? i + 1 : -1)]],
        msg: `a${i} = ${show(r.ai, c)}，u${i} = a${i}·m' mod β = ${show(r.ui, c)}；加上 u${i}·m·β^${i} 後，第 ${i} 個字組變成 0。` });
    });
    f.push({ html: [['÷ R', rowHTML(t.shifted, c.b, S.k + 1, () => '')]], msg: `低 ${S.k} 個字組全是 0，右移 ${S.k} 個字組（除以 R）。結果 ${show(t.shifted, c)} 小於 2m。` });
    const ok = t.r === (T * S.Rinv) % c.m;
    f.push({ html: [[t.fixes ? '− m' : '結果', rowHTML(t.r, c.b, S.k, () => '')]],
      msg: `${t.fixes ? '大於 m，減一次 m。' : '已小於 m，不必減。'}REDC(T) = ${show(t.r, c)}；與 T·R⁻¹ mod m 比對：<b>${ok ? '相同 ✓' : '不同 ✗'}</b>` });
    return f;
  }
  const apply = (fr, i) => {
    const rows = player.frames.slice(0, i + 1).flatMap(x => x.html);
    steps.innerHTML = rows.map(([l, h], j) => `<div class="frow${j === rows.length - 1 ? ' new' : ''}"><div class="fl">${l}</div><div class="fv" style="overflow-x:auto">${h}</div></div>`).join('');
    status.innerHTML = fr.msg;
  };
  const blank = () => { steps.innerHTML = '<div class="where">（尚未開始）</div>'; status.innerHTML = '按「下一步」開始。'; };
  function load(random) {
    const c = C[sel.value], S = ECC.montSetupB(c.m, c.b);
    const T = !random && c.T ? c.T : rnd(c.m) * rnd(c.m);
    $('w09pre').innerHTML = `<div class="ic-row"><span class="ic-label">m</span><span class="ic-value">${show(c.m, c)}</span></div>`
      + `<div class="ic-row"><span class="ic-label">β</span><span class="ic-value">${bname(c.b)}</span></div>`
      + `<div class="ic-row"><span class="ic-label">s</span><span class="ic-value">${S.k}</span></div>`
      + `<div class="ic-row"><span class="ic-label">m'</span><span class="ic-value">${show(S.mPrime, c)}</span></div>`
      + `<div class="ic-row"><span class="ic-label">R² mod m</span><span class="ic-value">${show(S.R2, c)}</span></div>`;
    const frames = framesFor(c, T);
    if (!player) {
      player = new HC.Player({ frames, apply, delay: 1000 });
      HC.bindPlayer(player, { play: $('w09play'), step: $('w09step'), reset: $('w09reset'), onReset: blank });
    } else player.load(frames);
    blank();
  }
  sel.addEventListener('change', () => load(false));
  $('w09rand').addEventListener('click', () => load(true));
  load(false);

  /* ---------- 完整流程對照 ---------- */
  const fsel = $('w09fmod'), xin = $('w09x'), yin = $('w09y');
  const parse = s => { s = s.trim(); return s.startsWith('0x') ? BigInt(s) : BigInt(s.replace(/[\s_,]/g, '')); };
  const step = (k, v) => `<div class="flow-step"><span class="fs-k">${k}</span><span class="fs-v">${v}</span></div>`;
  function compute() {
    const c = C[fsel.value];
    let x, y;
    try { x = ECC.mod(parse(xin.value), c.m); y = ECC.mod(parse(yin.value), c.m); }
    catch (_) { $('w09fstatus').innerHTML = '請輸入整數（十進位或 0x 開頭的十六進位）。'; return; }
    const S = ECC.montSetupB(c.m, c.b), sh = v => show(v, c);
    const xt = ECC.redc(x * S.R2, S), yt = ECC.redc(y * S.R2, S);
    const zt = ECC.redc(xt * yt, S), z = ECC.redc(zt, S);
    $('w09mont').innerHTML = '<div class="flow-head">MONTGOMERY</div>'
      + step('進入：x̃ = REDC(x·(R² mod m))', sh(xt))
      + step('進入：ỹ = REDC(y·(R² mod m))', sh(yt))
      + step('相乘：REDC(x̃·ỹ) = (xy)~', sh(zt))
      + step('離開：REDC((xy)~)', `<b>${sh(z)}</b>`);
    const B = ECC.barrettSetupB(c.m, c.b), t = ECC.barrettTrace(x * y, B);
    $('w09bar').innerHTML = '<div class="flow-head">BARRETT</div>'
      + step('x·y', sh(x * y))
      + step('估商 q₃（真正的商 Q）', `${sh(t.q3)}（Q − q₃ = ${t.Q - t.q3}）`)
      + step(`r = x·y − q₃m，修正 ${t.fixes} 次`, sh(t.r0))
      + step('結果', `<b>${sh(t.r)}</b>`);
    const ok = z === t.r && z === (x * y) % c.m;
    $('w09fstatus').innerHTML = `兩條路都得到 xy mod m = ${sh(z)}：<b>${ok ? '一致 ✓' : '不一致 ✗'}</b>。注意中間的 (xy)~ = ${sh(zt)} 本身不是答案。`;
  }
  fsel.addEventListener('change', () => {
    if (fsel.value === 't4567') { xin.value = '1234'; yin.value = '3211'; }
    else { xin.value = '0x' + rnd(C[fsel.value].m).toString(16); yin.value = '0x' + rnd(C[fsel.value].m).toString(16); }
    compute();
  });
  $('w09frand').addEventListener('click', () => { const m = C[fsel.value].m; xin.value = m < 100000n ? rnd(m).toString() : '0x' + rnd(m).toString(16); yin.value = m < 100000n ? rnd(m).toString() : '0x' + rnd(m).toString(16); compute(); });
  $('w09go').addEventListener('click', compute);
  compute();
});

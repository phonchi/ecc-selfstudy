/* 第 7 章：折疊實驗室 */
HC.ready(() => {
  const P = ECC.P;
  const MODS = {
    t127: { p: 127n, n: 7, c: 1n, name: '2^7 − 1', bits: true },
    t251: { p: 251n, n: 8, c: 5n, name: '2^8 − 5', bits: true },
    p521: { p: P.p521, n: 521, c: 1n, name: '2^521 − 1' },
    p25519: { p: P.p25519, n: 255, c: 19n, name: '2^255 − 19' },
    p448: { p: P.p448, name: '2^448 − 2^224 − 1' },
    p256: { p: P.p256, name: '2^256 − 2^224 + 2^192 + 2^96 − 1' },
  };
  const sel = $('w07mod'), stage = $('w07stage'), status = $('w07status'), info = $('w07info');
  let rnd = 20261004;
  const rand = bound => {            // 固定種子的 BigInt 亂數，重新整理後結果一樣
    let x = 0n;
    const bits = bound.toString(2).length + 8;
    for (let i = 0; i < bits; i += 30) { rnd = (Math.imul(rnd, 1103515245) + 12345) >>> 0; x = (x << 30n) | BigInt(rnd >>> 2); }
    return x % bound;
  };
  const show = (x, M) => (M.bits ? `<span class="bits">${x.toString(2)}</span> <span class="where">= ${x}</span>`
    : `<span class="bigval">${HC.hexShort(x, 16)}</span> <span class="where">（${x.toString(2).length} 位元）</span>`);
  const split = (A, M) => {
    const hi = A >> BigInt(M.n), lo = A & ((1n << BigInt(M.n)) - 1n);
    if (M.bits) {
      const hs = hi.toString(2), ls = lo.toString(2).padStart(M.n, '0');
      return `<span class="bits"><span class="h">${hs}</span><span class="l">${ls}</span></span>`;
    }
    return `<span class="bigval"><span class="bits"><span class="h">${HC.hexShort(hi, 10)}</span></span> ‖ <span class="bits"><span class="l">${HC.hexShort(lo, 10)}</span></span></span>`;
  };
  const row = (label, html, ok = false) => ({ label, html, ok });

  function framesFor(key, x, y) {
    const M = MODS[key], A = x * y, fr = [];
    fr.push({ rows: [row('A = x·y', show(A, M))], msg: `A = x·y 有 ${A.toString(2).length} 位元，比 p 長一倍。` });
    if (key === 'p448' || key === 'p256') return fr.concat(key === 'p448' ? fr448(A, M) : fr256(A, M));
    let cur = A, round = 0;
    // Mersenne（c = 1）折一次就小於 2p，剩下的只是減一次 p；偽 Mersenne 可能要再折一次
    while ((cur >> BigInt(M.n)) && !(M.c === 1n && round >= 1)) {
      round++;
      const hi = cur >> BigInt(M.n), lo = cur & ((1n << BigInt(M.n)) - 1n);
      fr.push({ rows: [row(`第 ${round} 次切開`, split(cur, M))],
        msg: `在第 ${M.n} 位切開：<b>高位 A₁</b> 與 <b>低位 A₀</b>。因為 2^${M.n} ≡ ${M.c} (mod p)，A₁·2^${M.n} 可換成 A₁·${M.c}。` });
      cur = lo + M.c * hi;
      fr.push({ rows: [row(M.c === 1n ? 'A₀ + A₁' : `A₀ + ${M.c}·A₁`, show(cur, M))],
        msg: `折疊後剩 ${cur.toString(2).length} 位元；值變小了，模 p 的餘數沒變。` });
    }
    let k = 0;
    while (cur >= M.p) { cur -= M.p; k++; }
    fr.push(finalFrame(cur, A, M, k));
    return fr;
  }
  function finalFrame(r, A, M, k, adds = 0) {
    const good = r === A % M.p;
    const what = adds ? `加 ${adds} 次 p` : k ? `減 ${k} 次 p` : '';
    return { rows: [row(what || '已在 [0, p)', show(r, M), good)],
      msg: `${what ? `再${what}，` : '結果已在 [0, p)，'}得到 ${M.bits ? r : HC.hexShort(r, 8)}。與 A % p 比對：<b>${good ? '相同 ✓' : '不同 ✗'}</b>` };
  }
  function fr448(A, M) {
    const t = ECC.fold448(A), fr = [];
    const w = t.words.map(v => HC.hexShort(v, 6));
    fr.push({ rows: [row('224 位元塊', `<span class="bigval">A₃=${w[3]}<br>A₂=${w[2]}<br>A₁=${w[1]}<br>A₀=${w[0]}</span>`)],
      msg: '切成四塊，每塊 224 位元。2^448 ≡ 2^224 + 1，所以高次方都能換掉。' });
    for (const [name, lab] of [['S1', 'A₁‖A₀'], ['S2', 'A₂‖A₂'], ['S3', 'A₃‖A₃'], ['S4', 'A₃‖0']])
      fr.push({ rows: [row(`+ ${lab}`, show(t.terms[name], M))], msg: `加上 ${name} = (${lab})。` });
    fr.push({ rows: [row('四項之和', show(t.sum, M))], msg: '四個 448 位元的數相加，結果小於 4·2^448。' });
    fr.push(finalFrame(t.r, A, M, t.fixes));
    return fr;
  }
  function fr256(A, M) {
    const t = ECC.foldP256(A), fr = [];
    fr.push({ rows: [row('32 位元字組', HC.wordsHTML(t.words, 32, i => (i >= 8 ? 'hi' : 'lo')))],
      msg: 'A 寫成 16 個 32 位元字組 A₁₅…A₀。高 8 個字組（藍）要換成低次方的組合。' });
    let run = 0n;
    for (const term of t.terms) {
      run += BigInt(term.coef) * term.value;
      const ws = term.idx.map(i => (i < 0 ? 0n : t.words[i])).reverse();
      const sign = term.coef > 0 ? (term.coef === 2 ? '+2·' : '+ ') : '− ';
      fr.push({ rows: [row(sign + term.name, HC.wordsHTML(ws, 32, () => (term.coef < 0 ? 'neg' : '')))],
        msg: `${sign}${term.name} = (${term.idx.map(i => (i < 0 ? '0' : 'A' + i)).join(', ')})。累計 ${run < 0n ? '為負數' : `約 ${run.toString(2).length} 位元`}。` });
    }
    fr.push({ rows: [row('組合 U', (t.raw < 0n ? '−' : '') + show(t.raw < 0n ? -t.raw : t.raw, M))],
      msg: `U = T + 2S₁ + 2S₂ + S₃ + S₄ − D₁ − D₂ − D₃ − D₄ ${t.raw < 0n ? '是負數' : t.raw >= M.p ? '比 p 大' : '已在 [0,p)'}。` });
    fr.push(finalFrame(t.r, A, M, t.subs, t.adds));
    return fr;
  }

  let player = null, rowsShown = [];
  const apply = (f, i) => {
    rowsShown = player.frames.slice(0, i + 1).flatMap(fr => fr.rows);
    stage.innerHTML = rowsShown.map((r, j) => `<div class="frow${j === rowsShown.length - 1 ? ' new' : ''}${r.ok ? ' ok' : ''}"><div class="fl">${r.label}</div><div class="fv">${r.html}</div></div>`).join('');
    status.innerHTML = f.msg;
  };
  function load() {
    const key = sel.value, M = MODS[key];
    const x = rand(M.p), y = rand(M.p);
    info.innerHTML = `<div class="ic-row"><span class="ic-label">p</span><span class="ic-value">${M.name}</span></div>`
      + `<div class="ic-row"><span class="ic-label">位元數</span><span class="ic-value">${M.p.toString(2).length}</span></div>`
      + `<div class="ic-row"><span class="ic-label">x</span><span class="ic-value">${M.bits ? x : HC.hexShort(x, 5)}</span></div>`
      + `<div class="ic-row"><span class="ic-label">y</span><span class="ic-value">${M.bits ? y : HC.hexShort(y, 5)}</span></div>`;
    const frames = framesFor(key, x, y);
    if (!player) {
      player = new HC.Player({ frames, apply, delay: 1100 });
      HC.bindPlayer(player, { play: $('w07play'), step: $('w07step'), reset: $('w07reset'), onReset: clear });
    } else player.load(frames);
    clear();
  }
  const clear = () => { stage.innerHTML = '<div class="where">（尚未開始）</div>'; status.innerHTML = '按「下一步」開始。'; };
  sel.addEventListener('change', load);
  $('w07rand').addEventListener('click', load);
  load();

  // P-256 九項的表
  const tb = $('w07p256table');
  if (tb) {
    const head = '<tr><th>項</th><th>係數</th>' + [7, 6, 5, 4, 3, 2, 1, 0].map(i => `<th>字組 ${i}</th>`).join('') + '</tr>';
    tb.innerHTML = head + ECC.P256_TERMS.map(([n, c, idx]) => `<tr><td>${n}</td><td class="num">${c > 0 ? '+' + c : c}</td>`
      + idx.map(i => `<td class="num">${i < 0 ? '0' : 'A' + i}</td>`).join('') + '</tr>').join('');
  }
});

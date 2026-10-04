/* 第 5 章：double-and-add、NAF、ladder 逐位演示與運算節奏 */
HC.ready(() => {
  const p = 97n, a = 94n, P = [0n, 43n], N = 107n;
  const msel = $('w05m'), kin = $('w05k'), table = $('w05table'), trace = $('w05trace'), status = $('w05status');
  let player = null, run = null;

  function build() {
    let k = BigInt(Math.max(1, Math.min(106, Math.round(Number(kin.value) || 1))));
    kin.value = String(k);
    const m = msel.value, t = ECC.scalarTrace(k, P, a, p, m, m === 'ladder' ? 7 : 0);   // 階梯固定跑 7 位（群階 107 的位元數）
    // 已讀數字代表的整數
    let v = 0n;
    t.frames.forEach(f => {
      const d = f.digit === '1̄' ? -1n : BigInt(f.digit);
      v = 2n * v + d; f.prefix = v;
    });
    const digits = m === 'naf' ? ECC.naf(k).reverse().map(d => (d === -1 ? '1̄' : String(d))) : [...k.toString(2).padStart(m === 'ladder' ? 7 : 0, '0')];
    return { k, m, t, digits };
  }
  const opsHTML = f => f.ops.map(o => (o.includes('起點') ? '<span class="lbl">起點</span>' : `<span class="${o.includes('2R') ? 'tr-d' : 'tr-a'}">${o.includes('2R') ? 'D' : 'A'}</span>`)).join('');
  function apply(f, i) {
    const rows = run.t.frames.slice(0, i + 1);
    const ladder = run.m === 'ladder';
    let h = `<table class="etable"><tr><th>步</th><th>數字</th><th>運算</th><th>已讀的整數 j</th><th>${ladder ? 'R₀ = jP' : 'R = jP'}</th>${ladder ? '<th>R₁ = (j+1)P</th>' : ''}</tr>`;
    rows.forEach((r, j) => {
      h += `<tr${j === i ? ' style="background:var(--highlight)"' : ''}><td>${j + 1}</td><td>${r.digit}</td><td style="text-align:left">${r.ops.join('，')}</td><td>${r.prefix}</td><td>${HC.pt(r.R)}</td>${ladder ? `<td>${HC.pt(r.R1)}</td>` : ''}</tr>`;
    });
    table.innerHTML = h + '</table>';
    trace.innerHTML = '<span class="lbl">節奏</span>' + run.t.frames.map((r, j) => (j <= i ? `<span class="grp${j === i ? ' cur' : ''}">${opsHTML(r)}</span>` : '')).join('');
    const check = ECC.eq(f.R, ECC.mul(((f.prefix % N) + N) % N, P, a, p));
    let msg = `讀到數字 ${f.digit}：${f.ops.join('，')}。目前的點 = ${f.prefix}·P ${check ? '✓' : '✗'}`;
    if (ladder) {
      const diff = ECC.add(f.R1, ECC.neg(f.R, p), a, p);
      msg += `；R₁ − R₀ = ${HC.pt(diff)} ${ECC.eq(diff, P) ? '= P ✓' : '≠ P ✗'}`;
    }
    if (i === run.t.frames.length - 1) msg += `。完成：${run.k}P = <b>${HC.pt(f.R)}</b>`;
    status.innerHTML = msg;
    $('w05count').innerHTML = `<div class="ic-row"><span class="ic-label">k 的${run.m === 'naf' ? ' NAF' : '二進位'}</span><span class="ic-value">${run.digits.join('')}</span></div>`
      + `<div class="ic-row"><span class="ic-label">倍點 D</span><span class="ic-value">${f.D}</span></div>`
      + `<div class="ic-row"><span class="ic-label">加點 A</span><span class="ic-value">${f.A}</span></div>`;
  }
  const blank = () => {
    table.innerHTML = '<div class="where">（尚未開始）</div>';
    trace.innerHTML = '<span class="lbl">節奏</span>';
    status.innerHTML = '按「下一步」逐位執行。';
    $('w05count').innerHTML = `<div class="ic-row"><span class="ic-label">k 的${run.m === 'naf' ? ' NAF' : '二進位'}</span><span class="ic-value">${run.digits.join('')}</span></div>`
      + `<div class="ic-row"><span class="ic-label">總計</span><span class="ic-value">${run.t.D} D、${run.t.A} A</span></div>`;
  };
  function load() {
    run = build();
    if (!player) {
      player = new HC.Player({ frames: run.t.frames, apply, delay: 800 });
      HC.bindPlayer(player, { play: $('w05play'), step: $('w05step'), reset: $('w05reset'), onReset: blank });
    } else player.load(run.t.frames);
    blank();
  }
  msel.addEventListener('change', load);
  kin.addEventListener('change', load);
  load();
});

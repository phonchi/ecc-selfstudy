/* 第 6 章：schoolbook 乘法逐格演示（HAC 演算法 14.12） */
HC.ready(() => {
  const selW = $('w06w'), selK = $('w06k'), grid = $('w06grid'), io = $('w06io'), outEl = $('w06out'), status = $('w06status');
  let seed = 20261004;
  const rword = w => {                  // 固定種子的 w 位元亂數
    let x = 0n;
    for (let got = 0; got < w; got += 16) { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; x = (x << 16n) | BigInt((seed >>> 8) & 0xffff); }
    return x & ((1n << BigInt(w)) - 1n);
  };
  const hexw = (v, w) => v.toString(16).padStart(Math.ceil(w / 4), '0');
  const cellHex = (v, w) => {           // 格子裡的 2w 位元部分積：太長就縮寫
    const s = hexw(v, 2 * w);
    return s.length <= 8 ? s : s.slice(0, 4) + '…' + s.slice(-4);
  };
  const words = (ws, w, cls) => HC.wordsHTML(ws, w, cls);

  let S = null, player = null;
  function setup(maxed) {
    const w = Number(selW.value), k = Number(selK.value), b = 1n << BigInt(w);
    const xw = [], yw = [];
    for (let i = 0; i < k; i++) { xw.push(maxed ? b - 1n : rword(w)); yw.push(maxed ? b - 1n : rword(w)); }
    const t = ECC.schoolbookTrace(xw, yw, w);
    S = { w, k, b, xw, yw, t, x: ECC.fromWords(xw, w), y: ECC.fromWords(yw, w) };
    io.innerHTML = `<div class="io-row"><span class="row-label">x</span>${words(xw, w)}</div>`
      + `<div class="io-row"><span class="row-label">y</span>${words(yw, w)}</div>`
      + `<div class="where">以 16 進位顯示，每格一個 ${w} 位元字組，左邊是高位。</div>`;
    if (!player) {
      player = new HC.Player({ frames: t.frames, apply, delay: 650 });
      HC.bindPlayer(player, { play: $('w06play'), step: $('w06step'), reset: $('w06reset'), onReset: blank });
    } else { player.load(t.frames); $('w06play').textContent = '▶ 播放'; }
    blank();
  }
  function drawGrid(fi) {
    const { k, w, xw, yw, t } = S;
    const done = new Map();             // "i,j" -> 部分積
    let cur = null;
    for (let n = 0; n <= fi; n++) {
      const f = t.frames[n];
      if (f.uv === null) continue;
      done.set(`${f.i},${f.j}`, xw[f.j] * yw[f.i]);
      if (n === fi) cur = `${f.i},${f.j}`;
    }
    let h = '<tr><th></th>' + Array.from({ length: k }, (_, c) => `<th>x${sub(k - 1 - c)}</th>`).join('') + '</tr>';
    for (let i = 0; i < k; i++) {
      h += `<tr><th>y${sub(i)}</th>`;
      for (let c = 0; c < k; c++) {
        const j = k - 1 - c, key = `${i},${j}`, v = done.get(key);
        const cls = key === cur ? 'cur' : v !== undefined ? 'done' : '';
        h += `<td class="${cls}"><span class="ij">→ z${sub(i + j)}</span>${v !== undefined ? cellHex(v, w) : '·'}</td>`;
      }
      h += '</tr>';
    }
    grid.innerHTML = h;
  }
  const subs = '₀₁₂₃₄₅₆₇₈₉';
  const sub = n => String(n).split('').map(d => subs[d]).join('');
  function drawOut(out, hi) {
    outEl.innerHTML = `<div class="io-row"><span class="row-label">輸出 z</span>${words(out, S.w, i => (i === hi ? 'cur' : ''))}</div>`;
  }
  function apply(f, n) {
    const { w, xw, yw, k, b, t } = S;
    drawGrid(n);
    const mults = t.frames.slice(0, n + 1).filter(x => x.uv !== null).length;
    if (f.uv !== null) {
      const prev = n > 0 ? t.frames[n - 1] : null;
      const before = (prev ? prev.out : Array(2 * k).fill(0n))[f.i + f.j];
      const cin = f.j === 0 ? 0n : prev.carry;
      drawOut(f.out, f.i + f.j);
      status.innerHTML = `(i, j) = (${f.i}, ${f.j})：uv = z${sub(f.i + f.j)} + x${sub(f.j)}·y${sub(f.i)} + c = ${hexw(before, w)} + ${hexw(xw[f.j], w)}·${hexw(yw[f.i], w)} + ${hexw(cin, w)} = <b>${hexw(f.uv, 2 * w)}</b>`
        + `<br>→ z${sub(f.i + f.j)} = ${hexw(f.uv & (b - 1n), w)}，新進位 c = ${hexw(f.carry, w)}${f.uv === b * b - 1n ? '（恰好等於 β² − 1）' : ''}`;
    } else {
      drawOut(f.out, f.i + k);
      const last = n === t.frames.length - 1;
      status.innerHTML = `第 ${f.i} 列結束：進位 c = ${hexw(f.carry, w)} 寫入 z${sub(f.i + k)}。`
        + (last ? `<br>全部完成：共 ${mults} 次字組乘法 = s² = ${k * k}。` : '');
    }
    count(mults, n);
  }
  function count(mults, n) {
    const { k, t, x, y, w } = S;
    $('w06count').innerHTML = [
      ['字組乘法', `${mults} / ${k * k}`], ['s²', String(k * k)], ['平方時不同的乘積', String(k * (k + 1) / 2)],
      ['步驟', `${n + 1} / ${t.frames.length}`],
    ].map(([l, v]) => `<div class="ic-row"><span class="ic-label">${l}</span><span class="ic-value">${v}</span></div>`).join('');
    const done = n === t.frames.length - 1, got = ECC.fromWords(t.out, w), ok = got === x * y;
    $('w06check').innerHTML = done
      ? `<div class="ic-row"><span class="ic-label">輸出字組</span><span class="ic-value">${2 * k} 個</span></div>`
        + `<div class="ic-row"><span class="ic-label">與 x·y 比對</span><span class="ic-value hl">${ok ? '相同 ✓' : '不同 ✗'}</span></div>`
        + `<div class="ic-note">x·y = ${HC.hexShort(x * y, 10)}</div>`
      : '<div class="ic-note">播放完畢後，把輸出字組拼回整數，與 BigInt 直接算的 x·y 比對。</div>';
  }
  function blank() {
    drawGrid(-1);
    drawOut(Array(2 * S.k).fill(0n), -1);
    status.innerHTML = `x、y 各有 ${S.k} 個 ${S.w} 位元字組。按「下一步」開始逐格相乘。`;
    count(0, -1);
  }
  selW.addEventListener('change', () => setup(false));
  selK.addEventListener('change', () => setup(false));
  $('w06rand').addEventListener('click', () => setup(false));
  $('w06max').addEventListener('click', () => setup(true));
  setup(false);
});

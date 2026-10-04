/* 第 0 章：toyB 曲線上的 ECDH 兩人面板 */
HC.ready(() => {
  const p = 97n, a = -3n, b = 6n, n = 107;       // y^2 = x^3 - 3x + 6 over F_97，群階 107（質數）
  const ac = ECC.mod(a, p);
  const pts = ECC.points(ac, b, p).filter(P => P !== null);
  const mul = (k, P) => ECC.mul(BigInt(k), P, ac, p);
  const key = P => (P === null ? 'O' : `${P[0]},${P[1]}`);

  const gsel = $('w00gen'), ain = $('w00a'), bin = $('w00b');
  // 生成元選項：依 x 排序的點表中均勻取 6 個（群階是質數，任何非 O 的點都是生成元）
  const choices = [0, 21, 42, 63, 84, 105].map(i => pts[i]);
  gsel.innerHTML = choices.map((P, i) => `<option value="${i}">${HC.pt(P)}</option>`).join('');

  /* ---------- 點雲 ---------- */
  const S = HC.svg('w00cloud', { w: 460, h: 440, xd: [0, 96], yd: [0, 96], pad: { l: 34, r: 14, t: 14, b: 28 } });
  S.grid(8, 8, { fmt: v => String(Math.round(v)) });
  const cloud = S.clearLayer('cloud');
  for (const P of pts) S.dot(Number(P[0]), Number(P[1]), { r: 2.6 }, cloud);

  const ROLE = { G: 'pt w00G', A: 'pt w00A', B: 'pt w00B', S: 'pt w00S' };
  function drawMarks(marks) {
    const g = S.clearLayer('marks');
    const groups = new Map();                       // 同一點上的標籤合併
    for (const [name, role, P] of marks) {
      const k = key(P);
      if (!groups.has(k)) groups.set(k, { P, names: [], role });
      const gr = groups.get(k); gr.names.push(name); gr.role = role;
    }
    for (const { P, names, role } of groups.values()) {
      const x = Number(P[0]), y = Number(P[1]);
      S.dot(x, y, { cls: ROLE[role], r: 6.5 }, g);
      const right = x < 70;
      S.txt(x, y, names.join(' = '), { cls: 'vlab w00lab', dx: right ? 10 : -10, dy: y > 88 ? 14 : -8, anchor: right ? 'start' : 'end' }, g);
    }
  }

  /* ---------- 逐步 frames ---------- */
  const row = (l, v, hl) => `<div class="ic-row"><span class="ic-label">${l}</span><span class="ic-value${hl ? ' hl' : ''}">${v}</span></div>`;
  const hid = '—';
  let state = null;
  function compute() {
    const G = choices[Number(gsel.value)], av = Number(ain.value), bv = Number(bin.value);
    const A = mul(av, G), B = mul(bv, G), SA = mul(av, B), SB = mul(bv, A);
    const ab = (av * bv) % n, Sab = mul(ab, G);
    // 竊聽者的暴力搜尋：從 G 開始逐一加，直到碰到 A
    let R = G, tries = 1;
    while (key(R) !== key(A)) { R = ECC.add(R, G, ac, p); tries++; }
    state = { G, av, bv, A, B, SA, SB, ab, Sab, tries };
  }
  const frameDefs = [
    { msg: s => `公開參數：曲線 y² = x³ − 3x + 6 over F₉₇，群階 n = ${n}（質數），生成元 G = ${HC.pt(s.G)}。` },
    { msg: s => `Alice 祕密選 a = ${s.av}，算出公鑰 A = aG = ${HC.pt(s.A)}。` },
    { msg: s => `Bob 祕密選 b = ${s.bv}，算出公鑰 B = bG = ${HC.pt(s.B)}。` },
    { msg: s => `交換：Alice 把 A 送給 Bob，Bob 把 B 送給 Alice。通道上只出現 G、A、B。` },
    { msg: s => `Alice 用自己的 a 乘上收到的 B：aB = ${HC.pt(s.SA)}。` },
    { msg: s => {
      const ok = key(s.SA) === key(s.SB) && key(s.SA) === key(s.Sab);
      return `Bob 算 bA = ${HC.pt(s.SB)}。兩邊<b>${ok ? '相同 ✓' : '不同 ✗'}</b>，都等於 (ab mod ${n})G = ${s.ab}G。`
        + (s.SA ? `共享的 x 座標 ${s.SA[0]} 送進 KDF。` : '');
    } },
  ];
  const status = $('w00status');
  function render(i) {
    const s = state;
    const marks = [['G', 'G', s.G]];
    if (i >= 1) marks.push(['A', 'A', s.A]);
    if (i >= 2) marks.push(['B', 'B', s.B]);
    if (i >= 4 && s.SA) marks.push([i >= 5 ? 'S' : 'aB', 'S', s.SA]);
    drawMarks(marks);
    $('w00alice').innerHTML = row('私鑰 a', i >= 1 ? s.av : hid) + row('公鑰 A', i >= 1 ? HC.pt(s.A) : hid)
      + row('收到 B', i >= 3 ? HC.pt(s.B) : hid) + row('aB', i >= 4 ? HC.pt(s.SA) : hid, i >= 4);
    $('w00bob').innerHTML = row('私鑰 b', i >= 2 ? s.bv : hid) + row('公鑰 B', i >= 2 ? HC.pt(s.B) : hid)
      + row('收到 A', i >= 3 ? HC.pt(s.A) : hid) + row('bA', i >= 5 ? HC.pt(s.SB) : hid, i >= 5);
    $('w00eve').innerHTML = row('G', HC.pt(s.G)) + row('A', i >= 3 ? HC.pt(s.A) : hid) + row('B', i >= 3 ? HC.pt(s.B) : hid);
    $('w00evenote').textContent = i >= 3
      ? `暴力搜尋：從 G 起逐一加 G，第 ${s.tries} 次碰到 A，於是知道 a = ${s.tries}。在 107 個元素的群裡這很快；群階約 2^256 時不可行。`
      : '交換之前，通道上只有公開參數。';
    status.innerHTML = i < 0 ? '按「下一步」開始。圖上先標出 G。' : frameDefs[i].msg(s);
  }

  const frames = frameDefs.map((_, i) => ({ i }));
  const player = new HC.Player({ frames, apply: fr => render(fr.i), delay: 1300 });
  HC.bindPlayer(player, { play: $('w00play'), step: $('w00step'), reset: $('w00reset'), onReset: () => render(-1) });

  function update() {
    $('w00av').textContent = ain.value; $('w00bv').textContent = bin.value;
    compute();
    render(player.i);
  }
  for (const el of [ain, bin]) el.addEventListener('input', update);
  gsel.addEventListener('change', update);
  update();
});

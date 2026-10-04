/* 第 4 章：三種座標的成本、Jacobian 的多種寫法 */
HC.ready(() => {
  /* ---------- 成本長條 ---------- */
  const sv = HC.svg('w04bars', { w: 620, h: 260, pad: { l: 150, r: 70, t: 14, b: 26 } });
  const Iin = $('w04I'), Sin = $('w04S'), Lin = $('w04l');
  const ROWS = [
    ['仿射座標', 'bar alt3'],
    ['Jacobian（一般加點）', 'bar'],
    ['Jacobian（混合加點）', 'bar alt'],
  ];
  function costs(l, I, S) {
    const D = l - 1, A = l / 2, conv = I + 3 + S;
    return [
      { dbl: D * (I + 2 + 2 * S), add: A * (I + 2 + S), conv: 0 },
      { dbl: D * (3 + 5 * S), add: A * (11 + 5 * S), conv },
      { dbl: D * (3 + 5 * S), add: A * (7 + 4 * S), conv },
    ];
  }
  function draw() {
    const I = Number(Iin.value), S = Number(Sin.value), l = Number(Lin.value);
    $('w04Iv').textContent = I; $('w04Sv').textContent = S.toFixed(2);
    const c = costs(l, I, S), tot = c.map(x => x.dbl + x.add + x.conv);
    const max = Math.max(...tot) * 1.05;
    sv.xd = [0, max]; sv.yd = [0, 3];
    sv.grid(5, 0, { fmt: v => (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0)) });
    const g = sv.clearLayer('bars');
    const bh = 34;
    c.forEach((x, i) => {
      const y = sv.pad.t + 20 + i * 70;
      let x0 = sv.X(0);
      for (const [part, cls] of [['dbl', ROWS[i][1]], ['add', ROWS[i][1]], ['conv', 'bar alt2']]) {
        const w = sv.X(x[part]) - sv.X(0);
        if (w > 0) { const r = sv.add('rect', { cls, x: x0, y, width: w, height: bh, opacity: part === 'add' ? 0.65 : 1 }, g); r.setAttribute('rx', 3); }
        x0 += w;
      }
      sv.txtPx(sv.pad.l - 8, y + bh / 2 + 4, ROWS[i][0], { anchor: 'end', cls: 'vlab' }, g);
      sv.txtPx(x0 + 6, y + bh / 2 + 4, Math.round(tot[i]).toLocaleString() + ' M', { cls: 'vlab' }, g);
    });
    // 仿射與混合加點相等時的 I/M
    const D = l - 1, A = l / 2;
    const cross = (D * (3 + 5 * S) + A * (7 + 4 * S) + 3 + S - D * (2 + 2 * S) - A * (2 + S)) / (D + A - 1);
    $('w04status').innerHTML = `仿射 ÷ 混合 Jacobian = <b>${(tot[0] / tot[2]).toFixed(1)} 倍</b>。只要 I/M 大於約 ${cross.toFixed(1)}，Jacobian 就比較快。`;
    $('w04break').innerHTML = ROWS.map(([n], i) => `<div class="ic-row"><span class="ic-label">${n}</span><span class="ic-value">${Math.round(tot[i]).toLocaleString()}</span></div>`).join('')
      + `<div class="ic-note" style="margin-top:.4rem">每條長條分三段：深色是 ${l - 1} 次倍點，淺色是 ${l / 2} 次加點，橙色是最後轉回仿射的一次反元素。</div>`;
  }
  [Iin, Sin, Lin].forEach(el => el.addEventListener('input', draw));
  Lin.addEventListener('change', draw);
  draw();

  /* ---------- 多種寫法 ---------- */
  const p = 97n, a = 94n, b = 6n;
  const pts = ECC.points(a, b, p).slice(1);
  let idx = 17;
  const l1 = $('w04l1'), l2 = $('w04l2');
  function jac(P, lam) { return [lam * lam % p * P[0] % p, lam ** 3n % p * P[1] % p, lam]; }
  function repr() {
    const P = pts[idx], L1 = BigInt(l1.value), L2 = BigInt(l2.value);
    $('w04l1v').textContent = l1.value; $('w04l2v').textContent = l2.value;
    const J1 = jac(P, L1), J2 = jac(P, L2);
    const back = J => ECC.fromJacobian(J, p);
    const fmtJ = J => `(${J[0]} : ${J[1]} : ${J[2]})`;
    $('w04repr').innerHTML = [['仿射 P', HC.pt(P)], ['寫法一（θ₁）', fmtJ(J1)], ['寫法二（θ₂）', fmtJ(J2)],
      ['寫法一轉回仿射', HC.pt(back(J1))], ['寫法二轉回仿射', HC.pt(back(J2))]]
      .map(([k, v]) => `<div class="frow"><div class="fl">${k}</div><div class="fv mono">${v}</div></div>`).join('');
    const [X1, Y1, Z1] = J1, [X2, Y2, Z2] = J2;
    const lhsX = X1 * Z2 * Z2 % p, rhsX = X2 * Z1 * Z1 % p, lhsY = Y1 * Z2 ** 3n % p, rhsY = Y2 * Z1 ** 3n % p;
    $('w04eq').innerHTML = `<div class="ic-row"><span class="ic-label">X₁Z₂²</span><span class="ic-value">${lhsX}</span></div>`
      + `<div class="ic-row"><span class="ic-label">X₂Z₁²</span><span class="ic-value">${rhsX}</span></div>`
      + `<div class="ic-row"><span class="ic-label">Y₁Z₂³</span><span class="ic-value">${lhsY}</span></div>`
      + `<div class="ic-row"><span class="ic-label">Y₂Z₁³</span><span class="ic-value">${rhsY}</span></div>`
      + `<div class="ic-note" style="margin-top:.4rem">${lhsX === rhsX && lhsY === rhsY ? '兩組都相等：是同一個點，而且檢查過程沒有用到除法。' : '不相等。'}</div>`;
  }
  l1.addEventListener('input', repr); l2.addEventListener('input', repr);
  $('w04next').addEventListener('click', () => { idx = (idx * 31 + 7) % pts.length; repr(); });
  repr();
});

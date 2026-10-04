/* 第 1 章：F_p 乘法表、延伸歐幾里得與 Fermat */
HC.ready(() => {
  const sel = $('w01p'), host = $('w01table'), status = $('w01status');
  let p = 13, selA = null, selB = null;

  function draw() {
    p = Number(sel.value);
    const prime = p !== 12;
    let h = '<table class="mtable"><tr><th>×</th>';
    for (let b = 1; b < p; b++) h += `<th class="${b === selB ? 'selcol' : ''}">${b}</th>`;
    h += '</tr>';
    for (let a = 1; a < p; a++) {
      h += `<tr class="${a === selA ? 'selrow' : ''}"><th>${a}</th>`;
      for (let b = 1; b < p; b++) {
        const v = (a * b) % p, t = v / (p - 1);
        const bg = `color-mix(in oklch, var(--accent2) ${Math.round(8 + 72 * t)}%, var(--canvas))`;
        const cls = [v === 1 ? 'one' : '', t > 0.55 ? 'dark' : '', a === selA && b === selB ? 'sel' : ''].join(' ');
        h += `<td class="${cls}" style="background:${bg}" data-a="${a}" data-b="${b}">${v}</td>`;
      }
      h += '</tr>';
    }
    host.innerHTML = h + '</table>';
    if (!prime) status.innerHTML = 'p = 12 不是質數：與 12 不互質的列（2, 3, 4, 6, 8, 9, 10）沒有 1，也就是沒有反元素；乘法表也出現 0（零因子）。';
  }

  function explain(a) {
    const P = BigInt(p), A = BigInt(a);
    const t = ECC.egcdTrace(P, A);
    $('w01eTitle').textContent = `延伸歐幾里得：${a}⁻¹ mod ${p}`;
    let rows = '<table class="etable"><tr><th>q</th><th>r</th><th>' + p + ' 的係數</th><th>' + a + ' 的係數</th></tr>';
    for (const r of t.rows) {
      if (r.r === 0n) break;
      rows += `<tr><td>${r.q === null ? '—' : r.q}</td><td>${r.r}</td><td>${r.s}</td><td>${r.t}</td></tr>`;
    }
    rows += '</table>';
    const inv = t.g === 1n ? ECC.mod(t.t, P) : null;
    $('w01euclid').innerHTML = rows + (inv === null
      ? `<div class="ic-note" style="margin-top:.4rem">gcd(${a}, ${p}) = ${t.g} ≠ 1：沒有反元素。</div>`
      : `<div class="ic-note" style="margin-top:.4rem">最後一列的餘數是 1，所以 ${a}⁻¹ ≡ ${t.t} ≡ <b>${inv}</b>（${t.rows.length - 3} 次除法）。</div>`);
    const fm = $('w01fermat');
    $('w01fTitle').textContent = `Fermat：${a}^${p - 2} mod ${p}`;
    if (p === 12) { fm.innerHTML = '<div class="ic-note">Fermat 小定理只對質數 p 成立。</div>'; return; }
    const pt = ECC.powTrace(A, P - 2n, P);
    const bits = (P - 2n).toString(2);
    let s = `<div class="ic-row"><span class="ic-label">p − 2 的二進位</span><span class="ic-value">${bits}</span></div>`;
    s += '<table class="etable"><tr><th>位元</th><th>動作</th><th>值</th></tr>';
    pt.steps.forEach((st, i) => {
      const act = i === 0 ? '從 a 開始' : (st.bit === '1' ? '平方，乘 a' : '平方');
      s += `<tr><td>${st.bit}</td><td style="text-align:left">${act}</td><td>${st.r}</td></tr>`;
    });
    s += '</table>';
    // 第一位只是把 1 換成 a，不算真正的運算
    s += `<div class="ic-note" style="margin-top:.4rem">${bits.length - 1} 次平方、${pt.mul - 1} 次乘法，得到 <b>${pt.r}</b>。</div>`;
    fm.innerHTML = s;
  }

  host.addEventListener('click', e => {
    const td = e.target.closest('td[data-a]');
    if (!td) return;
    selA = Number(td.dataset.a); selB = Number(td.dataset.b);
    draw();
    const v = (selA * selB) % p;
    status.innerHTML = `${selA} × ${selB} = ${selA * selB} ≡ <b>${v}</b> (mod ${p})` + (v === 1 ? `：${selA} 與 ${selB} 互為反元素。` : '');
    explain(selA);
  });
  sel.addEventListener('change', () => { selA = selB = null; draw(); status.innerHTML = p === 12 ? status.innerHTML : '點表格中的任一格。'; explain(3); });
  draw(); explain(3);
});

/* 第 10 章：從 kP 到字組乘法的總帳（粗估） */
HC.ready(() => {
  const mod = $('w10mod'), red = $('w10red'), sm = $('w10sm');
  const fmt = n => Math.round(n).toLocaleString();
  function calc() {
    const [k, l] = mod.value.split('|').map(Number);
    // 純量乘法：倍點、加點次數與每次的 M、S
    let nD = l - 1, nA, addM, addS;
    if (sm.value === 'dbladd') { nA = l / 2; addM = 7; addS = 4; }
    else if (sm.value === 'naf') { nA = l / 3; addM = 7; addS = 4; }
    else { nD = l; nA = l; addM = 11; addS = 5; }
    const M = nD * 3 + nA * addM + 100 + 3;     // 最後轉回仿射：1I（100M）+ 3M + 1S
    const S = nD * 5 + nA * addS + 1;
    const redCost = { fold: 0, barrett: k * k + 4 * k + 1, mont: k * (k + 1) }[red.value];
    const wM = M * (k * k + redCost), wS = S * ((k * k + k) / 2 + redCost);
    const words = wM + wS;
    const tier = (label, val, note, w) => `<div class="frow"><div class="fl">${label}</div><div class="fv"><div class="ledger-bar" style="--w:${w}%"></div><b class="mono">${val}</b> <span class="where">${note}</span></div></div>`;
    $('w10chain').innerHTML =
      tier('純量乘法', '1 次 kP', `純量 k 有 ℓ = ${l} 位元`, 4)
      + tier('點運算', `${fmt(nD)} 倍點 + ${fmt(nA)} 加點`, sm.value === 'ladder' ? '每一位一次倍點、一次一般加點' : '加點用混合座標', 12)
      + tier('體運算', `${fmt(M)} 次乘法 M + ${fmt(S)} 次平方 S`, `含最後一次反元素（以 100 次乘法計）`, 40)
      + tier('字組乘法', fmt(words), `乘積與平方 ${fmt(M * k * k + S * (k * k + k) / 2)}，化簡 ${fmt((M + S) * redCost)}`, 100);
    const share = (M + S) * redCost / words;
    $('w10status').innerHTML = `一次 kP 約 <b>${fmt(words)}</b> 次 64 位元乘法；其中化簡佔 <b>${(share * 100).toFixed(0)}%</b>。`
      + (red.value === 'fold' ? '折疊幾乎不用乘法，所以只剩乘積本身的成本。' : '換成特殊模數折疊，可以省下這一部分。');
  }
  [mod, red, sm].forEach(e => e.addEventListener('change', calc));
  calc();
});

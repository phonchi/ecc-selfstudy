// 比對 assets/ecc-core.js 與 python/ecc_ref.py：node tests/crosscheck.cjs
const ECC = require('../assets/ecc-core.js');
const V = require('./_vectors.json');
const C = require('../data/curves.json');
const h = (c, k) => ECC.fromHex(C[c][k]);
const X = s => BigInt(s);
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; if (fail < 20) console.error('FAIL', msg); } };

const folds = { 'P-521': ECC.foldP521, 'P-256': ECC.foldP256, '2^255-19': ECC.fold25519, '2^448-2^224-1': ECC.fold448 };
for (const [name, A, r] of V.fold) ok(folds[name](X(A)).r === X(r), `fold ${name} ${A}`);

for (const [p, w, x, y, br, bf, rr, mm] of V.red) {
  const T = X(x) * X(y);
  const bs = ECC.barrettSetup(X(p), w), bt = ECC.barrettTrace(T, bs);
  ok(bt.r === X(br) && bt.fixes === bf, `barrett ${p} ${x} ${y}`);
  ok(bt.q3 >= bt.Q - 2n && bt.q3 <= bt.Q, `barrett q3 range ${p}`);
  const ms = ECC.montSetup(X(p), w), rt = ECC.redcTrace(T, ms);
  ok(rt.r === X(rr) && rt.shifted < 2n * ms.m, `redc ${p} ${x} ${y}`);
  ok(rt.rounds.every((rd, i) => ((rd.A >> (BigInt(w) * BigInt(i))) & (ms.b - 1n)) === 0n), `redc word zeroed ${p}`);
  ok(ECC.montMul(X(x), X(y), ms) === X(mm), `montmul ${p}`);
}

for (const v of V.scalar) {
  const name = v[0];
  const p = h(name, 'p'), a = h(name, 'a');
  if (name.startsWith('P-')) {
    const G = [h(name, 'Gx'), h(name, 'Gy')];
    const R = ECC.mulJacobian(X(v[1]), G, a, p);
    ok(R[0] === X(v[2]) && R[1] === X(v[3]), `jacobian ${name}`);
  } else {
    const [[P, Q, k], R, S, naf] = v.slice(1);
    const toPt = q => (q === null ? null : [BigInt(q[0]), BigInt(q[1])]);
    ok(ECC.eq(ECC.add(toPt(P), toPt(Q), a, p), toPt(R)), `add ${name}`);
    for (const m of ['dbladd', 'naf', 'ladder'])
      ok(ECC.eq(ECC.scalarTrace(k, toPt(P), a, p, m).R, toPt(S)), `scalar ${m} ${name} k=${k}`);
    ok(ECC.eq(ECC.mulJacobian(k, toPt(P), a, p), toPt(S)), `jac toy ${name}`);
    ok(JSON.stringify(ECC.naf(k)) === JSON.stringify(naf), `naf ${k}`);
    if (ECC.eq(toPt(P), toPt(Q)) || toPt(P)[0] !== toPt(Q)[0]) {} // 一般情形已涵蓋
  }
}
for (const [w, k, x, y, out] of V.mult) {
  const r = ECC.schoolbookTrace(ECC.toWords(X(x), w, k), ECC.toWords(X(y), w, k), w).out;
  ok(r.length === out.length && r.every((d, i) => d === X(out[i])), `schoolbook w=${w}`);
}
for (const [p, a, r] of V.inv) {
  ok(ECC.invEuclid(X(a), X(p)) === X(r) && ECC.invFermat(X(a), X(p)) === X(r), `inv ${p}`);
}
// 小曲線點數與群階
ok(ECC.points(h('toyA', 'a'), h('toyA', 'b'), h('toyA', 'p')).length === 100, 'toyA count');
ok(ECC.points(h('toyB', 'a'), h('toyB', 'b'), h('toyB', 'p')).length === 107, 'toyB count');
console.log(`crosscheck: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);

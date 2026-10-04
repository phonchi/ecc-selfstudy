/* ============================================================
   ECC 自學站：數學核心（瀏覽器與 Node 共用）
   全部用原生 BigInt。對應 python/ecc_ref.py，由 tests/crosscheck.cjs 比對。
   帶 Trace 的函式回傳逐步資料（frames），供頁面元件播放。
   ============================================================ */
(function (root) {
  'use strict';
  const ECC = {};
  const B = v => (typeof v === 'bigint' ? v : BigInt(v));

  /* ---------- 基本整數運算 ---------- */
  // JS 的 % 對負數會回傳負值，這裡一律回傳 [0, m)
  ECC.mod = (a, m) => { const r = a % m; return r < 0n ? r + m : r; };
  ECC.bitLength = x => (x === 0n ? 0 : x.toString(2).length);
  ECC.hex = x => '0x' + x.toString(16);
  ECC.fromHex = h => BigInt('0x' + h.replace(/^0x/, ''));

  ECC.egcdTrace = (a, b) => {
    a = B(a); b = B(b);
    let [r0, r1, s0, s1, t0, t1] = [a, b, 1n, 0n, 0n, 1n];
    const rows = [{ q: null, r: r0, s: s0, t: t0 }, { q: null, r: r1, s: s1, t: t1 }];
    while (r1 !== 0n) {
      const q = r0 / r1;
      [r0, r1] = [r1, r0 - q * r1];
      [s0, s1] = [s1, s0 - q * s1];
      [t0, t1] = [t1, t0 - q * t1];
      rows.push({ q, r: r1, s: s1, t: t1 });
    }
    return { g: r0, s: s0, t: t0, rows };
  };
  ECC.invEuclid = (a, p) => {
    p = B(p);
    const { g, s } = ECC.egcdTrace(ECC.mod(B(a), p), p);
    if (g !== 1n) throw new RangeError('沒有反元素');
    return ECC.mod(s, p);
  };
  // 由左而右的平方-乘：回傳結果與平方、乘法次數
  ECC.powTrace = (a, e, m) => {
    a = ECC.mod(B(a), B(m)); e = B(e); m = B(m);
    let r = 1n, sq = 0, mul = 0;
    const steps = [];
    for (const bit of e.toString(2)) {
      r = r * r % m; sq++;
      if (bit === '1') { r = r * a % m; mul++; }
      steps.push({ bit, r });
    }
    return { r, sq, mul, steps };
  };
  ECC.pow = (a, e, m) => ECC.powTrace(a, e, m).r;
  ECC.invFermat = (a, p) => ECC.pow(a, B(p) - 2n, p);

  /* ---------- 曲線：仿射座標，O 以 null 表示 ---------- */
  ECC.O = null;
  ECC.onCurve = (P, a, b, p) => P === null ||
    ECC.mod(P[1] * P[1] - (P[0] ** 3n + a * P[0] + b), p) === 0n;
  ECC.neg = (P, p) => (P === null ? null : [P[0], ECC.mod(-P[1], p)]);
  ECC.eq = (P, Q) => (P === null || Q === null ? P === Q : P[0] === Q[0] && P[1] === Q[1]);

  // 回傳 {R, kind, lam}：kind 為 'O-left' | 'O-right' | 'inverse' | 'double' | 'add'
  ECC.addInfo = (P, Q, a, p) => {
    if (P === null) return { R: Q, kind: 'O-left' };
    if (Q === null) return { R: P, kind: 'O-right' };
    const [x1, y1] = P, [x2, y2] = Q;
    if (x1 === x2 && ECC.mod(y1 + y2, p) === 0n) return { R: null, kind: 'inverse' };
    let lam, kind;
    if (x1 === x2 && y1 === y2) {
      lam = ECC.mod((3n * x1 * x1 + a) * ECC.invFermat(2n * y1, p), p); kind = 'double';
    } else {
      lam = ECC.mod((y2 - y1) * ECC.invFermat(ECC.mod(x2 - x1, p), p), p); kind = 'add';
    }
    const x3 = ECC.mod(lam * lam - x1 - x2, p);
    const y3 = ECC.mod(lam * (x1 - x3) - y1, p);
    return { R: [x3, y3], kind, lam };
  };
  ECC.add = (P, Q, a, p) => ECC.addInfo(P, Q, a, p).R;

  ECC.points = (a, b, p) => {
    const pn = Number(p), roots = new Map();
    for (let y = 0; y < pn; y++) {
      const s = (y * y) % pn;
      if (!roots.has(s)) roots.set(s, []);
      roots.get(s).push(y);
    }
    const pts = [null];
    for (let x = 0; x < pn; x++) {
      const rhs = Number(ECC.mod(B(x) ** 3n + a * B(x) + b, p));
      for (const y of roots.get(rhs) || []) pts.push([B(x), B(y)]);
    }
    return pts;
  };
  ECC.order = (P, a, p) => {
    let k = 1, R = P;
    while (R !== null) { R = ECC.add(R, P, a, p); k++; }
    return k;
  };

  /* ---------- 純量乘法：三種方法，回傳逐步 frames ---------- */
  ECC.naf = k => {
    k = B(k);
    const d = [];
    while (k > 0n) {
      let z = 0n;
      if (k & 1n) { z = 2n - (k % 4n); k -= z; }
      d.push(Number(z)); k >>= 1n;
    }
    return d; // 由低到高
  };

  // method: 'dbladd' | 'naf' | 'ladder'
  ECC.scalarTrace = (k, P, a, p, method = 'dbladd') => {
    k = B(k);
    const frames = [];
    let D = 0, A = 0;
    if (method === 'ladder') {
      let R0 = null, R1 = P;
      for (const bit of k.toString(2)) {
        if (bit === '0') { R1 = ECC.add(R0, R1, a, p); R0 = ECC.add(R0, R0, a, p); }
        else { R0 = ECC.add(R0, R1, a, p); R1 = ECC.add(R1, R1, a, p); }
        D++; A++;
        frames.push({ digit: bit, ops: bit === '0' ? ['R1←R0+R1', 'R0←2R0'] : ['R0←R0+R1', 'R1←2R1'], R: R0, R1, D, A });
      }
      return { R: R0, frames, D, A };
    }
    const digits = method === 'naf' ? ECC.naf(k).reverse() : [...k.toString(2)].map(Number);
    const minusP = ECC.neg(P, p);
    let R = null;
    for (const dgt of digits) {
      const ops = [];
      R = ECC.add(R, R, a, p); D++; ops.push('R←2R');
      if (dgt === 1) { R = ECC.add(R, P, a, p); A++; ops.push('R←R+P'); }
      else if (dgt === -1) { R = ECC.add(R, minusP, a, p); A++; ops.push('R←R−P'); }
      frames.push({ digit: dgt === -1 ? '1̄' : String(dgt), ops, R, D, A });
    }
    return { R, frames, D, A };
  };
  ECC.mul = (k, P, a, p) => ECC.scalarTrace(k, P, a, p, 'dbladd').R;

  /* ---------- Jacobian 座標：(X:Y:Z) ↔ (X/Z², Y/Z³) ---------- */
  ECC.jacDouble = ([X, Y, Z], a, p) => {
    if (Z === 0n || Y === 0n) return [1n, 1n, 0n];
    const XX = X * X % p, YY = Y * Y % p, ZZ = Z * Z % p;
    const S = 4n * X * YY % p;
    const M = ECC.mod(3n * XX + a * ZZ * ZZ, p);
    const X3 = ECC.mod(M * M - 2n * S, p);
    const Y3 = ECC.mod(M * (S - X3) - 8n * YY * YY, p);
    return [X3, Y3, 2n * Y * Z % p];
  };
  ECC.jacAddAffine = (J, Q, a, p) => {
    if (Q === null) return J;
    const [X1, Y1, Z1] = J;
    if (Z1 === 0n) return [Q[0], Q[1], 1n];
    const Z1Z1 = Z1 * Z1 % p;
    const H = ECC.mod(Q[0] * Z1Z1 - X1, p);
    const r = ECC.mod(Q[1] * Z1 * Z1Z1 - Y1, p);
    if (H === 0n) return r === 0n ? ECC.jacDouble(J, a, p) : [1n, 1n, 0n];
    const HH = H * H % p, HHH = H * HH % p, V = X1 * HH % p;
    const X3 = ECC.mod(r * r - HHH - 2n * V, p);
    const Y3 = ECC.mod(r * (V - X3) - Y1 * HHH, p);
    return [X3, Y3, Z1 * H % p];
  };
  ECC.fromJacobian = ([X, Y, Z], p) => {
    if (ECC.mod(Z, p) === 0n) return null;
    const zi = ECC.invFermat(Z, p), zi2 = zi * zi % p;
    return [X * zi2 % p, Y * zi2 % p * zi % p];
  };
  ECC.mulJacobian = (k, P, a, p) => {
    let R = [1n, 1n, 0n];
    for (const bit of B(k).toString(2)) {
      R = ECC.jacDouble(R, a, p);
      if (bit === '1') R = ECC.jacAddAffine(R, P, a, p);
    }
    return ECC.fromJacobian(R, p);
  };

  /* ---------- 字組 ---------- */
  ECC.toWords = (x, w, k) => {
    x = B(x); const W = B(w), mask = (1n << W) - 1n, out = [];
    for (let i = 0; i < k; i++) out.push((x >> (W * B(i))) & mask);
    return out;
  };
  ECC.fromWords = (ws, w) => ws.reduce((s, d, i) => s + (d << (B(w) * B(i))), 0n);
  ECC.wordsNeeded = (m, w) => Math.ceil(ECC.bitLength(B(m)) / w);

  // HAC 14.12：每一格 (i, j) 一個 frame
  ECC.schoolbookTrace = (xw, yw, w) => {
    const n = xw.length, t = yw.length, W = B(w), mask = (1n << W) - 1n;
    const out = Array(n + t).fill(0n), frames = [];
    for (let i = 0; i < t; i++) {
      let carry = 0n;
      for (let j = 0; j < n; j++) {
        const uv = out[i + j] + xw[j] * yw[i] + carry;
        out[i + j] = uv & mask; carry = uv >> W;
        frames.push({ i, j, uv, carry, out: out.slice() });
      }
      out[i + n] = carry;
      frames.push({ i, j: n, uv: null, carry, out: out.slice(), rowEnd: true });
    }
    return { out, frames };
  };

  /* ---------- 特殊模數的折疊 ---------- */
  ECC.P = {
    p256: (1n << 256n) - (1n << 224n) + (1n << 192n) + (1n << 96n) - 1n,
    p521: (1n << 521n) - 1n,
    p25519: (1n << 255n) - 19n,
    p448: (1n << 448n) - (1n << 224n) - 1n,
  };
  ECC.foldP521 = A => {
    const p = ECC.P.p521, A0 = A & p, A1 = A >> 521n;
    let Bv = A0 + A1; const fix = Bv >= p ? 1 : 0;
    if (fix) Bv -= p;
    return { r: Bv, A0, A1, sum: A0 + A1, fixes: fix };
  };
  ECC.fold25519 = A => {
    const p = ECC.P.p25519, mask = (1n << 255n) - 1n, rounds = [];
    while (A >> 255n) {
      const lo = A & mask, hi = A >> 255n;
      A = lo + 19n * hi; rounds.push({ lo, hi, after: A });
    }
    const fix = A >= p ? 1 : 0;
    return { r: fix ? A - p : A, rounds, fixes: fix };
  };
  ECC.fold448 = A => {
    const p = ECC.P.p448, [A0, A1, A2, A3] = ECC.toWords(A, 224, 4);
    const cat = (hi, lo) => (hi << 224n) | lo;
    const terms = { S1: cat(A1, A0), S2: cat(A2, A2), S3: cat(A3, A3), S4: cat(A3, 0n) };
    let Bv = terms.S1 + terms.S2 + terms.S3 + terms.S4, fixes = 0;
    const sum = Bv;
    while (Bv >= p) { Bv -= p; fixes++; }
    return { r: Bv, words: [A0, A1, A2, A3], terms, sum, fixes };
  };
  // SP 800-186 G.1.2：每一項由高到低列出 8 個 32 位元字組的索引（-1 代表 0）
  ECC.P256_TERMS = [
    ['T', 1, [7, 6, 5, 4, 3, 2, 1, 0]],
    ['S1', 2, [15, 14, 13, 12, 11, -1, -1, -1]],
    ['S2', 2, [-1, 15, 14, 13, 12, -1, -1, -1]],
    ['S3', 1, [15, 14, -1, -1, -1, 10, 9, 8]],
    ['S4', 1, [8, 13, 15, 14, 13, 11, 10, 9]],
    ['D1', -1, [10, 8, -1, -1, -1, 13, 12, 11]],
    ['D2', -1, [11, 9, -1, -1, 15, 14, 13, 12]],
    ['D3', -1, [12, -1, 10, 9, 8, 15, 14, 13]],
    ['D4', -1, [13, -1, 11, 10, 9, -1, 15, 14]],
  ];
  ECC.foldP256 = A => {
    const p = ECC.P.p256, a = ECC.toWords(A, 32, 16);
    const terms = ECC.P256_TERMS.map(([name, coef, idx]) => {
      const ws = idx.map(i => (i < 0 ? 0n : a[i]));
      return { name, coef, idx, value: ECC.fromWords(ws.slice().reverse(), 32) };
    });
    let Bv = terms.reduce((s, t) => s + B(t.coef) * t.value, 0n);
    const raw = Bv; let fixes = 0;
    while (Bv < 0n) { Bv += p; fixes++; }
    while (Bv >= p) { Bv -= p; fixes++; }
    return { r: Bv, words: a, terms, raw, fixes };
  };

  /* ---------- Barrett（HAC 14.42）：基底 b 可以是 10 或 2^w ---------- */
  ECC.digitsNeeded = (m, b) => { let k = 0; for (let t = m; t > 0n; t /= b) k++; return k; };
  ECC.barrettSetupB = (m, b) => {
    m = B(m); b = B(b);
    const k = ECC.digitsNeeded(m, b);
    return { m, b, k, mu: b ** B(2 * k) / m };
  };
  ECC.barrettSetup = (m, w) => Object.assign(ECC.barrettSetupB(m, 1n << B(w)), { w });
  ECC.barrettTrace = (x, S) => {
    x = B(x);
    const { m, b } = S, K = B(S.k);
    const q1 = x / b ** (K - 1n);
    const q2 = q1 * S.mu;
    const q3 = q2 / b ** (K + 1n);
    const mod = b ** (K + 1n);
    const r1 = x % mod, r2 = (q3 * m) % mod;
    let r = r1 - r2; const wrapped = r < 0n;
    if (wrapped) r += mod;
    const r0 = r, subs = [];
    while (r >= m) { r -= m; subs.push(r); }
    return { x, q1, q2, q3, Q: x / m, r1, r2, r0, wrapped, subs, fixes: subs.length, r };
  };

  /* ---------- Montgomery（HAC 14.32、14.36）：基底 b 與 m 互質 ---------- */
  const gcd = (a, c) => { while (c) [a, c] = [c, a % c]; return a; };
  ECC.montSetupB = (m, b) => {
    m = B(m); b = B(b);
    if (gcd(m, b) !== 1n) throw new RangeError('Montgomery 需要 gcd(m, b) = 1；b 為 2 的冪時就是 m 為奇數');
    const k = ECC.digitsNeeded(m, b);
    const mPrime = ECC.mod(-ECC.invEuclid(m % b, b), b);
    const R = b ** B(k);
    return { m, b, k, R, mPrime, R2: (R * R) % m, Rinv: ECC.invEuclid(R % m, m) };
  };
  ECC.montSetup = (m, w) => Object.assign(ECC.montSetupB(m, 1n << B(w)), { w });
  ECC.redcTrace = (T, S) => {
    T = B(T);
    const { b, m } = S, rounds = [];
    let A = T;
    for (let i = 0; i < S.k; i++) {
      const bi = b ** B(i);
      const ai = (A / bi) % b;
      const ui = ai * S.mPrime % b;
      A += ui * m * bi;
      rounds.push({ i, ai, ui, A });
    }
    const shifted = A / S.R;
    const fix = shifted >= m ? 1 : 0;
    return { T, rounds, shifted, fixes: fix, r: fix ? shifted - m : shifted };
  };
  ECC.redc = (T, S) => ECC.redcTrace(T, S).r;
  ECC.montMul = (x, y, S) => {
    x = B(x); y = B(y);
    const { b, m } = S, y0 = y % b;
    let A = 0n;
    for (let i = 0; i < S.k; i++) {
      const xi = (x / b ** B(i)) % b;
      const ui = ((A % b) + xi * y0) * S.mPrime % b;
      A = (A + xi * y + ui * m) / b;
    }
    return A >= m ? A - m : A;
  };
  ECC.toMont = (x, S) => ECC.mod(B(x) * S.R, S.m);
  ECC.fromMont = (x, S) => ECC.redc(B(x), S);

  if (typeof module !== 'undefined' && module.exports) module.exports = ECC;
  else root.ECC = ECC;
})(typeof self !== 'undefined' ? self : this);

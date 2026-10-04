"""用固定種子產生測試向量，寫到 tests/_vectors.json，供 crosscheck.cjs 比對 JS 核心。"""
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "python"))
import ecc_ref as E  # noqa: E402

C = json.loads((ROOT / "data" / "curves.json").read_text())
h = lambda c, k: int(C[c][k], 16)
rnd = random.Random(20261004)
N = int(sys.argv[1]) if len(sys.argv) > 1 else 10000
V = {"fold": [], "red": [], "scalar": [], "mult": [], "inv": []}

folds = {"P-521": E.fold_p521, "P-256": E.fold_p256,
         "2^255-19": E.fold_25519, "2^448-2^224-1": E.fold_448}
for name, f in folds.items():
    p = h(name, "p")
    for _ in range(N // 4):
        A = rnd.randrange(p * p)
        V["fold"].append([name, hex(A), hex(f(A))])

mods = [("P-256", 64), ("P-521", 64), ("2^255-19", 64), ("2^448-2^224-1", 32), ("toy241", 2), ("toy127", 3)]
for name, w in mods:
    p = 241 if name == "toy241" else 127 if name == "toy127" else h(name, "p")
    k, mu = E.barrett_setup(p, w)
    km, mp = E.mont_setup(p, w)
    for _ in range(N // len(mods)):
        x, y = rnd.randrange(p), rnd.randrange(p)
        V["red"].append([hex(p), w, hex(x), hex(y), hex(E.barrett(x * y, p, w, k, mu)[0]),
                         E.barrett(x * y, p, w, k, mu)[1], hex(E.redc(x * y, p, w, km, mp)),
                         hex(E.mont_mul(x, y, p, w, km, mp))])

for name in ["P-256", "P-521"]:
    p, a, n = h(name, "p"), h(name, "a"), h(name, "n")
    G = (h(name, "Gx"), h(name, "Gy"))
    for _ in range(20):
        k = rnd.randrange(1, n)
        R = E.scalar_mult_jacobian(k, G, a, p)
        V["scalar"].append([name, hex(k), hex(R[0]), hex(R[1])])
for name in ["toyA", "toyB"]:
    p, a = h(name, "p"), h(name, "a")
    pts = E.curve_points(a, h(name, "b"), p)
    for _ in range(300):
        P, Q = rnd.choice(pts[1:]), rnd.choice(pts[1:])
        k = rnd.randrange(1, 300)
        R = E.ec_add(P, Q, a, p)
        S = E.scalar_mult(k, P, a, p)
        V["scalar"].append([name, [P, Q, k], R, S, E.naf(k)])

for w, kk in [(16, 4), (32, 8), (64, 9)]:
    for _ in range(N // 30):
        x, y = rnd.getrandbits(w * kk), rnd.getrandbits(w * kk)
        V["mult"].append([w, kk, hex(x), hex(y), [hex(d) for d in E.schoolbook(E.to_words(x, w, kk), E.to_words(y, w, kk), w)]])

for p in [97, 127, 241, h("P-256", "p")]:
    for _ in range(200):
        a = rnd.randrange(1, p)
        V["inv"].append([hex(p), hex(a), hex(E.inv_euclid(a, p))])

(Path(__file__).parent / "_vectors.json").write_text(json.dumps(V))
print({k: len(v) for k, v in V.items()})

"""python/ecc_ref.py 的正確性檢查。執行：python3 -m pytest tests/"""
import json
import random
import sys
from pathlib import Path

import pytest
from sympy import isprime

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "python"))
import ecc_ref as E  # noqa: E402

CURVES = json.loads((ROOT / "data" / "curves.json").read_text())
H = lambda c, k: int(CURVES[c][k], 16)
SMALL = [97, 127, 241]


def test_inverses():
    for p in SMALL:
        for a in range(1, p):
            assert E.inv_euclid(a, p) == E.inv_fermat(a, p) == pow(a, -1, p)


@pytest.mark.parametrize("name,size", [("toyA", 100), ("toyB", 107)])
def test_toy_group(name, size):
    p, a, b = H(name, "p"), H(name, "a"), H(name, "b")
    pts = E.curve_points(a, b, p)
    assert len(pts) == size
    assert abs(len(pts) - (p + 1)) <= 2 * p ** 0.5          # Hasse
    rnd = random.Random(1)
    for _ in range(300):
        P, Q, R = (rnd.choice(pts) for _ in range(3))
        assert E.on_curve(E.ec_add(P, Q, a, p), a, b, p)
        assert E.ec_add(P, Q, a, p) == E.ec_add(Q, P, a, p)
        assert E.ec_add(E.ec_add(P, Q, a, p), R, a, p) == E.ec_add(P, E.ec_add(Q, R, a, p), a, p)
        assert E.ec_add(P, E.ec_neg(P, p), a, p) is E.O
    for P in pts[1:]:
        assert E.scalar_mult(size, P, a, p) is E.O           # Lagrange
        for k in (1, 2, 3, 37, size - 1, size + 5):
            ref = E.scalar_mult(k, P, a, p)
            assert E.scalar_mult_naf(k, P, a, p) == ref
            assert E.ladder(k, P, a, p) == ref
            assert E.scalar_mult_jacobian(k, P, a, p) == ref


def test_naf_form():
    for k in range(1, 5000):
        d = E.naf(k)
        assert sum(x << i for i, x in enumerate(d)) == k
        assert all(d[i] == 0 or d[i + 1] == 0 for i in range(len(d) - 1))


@pytest.mark.parametrize("name", ["P-256", "P-521"])
def test_nist_params(name):
    p, a, b, n = (H(name, k) for k in "pabn")
    G = (H(name, "Gx"), H(name, "Gy"))
    assert isprime(p) and isprime(n)
    assert a == p - 3
    assert E.on_curve(G, a, b, p)
    assert E.scalar_mult_jacobian(n, G, a, p) is E.O
    k = random.Random(2).randrange(1, n)
    assert E.scalar_mult_jacobian(k, G, a, p) == E.scalar_mult(k, G, a, p)


def test_p256_2G_known_vector():
    # 公開測試向量：P-256 的 2G
    p, a = H("P-256", "p"), H("P-256", "a")
    G = (H("P-256", "Gx"), H("P-256", "Gy"))
    x2, y2 = E.ec_add(G, G, a, p)
    assert x2 == 0x7CF27B188D034F7E8A52380304B51AC3C08969E277F21B35A60B48FC47669978
    assert y2 == 0x07775510DB8ED040293D9AC69F7430DBBA7DADE63CE982299E04B79D227873D1


def test_words_and_mult():
    rnd = random.Random(3)
    for w, k in [(8, 4), (32, 8), (64, 4), (64, 9)]:
        for _ in range(200):
            x, y = rnd.getrandbits(w * k), rnd.getrandbits(w * k)
            xw, yw = E.to_words(x, w, k), E.to_words(y, w, k)
            assert E.from_words(xw, w) == x
            assert E.from_words(E.schoolbook(xw, yw, w), w) == x * y
            assert E.karatsuba(x, y, w * k) == x * y


FOLDS = {
    "P-521": E.fold_p521, "P-256": E.fold_p256,
    "2^255-19": E.fold_25519, "2^448-2^224-1": E.fold_448,
}


@pytest.mark.parametrize("name", list(FOLDS))
def test_folds(name):
    p = H(name, "p")
    rnd = random.Random(4)
    cases = [0, 1, p - 1, p, p + 1, (p - 1) ** 2] + [rnd.randrange(p * p) for _ in range(3000)]
    for A in cases:
        assert FOLDS[name](A) == A % p


def test_small_reductions_exhaustive():
    for p in SMALL:
        for w in (2, 3, 4):
            k, mu = E.barrett_setup(p, w)
            km, mp = E.mont_setup(p, w)
            R = 1 << (w * km)
            Rinv = pow(R, -1, p)
            for x in range(p * p):
                r, fixes = E.barrett(x, p, w, k, mu)
                assert r == x % p and 0 <= fixes <= 2
                assert E.redc(x, p, w, km, mp) == x * Rinv % p
            for x in range(0, p, 7):
                for y in range(p):
                    assert E.mont_mul(x, y, p, w, km, mp) == x * y * Rinv % p


def test_barrett_two_corrections_example():
    # p = 241, b = 4 (w = 2)：x = 57855 時估計的商比真正的商少 2
    k, mu = E.barrett_setup(241, 2)
    r, fixes = E.barrett(57855, 241, 2, k, mu)
    assert r == 57855 % 241 and fixes == 2


@pytest.mark.parametrize("name", ["P-256", "P-521", "2^255-19", "2^448-2^224-1"])
def test_real_barrett_montgomery(name):
    p = H(name, "p")
    rnd = random.Random(5)
    k, mu = E.barrett_setup(p, 64)
    km, mp = E.mont_setup(p, 64)
    Rinv = pow(1 << (64 * km), -1, p)
    for _ in range(1000):
        x, y = rnd.randrange(p), rnd.randrange(p)
        assert E.barrett(x * y, p, 64, k, mu)[0] == x * y % p
        assert E.redc(x * y, p, 64, km, mp) == x * y * Rinv % p
        assert E.mont_mul(x, y, p, 64, km, mp) == x * y * Rinv % p


def test_mprime_is_one_for_minus_one_mod_b():
    # 低 64 位全為 1 的模數（P-521、2^448-2^224-1）有 m' = 1；P-256 也是
    for name in ["P-521", "2^448-2^224-1", "P-256"]:
        assert E.mont_setup(H(name, "p"), 64)[1] == 1

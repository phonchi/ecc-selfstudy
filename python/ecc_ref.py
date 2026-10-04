"""ECC 自學站的 Python 參考實作。

網頁上顯示的程式碼片段取自本檔中 `# >>> 名稱` 與 `# <<<` 之間的區段，
由 tools/build.py 嵌入。tests/test_ref.py 驗證這些函式的正確性，
tests/crosscheck.mjs 確認瀏覽器端的 assets/ecc-core.js 與本檔結果一致。
"""

# >>> egcd
def egcd(a, b):
    """回傳 (g, s, t)，使 s*a + t*b = g = gcd(a, b)。"""
    s0, s1, t0, t1 = 1, 0, 0, 1
    while b != 0:
        q = a // b
        a, b = b, a - q * b
        s0, s1 = s1, s0 - q * s1
        t0, t1 = t1, t0 - q * t1
    return a, s0, t0


def inv_euclid(a, p):
    g, s, _ = egcd(a % p, p)
    if g != 1:
        raise ZeroDivisionError("a 在模 p 下沒有反元素")
    return s % p


def inv_fermat(a, p):
    # p 是質數：a^(p-1) = 1，所以 a^(p-2) 就是 a 的反元素
    return pow(a, p - 2, p)
# <<<


# >>> affine
O = None  # 無窮遠點，群的單位元


def ec_neg(P, p):
    return O if P is O else (P[0], (-P[1]) % p)


def ec_add(P, Q, a, p):
    """y^2 = x^3 + a x + b 上的加法（仿射座標）。b 不出現在公式裡。"""
    if P is O:
        return Q
    if Q is O:
        return P
    x1, y1 = P
    x2, y2 = Q
    if x1 == x2 and (y1 + y2) % p == 0:
        return O                                   # P + (-P) = O
    if P == Q:
        lam = (3 * x1 * x1 + a) * inv_fermat(2 * y1, p) % p    # 切線斜率
    else:
        lam = (y2 - y1) * inv_fermat(x2 - x1, p) % p           # 割線斜率
    x3 = (lam * lam - x1 - x2) % p
    y3 = (lam * (x1 - x3) - y1) % p
    return (x3, y3)
# <<<


def on_curve(P, a, b, p):
    if P is O:
        return True
    x, y = P
    return (y * y - (x ** 3 + a * x + b)) % p == 0


def curve_points(a, b, p):
    """小質數用：列出曲線上所有點（含 O）。"""
    roots = {}
    for y in range(p):
        roots.setdefault(y * y % p, []).append(y)
    pts: list = [O]
    for x in range(p):
        for y in roots.get((x ** 3 + a * x + b) % p, []):
            pts.append((x, y))
    return pts


# >>> scalar
def scalar_mult(k, P, a, p):
    """由左而右的 double-and-add：每讀一位先倍點，位元為 1 再加 P。"""
    R = O
    for bit in bin(k)[2:]:
        R = ec_add(R, R, a, p)          # 倍點
        if bit == "1":
            R = ec_add(R, P, a, p)      # 加點
    return R


def naf(k):
    """非相鄰形式：數字取 -1, 0, 1，且沒有兩個相鄰的非零位。由低位到高位。"""
    digits = []
    while k > 0:
        if k % 2 == 1:
            d = 2 - (k % 4)             # k = 1 (mod 4) 取 1，k = 3 (mod 4) 取 -1
            k -= d
        else:
            d = 0
        digits.append(d)
        k //= 2
    return digits


def scalar_mult_naf(k, P, a, p):
    R = O
    minusP = ec_neg(P, p)
    for d in reversed(naf(k)):
        R = ec_add(R, R, a, p)
        if d == 1:
            R = ec_add(R, P, a, p)
        elif d == -1:
            R = ec_add(R, minusP, a, p)
    return R


def ladder(k, P, a, p):
    """Montgomery ladder：每一位都做一次加點與一次倍點，並保持 R1 - R0 = P。"""
    R0, R1 = O, P
    for bit in bin(k)[2:]:
        if bit == "0":
            R0, R1 = ec_add(R0, R0, a, p), ec_add(R0, R1, a, p)
        else:
            R0, R1 = ec_add(R0, R1, a, p), ec_add(R1, R1, a, p)
    return R0
# <<<


# >>> jacobian
# Jacobian 座標：(X : Y : Z) 代表仿射點 (X/Z^2, Y/Z^3)；Z = 0 代表 O。
def to_jacobian(P):
    return (1, 1, 0) if P is O else (P[0], P[1], 1)


def from_jacobian(J, p):
    X, Y, Z = J
    if Z % p == 0:
        return O
    zi = inv_fermat(Z, p)               # 整個純量乘法最後只求這一次反元素
    return (X * zi * zi % p, Y * zi * zi * zi % p)


def jac_double(J, a, p):
    X, Y, Z = J
    if Z == 0 or Y == 0:
        return (1, 1, 0)
    XX, YY, ZZ = X * X % p, Y * Y % p, Z * Z % p
    S = 4 * X * YY % p
    M = (3 * XX + a * ZZ * ZZ) % p
    X3 = (M * M - 2 * S) % p
    Y3 = (M * (S - X3) - 8 * YY * YY) % p
    Z3 = 2 * Y * Z % p
    return (X3, Y3, Z3)


def jac_add_affine(J, Q, a, p):
    """混合加法：J 是 Jacobian 點，Q 是仿射點（Z = 1）。"""
    if Q is O:
        return J
    X1, Y1, Z1 = J
    if Z1 == 0:
        return to_jacobian(Q)
    x2, y2 = Q
    Z1Z1 = Z1 * Z1 % p
    U2 = x2 * Z1Z1 % p
    S2 = y2 * Z1 * Z1Z1 % p
    H = (U2 - X1) % p
    r = (S2 - Y1) % p
    if H == 0:
        return jac_double(J, a, p) if r == 0 else (1, 1, 0)
    HH = H * H % p
    HHH = H * HH % p
    V = X1 * HH % p
    X3 = (r * r - HHH - 2 * V) % p
    Y3 = (r * (V - X3) - Y1 * HHH) % p
    Z3 = Z1 * H % p
    return (X3, Y3, Z3)


def scalar_mult_jacobian(k, P, a, p):
    R = (1, 1, 0)
    for bit in bin(k)[2:]:
        R = jac_double(R, a, p)
        if bit == "1":
            R = jac_add_affine(R, P, a, p)
    return from_jacobian(R, p)
# <<<


# >>> words
def to_words(x, w, k):
    """把 x 拆成 k 個 w 位元字組，由低到高：x = sum(words[i] * 2^(w*i))。"""
    mask = (1 << w) - 1
    return [(x >> (w * i)) & mask for i in range(k)]


def from_words(words, w):
    return sum(d << (w * i) for i, d in enumerate(words))


def schoolbook(xw, yw, w):
    """HAC Alg. 14.12：逐字組相乘，每次只處理一個 2w 位元的乘積與進位。"""
    n, t = len(xw), len(yw)
    mask = (1 << w) - 1
    out = [0] * (n + t)
    for i in range(t):
        carry = 0
        for j in range(n):
            uv = out[i + j] + xw[j] * yw[i] + carry   # 一定小於 2^(2w)
            out[i + j] = uv & mask
            carry = uv >> w
        out[i + n] = carry
    return out
# <<<


# >>> karatsuba
def karatsuba(x, y, n):
    """x, y 都小於 2^n。三次半長乘法取代四次。"""
    if n <= 32:
        return x * y
    h = n // 2
    x1, x0 = x >> h, x & ((1 << h) - 1)
    y1, y0 = y >> h, y & ((1 << h) - 1)
    z2 = karatsuba(x1, y1, n - h)
    z0 = karatsuba(x0, y0, h)
    z1 = karatsuba(x1 + x0, y1 + y0, n - h + 1) - z2 - z0
    return (z2 << (2 * h)) + (z1 << h) + z0
# <<<


# >>> fold
def fold_p521(A):
    """p = 2^521 - 1，A < p^2。2^521 = 1 (mod p)，所以高半部直接加回低半部。"""
    p = (1 << 521) - 1
    B = (A & p) + (A >> 521)
    return B - p if B >= p else B


def fold_25519(A):
    """p = 2^255 - 19。2^255 = 19 (mod p)，所以高半部乘 19 加回來。"""
    p = (1 << 255) - 19
    while A >> 255:
        A = (A & ((1 << 255) - 1)) + 19 * (A >> 255)
    return A - p if A >= p else A


def fold_448(A):
    """p = 2^448 - 2^224 - 1（Goldilocks）。SP 800-186 G.1.6，224 位元字組。"""
    p = (1 << 448) - (1 << 224) - 1
    A0, A1, A2, A3 = to_words(A, 224, 4)
    cat = lambda hi, lo: (hi << 224) | lo
    B = cat(A1, A0) + cat(A2, A2) + cat(A3, A3) + cat(A3, 0)
    while B >= p:
        B -= p
    return B


def fold_p256(A):
    """p = 2^256 - 2^224 + 2^192 + 2^96 - 1。SP 800-186 G.1.2，32 位元字組。"""
    p = (1 << 256) - (1 << 224) + (1 << 192) + (1 << 96) - 1
    a = to_words(A, 32, 16)
    def cat(*ws):                       # 由高到低列出 8 個字組
        return from_words(list(reversed(ws)), 32)
    T  = cat(a[7], a[6], a[5], a[4], a[3], a[2], a[1], a[0])
    S1 = cat(a[15], a[14], a[13], a[12], a[11], 0, 0, 0)
    S2 = cat(0, a[15], a[14], a[13], a[12], 0, 0, 0)
    S3 = cat(a[15], a[14], 0, 0, 0, a[10], a[9], a[8])
    S4 = cat(a[8], a[13], a[15], a[14], a[13], a[11], a[10], a[9])
    D1 = cat(a[10], a[8], 0, 0, 0, a[13], a[12], a[11])
    D2 = cat(a[11], a[9], 0, 0, a[15], a[14], a[13], a[12])
    D3 = cat(a[12], 0, a[10], a[9], a[8], a[15], a[14], a[13])
    D4 = cat(a[13], 0, a[11], a[10], a[9], 0, a[15], a[14])
    B = T + 2 * S1 + 2 * S2 + S3 + S4 - D1 - D2 - D3 - D4
    while B < 0:                        # 結果落在 (-4p, 5p)，加減幾次 p 即可
        B += p
    while B >= p:
        B -= p
    return B
# <<<


# >>> barrett
def barrett_setup(m, w):
    """b = 2^w，k = m 的字組數，預先算 mu = floor(b^(2k) / m)。"""
    k = (m.bit_length() + w - 1) // w
    mu = (1 << (2 * k * w)) // m
    return k, mu


def barrett(x, m, w, k, mu):
    """HAC Alg. 14.42：0 <= x < b^(2k)。回傳 (x mod m, 修正次數)。"""
    q1 = x >> (w * (k - 1))
    q2 = q1 * mu
    q3 = q2 >> (w * (k + 1))            # 商的估計值，比真正的商最多少 2
    mod = 1 << (w * (k + 1))
    r = (x % mod) - (q3 * m % mod)
    if r < 0:
        r += mod
    fixes = 0
    while r >= m:                       # 最多兩次
        r -= m
        fixes += 1
    return r, fixes
# <<<


# >>> montgomery
def mont_setup(m, w):
    """m 必須是奇數；R = b^k > m，m' = -m^(-1) mod b。"""
    k = (m.bit_length() + w - 1) // w
    b = 1 << w
    m_prime = (-inv_euclid(m % b, b)) % b
    return k, m_prime


def redc(T, m, w, k, m_prime):
    """HAC Alg. 14.32：輸入 0 <= T < mR，輸出 T * R^(-1) mod m。
    每一輪把目前最低的字組變成 0，k 輪後整個數右移 k 個字組。"""
    b = 1 << w
    A = T
    for i in range(k):
        a_i = (A >> (w * i)) & (b - 1)
        u_i = a_i * m_prime % b          # 只需要模 b 的乘法
        A += u_i * m << (w * i)          # 這一步讓第 i 個字組歸零
    A >>= w * k                          # 除以 R：只是丟掉低位字組
    return A - m if A >= m else A


def mont_mul(x, y, m, w, k, m_prime):
    """HAC Alg. 14.36：乘法與化簡交錯，x, y < m，回傳 x * y * R^(-1) mod m。"""
    b = 1 << w
    A = 0
    y0 = y & (b - 1)
    for i in range(k):
        x_i = (x >> (w * i)) & (b - 1)
        a0 = A & (b - 1)
        u_i = (a0 + x_i * y0) * m_prime % b
        A = (A + x_i * y + u_i * m) >> w
    return A - m if A >= m else A
# <<<

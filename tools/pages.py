"""章節的單一來源：標題、成本鏈位置、本章文獻。內容在 content/<slug>.html。"""
from dataclasses import dataclass, field

# 左欄的分部
PARTS = [
    ("序章", [0]),
    ("第一部　數學基礎", [1, 2, 3]),
    ("第二部　從曲線到運算成本", [4, 5]),
    ("第三部　模乘法", [6, 7, 8, 9]),
    ("總整", [10]),
]
APPENDIX = [("notation.html", "記號與術語"), ("references.html", "參考文獻")]

# 成本鏈：由上而下，每一層都由下一層的運算組成
CHAIN = [
    ("協定 ECDH", "00_why_ecc.html"),
    ("純量乘法 kP", "05_scalar.html"),
    ("加點／倍點", "04_coordinates.html"),
    ("模乘 mod p", "07_special.html"),
    ("字組乘法", "06_multiprecision.html"),
]


@dataclass
class Page:
    num: int
    slug: str
    title: str          # 中文標題（純文字）
    en: str
    subtitle: str
    formula: str        # hero 的公式（MathJax）
    layer: int          # 對應 CHAIN 的索引
    blurb: str          # 首頁卡片說明
    refs: list = field(default_factory=list)   # (sources key, 章節位置)

    @property
    def file(self):
        return f"{self.slug}.html"


PAGES = [
    Page(0, "00_why_ecc", "為什麼是橢圓曲線", "Why Elliptic Curves",
         "同樣的安全強度，金鑰短很多；而一切成本最後都落在 mod p 的乘法",
         r"$Q = kG \quad\text{已知 } G, Q,\ \text{求 } k\ \text{很難}$", 0,
         "公開金鑰的需求、RSA 與 ECC 的金鑰長度、ECDH 交換，以及整個網站的成本鏈。",
         [("SP800-57", "Part 1 Rev. 5, §5.6.1.1 Table 2"), ("HMV", "§1.3, Table 1.1"), ("PP", "§6.2.4 Table 6.1, §9.3"), ("RFC7748", "§6")]),
    Page(1, "01_finite_field", "群、體與 𝔽ₚ", "Groups, Fields and the Prime Field",
         "曲線上的座標住在這裡：加減乘除都取模 p",
         r"$a\cdot a^{-1}\equiv 1 \pmod p,\qquad a^{-1}=a^{p-2}\bmod p$", 3,
         "模運算、反元素的兩種算法（延伸歐幾里得、Fermat），以及為什麼求反元素比乘法貴。",
         [("HAC", "§2.4：Alg. 2.107, Fact 2.127, Alg. 2.142–2.143"), ("HMV", "§2.2：Alg. 2.19–2.20"), ("HPS", "§1.3"), ("PP", "§6.3")]),
    Page(2, "02_group_law", "曲線與群律", "Curves and the Group Law",
         "一條三次曲線，加上「割線的第三個交點」，就得到一個交換群",
         r"$E:\ y^2 = x^3 + ax + b,\qquad P+Q+R = \mathcal O$", 2,
         "實數圖像上的割線與切線、無窮遠點、加法公式，再搬到 F_p 上變成一片點雲。",
         [("Washington", "§2.1–2.4"), ("HMV", "§3.1.2"), ("HPS", "§6.1–6.2"), ("SP800-186", "App. A.1.1")]),
    Page(3, "03_ecdlp", "群結構與 ECDLP", "Group Structure and the ECDLP",
         "點的個數、子群，以及為什麼「從 kP 找回 k」很難",
         r"$|\#E(\mathbb F_p)-(p+1)|\le 2\sqrt p$", 1,
         "Hasse 定理、循環子群與餘因子、Pollard rho 的平方根界，以及要避開的弱曲線。",
         [("Washington", "Thm. 4.2, §5.1–5.2"), ("HMV", "§3.1.3–3.1.4, §4.1（Alg. 4.3）"), ("HPS", "§6.3"), ("SP800-186", "§3.1.1")]),
    Page(4, "04_coordinates", "座標與運算成本", "Coordinates and Cost",
         "把除法延到最後：多一個座標，換掉每一步的求反元素",
         r"$(X:Y:Z)\ \mapsto\ (X/Z^2,\ Y/Z^3)$", 2,
         "仿射座標每步都要反元素；Jacobian 座標只用乘法。用 I/M 比例比較總成本。",
         [("HMV", "§3.2.2：Alg. 3.21–3.22, Table 3.3"), ("EFD", "short Weierstrass, Jacobian"), ("Washington", "§2.6")]),
    Page(5, "05_scalar", "純量乘法", "Scalar Multiplication",
         "kP 是 ECC 的核心運算；它把幾百位元的 k 變成幾千次模乘",
         r"$kP = \underbrace{P+P+\cdots+P}_{k}$", 1,
         "double-and-add、NAF、Montgomery ladder，旁通道與常數時間，以及一次 kP 的成本帳。",
         [("HMV", "§3.3（Alg. 3.26–3.31, 3.35–3.36）, §5.3"), ("HECC", "§13.2.3"), ("HAC", "§14.6, §14.7.1"), ("RFC7748", "§5")]),
    Page(6, "06_multiprecision", "大整數乘法", "Multiprecision Multiplication",
         "256 位元的數放不進一個暫存器：先切成字組，再逐格相乘",
         r"$x\cdot y=\sum_{i,j} x_j y_i\, b^{\,i+j},\quad b=2^{w}$", 4,
         "字組表示、schoolbook 乘法與進位、平方的對稱性，以及 Karatsuba 的想法。",
         [("HAC", "§14.2：Alg. 14.12, 14.16；Karatsuba 見 §14.8"), ("HMV", "§2.2.2–2.2.3：Alg. 2.9, 2.10, 2.13；S ≈ 0.8M 的假設見 §3.3")]),
    Page(7, "07_special", "特殊形式的模數", "Special Moduli",
         "選一個「長得好看」的 p，讓 mod p 只剩加減與移位",
         r"$2^{521}\equiv 1,\qquad 2^{255}\equiv 19 \pmod p$", 3,
         "Mersenne、偽 Mersenne 與 Solinas 質數：P-521、2^255−19、Goldilocks、P-256 的折疊。",
         [("SP800-186", "App. G.1"), ("HMV", "§2.2.6：Alg. 2.29, 2.31"), ("HAC", "§14.3.4：Alg. 14.47"), ("Solinas99", "")]),
    Page(8, "08_barrett", "Barrett 化簡", "Barrett Reduction",
         "任何模數都適用：預先算好 1/m 的近似，用乘法與移位估出商",
         r"$q \approx \left\lfloor \frac{\lfloor x/b^{k-1}\rfloor\,\mu}{b^{k+1}} \right\rfloor,\quad \mu=\lfloor b^{2k}/m\rfloor$", 3,
         "估商的想法、HAC Alg. 14.42、為什麼最多修正兩次，逐步數線演示。",
         [("HAC", "§14.3.3：Alg. 14.42, Fact 14.43, Notes 14.44–14.45"), ("HMV", "Alg. 2.14"), ("Barrett86", "")]),
    Page(9, "09_montgomery", "Montgomery 乘法", "Montgomery Multiplication",
         "換一個座標系：在「乘上 R」的世界裡，除以 R 只是丟掉低位",
         r"$\mathrm{REDC}(T) = T R^{-1} \bmod m,\qquad R=b^k$", 3,
         "Montgomery 表示、REDC 逐字組歸零、交錯式乘法，與 Barrett 同一組輸入並排比較。",
         [("HAC", "§14.3.2：Fact 14.29, Alg. 14.32, 14.36, Notes 14.33–14.39"), ("HECC", "§10.4.2"), ("Montgomery85", "")]),
    Page(10, "10_synthesis", "總整：何時用哪一種", "Putting It Together",
         "從 ECDH 一路往下到字組乘法，各層的選擇與取捨",
         r"$\text{ECDH}\to kP\to \text{點運算}\to \bmod p\to \text{字組}$", 0,
         "比較表、成本鏈總覽，以及延伸閱讀的順序。",
         [("HMV", "§3.7"), ("HAC", "Ch. 14"), ("SP800-186", "")]),
]

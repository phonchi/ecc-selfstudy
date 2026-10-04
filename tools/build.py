#!/usr/bin/env python3
"""產生全站 HTML。冪等；直接覆寫根目錄的 *.html。

content/<slug>.html 是各章內文，格式約定：
  <section id="..." data-nav="短名"> … </section>   每一節；自動加節號、浮動導覽與目錄
  <!-- code: 名稱 -->                                 換成 python/ecc_ref.py 中 `# >>> 名稱` 區段
assets/js/<slug>.js 若存在就在頁尾載入（本章元件）。

用法：python3 tools/build.py
"""
import html
import re
import sys
from pathlib import Path

from pygments import highlight
from pygments.formatters import HtmlFormatter
from pygments.lexers import PythonLexer

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import pages as P  # noqa: E402
import sources as S  # noqa: E402

SITE = "橢圓曲線密碼：從曲線到模乘法"
REPO = "https://github.com/phonchi/ecc-selfstudy"
VER = "20261004"
INDEX_FORMULA = r"$y^2 = x^3 + ax + b\quad\text{over}\ \mathbb F_p$"

SEC_RE = re.compile(r'<section id="([\w-]+)" data-nav="([^"]+)">')
H2_RE = re.compile(r"<h2>(.*?)</h2>", re.S)
CODE_RE = re.compile(r"<!-- code: ([\w-]+)(?: ([^>]*?))? -->")


def snippets():
    src = (ROOT / "python" / "ecc_ref.py").read_text(encoding="utf-8")
    out = {}
    for m in re.finditer(r"# >>> ([\w-]+)\n(.*?)# <<<", src, re.S):
        out[m.group(1)] = m.group(2).rstrip() + "\n"
    return out


def plain(t):
    """目錄用的純文字標題：去掉 HTML 與 TeX 記號。"""
    t = re.sub(r"<[^>]+>", "", t)
    def tex(m):
        x = m.group(1)
        x = re.sub(r"\\mathbb\s*\{?F\}?", "F", x)
        x = re.sub(r"\\[a-zA-Z]+", "", x)
        x = x.replace("{", "").replace("}", "").replace("-", "−").replace(" ", "")
        return x
    return re.sub(r"\$([^$]*)\$", tex, t).strip()


def code_block(code, caption):
    body = highlight(code, PythonLexer(), HtmlFormatter(nowrap=True))
    return (f'<div class="code-block"><div class="code-cap">{caption}</div>'
            f'<button class="copy" type="button">複製</button>'
            f'<pre class="hl"><code>{body}</code></pre></div>')


def head(title, desc, slug=None):
    css = ROOT / "assets" / "css" / f"{slug}.css"
    extra = f'\n<link rel="stylesheet" href="assets/css/{slug}.css?v={VER}">' if slug and css.exists() else ""
    return f"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="{html.escape(desc)}">
<title>{html.escape(title)}</title>
<script>
  try {{ const t = localStorage.getItem('ecc-theme'); if (t) document.documentElement.setAttribute('data-theme', t); }} catch (_) {{}}
  MathJax = {{ tex: {{ inlineMath: [['$','$'], ['\\\\(','\\\\)']], displayMath: [['$$','$$'], ['\\\\[','\\\\]']] }},
             options: {{ skipHtmlTags: ['script','noscript','style','textarea','pre','code'] }},
             chtml: {{ scale: 0.98 }} }};
</script>
<script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700;900&family=Noto+Sans+TC:wght@300;400;500;700&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/ecc.css?v={VER}">{extra}
</head>"""


CURVE_SVG = """<svg class="hero-curve" width="300" height="300" viewBox="-2.2 -3.2 5 6.4" aria-hidden="true">
  <path d="{d}" fill="none" stroke="#fff" stroke-width="0.05"/>
</svg>"""


def hero_curve():
    # y^2 = x^3 - 2x + 2 的實數圖（只有一個分支），純裝飾
    import math
    up, dn = [], []
    x = -1.769
    while x <= 2.6:
        r = x ** 3 - 2 * x + 2
        if r >= 0:
            up.append((x, -math.sqrt(r)))
            dn.append((x, math.sqrt(r)))
        x += 0.02
    pts = list(reversed(dn)) + up
    d = "M" + " L".join(f"{a:.3f},{b:.3f}" for a, b in pts)
    return CURVE_SVG.format(d=d)


def chain_html(active):
    parts = []
    for i, (name, href) in enumerate(P.CHAIN):
        if i:
            parts.append('<span class="arr">→</span>')
        on = " on" if i == active else ""
        parts.append(f'<a class="layer{on}" href="{href}">{name}</a>')
    return ('<div class="chain" aria-label="成本鏈">' + "".join(parts) + "</div>"
            '<div class="chain-caption">成本鏈：每一層都由下一層的運算組成</div>')


def build_chapter(p, snip):
    raw = (ROOT / "content" / p.file).read_text(encoding="utf-8")
    secs = SEC_RE.findall(raw)
    k = 0

    def number(m):
        nonlocal k
        k += 1
        return m.group(0) + f'\n<div class="section-number">§{p.num}.{k}</div>'
    body = SEC_RE.sub(number, raw)

    def code(m):
        name, cap = m.group(1), m.group(2) or "Python 參考實作"
        if name not in snip:
            raise SystemExit(f"{p.file}: 找不到程式碼片段 {name}")
        return code_block(snip[name], html.escape(cap))
    body = CODE_RE.sub(code, body)

    titles = {}
    for sid, short in secs:
        seg = raw.split(f'<section id="{sid}"', 1)[1]
        m = H2_RE.search(seg)
        titles[sid] = plain(m.group(1)) if m else short

    toc = "".join(f'<a href="#{sid}"><span class="toc-num">{p.num}.{i}</span>{html.escape(titles[sid])}</a>'
                  for i, (sid, _) in enumerate(secs, 1))
    toc += f'<a href="#refs"><span class="toc-num">REF</span>本章文獻</a>'
    nav = "".join(f'<a href="#{sid}" data-target="{sid}"><span class="fn-num">{p.num}.{i}</span>'
                  f'<span class="fn-name">{html.escape(short)}</span></a>'
                  for i, (sid, short) in enumerate(secs, 1))
    nav += '<a href="#refs" data-target="refs"><span class="fn-num">REF</span><span class="fn-name">本章文獻</span></a>'

    refs = "".join(f"<li>{S.cite_html(key, where)}</li>" for key, where in p.refs)
    i = P.PAGES.index(p)
    prev = P.PAGES[i - 1] if i > 0 else None
    nxt = P.PAGES[i + 1] if i + 1 < len(P.PAGES) else None
    pv = (f'<a class="prev" href="{prev.file}"><div class="nav-dir">← 上一章</div>'
          f'<div class="nav-title">{prev.num}. {prev.title}</div></a>') if prev else '<span class="ph"></span>'
    nx = (f'<a class="next" href="{nxt.file}"><div class="nav-dir">下一章 →</div>'
          f'<div class="nav-title">{nxt.num}. {nxt.title}</div></a>') if nxt else '<span class="ph"></span>'
    js = ROOT / "assets" / "js" / f"{p.slug}.js"
    page_js = f'<script src="assets/js/{p.slug}.js?v={VER}"></script>' if js.exists() else ""

    return f"""{head(f"{p.num}. {p.title} — {SITE}", f"{p.title}（{p.en}）：{p.subtitle}", p.slug)}
<body>
<nav class="float-nav" id="floatNav" aria-label="本章導覽">{nav}</nav>
<header class="hero small" id="top">
  <div class="hero-grid"></div>
  {hero_curve()}
  <a class="home-link" href="index.html">← 總覽</a>
  <button class="theme-toggle" id="themeToggle" type="button">☾ 深色</button>
  <div class="hero-content">
    <div class="eyebrow">CHAPTER {p.num:02d} · {html.escape(p.en.upper())}</div>
    <h1>{html.escape(p.title)}</h1>
    <div class="subtitle">{html.escape(p.subtitle)}</div>
    <div class="big-formula">{p.formula}</div>
    {chain_html(p.layer)}
  </div>
</header>
<main class="container">
<div class="toc"><div class="toc-title">本章內容</div><div class="toc-grid">{toc}</div></div>
{body}
<section id="refs" data-nav="本章文獻">
<div class="section-number">REF</div>
<h2>本章文獻</h2>
<ul class="refs">{refs}</ul>
<p class="where">完整書目見 <a href="references.html">參考文獻</a>。</p>
</section>
<nav class="chapter-nav">{pv}<a class="home" href="index.html"><div class="nav-dir">總覽</div><div class="nav-title">全部章節</div></a>{nx}</nav>
</main>
<footer>{SITE}・<a href="{REPO}">原始碼</a>・所有互動元件在瀏覽器以 BigInt 計算，僅供教學，不是常數時間實作</footer>
<script src="assets/ecc-core.js?v={VER}"></script>
<script src="assets/ecc-ui.js?v={VER}"></script>
{page_js}
</body>
</html>
"""


def build_index():
    index_js = (f'<script src="assets/js/index.js?v={VER}"></script>'
                if (ROOT / "assets" / "js" / "index.js").exists() else "")
    raw = (ROOT / "content" / "index.html").read_text(encoding="utf-8")
    cards = {}
    for p in P.PAGES:
        layer = P.CHAIN[p.layer][0]
        cards[p.num] = (f'<a class="ch-card" href="{p.file}"><span class="ch-layer">{layer}</span>'
                        f'<div class="ch-num">CHAPTER {p.num:02d}</div><h3>{p.title}</h3><p>{p.blurb}</p></a>')
    body = re.sub(r"<!-- cards: ([\d,]+) -->",
                  lambda m: '<div class="ch-grid">' + "".join(cards[int(n)] for n in m.group(1).split(",")) + "</div>",
                  raw)
    return f"""{head(SITE, slug="index", desc="以互動元件介紹橢圓曲線密碼的數學基礎與模乘法：有限體、群律、ECDLP、座標、純量乘法、NIST 折疊、Barrett、Montgomery。")}
<body>
<header class="hero" id="top">
  <div class="hero-grid"></div>
  {hero_curve()}
  <button class="theme-toggle" id="themeToggle" type="button">☾ 深色</button>
  <div class="hero-content">
    <div class="eyebrow">ELLIPTIC CURVE CRYPTOGRAPHY · SELF-STUDY</div>
    <h1>橢圓曲線密碼<br><span class="green">從曲線</span>到<span class="orange">模乘法</span></h1>
    <div class="subtitle">給數學背景讀者的互動導覽：先問為什麼，再看數學，最後動手算</div>
    <div class="big-formula">{INDEX_FORMULA}</div>
    {chain_html(-1)}
  </div>
</header>
<main class="container">
{body}
</main>
<footer>{SITE}・<a href="{REPO}">原始碼</a>・互動元件僅供教學，不是常數時間實作</footer>
<script src="assets/ecc-core.js?v={VER}"></script>
<script src="assets/ecc-ui.js?v={VER}"></script>
{index_js}
</body>
</html>
"""


def build_refs():
    used = {}
    for p in P.PAGES:
        for key, where in p.refs:
            used.setdefault(key, []).append((p, where))
    items = []
    for key in S.SOURCES:
        chs = used.get(key, [])
        link = "、".join(f'<a href="{p.file}">第 {p.num} 章</a>' for p, _ in chs)
        items.append(f"<li>{S.cite_html(key)}" + (f' <span class="where">（{link}）</span>' if link else "") + "</li>")
    body = f"""<section id="books" data-nav="書目">
<h2>參考文獻</h2>
<p>各章結尾列出該章對應的章節。下面是全部書目；附連結的是出版者或標準組織的官方頁面。</p>
<ul class="refs">{''.join(items)}</ul>
<h3>建議閱讀順序</h3>
<ol>
<li>想先看全貌：Paar–Pelzl 第 9 章，或 Hoffstein–Pipher–Silverman 第 6 章。</li>
<li>曲線的數學：Washington 第 2、4 章。</li>
<li>實作與演算法：Hankerson–Menezes–Vanstone 第 2、3 章；模乘法另看 HAC 第 14 章（官方網站可免費下載）。</li>
<li>標準參數與快速化簡：NIST SP 800-186（P-256、P-521 參數在 §3.2.1，化簡公式在附錄 G）。</li>
<li>點運算公式的成本：Explicit-Formulas Database。</li>
</ol>
</section>"""
    return f"""{head("參考文獻 — " + SITE, "ECC 自學站的參考書目與閱讀順序")}
<body>
<header class="hero small" id="top">
  <div class="hero-grid"></div>
  <a class="home-link" href="index.html">← 總覽</a>
  <button class="theme-toggle" id="themeToggle" type="button">☾ 深色</button>
  <div class="hero-content"><div class="eyebrow">REFERENCES</div><h1>參考文獻</h1>
  <div class="subtitle">教科書、標準與原始論文</div></div>
</header>
<main class="container">{body}</main>
<footer>{SITE}・<a href="{REPO}">原始碼</a></footer>
<script src="assets/ecc-ui.js?v={VER}"></script>
</body>
</html>
"""


def main():
    snip = snippets()
    built = []
    for p in P.PAGES:
        if not (ROOT / "content" / p.file).exists():
            print("略過（尚無內容）：", p.file)
            continue
        (ROOT / p.file).write_text(build_chapter(p, snip), encoding="utf-8")
        built.append(p.file)
    if (ROOT / "content" / "index.html").exists():
        (ROOT / "index.html").write_text(build_index(), encoding="utf-8")
        built.append("index.html")
    (ROOT / "references.html").write_text(build_refs(), encoding="utf-8")
    built.append("references.html")
    print("built:", ", ".join(built))


if __name__ == "__main__":
    main()

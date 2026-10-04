#!/usr/bin/env python3
"""產生全站 HTML（書本式三欄版型）。冪等；直接覆寫根目錄的 *.html。

content/<slug>.html 是各章內文，格式約定：
  <section id="..." data-nav="短名"> <h2>標題</h2> … </section>
      每一節；標題自動加節號，並進入左欄與右欄目錄。
  <div class="box defn|thm|algo|rem" id="..." data-title="名稱" data-ref="HAC 14.32"
       data-terms="術語一|術語二" data-sym="$\\mathbb F_p$" data-gloss="一句話意義"> … </div>
      定義／定理／演算法／注意框；章內依序編號（定義 1.3、演算法 1.4…）。
      defn 的 data-terms、data-sym、data-gloss 會彙整到「記號與術語」附錄。
  [[ref:ID]]           換成指向該框的連結，文字是「定義 1.3」這類編號（可跨章）。
  <!-- code: 名稱 說明 -->   換成 python/ecc_ref.py 中 `# >>> 名稱` 區段，預設收合。
  <!-- notation: 記號 || 意義 -->   不在定義框裡的記號，也收進記號表（位置記為所在的節）。
assets/js/<slug>.js、assets/css/<slug>.css 若存在就載入。

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
SHORT = "ECC 自學"
REPO = "https://github.com/phonchi/ecc-selfstudy"
VER = "20261005"

SEC_RE = re.compile(r'<section id="([\w-]+)" data-nav="([^"]+)">')
H2_RE = re.compile(r"<h2>(.*?)</h2>", re.S)
CODE_RE = re.compile(r"<!-- code: ([\w-]+)(?: ([^>]*?))? -->")
BOX_RE = re.compile(r'<div class="box (defn|thm|algo|rem)"((?:\s+[\w-]+="[^"]*")*)\s*>')
ATTR_RE = re.compile(r'([\w-]+)="([^"]*)"')
REF_RE = re.compile(r"\[\[ref:([\w-]+)\]\]")
NOTE_RE = re.compile(r"<!-- notation: (.*?) \|\| (.*?) -->")
KIND = {"defn": "定義", "thm": "定理", "algo": "演算法", "rem": "注意"}


def snippets():
    src = (ROOT / "python" / "ecc_ref.py").read_text(encoding="utf-8")
    return {m.group(1): m.group(2).rstrip() + "\n"
            for m in re.finditer(r"# >>> ([\w-]+)\n(.*?)# <<<", src, re.S)}


def plain(t):
    """目錄用的純文字標題：去掉 HTML 與 TeX 記號。"""
    t = re.sub(r"<[^>]+>", "", t)

    def tex(m):
        x = m.group(1)
        x = re.sub(r"\\mathbb\s*\{?F\}?", "F", x)
        x = re.sub(r"\\[a-zA-Z]+", "", x)
        return x.replace("{", "").replace("}", "").replace("-", "−").replace(" ", "")
    return re.sub(r"\$([^$]*)\$", tex, t).strip()


def code_block(code, caption):
    body = highlight(code, PythonLexer(), HtmlFormatter(nowrap=True))
    return (f'<details class="code-fold"><summary>Python 參考實作（選讀）：{caption}</summary>'
            f'<div class="code-block"><button class="copy" type="button">複製</button>'
            f'<pre class="hl"><code>{body}</code></pre></div></details>')


# ── 第一輪：讀所有章節，替框編號，建立引用表與記號表 ─────────────────────────
class Chapter:
    def __init__(self, p, snip):
        self.p = p
        raw = (ROOT / "content" / p.file).read_text(encoding="utf-8")
        self.secs = SEC_RE.findall(raw)
        self.boxes = []          # (id, label, kind, attrs)
        self.notes = []          # (sym, gloss, section id)
        n = 0
        cur_sec = None
        out, pos = [], 0
        for m in re.finditer(BOX_RE.pattern + "|" + SEC_RE.pattern + "|" + NOTE_RE.pattern, raw):
            out.append(raw[pos:m.start()])
            pos = m.end()
            txt = m.group(0)
            if txt.startswith("<section"):
                cur_sec = re.search(r'id="([\w-]+)"', txt).group(1)
                out.append(txt)
            elif txt.startswith("<!-- notation"):
                nm = NOTE_RE.match(txt)
                self.notes.append((nm.group(1), nm.group(2), cur_sec))
            else:
                bm = BOX_RE.match(txt)
                kind, attrs = bm.group(1), dict(ATTR_RE.findall(bm.group(2)))
                n += 1
                label = f"{KIND[kind]} {p.num}.{n}"
                bid = attrs.get("id") or f"box-{p.num}-{n}"
                self.boxes.append((bid, label, kind, attrs, cur_sec))
                title = attrs.get("data-title") or (attrs.get("data-terms", "").replace("|", "、") if kind == "defn" else "")
                ref = attrs.get("data-ref", "")
                head = (f'<div class="box-head"><span class="box-label">{label}</span>'
                        + (f'<span class="box-title">{title}</span>' if title else "")
                        + (f'<span class="box-ref">{ref}</span>' if ref else "") + "</div>")
                out.append(f'<div class="box {kind}" id="{bid}">{head}')
        out.append(raw[pos:])
        body = "".join(out)

        k = 0

        def number(mm):
            nonlocal k
            k += 1
            return f'<h2><span class="secno">{p.num}.{k}</span>{mm.group(1)}</h2>'
        parts = re.split(r'(<section id="[\w-]+" data-nav="[^"]+">)', body)
        for i in range(2, len(parts), 2):
            parts[i] = H2_RE.sub(number, parts[i], count=1)
        body = "".join(parts)

        def code(mm):
            name, cap = mm.group(1), mm.group(2) or "參考實作"
            if name not in snip:
                raise SystemExit(f"{p.file}: 找不到程式碼片段 {name}")
            return code_block(snip[name], html.escape(cap))
        self.body = CODE_RE.sub(code, body)

        self.titles = {}
        for sid, short in self.secs:
            seg = raw.split(f'<section id="{sid}"', 1)[1]
            mm = H2_RE.search(seg)
            self.titles[sid] = plain(mm.group(1)) if mm else short


def resolve_refs(text, index):
    def rep(m):
        bid = m.group(1)
        if bid not in index:
            raise SystemExit(f"找不到引用 [[ref:{bid}]]")
        f, label = index[bid]
        return f'<a class="xref" href="{f}#{bid}">{label}</a>'
    return REF_RE.sub(rep, text)


# ── 版型 ─────────────────────────────────────────────────────────────
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


def sidebar(active_file, secs=None):
    """左欄：分部章節清單；目前的章展開各節。"""
    rows = [f'<a class="sb-site" href="index.html"><span class="sb-mark">∞</span>{SITE}</a>',
            f'<a class="sb-home{" on" if active_file == "index.html" else ""}" href="index.html">導讀</a>']
    by_num = {p.num: p for p in P.PAGES}
    for caption, nums in P.PARTS:
        rows.append(f'<div class="sb-part">{caption}</div><ul>')
        for n in nums:
            p = by_num[n]
            on = p.file == active_file
            rows.append(f'<li><a class="sb-ch{" on" if on else ""}" href="{p.file}">'
                        f'<span class="sb-num">{p.num}</span>{p.title}</a>')
            if on and secs:
                rows.append('<ul class="sb-secs">' + "".join(
                    f'<li><a href="#{sid}" data-target="{sid}">{p.num}.{i} {html.escape(short)}</a></li>'
                    for i, (sid, short) in enumerate(secs, 1)) + "</ul>")
            rows.append("</li>")
        rows.append("</ul>")
    rows.append('<div class="sb-part">附錄</div><ul>')
    for f, t in P.APPENDIX:
        rows.append(f'<li><a class="sb-ch{" on" if f == active_file else ""}" href="{f}">{t}</a></li>')
    rows.append("</ul>")
    return '<aside class="sidebar" id="sidebar" aria-label="章節導覽">' + "".join(rows) + "</aside>"


def pagetoc(items):
    if not items:
        return '<nav class="pagetoc" aria-label="本頁目錄"></nav>'
    lis = "".join(f'<li><a href="#{sid}" data-target="{sid}">{html.escape(t)}</a></li>' for sid, t in items)
    return f'<nav class="pagetoc" id="pagetoc" aria-label="本頁目錄"><div class="pt-title">本頁目錄</div><ul>{lis}</ul></nav>'


def chain_html(active):
    parts = []
    for i, (name, href) in enumerate(P.CHAIN):
        if i:
            parts.append('<span class="arr">→</span>')
        parts.append(f'<a class="layer{" on" if i == active else ""}" href="{href}">{name}</a>')
    return '<div class="chain" aria-label="成本鏈"><span class="chain-cap">成本鏈</span>' + "".join(parts) + "</div>"


def shell(title, desc, slug, active_file, secs, toc_items, main_html, scripts):
    return f"""{head(title, desc, slug)}
<body>
<header class="topbar">
  <button class="sb-toggle" id="sbToggle" type="button" aria-label="開關章節導覽" aria-controls="sidebar">☰</button>
  <a class="tb-title" href="index.html">{SHORT}</a>
  <span class="tb-spacer"></span>
  <a class="tb-link" href="{REPO}">原始碼</a>
  <button class="theme-toggle" id="themeToggle" type="button">☾ 深色</button>
</header>
<div class="book">
{sidebar(active_file, secs)}
<main class="content" id="top">
{main_html}
<footer>{SITE}・互動元件以 JavaScript BigInt 計算，僅供教學，不是常數時間實作</footer>
</main>
{pagetoc(toc_items)}
</div>
<div class="sb-backdrop" id="sbBackdrop"></div>
{scripts}
</body>
</html>
"""


def scripts_for(slug, core=True):
    s = []
    if core:
        s.append(f'<script src="assets/ecc-core.js?v={VER}"></script>')
    s.append(f'<script src="assets/ecc-ui.js?v={VER}"></script>')
    if slug and (ROOT / "assets" / "js" / f"{slug}.js").exists():
        s.append(f'<script src="assets/js/{slug}.js?v={VER}"></script>')
    return "\n".join(s)


def build_chapter(ch, index):
    p = ch.p
    refs = "".join(f"<li>{S.cite_html(key, where)}</li>" for key, where in p.refs)
    i = P.PAGES.index(p)
    prev = P.PAGES[i - 1] if i > 0 else None
    nxt = P.PAGES[i + 1] if i + 1 < len(P.PAGES) else None
    pv = (f'<a class="prev" href="{prev.file}"><div class="nav-dir">← 上一章</div>'
          f'<div class="nav-title">{prev.num}. {prev.title}</div></a>') if prev else '<span class="ph"></span>'
    nx = (f'<a class="next" href="{nxt.file}"><div class="nav-dir">下一章 →</div>'
          f'<div class="nav-title">{nxt.num}. {nxt.title}</div></a>') if nxt else '<span class="ph"></span>'
    toc_items = [(sid, f"{p.num}.{k} {ch.titles[sid]}") for k, (sid, _) in enumerate(ch.secs, 1)] + [("refs", "本章文獻")]
    main_html = f"""<div class="ch-head">
  <div class="eyebrow">第 {p.num} 章 · {html.escape(p.en)}</div>
  <h1>{html.escape(p.title)}</h1>
  <p class="ch-sub">{html.escape(p.subtitle)}</p>
  {chain_html(p.layer)}
</div>
{resolve_refs(ch.body, index)}
<section id="refs" data-nav="本章文獻">
<h2>本章文獻</h2>
<ul class="refs">{refs}</ul>
<p class="where">完整書目見 <a href="references.html">參考文獻</a>；全部記號見 <a href="notation.html">記號與術語</a>。</p>
</section>
<nav class="chapter-nav">{pv}<a class="home" href="index.html"><div class="nav-dir">導讀</div><div class="nav-title">全部章節</div></a>{nx}</nav>"""
    return shell(f"{p.num}. {p.title} — {SITE}", f"{p.title}（{p.en}）：{p.subtitle}", p.slug,
                 p.file, ch.secs, toc_items, main_html, scripts_for(p.slug))


def build_index(index):
    raw = (ROOT / "content" / "index.html").read_text(encoding="utf-8")
    cards = {}
    for p in P.PAGES:
        cards[p.num] = (f'<a class="ch-card" href="{p.file}"><span class="ch-layer">{P.CHAIN[p.layer][0]}</span>'
                        f'<div class="ch-num">第 {p.num} 章</div><h3>{p.title}</h3><p>{p.blurb}</p></a>')
    body = re.sub(r"<!-- cards: ([\d,]+) -->",
                  lambda m: '<div class="ch-grid">' + "".join(cards[int(n)] for n in m.group(1).split(",")) + "</div>",
                  raw)
    secs = SEC_RE.findall(raw)
    toc_items = []
    for sid, short in secs:
        toc_items.append((sid, short))
    main_html = f"""<div class="ch-head cover">
  <div class="eyebrow">Elliptic Curve Cryptography · Self-study</div>
  <h1>橢圓曲線密碼：從曲線到模乘法</h1>
  <p class="ch-sub">給數學背景讀者的導讀：每一章先說明為什麼需要，再給定義、定理與演算法，最後用互動元件動手算。</p>
  {chain_html(-1)}
</div>
{resolve_refs(body, index)}"""
    return shell(SITE, "以互動元件介紹橢圓曲線密碼的數學基礎與模乘法。", "index", "index.html",
                 None, toc_items, main_html, scripts_for("index"))


def build_refs():
    used = {}
    for p in P.PAGES:
        for key, where in p.refs:
            used.setdefault(key, []).append(p)
    items = []
    for key in S.SOURCES:
        chs = used.get(key, [])
        link = "、".join(f'<a href="{p.file}">第 {p.num} 章</a>' for p in chs)
        abbr = f'<b class="abbr">{key}</b> ' if key in S.ABBR else ""
        items.append(f"<li>{abbr}{S.cite_html(key)}" + (f' <span class="where">（{link}）</span>' if link else "") + "</li>")
    main_html = f"""<div class="ch-head"><div class="eyebrow">附錄</div><h1>參考文獻</h1>
<p class="ch-sub">教科書、標準與原始論文。正文中的縮寫：HAC、HMV、HECC 見下表粗體。</p></div>
<section id="books" data-nav="書目">
<h2>書目</h2>
<ul class="refs">{''.join(items)}</ul>
</section>
<section id="order" data-nav="閱讀順序">
<h2>建議閱讀順序</h2>
<ol>
<li>想先看全貌：Paar–Pelzl 第 9 章，或 Hoffstein–Pipher–Silverman 第 6 章。</li>
<li>曲線的數學：Washington 第 2、4、5 章。</li>
<li>實作與演算法：HMV 第 2、3 章；模乘法另看 HAC 第 14 章（官方網站可免費下載）。</li>
<li>標準參數與快速化簡：NIST SP 800-186（P-256、P-521 參數在 §3.2.1，化簡公式在附錄 G）。</li>
<li>點運算公式的成本：Explicit-Formulas Database。</li>
</ol>
</section>"""
    return shell("參考文獻 — " + SITE, "ECC 自學站的參考書目與閱讀順序", "references", "references.html",
                 None, [("books", "書目"), ("order", "建議閱讀順序")], main_html, scripts_for(None, core=False))


def build_notation(chapters):
    rows = []
    for ch in chapters:
        p = ch.p
        for bid, label, kind, attrs, sec in ch.boxes:
            if kind != "defn":
                continue
            terms = attrs.get("data-terms", attrs.get("data-title", ""))
            sym = attrs.get("data-sym", "")
            gloss = attrs.get("data-gloss", "")
            rows.append((p.num, f'<tr><td>{sym}</td><td>{terms.replace("|", "、")}</td><td>{gloss}</td>'
                                f'<td class="num"><a href="{p.file}#{bid}">{label}</a></td></tr>'))
        for sym, gloss, sec in ch.notes:
            where = f'{p.num}.{[s for s, _ in ch.secs].index(sec) + 1}' if sec else str(p.num)
            rows.append((p.num, f'<tr><td>{sym}</td><td></td><td>{gloss}</td>'
                                f'<td class="num"><a href="{p.file}#{sec}">§{where}</a></td></tr>'))
    by_part = []
    for caption, nums in P.PARTS:
        body = "".join(r for n, r in rows if n in nums)
        if body:
            by_part.append(f'<h3>{caption}</h3><div class="tbl-wrap"><table class="cmp-table notation">'
                           f'<tr><th>記號</th><th>術語</th><th>意義</th><th>定義位置</th></tr>{body}</table></div>')
    main_html = f"""<div class="ch-head"><div class="eyebrow">附錄</div><h1>記號與術語</h1>
<p class="ch-sub">全站每個記號與術語的意義，以及第一次正式定義的位置。依章節順序排列。</p></div>
<section id="conv" data-nav="記號約定">
<h2>全站記號約定</h2>
<div class="tbl-wrap"><table class="cmp-table">
<tr><th>記號</th><th>固定的意義</th></tr>
<tr><td>$p$</td><td>質數，有限體 $\\mathbb F_p$ 的大小</td></tr>
<tr><td>$a,b$</td><td>曲線 $y^2=x^3+ax+b$ 的係數</td></tr>
<tr><td>$k$</td><td>純量（整數），純量乘法 $kP$ 中的 $k$</td></tr>
<tr><td>$d_A,d_B$；$Q_A,Q_B$</td><td>ECDH 中 Alice、Bob 的私鑰與公鑰</td></tr>
<tr><td>$G,\\ n,\\ h$</td><td>基點、基點的階 $n=\\operatorname{{ord}}(G)$、餘因子 $h=\\#E(\\mathbb F_p)/n$</td></tr>
<tr><td>$\\ell$</td><td>純量 $k$ 的位元數</td></tr>
<tr><td>$w,\\ \\beta=2^w,\\ s$</td><td>字組的位元數、字組基底、一個數佔的字組數</td></tr>
<tr><td>$m$</td><td>第 6–9 章化簡用的一般模數（可以是 $p$，也可以是 $n$）</td></tr>
<tr><td>$\\mathbf M,\\mathbf S,\\mathbf I$</td><td>一次 $\\mathbb F_p$ 乘法、平方、求反元素的成本</td></tr>
</table></div>
</section>
<section id="list" data-nav="依章列表">
<h2>依章列表</h2>
{''.join(by_part)}
</section>"""
    return shell("記號與術語 — " + SITE, "ECC 自學站的記號與術語表", "notation", "notation.html",
                 None, [("conv", "全站記號約定"), ("list", "依章列表")], main_html, scripts_for(None, core=False))


def main():
    snip = snippets()
    chapters = [Chapter(p, snip) for p in P.PAGES if (ROOT / "content" / p.file).exists()]
    index = {}
    for ch in chapters:
        for bid, label, *_ in ch.boxes:
            if bid in index:
                raise SystemExit(f"框的 id 重複：{bid}")
            index[bid] = (ch.p.file, label)
    for ch in chapters:
        (ROOT / ch.p.file).write_text(build_chapter(ch, index), encoding="utf-8")
    (ROOT / "index.html").write_text(build_index(index), encoding="utf-8")
    (ROOT / "references.html").write_text(build_refs(), encoding="utf-8")
    (ROOT / "notation.html").write_text(build_notation(chapters), encoding="utf-8")
    nbox = sum(len(c.boxes) for c in chapters)
    print(f"built {len(chapters)} chapters + index, references, notation; {nbox} boxes")


if __name__ == "__main__":
    main()

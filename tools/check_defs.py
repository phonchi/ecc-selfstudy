#!/usr/bin/env python3
"""檢查「先定義後使用」：依閱讀順序（首頁、第 0–10 章），找出定義框的術語
在它的定義框之前就出現在正文中的地方。

出現在 [[ref:…]] 連結附近、或寫了「（第 N 章定義）」的句子視為已交代，不列出。
單字術語（例如「群」「體」）太容易誤判，略過。只是提示，不讓建置失敗。

用法：python3 tools/check_defs.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import pages as P  # noqa: E402

BOX = re.compile(r'<div class="box defn" id="([\w-]+)"((?:\s+[\w-]+="[^"]*")*)\s*>')
TERMS = re.compile(r'data-terms="([^"]*)"')


def text_of(html):
    html = re.sub(r"<script.*?</script>", " ", html, flags=re.S)
    html = re.sub(r"<!--.*?-->", " ", html, flags=re.S)
    return html


def main():
    files = [p.file for p in P.PAGES]          # 首頁是地圖，只列章名，不檢查
    docs = []
    for f in files:
        src = ROOT / "content" / f
        if src.exists():
            docs.append((f, text_of(src.read_text(encoding="utf-8"))))
    # 每個術語第一次被定義的位置（檔案序號、字元位置）
    defs = {}
    for di, (f, t) in enumerate(docs):
        for m in BOX.finditer(t):
            tm = TERMS.search(m.group(2))
            if not tm:
                continue
            for term in tm.group(1).split("|"):
                term = term.strip()
                if len(term) >= 2 and term not in defs:
                    defs[term] = (di, m.start(), f, m.group(1))
    problems = []
    for term, (ddi, dpos, dfile, bid) in defs.items():
        for di, (f, t) in enumerate(docs):
            if di > ddi:
                break
            limit = dpos if di == ddi else len(t)
            for m in re.finditer(re.escape(term), t[:limit]):
                if term == "單位" and t[m.end():m.end() + 1] == "元":
                    continue
                if term == "橢圓曲線" and t[m.end():m.end() + 2] == "密碼":
                    continue                   # 「橢圓曲線密碼」是主題名稱
                if "本章先" in t[max(0, m.start() - 20):m.start()]:
                    continue                   # 章首的導覽句
                if di == ddi and "<section" not in t[m.start():dpos]:
                    continue                   # 同一節裡先在動機段提到，緊接著定義
                ctx = t[max(0, m.start() - 120): m.end() + 120]
                if "[[ref:" in ctx or re.search(r"(第 ?\d+ ?章|下一節|下一章|§ ?\d+\.\d+ ?節?|\d+\.\d+ 節)(定義|說明|會|再|：)", ctx) or "data-terms" in ctx:
                    continue
                line = t[:m.start()].count("\n") + 1
                problems.append(f"{f}:{line}  「{term}」早於其定義 {dfile}#{bid}")
                break
    print("\n".join(problems) if problems else "check_defs: 沒有發現先用後定義的術語")
    print(f"（共檢查 {len(defs)} 個術語）")


if __name__ == "__main__":
    main()

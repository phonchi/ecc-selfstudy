#!/usr/bin/env python3
"""瀏覽器驗收：每頁 × {1280, 390} × {light, dark}。

檢查：無 console error／page error、無水平捲動、MathJax 無錯誤、
每個互動元件的按鈕、下拉選單、滑桿都能操作且不丟出錯誤。截圖存到 tools/_shots/。

用法：python3 tools/browser_check.py [頁面檔名…]
"""
import http.server
import socketserver
import sys
import threading
from functools import partial
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / "tools" / "_shots"
SHOTS.mkdir(exist_ok=True)

EXERCISE = """
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const panels = [...document.querySelectorAll('.viz-panel')];
  let n = 0;
  for (const p of panels) {
    for (const s of p.querySelectorAll('select')) {
      for (const o of s.options) { s.value = o.value; s.dispatchEvent(new Event('change', {bubbles:true})); n++; await sleep(30); }
      s.selectedIndex = 0; s.dispatchEvent(new Event('change', {bubbles:true}));
    }
    for (const r of p.querySelectorAll('input[type=range]')) {
      for (const v of [r.min, r.max, (Number(r.min) + Number(r.max)) / 2]) { r.value = v; r.dispatchEvent(new Event('input', {bubbles:true})); r.dispatchEvent(new Event('change', {bubbles:true})); n++; }
    }
    const btns = [...p.querySelectorAll('button')].filter(b => !b.classList.contains('btn-play'));
    for (let rep = 0; rep < 4; rep++) for (const b of btns) { if (!b.disabled) { b.click(); n++; await sleep(15); } }
  }
  return n;
}
"""


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass
    handler = partial(Quiet, directory=str(ROOT))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    pages = sys.argv[1:] or sorted(p.name for p in ROOT.glob("*.html"))
    httpd = serve()
    base = f"http://127.0.0.1:{httpd.server_address[1]}/"
    problems = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for theme in ("light", "dark"):
            for width, height in ((1280, 900), (390, 844)):
                ctx = browser.new_context(viewport={"width": width, "height": height}, color_scheme=theme)
                for name in pages:
                    page = ctx.new_page()
                    errs = []
                    page.on("console", lambda m, errs=errs: errs.append(m.text) if m.type == "error" else None)
                    page.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
                    page.goto(base + name, wait_until="networkidle")
                    page.wait_for_function("() => !window.MathJax || (MathJax.startup && MathJax.startup.promise)", timeout=20000)
                    page.evaluate("() => window.MathJax?.startup?.promise")
                    page.wait_for_timeout(400)
                    merr = page.evaluate("() => document.querySelectorAll('mjx-merror').length")
                    overflow = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
                    wide = page.evaluate("""() => [...document.querySelectorAll('main *')].filter(e => {
                        const r = e.getBoundingClientRect(); return r.right > document.documentElement.clientWidth + 1 && getComputedStyle(e).position !== 'fixed';
                      }).slice(0, 3).map(e => e.tagName + '.' + e.className)""")
                    tag = f"{name}@{width}/{theme}"
                    page.screenshot(path=str(SHOTS / f"{name[:-5]}_{width}_{theme}.png"), full_page=True)
                    n = page.evaluate(EXERCISE)
                    page.wait_for_timeout(300)
                    if errs:
                        problems.append(f"{tag}: errors {errs[:3]}")
                    if merr:
                        problems.append(f"{tag}: {merr} MathJax errors")
                    if overflow > 0:
                        problems.append(f"{tag}: horizontal overflow {overflow}px {wide}")
                    print(f"{tag}: {n} interactions, {len(errs)} errors, overflow {overflow}")
                    page.close()
                ctx.close()
        browser.close()
    httpd.shutdown()
    print("\n".join(problems) if problems else "browser_check: all clear")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()

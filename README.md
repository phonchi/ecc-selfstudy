# 橢圓曲線密碼：從曲線到模乘法

互動式的橢圓曲線密碼（ECC）自學網站，給數學背景的讀者。重點是 ECC 的大觀念、底層數學，以及實作中最花時間的部分：$\mathbb F_p$ 上的模乘法（特殊模數折疊、Barrett、Montgomery）。每一章都先說明動機，再講數學，接著是可以操作的互動元件與 Python 參考碼。

網站：<https://phonchi.github.io/ecc-selfstudy/>

## 章節

| 章 | 主題 | 互動元件 |
|---|---|---|
| 0 | 為什麼是橢圓曲線 | 在 107 個點的群上做 ECDH |
| 1 | 有限體 F_p | 乘法表熱圖、延伸歐幾里得與 Fermat 求反元素 |
| 2 | 曲線與群律 | 實數曲線上拖曳 P、Q；F_97 上的加法與「模 p 的直線」 |
| 3 | 群結構與 ECDLP | kP 的軌跡、Hasse 區間的直方圖 |
| 4 | 座標與運算成本 | I/M 比例對總成本的影響、Jacobian 座標的多種寫法 |
| 5 | 純量乘法 | double-and-add、NAF、Montgomery ladder 逐位執行與運算節奏 |
| 6 | 大整數乘法 | schoolbook 字組乘法逐格演示 |
| 7 | 特殊形式的模數 | P-521、2^255−19、Goldilocks、P-256 的折疊 |
| 8 | Barrett 化簡 | 估商與修正的數線演示 |
| 9 | Montgomery 乘法 | REDC 逐輪演示、與 Barrett 的完整流程對照 |
| 10 | 總整 | 從 kP 到字組乘法的成本總帳 |

範圍刻意不含：配對、二元體 GF(2^m)、點數計算演算法、ECDH 以外的協定。

## 結構

```
content/*.html        各章內文（HTML 片段）
assets/ecc-core.js    數學核心（BigInt；瀏覽器與 Node 共用）
assets/ecc-ui.js      頁面工具（逐步播放器、SVG、主題切換）
assets/ecc.css        共用樣式（淺色／深色）
assets/js/*.js        各章互動元件；assets/css/*.css 各章樣式
python/ecc_ref.py     Python 參考實作，網頁上的程式碼片段取自這裡
data/curves.json      曲線參數（NIST SP 800-186、RFC 7748）與教學用小曲線
tools/build.py        產生根目錄的 *.html
tools/pages.py        章節表與各章文獻；tools/sources.py 書目
```

## 建置與檢查

```bash
python3 tools/build.py                 # 產生 *.html
python3 -m pytest -q tests/            # Python 參考實作的正確性
python3 tests/gen_vectors.py           # 產生測試向量
node tests/crosscheck.cjs              # JS 核心與 Python 參考實作逐一比對
python3 tools/browser_check.py         # Playwright：每頁 × 寬 1280/390 × 淺色/深色
```

需要 Python 3（pygments、sympy、pytest、playwright）與 Node.js。網頁本身是靜態檔，只從 CDN 載入 MathJax 與 Google Fonts。

## 說明

互動元件用 JavaScript BigInt 計算，只用來說明演算法，**不是常數時間實作**，不可用於實際的密碼系統。

/* ============================================================
   ECC 自學站：頁面共用工具（改寫自作者其他自學站的 shared.js）
   - HC.retype：寫入含數學的 innerHTML 後重新排版 MathJax
   - HC.Player：逐步播放 frames
   - HC.svg / HC.drag：手寫 SVG 的座標尺度與拖曳
   - 主題切換、浮動導覽 scroll-spy、程式碼複製
   ============================================================ */
const $ = id => document.getElementById(id);
const HC = {};

HC.ready = fn => {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
  else fn();
};

HC._mathQueue = Promise.resolve();
HC.retype = el => {
  if (!window.MathJax?.typesetPromise) return Promise.resolve();
  HC._mathQueue = HC._mathQueue
    .then(() => window.MathJax.startup?.promise)
    .then(() => window.MathJax.typesetPromise(el ? [el] : undefined))
    .catch(e => console.error('MathJax 排版失敗', e));
  return HC._mathQueue;
};

HC.esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/* 大數顯示：太長時折成「前段…後段」 */
HC.short = (x, keep = 14) => {
  const s = x.toString();
  return s.length <= 2 * keep + 3 ? s : s.slice(0, keep) + '…' + s.slice(-keep) + ` (${s.length} 位)`;
};
HC.hexShort = (x, keep = 12) => {
  const s = x.toString(16);
  return '0x' + (s.length <= 2 * keep + 3 ? s : s.slice(0, keep) + '…' + s.slice(-keep));
};
HC.pt = P => (P === null ? 'O' : `(${P[0]}, ${P[1]})`);

/* ---------- 逐步播放器 ---------- */
class Player {
  constructor({ frames, apply, delay = 700, onDone, onIndex }) {
    this.frames = frames; this.apply = apply; this.delay = delay; this.i = -1; this.timer = null;
    this.onDone = onDone || (() => {}); this.onIndex = onIndex || (() => {});
  }
  step() {
    if (this.i + 1 >= this.frames.length) { this.stop(); this.onDone(); return false; }
    this.i += 1; this.apply(this.frames[this.i], this.i); this.onIndex(this.i); return true;
  }
  play() {
    this.stop();
    const tick = () => { if (this.step()) this.timer = setTimeout(tick, this.delay); };
    tick();
  }
  stop() { if (this.timer) clearTimeout(this.timer); this.timer = null; }
  get playing() { return this.timer !== null; }
  reset() { this.stop(); this.i = -1; }
  seek(i) { this.stop(); this.i = i - 1; this.step(); }
  load(frames) { this.reset(); this.frames = frames; }
}
HC.Player = Player;

/* 綁定一組 播放／下一步／重來 按鈕 */
HC.bindPlayer = (player, { play, step, reset, onReset }) => {
  const sync = () => { if (play) play.textContent = player.playing ? '⏸ 暫停' : '▶ 播放'; };
  if (play) play.addEventListener('click', () => {
    if (player.playing) player.stop();
    else { if (player.i + 1 >= player.frames.length) { player.reset(); onReset?.(); } player.play(); }
    sync();
  });
  if (step) step.addEventListener('click', () => { player.stop(); player.step(); sync(); });
  if (reset) reset.addEventListener('click', () => { player.reset(); onReset?.(); sync(); });
  const done = player.onDone;
  player.onDone = () => { done(); sync(); };
  sync();
};

/* ---------- SVG ---------- */
const NS = 'http://www.w3.org/2000/svg';
HC.svg = (id, o = {}) => {
  const host = $(id);
  const W = o.w || 620, H = o.h || 360;
  const pad = Object.assign({ l: 40, r: 14, t: 14, b: 30 }, o.pad || {});
  let el = host.tagName.toLowerCase() === 'svg' ? host : host.querySelector('svg');
  if (!el) { el = document.createElementNS(NS, 'svg'); host.appendChild(el); }
  el.setAttribute('viewBox', `0 0 ${W} ${H}`);
  el.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const s = { el, W, H, pad, xd: (o.xd || [0, 1]).slice(), yd: (o.yd || [0, 1]).slice() };
  Object.defineProperty(s, 'iw', { get: () => W - pad.l - pad.r });
  Object.defineProperty(s, 'ih', { get: () => H - pad.t - pad.b });
  s.X = v => pad.l + (v - s.xd[0]) / (s.xd[1] - s.xd[0]) * s.iw;
  s.Y = v => pad.t + s.ih - (v - s.yd[0]) / (s.yd[1] - s.yd[0]) * s.ih;
  s.ix = px => s.xd[0] + (px - pad.l) / s.iw * (s.xd[1] - s.xd[0]);
  s.iy = py => s.yd[0] + (pad.t + s.ih - py) / s.ih * (s.yd[1] - s.yd[0]);
  s.toData = ev => {
    const r = el.getBoundingClientRect();
    const px = (ev.clientX - r.left) / r.width * W, py = (ev.clientY - r.top) / r.height * H;
    return { x: s.ix(px), y: s.iy(py), px, py };
  };
  s.add = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k of Object.keys(attrs)) {
      if (attrs[k] === null || attrs[k] === undefined) continue;
      n.setAttribute(k === 'cls' ? 'class' : k, String(attrs[k]));
    }
    (parent || el).appendChild(n);
    return n;
  };
  s.layer = name => el.querySelector(`g[data-layer="${name}"]`) || s.add('g', { 'data-layer': name });
  s.clearLayer = name => { const g = s.layer(name); g.replaceChildren(); return g; };
  s.grid = (nx, ny, opt = {}) => {
    const g = s.clearLayer('grid');
    const f = opt.fmt || (v => String(Math.round(v * 100) / 100));
    for (let i = 0; nx > 0 && i <= nx; i++) {
      const v = s.xd[0] + (s.xd[1] - s.xd[0]) * i / nx, x = s.X(v);
      s.add('line', { cls: 'gridl', x1: x, y1: pad.t, x2: x, y2: pad.t + s.ih }, g);
      s.add('text', { cls: 'axlab', x, y: pad.t + s.ih + 14, 'text-anchor': 'middle' }, g).textContent = f(v);
    }
    for (let i = 0; ny > 0 && i <= ny; i++) {
      const v = s.yd[0] + (s.yd[1] - s.yd[0]) * i / ny, y = s.Y(v);
      s.add('line', { cls: 'gridl', x1: pad.l, y1: y, x2: pad.l + s.iw, y2: y }, g);
      s.add('text', { cls: 'axlab', x: pad.l - 5, y: y + 3.5, 'text-anchor': 'end' }, g).textContent = f(v);
    }
    if (opt.axes) {
      if (s.yd[0] < 0 && s.yd[1] > 0) s.add('line', { cls: 'ax', x1: pad.l, y1: s.Y(0), x2: pad.l + s.iw, y2: s.Y(0) }, g);
      if (s.xd[0] < 0 && s.xd[1] > 0) s.add('line', { cls: 'ax', x1: s.X(0), y1: pad.t, x2: s.X(0), y2: pad.t + s.ih }, g);
    }
    return s;
  };
  s.dot = (x, y, a = {}, parent) => s.add('circle', { cls: a.cls || 'pt', cx: s.X(x), cy: s.Y(y), r: a.r ?? 3.5 }, parent);
  s.seg = (x1, y1, x2, y2, a = {}, parent) => s.add('line', { cls: a.cls || 'chord', x1: s.X(x1), y1: s.Y(y1), x2: s.X(x2), y2: s.Y(y2) }, parent);
  s.path = (d, a = {}, parent) => s.add('path', { cls: a.cls || 'curve', d }, parent);
  s.txt = (x, y, str, a = {}, parent) => {
    const n = s.add('text', { cls: a.cls || 'vlab', x: s.X(x) + (a.dx || 0), y: s.Y(y) + (a.dy || 0), 'text-anchor': a.anchor || 'middle' }, parent);
    n.textContent = str; return n;
  };
  s.txtPx = (px, py, str, a = {}, parent) => {
    const n = s.add('text', { cls: a.cls || 'axlab', x: px, y: py, 'text-anchor': a.anchor || 'start' }, parent);
    n.textContent = str; return n;
  };
  return s;
};

HC.drag = (node, svc, onMove) => {
  let active = false;
  node.classList.add('handle');
  node.style.touchAction = 'none';
  node.addEventListener('pointerdown', ev => { active = true; node.setPointerCapture?.(ev.pointerId); ev.preventDefault(); });
  node.addEventListener('pointermove', ev => { if (active) { onMove(svc.toData(ev)); ev.preventDefault(); } });
  const end = () => { active = false; };
  node.addEventListener('pointerup', end);
  node.addEventListener('pointercancel', end);
};

/* 把一串 BigInt 字組畫成格子（由高到低顯示） */
HC.wordsHTML = (ws, w, cls = () => '') => {
  const digits = Math.ceil(w / 4);
  return '<div class="words">' + ws.slice().reverse().map((d, ri) => {
    const i = ws.length - 1 - ri;
    const c = cls(i, d) + (d === 0n ? ' zero' : '');
    return `<span class="word ${c}" title="字組 ${i}">${d.toString(16).padStart(digits, '0')}</span>`;
  }).join('') + '</div>';
};

/* ---------- 主題切換 ---------- */
HC.theme = {
  get() { try { return localStorage.getItem('ecc-theme'); } catch (_) { return null; } },
  set(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('ecc-theme', t); } catch (_) {}
    window.dispatchEvent(new Event('themechange'));
  },
  current() {
    const a = document.documentElement.getAttribute('data-theme');
    if (a) return a;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },
};
(function initTheme() {
  const t = HC.theme.get();
  if (t) document.documentElement.setAttribute('data-theme', t);
})();

HC.ready(() => {
  const btn = $('themeToggle');
  const label = () => { if (btn) btn.textContent = HC.theme.current() === 'dark' ? '☀ 淺色' : '☾ 深色'; };
  if (btn) btn.addEventListener('click', () => { HC.theme.set(HC.theme.current() === 'dark' ? 'light' : 'dark'); label(); });
  label();

  /* 浮動導覽 scroll-spy */
  const nav = $('floatNav');
  if (nav) {
    const links = [...nav.querySelectorAll('a[data-target]')];
    const secs = links.map(a => $(a.dataset.target)).filter(Boolean);
    const update = () => {
      const y = window.scrollY + window.innerHeight * 0.3;
      let act = secs[0]?.id;
      for (const s of secs) if (s.offsetTop <= y) act = s.id;
      links.forEach(a => a.classList.toggle('active', a.dataset.target === act));
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* 程式碼複製 */
  document.querySelectorAll('.code-block').forEach(cb => {
    const b = cb.querySelector('.copy'), pre = cb.querySelector('pre');
    if (!b || !pre) return;
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(pre.innerText); b.textContent = '已複製'; }
      catch (_) { b.textContent = '請手動選取'; }
      setTimeout(() => { b.textContent = '複製'; }, 1500);
    });
  });

  /* 展開 details 時排版其中的數學 */
  document.addEventListener('toggle', e => { if (e.target.tagName === 'DETAILS' && e.target.open) HC.retype(e.target); }, true);
});

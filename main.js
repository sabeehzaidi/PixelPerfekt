(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;

  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------------- text splitting + reveals ---------------- */
  $$('[data-split]').forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = words
      .map((w, i) => `<span class="w" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`)
      .join(' ');
  });
  $$('[data-scrub]').forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = words.map((w) => `<span class="sw" aria-hidden="true">${w}</span>`).join(' ');
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal, [data-split]').forEach((el) => io.observe(el));

  /* ---------------- copy email ---------------- */
  const copyBtn = $('#copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText('hello@pixelperfekt.ca'); copyBtn.textContent = 'Copied'; }
      catch { copyBtn.textContent = 'hello@pixelperfekt.ca'; }
      setTimeout(() => { copyBtn.textContent = 'Copy email'; }, 1800);
    });
  }

  /* ---------------- hero: a pixel field that resolves ---------------- */
  const hero = $('.hero');
  const cv = $('#field');
  const cx = cv.getContext('2d');
  const readout = $('#readout');
  const low = document.createElement('canvas');
  const lowX = low.getContext('2d');
  const lens = document.createElement('canvas');
  const lensX = lens.getContext('2d');

  const PAPER = [243, 240, 232];
  const BLOBS = [
    { c: [47, 91, 255], r: 0.62, ax: 0.30, ay: 0.26, fx: 0.21, fy: 0.17, px: 0.0, py: 1.2, ox: 0.74, oy: 0.50 },
    { c: [255, 90, 60], r: 0.30, ax: 0.22, ay: 0.30, fx: 0.33, fy: 0.27, px: 2.1, py: 0.4, ox: 0.82, oy: 0.34 },
    { c: [28, 48, 176], r: 0.46, ax: 0.26, ay: 0.20, fx: 0.15, fy: 0.24, px: 4.0, py: 2.6, ox: 0.66, oy: 0.72 },
    { c: [150, 188, 255], r: 0.40, ax: 0.30, ay: 0.28, fx: 0.26, fy: 0.19, px: 1.0, py: 3.3, ox: 0.58, oy: 0.30 },
  ];
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  let W = 0, H = 0, dpr = 1;
  let ptr = { x: -999, y: -999, sx: -999, sy: -999, inside: false, k: 0 };
  let visible = true;
  const t0 = performance.now();
  let lastCell = 0, lastLens = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = hero.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    sc = Math.min(dpr, 1.5); scene.width = Math.round(W * sc); scene.height = Math.round(H * sc);
  }

  // Fill an ImageData grid of cols x rows cells, each `ps` css px, starting at world (ox, oy).
  function fillGrid(img, cols, rows, ox, oy, ps, t) {
    const d = img.data;
    const bl = BLOBS.map((b) => ({
      c: b.c, r2: b.r * b.r,
      x: (b.ox + b.ax * Math.sin(t * b.fx + b.px)) * (W / H),
      y: b.oy + b.ay * Math.cos(t * b.fy + b.py),
    }));
    let n = 0;
    for (let j = 0; j < rows; j++) {
      const y = (oy + (j + 0.5) * ps) / H;
      for (let i = 0; i < cols; i++) {
        const x = (ox + (i + 0.5) * ps) / H;
        const th = BAYER[(i & 3) + ((j & 3) << 2)] / 16;
        let r = PAPER[0], g = PAPER[1], b2 = PAPER[2];
        for (let k = 0; k < bl.length; k++) {
          const B = bl[k];
          const dx = x - B.x, dy = y - B.y;
          let a = 1 - (dx * dx + dy * dy) / B.r2;
          if (a <= 0) continue;
          a *= a;
          a = Math.floor(a * 3 + th) / 3;
          if (a <= 0) continue;
          if (a > 1) a = 1;
          r += (B.c[0] - r) * a; g += (B.c[1] - g) * a; b2 += (B.c[2] - b2) * a;
        }
        d[n++] = r; d[n++] = g; d[n++] = b2; d[n++] = 255;
      }
    }
  }

  /* ---- devices: a phone and a tablet running a looping app UI ---- */
  const scene = document.createElement('canvas');
  const sctx = scene.getContext('2d');
  let sc = 1;
  const ease = (x) => x * x * (3 - 2 * x);

  function rr(c, x, y, w, h, r, fill) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
    if (fill) { c.fillStyle = fill; c.fill(); }
  }

  function drawPhone(c, cx0, cy0, w, h, rot, t) {
    c.save();
    c.translate(cx0, cy0); c.rotate(rot);
    rr(c, -w / 2, -h / 2, w, h, w * 0.15, '#0c0d10');
    const b = w * 0.04, sw = w - 2 * b, sh = h - 2 * b, u = sw / 100, L = sh / u;
    c.translate(-sw / 2, -sh / 2);
    rr(c, 0, 0, sw, sh, w * 0.115); c.clip();
    const R = (x, y, ww, hh, r, col) => rr(c, x * u, y * u, ww * u, hh * u, r * u, col);
    c.fillStyle = '#101218'; c.fillRect(0, 0, sw, sh);
    // status bar + notch
    R(8, 4, 12, 2.6, 1.3, '#6b6f7c'); R(76, 4, 3, 2.6, 0.6, '#6b6f7c'); R(81, 4, 3, 2.6, 0.6, '#6b6f7c'); R(86, 4, 6, 2.6, 0.8, '#6b6f7c');
    R(40, 3, 20, 4.2, 2.1, '#000');
    // header
    c.fillStyle = '#2f5bff'; c.beginPath(); c.arc(14 * u, 21 * u, 5.5 * u, 0, 7); c.fill();
    R(24, 16.5, 30, 3, 1.5, '#ece9df'); R(24, 22, 19, 2.4, 1.2, '#5e6270'); R(83, 16, 10, 10, 5, '#1b1e26');
    // feature card with a pulsing bead
    const g = c.createLinearGradient(0, 34 * u, 0, 100 * u);
    g.addColorStop(0, '#3a66ff'); g.addColorStop(1, '#1c2f9a');
    R(6, 34, 88, 64, 7, g);
    const pr = 13 * (1 + 0.05 * Math.sin(t * 2.2));
    const rg = c.createRadialGradient(68 * u, 62 * u, 1 * u, 68 * u, 66 * u, pr * u);
    rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.6, '#cfdcff'); rg.addColorStop(1, '#8fa8ff');
    c.fillStyle = rg; c.beginPath(); c.arc(68 * u, 66 * u, pr * u, 0, 7); c.fill();
    R(12, 42, 34, 3.6, 1.8, 'rgba(255,255,255,.92)'); R(12, 49, 22, 2.6, 1.3, 'rgba(255,255,255,.55)');
    R(12, 86, 44, 2.8, 1.4, 'rgba(255,255,255,.25)'); R(12, 86, 44 * ((t * 0.16) % 1), 2.8, 1.4, '#ffffff');
    // scrolling list
    c.save(); c.beginPath(); c.rect(0, 104 * u, sw, (L - 126) * u); c.clip();
    const rowH = 15, off = t * 9, idx = Math.floor(off / rowH), fr = off % rowH;
    const cols = ['#2f5bff', '#ff5a3c', '#ece9df', '#c9a227', '#7fa3ff'];
    for (let k = 0; k < 8; k++) {
      const y = 104 + k * rowH - fr, n = idx + k, col = cols[n % cols.length];
      R(6, y, 88, 12, 4, '#1a1d25'); R(10, y + 2.5, 7, 7, 2, col);
      R(21, y + 3, 28 + (n * 7) % 14, 2.3, 1.15, '#ece9df'); R(21, y + 7, 18 + (n * 5) % 10, 1.8, 0.9, '#5e6270');
      const on = (n + Math.floor(t / 2)) % 3 === 0;
      R(80, y + 3.5, 10, 5, 2.5, on ? '#2f5bff' : '#2a2e38');
      c.fillStyle = '#fff'; c.beginPath(); c.arc((on ? 87.5 : 82.5) * u, (y + 6) * u, 1.9 * u, 0, 7); c.fill();
    }
    c.restore();
    // bottom nav with a sliding active pill
    R(6, L - 20, 88, 13, 6.5, '#171a21');
    const seg = Math.floor(t / 2.5), f = (t / 2.5) % 1, e = f < 0.22 ? ease(f / 0.22) : 1;
    const px = (i) => 22 + (i % 3) * 28;
    const pxc = lerp(px(seg), px(seg + 1), e);
    R(pxc - 11, L - 18, 22, 9, 4.5, '#2f5bff');
    for (let i = 0; i < 3; i++) R(px(i) - 2.5, L - 15.5, 5, 5, 1.5, 'rgba(255,255,255,.88)');
    // tap ripple
    const rf = (t / 3) % 1, ri = Math.floor(t / 3);
    c.strokeStyle = `rgba(255,255,255,${((1 - rf) * 0.55).toFixed(3)})`; c.lineWidth = 0.9 * u;
    c.beginPath(); c.arc((20 + (ri * 37) % 60) * u, (110 + (ri * 53) % 70) * u, rf * 15 * u, 0, 7); c.stroke();
    c.restore();
  }

  function drawTablet(c, cx0, cy0, w, h, rot, t) {
    c.save();
    c.translate(cx0, cy0); c.rotate(rot);
    rr(c, -w / 2, -h / 2, w, h, w * 0.055, '#0c0d10');
    const b = w * 0.032, sw = w - 2 * b, sh = h - 2 * b, u = sw / 100, L = sh / u;
    c.translate(-sw / 2, -sh / 2);
    rr(c, 0, 0, sw, sh, w * 0.035); c.clip();
    const R = (x, y, ww, hh, r, col) => rr(c, x * u, y * u, ww * u, hh * u, r * u, col);
    c.fillStyle = '#eceae2'; c.fillRect(0, 0, sw, sh);
    // sidebar
    c.fillStyle = '#0c0d10'; c.fillRect(0, 0, 22 * u, sh);
    R(4, 5, 7, 7, 2, '#2f5bff');
    const act = Math.floor(t / 2.2) % 4;
    for (let i = 0; i < 4; i++) {
      if (i === act) R(3, 20 + i * 11 - 1.5, 16, 8, 3, '#2f5bff');
      R(6, 20 + i * 11, 10, 2.4, 1.2, i === act ? '#fff' : '#5e6270');
    }
    // top bar
    R(28, 5, 34, 3.2, 1.6, '#bdb9ab'); R(72, 3.5, 24, 6.5, 3.2, '#fff');
    // stat cards
    const cc = ['#2f5bff', '#ff5a3c', '#0c0d10'];
    for (let i = 0; i < 3; i++) {
      const x = 28 + i * 23.5;
      R(x, 16, 21.5, 19, 4, '#fff'); R(x + 3, 20, 10, 2, 1, '#bdb9ab');
      R(x + 3, 25, 6 + 9 * (0.55 + 0.45 * Math.sin(t * 0.8 + i * 1.7)), 5, 1.5, cc[i]);
    }
    // bar chart
    R(28, 41, 68, L - 47, 4, '#fff');
    const n = 9, cw = 5.4, gap = 2.6, base = L - 12, maxH = L - 62, hi = Math.floor(t * 0.9) % n;
    for (let i = 0; i < n; i++) {
      const hh = maxH * (0.28 + 0.72 * (0.5 + 0.5 * Math.sin(t * 0.9 + i * 0.85)));
      R(33 + i * (cw + gap), base - hh, cw, hh, 1.2, i === hi ? '#ff5a3c' : '#2f5bff');
    }
    c.restore();
  }

  function drawScene(t) {
    sctx.setTransform(sc, 0, 0, sc, 0, 0);
    sctx.clearRect(0, 0, W, H);
    const mobile = W < 860;
    const sy = window.scrollY;
    const bob = reduce ? 0 : Math.sin(t * 0.9) * 6;
    const px = ptr.k > 0.02 ? ((ptr.sx / W) - 0.5) * 22 * ptr.k : 0;
    if (!mobile) {
      const th = H * 0.6, tw = th * 0.76;
      drawTablet(sctx, W * 0.91 - px * 1.6, H * 0.5 + sy * 0.32 - bob * 0.6, tw, th, 0.07 + (reduce ? 0 : Math.sin(t * 0.35) * 0.02), t + 3);
      const ph = Math.min(H * 0.78, W * 0.62), pw = ph * 0.47;
      drawPhone(sctx, W * 0.72 - px, H * 0.55 + sy * 0.16 + bob, pw, ph, -0.03 + (reduce ? 0 : Math.sin(t * 0.3) * 0.015), t);
    } else {
      const ph = Math.min(H * 0.5, W * 1.05), pw = ph * 0.47;
      drawPhone(sctx, W * 0.5, H * 0.9 + sy * 0.1 + bob, pw, ph, -0.03 + (reduce ? 0 : Math.sin(t * 0.3) * 0.015), t);
    }
  }

  function draw(now) {
    const t = reduce ? 6 : Math.max(0, now - t0) / 1000;
    const intro = reduce ? 1 : clamp(Math.max(0, now - t0) / 2400);
    const easeOut = 1 - Math.pow(1 - intro, 3);
    const scrollP = clamp(window.scrollY / Math.max(1, H));
    const endCell = 6;
    // coarse -> fine as the page loads, then dissolving into big pixels as you scroll away
    const ps = Math.max(6, Math.round(lerp(110, endCell, easeOut) + scrollP * 56));

    const cols = Math.ceil(W / ps), rows = Math.ceil(H / ps);
    if (low.width !== cols || low.height !== rows) { low.width = cols; low.height = rows; }
    const img = lowX.createImageData(cols, rows);
    fillGrid(img, cols, rows, 0, 0, ps, t);
    lowX.putImageData(img, 0, 0);

    drawScene(t);
    lowX.imageSmoothingEnabled = true; lowX.imageSmoothingQuality = 'high';
    lowX.drawImage(scene, 0, 0, scene.width, scene.height, 0, 0, W / ps, H / ps);

    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.clearRect(0, 0, cv.width, cv.height);
    cx.imageSmoothingEnabled = false;
    cx.drawImage(low, 0, 0, cols * ps * dpr, rows * ps * dpr);

    // pointer lens: the same scene, resolved to fine detail
    let lensPs = 0;
    if (!reduce && fine) {
      ptr.k = lerp(ptr.k, ptr.inside ? 1 : 0, 0.14);
      ptr.sx = lerp(ptr.sx, ptr.x, 0.2); ptr.sy = lerp(ptr.sy, ptr.y, 0.2);
      if (ptr.k > 0.02) {
        const Rr = 120 * ptr.k;
        lensPs = 4;
        const size = Math.ceil((Rr * 2) / lensPs) + 1;
        const ox = ptr.sx - size * lensPs / 2, oy = ptr.sy - size * lensPs / 2;
        if (lens.width !== size) { lens.width = size; lens.height = size; }
        const li = lensX.createImageData(size, size);
        fillGrid(li, size, size, ox, oy, lensPs, t);
        lensX.putImageData(li, 0, 0);
        cx.save();
        cx.beginPath(); cx.arc(ptr.sx * dpr, ptr.sy * dpr, Rr * dpr, 0, Math.PI * 2); cx.clip();
        cx.drawImage(lens, ox * dpr, oy * dpr, size * lensPs * dpr, size * lensPs * dpr);
        cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
        cx.drawImage(scene, 0, 0, scene.width, scene.height, 0, 0, cv.width, cv.height);
        cx.restore();
        cx.strokeStyle = 'rgba(12,13,16,.85)'; cx.lineWidth = 1.5 * dpr;
        cx.beginPath(); cx.arc(ptr.sx * dpr, ptr.sy * dpr, Rr * dpr, 0, Math.PI * 2); cx.stroke();
      }
    }

    if (readout && (ps !== lastCell || lensPs !== lastLens)) {
      readout.textContent = lensPs ? `CELL ${ps}PX / LENS ${lensPs}PX` : `CELL ${ps}PX`;
      lastCell = ps; lastLens = lensPs;
    }
  }

  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.inside = true;
    if (ptr.sx < -900) { ptr.sx = ptr.x; ptr.sy = ptr.y; }
  });
  hero.addEventListener('pointerleave', () => { ptr.inside = false; });
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(hero);
  addEventListener('resize', () => { resize(); if (reduce) draw(performance.now()); });
  resize();

  /* ---------------- scroll-driven motion ---------------- */
  const parEls = $$('[data-speed]').map((el) => ({
    el, parent: el.parentElement, speed: parseFloat(el.dataset.speed), rot: parseFloat(el.dataset.rot || 0),
  }));
  const scrubs = $$('[data-scrub]').map((el) => ({ el, words: $$('.sw', el) }));
  const header = $('.site-header');
  const bar = $('.progress i');
  const root = document.documentElement;
  const cursor = $('.cursor');

  let sy = window.scrollY;
  function update() {
    const target = window.scrollY;
    sy = reduce ? target : lerp(sy, target, 0.14);
    if (Math.abs(sy - target) < 0.1) sy = target;
    const vh = innerHeight;

    header.classList.toggle('scrolled', target > 24);
    bar.style.transform = `scaleX(${clamp(target / Math.max(1, root.scrollHeight - vh))})`;
    root.style.setProperty('--gy', `${-((sy * 0.18) % 48)}px`);

    if (!reduce) {
      for (const p of parEls) {
        const r = p.parent.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        const off = (r.top + r.height / 2 - vh / 2) * p.speed;
        const rot = p.rot ? ((r.top + r.height / 2 - vh / 2) / vh) * p.rot : 0;
        p.el.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0)${rot ? ` rotate(${rot.toFixed(2)}deg)` : ''}`;
      }
    }

    for (const s of scrubs) {
      const r = s.el.getBoundingClientRect();
      const prog = clamp((vh * 0.85 - r.top) / (vh * 0.55 + r.height * 0.5));
      const lit = Math.round(prog * s.words.length);
      s.words.forEach((w, i) => w.classList.toggle('lit', i < lit));
    }
  }

  /* ---------------- cursor ---------------- */
  let cxp = -100, cyp = -100, cxt = -100, cyt = -100;
  if (fine && !reduce) {
    addEventListener('pointermove', (e) => { cxt = e.clientX; cyt = e.clientY; cursor.classList.add('on'); });
    document.addEventListener('pointerleave', () => cursor.classList.remove('on'));
    $$('a, button').forEach((el) => {
      el.addEventListener('pointerenter', () => cursor.classList.add('big'));
      el.addEventListener('pointerleave', () => cursor.classList.remove('big'));
    });
  }

  function frame(now) {
    update();
    if (visible || reduce) draw(now);
    if (fine && !reduce) {
      cxp = lerp(cxp, cxt, 0.22); cyp = lerp(cyp, cyt, 0.22);
      cursor.style.transform = `translate3d(${cxp.toFixed(1)}px, ${cyp.toFixed(1)}px, 0)`;
    }
    if (!reduce) requestAnimationFrame(frame);
  }

  if (reduce) {
    draw(performance.now()); update();
    addEventListener('scroll', update, { passive: true });
  } else {
    requestAnimationFrame(frame);
  }
})();

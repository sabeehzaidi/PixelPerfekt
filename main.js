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

  function draw(now) {
    const t = reduce ? 6 : (now - t0) / 1000;
    const intro = reduce ? 1 : clamp((now - t0) / 2400);
    const easeOut = 1 - Math.pow(1 - intro, 3);
    const scrollP = clamp(window.scrollY / Math.max(1, H));
    const endCell = W < 700 ? 14 : 18;
    // coarse -> fine as the page loads, then dissolving into big pixels as you scroll away
    const ps = Math.max(8, Math.round(lerp(110, endCell, easeOut) + scrollP * 56));

    const cols = Math.ceil(W / ps), rows = Math.ceil(H / ps);
    if (low.width !== cols || low.height !== rows) { low.width = cols; low.height = rows; }
    const img = lowX.createImageData(cols, rows);
    fillGrid(img, cols, rows, 0, 0, ps, t);
    lowX.putImageData(img, 0, 0);

    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.clearRect(0, 0, cv.width, cv.height);
    cx.imageSmoothingEnabled = false;
    cx.drawImage(low, 0, 0, cols * ps * dpr, rows * ps * dpr);

    // pointer lens: the same field, at a much finer resolution
    let lensPs = 0;
    if (!reduce && fine) {
      ptr.k = lerp(ptr.k, ptr.inside ? 1 : 0, 0.14);
      ptr.sx = lerp(ptr.sx, ptr.x, 0.2); ptr.sy = lerp(ptr.sy, ptr.y, 0.2);
      if (ptr.k > 0.02) {
        const R = 120 * ptr.k;
        lensPs = 4;
        const size = Math.ceil((R * 2) / lensPs) + 1;
        const ox = ptr.sx - size * lensPs / 2, oy = ptr.sy - size * lensPs / 2;
        if (lens.width !== size) { lens.width = size; lens.height = size; }
        const li = lensX.createImageData(size, size);
        fillGrid(li, size, size, ox, oy, lensPs, t);
        lensX.putImageData(li, 0, 0);
        cx.save();
        cx.beginPath(); cx.arc(ptr.sx * dpr, ptr.sy * dpr, R * dpr, 0, Math.PI * 2); cx.clip();
        cx.drawImage(lens, ox * dpr, oy * dpr, size * lensPs * dpr, size * lensPs * dpr);
        cx.restore();
        cx.strokeStyle = 'rgba(12,13,16,.85)'; cx.lineWidth = 1.5 * dpr;
        cx.beginPath(); cx.arc(ptr.sx * dpr, ptr.sy * dpr, R * dpr, 0, Math.PI * 2); cx.stroke();
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

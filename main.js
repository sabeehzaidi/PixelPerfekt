(() => {
  'use strict';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobileMQ = matchMedia('(max-width: 800px)');
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (t) => t * t * (3 - 2 * t);
  const mod = (n, m) => ((n % m) + m) % m;

  /* ---------------------------------------------------------------
     Themes: colours the beads morph between as you scroll.
     --------------------------------------------------------------- */
  const THEMES = [
    { name: 'Opal', desc: 'Soft, shifting pastels that drift as you count.',
      hi: [255, 255, 255], base: [205, 205, 212], edge: [70, 70, 80],
      blobs: [[255, 150, 195], [165, 255, 150], [150, 200, 255]], glow: [190, 180, 255] },
    { name: 'Gold Leaf', desc: 'Hammered gold with a warm, quiet shine.',
      hi: [255, 242, 175], base: [214, 172, 40], edge: [72, 50, 4],
      blobs: [[255, 218, 95], [185, 135, 22], [255, 238, 160]], glow: [214, 172, 40] },
    { name: 'Galaxy', desc: 'Deep-space purples with a slow cosmic glow.',
      hi: [225, 195, 255], base: [105, 52, 175], edge: [14, 5, 40],
      blobs: [[255, 80, 205], [80, 120, 255], [165, 95, 255]], glow: [150, 90, 255] },
    { name: 'Aurora', desc: 'Northern lights rippling across every bead.',
      hi: [195, 255, 232], base: [30, 155, 122], edge: [3, 32, 30],
      blobs: [[80, 255, 190], [60, 205, 255], [125, 255, 125]], glow: [60, 232, 182] },
    { name: 'Deep Sea', desc: 'A deep sea finish, three colourways. Press play on the sonar ping.',
      hi: [165, 242, 252], base: [20, 112, 132], edge: [2, 22, 32],
      blobs: [[80, 222, 232], [30, 142, 172], [145, 242, 242]], glow: [40, 192, 212] },
  ];

  const mixRGB = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const mixTheme = (A, B, t) => ({
    hi: mixRGB(A.hi, B.hi, t),
    base: mixRGB(A.base, B.base, t),
    edge: mixRGB(A.edge, B.edge, t),
    glow: mixRGB(A.glow, B.glow, t),
    blobs: A.blobs.map((c, i) => mixRGB(c, B.blobs[i], t)),
  });
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  /* ---------------------------------------------------------------
     Setup: year, split text, reveals
     --------------------------------------------------------------- */
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

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
      if (e.isIntersecting) {
        e.target.classList.add('in');
        if (e.target.dataset.count) countUp(e.target);
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal, [data-split], [data-count]').forEach((el) => io.observe(el));

  function countUp(el) {
    const target = parseInt(el.dataset.count, 10);
    if (reduce) { el.textContent = target; return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = clamp((now - t0) / 1600);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // badge ring (echoes the app's loop badge)
  const ring = $('#ring');
  if (ring) {
    let svg = '<circle r="52" fill="none" stroke="rgba(201,162,39,.25)" stroke-width="1"/>';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      svg += `<circle cx="${(Math.cos(a) * 40).toFixed(2)}" cy="${(Math.sin(a) * 40).toFixed(2)}" r="5.5" fill="#d9b43a"/>`;
    }
    ring.innerHTML = svg;
  }

  // cursor-lit cards + tilt phones
  $$('.card').forEach((c) => {
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--cx', `${e.clientX - r.left}px`);
      c.style.setProperty('--cy', `${e.clientY - r.top}px`);
    });
  });
  $$('.tilt').forEach((t) => {
    const inner = t.firstElementChild;
    t.addEventListener('pointermove', (e) => {
      const r = t.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      inner.style.setProperty('--ry', `${nx * 14}deg`);
      inner.style.setProperty('--rx', `${-ny * 14}deg`);
    });
    t.addEventListener('pointerleave', () => {
      inner.style.setProperty('--ry', '0deg');
      inner.style.setProperty('--rx', '0deg');
    });
  });

  // demo video plays only while visible
  const video = $('.phone video');
  if (video && !reduce) {
    video.muted = true;
    new IntersectionObserver((es) => {
      es.forEach((e) => { e.isIntersecting ? video.play().catch(() => {}) : video.pause(); });
    }, { threshold: 0.35 }).observe(video);
  }

  /* ---------------------------------------------------------------
     Canvas stage
     --------------------------------------------------------------- */
  const canvas = $('#stage');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildKeyframes();
    buildMotes();
  }

  // Keyframes come from [data-bead] elements: where the tasbih sits when
  // that element is centred in the viewport.
  let kfs = [];
  function buildKeyframes() {
    const m = mobileMQ.matches;
    kfs = $$('[data-bead]').map((el) => {
      const r = el.getBoundingClientRect();
      const d = el.dataset;
      const num = (v, def) => (v === undefined ? def : parseFloat(v));
      const k = {
        y: r.top + scrollY + r.height / 2 - innerHeight / 2,
        theme: parseInt(d.theme || '0', 10),
      };
      if (m) {
        k.x = num(d.mx, 0.5);
        k.cy = num(d.my, 0.5);
        k.s = num(d.ms, num(d.s, 1) * 0.8);
        k.a = num(d.ma, num(d.a, 1) * 0.5);
      } else {
        k.x = num(d.x, 0.5);
        k.cy = num(d.y, 0.5);
        k.s = num(d.s, 1);
        k.a = num(d.a, 1);
      }
      return k;
    }).sort((a, b) => a.y - b.y);
  }

  function sample(sy) {
    const first = kfs[0], last = kfs[kfs.length - 1];
    if (!first) return { x: 0.5, cy: 0.5, s: 1, a: 1, ta: 0, tb: 0, t: 0 };
    if (sy <= first.y) return { ...first, ta: first.theme, tb: first.theme, t: 0 };
    if (sy >= last.y) return { ...last, ta: last.theme, tb: last.theme, t: 0 };
    let i = 0;
    while (i < kfs.length - 2 && sy >= kfs[i + 1].y) i++;
    const A = kfs[i], B = kfs[i + 1];
    const span = Math.max(1, B.y - A.y);
    const t = smooth(clamp((sy - A.y) / span));
    return {
      x: lerp(A.x, B.x, t), cy: lerp(A.cy, B.cy, t),
      s: lerp(A.s, B.s, t), a: lerp(A.a, B.a, t),
      ta: A.theme, tb: B.theme, t,
    };
  }

  // floating dust
  let motes = [];
  function buildMotes() {
    const n = Math.round(clamp((W * H) / 22000, 24, 80));
    motes = Array.from({ length: n }, () => ({
      x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8,
      r: 0.6 + Math.random() * 1.6, ph: Math.random() * 6.28,
    }));
  }

  function drawBead(x, y, r, th, rot, alpha) {
    if (alpha <= 0.01 || r < 1) return;
    ctx.save();
    // halo
    let g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.1);
    g.addColorStop(0, rgba(th.glow, 0.2 * alpha));
    g.addColorStop(1, rgba(th.glow, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 2.1, 0, 6.2832); ctx.fill();

    // body
    ctx.globalAlpha = alpha;
    g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
    g.addColorStop(0, rgba(th.hi));
    g.addColorStop(0.38, rgba(th.base));
    g.addColorStop(1, rgba(th.edge));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();

    // swirling colour blobs, clipped to the sphere
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.clip();
    ctx.globalCompositeOperation = 'screen';
    for (let j = 0; j < 3; j++) {
      const a = rot + j * 2.094;
      const bx = x + Math.cos(a) * r * 0.45;
      const by = y + Math.sin(a * 1.2) * r * 0.45;
      const bg = ctx.createRadialGradient(bx, by, 0, bx, by, r * 0.75);
      bg.addColorStop(0, rgba(th.blobs[j], 0.5));
      bg.addColorStop(1, rgba(th.blobs[j], 0));
      ctx.fillStyle = bg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    // limb darkening for the sphere look
    const sh = ctx.createRadialGradient(x - r * 0.15, y - r * 0.2, r * 0.45, x, y, r);
    sh.addColorStop(0, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = sh;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();

    // rim + specular
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = Math.max(1, r * 0.025);
    ctx.beginPath(); ctx.arc(x, y, r - 0.5, 0, 6.2832); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.38, y - r * 0.46, r * 0.2, r * 0.11, -0.7, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  const BEADS = 7;
  let mx = 0, my = 0, tmx = 0, tmy = 0; // smoothed / target pointer (-1..1)
  addEventListener('pointermove', (e) => {
    tmx = (e.clientX / innerWidth - 0.5) * 2;
    tmy = (e.clientY / innerHeight - 0.5) * 2;
    document.documentElement.style.setProperty('--mx', `${e.clientX}px`);
    document.documentElement.style.setProperty('--my', `${e.clientY}px`);
  }, { passive: true });

  function draw(sy, tm) {
    ctx.clearRect(0, 0, W, H);
    const k = sample(sy);
    const th = mixTheme(THEMES[k.ta], THEMES[k.tb], k.t);
    const glowStr = th.glow.map((v) => v | 0).join(',');
    document.documentElement.style.setProperty('--glow', glowStr);

    const cx = W * k.x + mx * 22;
    const cy = H * k.cy + my * 12;
    const R = (W < 800 ? W * 0.19 : Math.min(W, H) * 0.064) * k.s;

    // ambient glow behind the tasbih
    let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 7);
    g.addColorStop(0, rgba(th.glow, 0.2 * k.a));
    g.addColorStop(1, rgba(th.glow, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // dust
    for (const p of motes) {
      const y = mod(p.y * H - sy * 0.12 * p.z - tm * 6 * p.z, H);
      const x = p.x * W + Math.sin(tm * 0.4 + p.ph) * 14 * p.z + mx * 18 * p.z;
      ctx.fillStyle = rgba(th.glow, 0.5 * p.z * (0.6 + 0.4 * Math.sin(tm + p.ph)));
      ctx.beginPath(); ctx.arc(x, y, p.r * p.z, 0, 6.2832); ctx.fill();
    }

    // string geometry
    const amp = Math.min(W, H) * 0.03 * k.s;
    const phase = sy * 0.0016 + tm * 0.5;
    const sway = (s) => Math.sin(s * 7 + phase) * amp * (0.55 + 0.45 * Math.sin(Math.PI * s));
    const yAt = (s) => cy + (s - 0.5) * H * 1.15;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(58,58,62,${0.95 * Math.min(1, k.a * 1.4)})`;
    ctx.lineWidth = Math.max(3, R * 0.11);
    ctx.beginPath();
    for (let s = 0; s <= 1.001; s += 0.02) {
      const x = cx + sway(s), y = yAt(s);
      s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // beads slide along the string with scroll
    const offset = sy * 0.0011 + tm * 0.012;
    const list = [];
    for (let i = 0; i < BEADS; i++) {
      const s = mod(i / BEADS + offset, 1);
      const env = Math.sin(Math.PI * s);
      const pulse = 1 + 0.07 * Math.exp(-Math.pow((s - 0.5) / 0.05, 2));
      list.push({
        i, s,
        x: cx + sway(s),
        y: yAt(s),
        r: R * (0.42 + 1.0 * Math.pow(env, 0.85)) * pulse,
        a: clamp(env * 2.6) * k.a,
      });
    }
    list.sort((a, b) => a.r - b.r);
    for (const b of list) drawBead(b.x, b.y, b.r, th, sy * 0.0035 + b.i * 1.7 + tm * 0.15, b.a);
  }

  /* ---------------------------------------------------------------
     DOM scroll effects
     --------------------------------------------------------------- */
  const bar = $('.progress i');
  const countEl = $('#count');
  const parEls = $$('[data-speed]');
  const scrubs = $$('[data-scrub]').map((el) => ({ el, words: $$('.sw', el) }));
  const marqueeTracks = $$('.marquee-track');
  const themesCopy = $('.themes-copy');
  const themeName = $('#theme-name');
  const themeDesc = $('#theme-desc');
  const themeIdx = $('#theme-idx');
  const themeDots = $$('#theme-dots li');
  const steps = $$('.theme-step');
  const themesTrack = $('.themes-track');
  let activeTheme = 0;
  let lastCount = '';

  function setTheme(i) {
    if (i === activeTheme) return;
    activeTheme = i;
    themesCopy.classList.add('swap');
    setTimeout(() => {
      themeName.textContent = THEMES[i].name;
      themeDesc.textContent = THEMES[i].desc;
      themeIdx.textContent = String(i + 1).padStart(2, '0');
      themeDots.forEach((d, n) => d.classList.toggle('on', n === i));
      themesCopy.classList.remove('swap');
    }, 260);
  }

  function updateDom(sy) {
    const vh = innerHeight;
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    const p = clamp(sy / max);
    bar.style.transform = `scaleX(${p})`;
    const c = `${1 + Math.floor(p * 99)} / 100`;
    if (c !== lastCount) { countEl.textContent = c; lastCount = c; }

    for (const el of parEls) {
      const host = el.parentElement;
      const r = host.getBoundingClientRect();
      const d = r.top + r.height / 2 - vh / 2;
      if (Math.abs(d) > vh * 1.6) continue;
      const rot = parseFloat(el.dataset.rot || '0') * (d / vh);
      el.style.transform = `translate3d(0, ${(-d * parseFloat(el.dataset.speed)).toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`;
    }

    for (const s of scrubs) {
      const r = s.el.getBoundingClientRect();
      const prog = clamp((vh * 0.78 - r.top) / (r.height + vh * 0.25));
      const lit = prog * s.words.length * 1.05;
      s.words.forEach((w, i) => w.classList.toggle('lit', i < lit));
    }

    marqueeTracks.forEach((t) => {
      const half = t.scrollWidth / 2;
      const dir = parseFloat(t.dataset.dir || '-1');
      const x = mod(sy * 0.45, half);
      t.style.transform = `translate3d(${dir < 0 ? -x : x - half}px,0,0)`;
    });

    // pinned themes: pick the step nearest the viewport centre
    let best = 0, bestD = Infinity;
    steps.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - vh / 2);
      if (d < bestD) { bestD = d; best = i; }
    });
    const tr = themesTrack.getBoundingClientRect();
    const inTrack = tr.top < vh * 0.6 && tr.bottom > vh * 0.4;
    if (inTrack) setTheme(best);
    themesCopy.style.opacity = clamp((tr.bottom - vh * 0.55) / (vh * 0.4)).toFixed(3);
  }

  /* ---------------------------------------------------------------
     Loop
     --------------------------------------------------------------- */
  let sy = scrollY;
  function frame(now) {
    const target = scrollY;
    sy += (target - sy) * (reduce ? 1 : 0.085);
    if (Math.abs(target - sy) < 0.05) sy = target;
    mx += (tmx - mx) * 0.06;
    my += (tmy - my) * 0.06;
    const tm = reduce ? 0 : now / 1000;
    draw(sy, tm);
    updateDom(sy);
    requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  addEventListener('load', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
  new ResizeObserver(() => buildKeyframes()).observe(document.body);
  resize();
  requestAnimationFrame(frame);
})();

/*
 * Canvas 2D ports of the Digital Tasbih app's bead renderers
 * (core/designsystem/*Bead.kt). Same layers, same constants; `phase` is the
 * bead's live offset in bead-radii, here driven by page scroll.
 */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const WHITE = [255, 255, 255];
  const BLACK = [0, 0, 0];

  /* ---------- helpers ---------- */
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a < 0 ? 0 : a > 1 ? 1 : +a.toFixed(3)})`;
  const wrap01 = (v) => v - Math.floor(v);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fract = wrap01;

  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hsv(h, s, v) {
    h = (((h % 360) + 360) % 360) / 60;
    const i = Math.floor(h), f = h - i;
    const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
    const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
    return [r * 255, g * 255, b * 255];
  }

  const disc = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, Math.max(r, 0.01), 0, TAU); };
  const radial = (ctx, x, y, r, stops) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(r, 0.01));
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  };
  const even = (colors) => colors.map((c, i) => [i / (colors.length - 1), c]);
  const glowDisc = (ctx, x, y, r, c, a) => {
    ctx.fillStyle = radial(ctx, x, y, r, [[0, rgba(c, a)], [1, rgba(c, 0)]]);
    disc(ctx, x, y, r); ctx.fill();
  };
  const clipDisc = (ctx, x, y, r) => { disc(ctx, x, y, r); ctx.clip(); };
  const specular = (ctx, x, y, R, off, rf, a, offY = off) => glowDisc(ctx, x - R * off, y - R * offY, R * rf, WHITE, a);
  const rim = (ctx, x, y, R, color, widthF) => {
    const w = R * widthF;
    ctx.strokeStyle = color; ctx.lineWidth = w;
    disc(ctx, x, y, R - w / 2); ctx.stroke();
  };
  const vignette = (ctx, x, y, R, stops) => {
    ctx.fillStyle = radial(ctx, x, y, R, stops);
    disc(ctx, x, y, R); ctx.fill();
  };
  const vgrad = (ctx, y0, y1, stops) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  };
  const withRotation = (ctx, x, y, deg, fn) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(deg * DEG); fn(); ctx.restore();
  };

  /* ---------- GOLD LEAF (METALLIC) ---------- */
  function metallic(ctx, x, y, R, b) {
    ctx.fillStyle = radial(ctx, x - R * 0.35, y - R * 0.35, R * 1.7, even([
      rgba(mix(b, WHITE, 0.55)), rgba(b), rgba(mix(b, BLACK, 0.55)), rgba(mix(b, BLACK, 0.82)),
    ]));
    disc(ctx, x, y, R); ctx.fill();

    ctx.save(); clipDisc(ctx, x, y, R);
    const vein = mix(b, WHITE, 0.75);
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(vein, 0.22); ctx.lineWidth = R * 0.05;
    ctx.beginPath(); ctx.moveTo(x - R * 0.7, y - R * 0.5);
    ctx.quadraticCurveTo(x - R * 0.1, y + R * 0.15, x + R * 0.65, y - R * 0.35); ctx.stroke();
    ctx.strokeStyle = rgba(vein, 0.22 * 0.8); ctx.lineWidth = R * 0.05 * 0.7;
    ctx.beginPath(); ctx.moveTo(x - R * 0.55, y + R * 0.6);
    ctx.quadraticCurveTo(x + R * 0.2, y + R * 0.25, x + R * 0.7, y + R * 0.7); ctx.stroke();
    ctx.restore();

    glowDisc(ctx, x - R * 0.38, y - R * 0.38, R * 0.42, mix(b, WHITE, 0.92), 0.85);
  }

  /* ---------- OPAL ---------- */
  const OPAL_PATCHES = [
    [0.35, 0.4, 0.62, 0.25, 0.0, 0.55], [0.66, 0.35, 0.5, 0.25, 0.38, 0.5], [0.5, 0.7, 0.6, 0.25, 0.68, 0.5],
    [0.3, 0.65, 0.4, 0.55, 0.15, 0.6], [0.68, 0.62, 0.38, 0.55, 0.52, 0.6],
    [0.47, 0.42, 0.3, 0.9, 0.82, 0.65], [0.6, 0.3, 0.26, 0.9, 0.25, 0.6],
  ]; // x, y, radiusFactor, depth, hueOffset, alpha

  function opal(ctx, x, y, R, b, phase) {
    ctx.fillStyle = radial(ctx, x - R * 0.25, y - R * 0.25, R * 1.4, [[0, rgba(mix(b, WHITE, 0.62))], [1 / 1.4, rgba(mix(b, BLACK, 0.3))], [1, rgba(mix(b, BLACK, 0.3))]]);
    disc(ctx, x, y, R); ctx.fill();

    ctx.save(); clipDisc(ctx, x, y, R);
    const tile = R * 2.4;
    for (const [px, py, rf, depth, hueOff, alpha] of OPAL_PATCHES) {
      const u = wrap01(px + (phase * R * depth * 0.3) / tile);
      const v = wrap01(py - (phase * R * depth) / tile);
      const fade = clamp(Math.min(u, 1 - u) / 0.15, 0, 1) * clamp(Math.min(v, 1 - v) / 0.15, 0, 1);
      if (fade <= 0) continue;
      const hue = wrap01(hueOff + phase * 0.07 * (0.5 + depth));
      glowDisc(ctx, x + (u - 0.5) * tile, y + (v - 0.5) * tile, R * rf, hsv(hue * 360, 0.62, 1), alpha * fade);
    }
    ctx.fillStyle = radial(ctx, x - R * 0.2, y - R * 0.25, R, [[0, rgba(WHITE, 0.16)], [1, rgba(WHITE, 0)]]);
    disc(ctx, x, y, R); ctx.fill();
    vignette(ctx, x, y, R, [[0.7, rgba(BLACK, 0)], [1, rgba(BLACK, 0.32)]]);
    ctx.restore();

    rim(ctx, x, y, R, rgba(WHITE, 0.55), 0.025);
    specular(ctx, x, y, R, 0.42, 0.3, 0.5);
  }

  /* ---------- GALAXY ---------- */
  const NEBULA = [
    [0.2, 0.35, 1.1, null, 0.85], [0.62, 0.7, 1.0, [255, 79, 216], 0.7],
    [0.85, 0.25, 0.9, [61, 123, 255], 0.7], [0.4, 0.9, 0.85, null, 0.6],
  ];
  const STAR_LAYERS = [
    { depth: 0.3, count: 16, min: 0.008, max: 0.016, alpha: 0.55 },
    { depth: 0.55, count: 11, min: 0.014, max: 0.026, alpha: 0.8 },
    { depth: 0.9, count: 6, min: 0.024, max: 0.04, alpha: 1 },
  ];
  const STARS = (() => {
    const r = rng(0x6a1a), out = [];
    for (const layer of STAR_LAYERS) {
      for (let i = 0; i < layer.count; i++) {
        out.push({ x: r(), y: r(), size: layer.min + r() * (layer.max - layer.min), layer, seed: r() * TAU, warm: r() > 0.5 });
      }
    }
    return out;
  })();
  const STAR_WARM = [255, 233, 201], STAR_COOL = [205, 230, 255], RING_COLOR = [127, 216, 255];

  function orbitRing(ctx, x, y, R, phase, front) {
    const major = R * 1.08, minor = R * 0.3, steps = 56, headAngle = phase * 0.8;
    withRotation(ctx, x, y, -22, () => {
      ctx.lineCap = 'round'; ctx.lineWidth = R * 0.032;
      for (let s = 0; s < steps; s++) {
        const a = (s * TAU) / steps;
        if ((Math.sin(a) > 0) !== front) continue;
        const behind = wrap01((headAngle - a) / TAU) * TAU;
        const intensity = 0.18 + 0.82 * Math.exp(-behind * 1.6);
        const n = a + TAU / steps;
        ctx.strokeStyle = rgba(RING_COLOR, intensity);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * major, Math.sin(a) * minor);
        ctx.lineTo(Math.cos(n) * major, Math.sin(n) * minor);
        ctx.stroke();
      }
      if ((Math.sin(headAngle) > 0) === front) {
        const hx = Math.cos(headAngle) * major, hy = Math.sin(headAngle) * minor;
        const gr = R * 0.07 * 3.2;
        ctx.fillStyle = radial(ctx, hx, hy, gr, [[0, 'rgba(255,255,255,1)'], [0.5, rgba(RING_COLOR, 0.5)], [1, rgba(RING_COLOR, 0)]]);
        disc(ctx, hx, hy, gr); ctx.fill();
      }
    });
  }

  function galaxy(ctx, x, y, R, b, phase, vel) {
    orbitRing(ctx, x, y, R, phase, false);

    ctx.save(); clipDisc(ctx, x, y, R);
    ctx.fillStyle = radial(ctx, x, y, R, [[0, rgba(mix(b, BLACK, 0.68))], [1, rgba(mix(b, BLACK, 0.94))]]);
    disc(ctx, x, y, R); ctx.fill();

    // nebula clouds
    const nTile = R * 3.4;
    for (const [cx, cy, rf, tint, alpha] of NEBULA) {
      const u = wrap01(cx + (phase * R * 0.12 * 0.25) / nTile);
      const v = wrap01(cy + (-phase * R * 0.12) / nTile);
      const fade = clamp(Math.min(u, 1 - u) / 0.12, 0, 1) * clamp(Math.min(v, 1 - v) / 0.12, 0, 1);
      if (fade <= 0) continue;
      const c = tint ? mix(tint, b, 0.25) : mix(b, WHITE, 0.15);
      glowDisc(ctx, x + (u - 0.5) * nTile, y + (v - 0.5) * nTile, R * rf, c, alpha * fade);
    }

    // milky band
    const sway = Math.sin(phase * 0.35) * R * 0.3, hw = R * 0.28;
    withRotation(ctx, x, y, -28, () => {
      const bc = mix(b, WHITE, 0.25);
      ctx.fillStyle = vgrad(ctx, sway - hw, sway + hw, [[0, rgba(bc, 0)], [0.5, rgba(bc, 0.42)], [1, rgba(bc, 0)]]);
      ctx.fillRect(-R * 1.6, sway - hw, R * 3.2, hw * 2);
    });

    // stars (+ warp streaks with scroll speed)
    const sTile = R * 2.6, travel = Math.sign(vel) || 0, norm = Math.hypot(0.25, 1);
    ctx.lineCap = 'round';
    for (const s of STARS) {
      const u = wrap01(s.x + (phase * R * s.layer.depth * 0.25) / sTile);
      const v = wrap01(s.y + (-phase * R * s.layer.depth) / sTile);
      const fade = clamp(Math.min(u, 1 - u) / 0.12, 0, 1) * clamp(Math.min(v, 1 - v) / 0.12, 0, 1);
      if (fade <= 0) continue;
      const twinkle = 0.65 + 0.35 * Math.sin(phase * 1.7 + s.seed);
      const col = rgba(s.warm ? STAR_WARM : STAR_COOL, s.layer.alpha * fade * twinkle);
      const px = x + (u - 0.5) * sTile, py = y + (v - 0.5) * sTile, sr = R * s.size;
      const streak = Math.min(Math.abs(vel) * 9 * s.layer.depth, 0.55) * R;
      if (streak > 1.5) {
        ctx.strokeStyle = col; ctx.lineWidth = sr * 2;
        ctx.beginPath(); ctx.moveTo(px, py);
        ctx.lineTo(px - (0.25 / norm) * travel * streak, py + (1 / norm) * travel * streak); ctx.stroke();
      } else {
        ctx.fillStyle = col; disc(ctx, px, py, sr); ctx.fill();
      }
    }

    const rc = mix(b, WHITE, 0.1);
    vignette(ctx, x, y, R, [[0.62, rgba(rc, 0)], [1, rgba(rc, 0.3)]]);
    ctx.restore();

    specular(ctx, x, y, R, 0.4, 0.36, 0.42);
    orbitRing(ctx, x, y, R, phase, true);
  }

  /* ---------- ZELLIGE ---------- */
  const ZEL_GOLD = [242, 199, 92];
  const STAR_HALF = 1 / (2 * Math.sqrt(2));

  function tiledStars(x, y, R, cell, sx, sy, cellOffset) {
    const s = cell * STAR_HALF, d = s * Math.SQRT2;
    const posMod = (v) => v - Math.floor(v / cell) * cell;
    const ox = posMod(sx + cellOffset), oy = posMod(sy + cellOffset);
    const n = Math.ceil(R / cell) + 1;
    const p = new Path2D();
    for (let ix = -n; ix <= n; ix++) {
      for (let iy = -n; iy <= n; iy++) {
        const cx = x + ix * cell + ox, cy = y + iy * cell + oy;
        p.moveTo(cx - s, cy - s); p.lineTo(cx + s, cy - s); p.lineTo(cx + s, cy + s); p.lineTo(cx - s, cy + s); p.closePath();
        p.moveTo(cx, cy - d); p.lineTo(cx + d, cy); p.lineTo(cx, cy + d); p.lineTo(cx - d, cy); p.closePath();
      }
    }
    return p;
  }

  function zellige(ctx, x, y, R, b, phase) {
    ctx.fillStyle = radial(ctx, x - R * 0.25, y - R * 0.25, R * 1.5, [[0, rgba(mix(b, BLACK, 0.3))], [1 / 1.5, rgba(mix(b, BLACK, 0.72))], [1, rgba(mix(b, BLACK, 0.72))]]);
    disc(ctx, x, y, R); ctx.fill();

    ctx.save(); clipDisc(ctx, x, y, R);
    const back = tiledStars(x, y, R, R * 1.05, phase * R * 0.22 * 0.3, -phase * R * 0.22, 0);
    ctx.fillStyle = rgba(mix(b, WHITE, 0.4), 0.3); ctx.fill(back);
    ctx.strokeStyle = rgba(mix(b, BLACK, 0.8), 0.75); ctx.lineWidth = R * 0.024; ctx.lineJoin = 'miter'; ctx.stroke(back);

    const cellG = R * 0.58;
    const gold = tiledStars(x, y, R, cellG, phase * R * 0.6 * 0.3, -phase * R * 0.6, cellG / 2);
    ctx.strokeStyle = rgba(ZEL_GOLD, 0.95); ctx.lineWidth = R * 0.017; ctx.stroke(gold);

    const sway = Math.sin(phase * 0.45) * R * 0.75, hw = R * 0.3;
    withRotation(ctx, x, y, -32, () => {
      ctx.fillStyle = vgrad(ctx, sway - hw, sway + hw, [[0, rgba(WHITE, 0)], [0.5, rgba(WHITE, 0.22)], [1, rgba(WHITE, 0)]]);
      ctx.fillRect(-R * 1.6, sway - hw, R * 3.2, hw * 2);
    });
    vignette(ctx, x, y, R, [[0.7, rgba(BLACK, 0)], [1, rgba(BLACK, 0.5)]]);
    ctx.restore();

    rim(ctx, x, y, R, rgba(ZEL_GOLD), 0.045);
    specular(ctx, x, y, R, 0.4, 0.3, 0.3);
  }

  /* ---------- AURORA ---------- */
  const AUR_GREEN = [61, 255, 176], AUR_VIOLET = [176, 108, 255];
  // depth, tint, baselineFactor, heightFactor, [freq, freq2, heightFreq, seed], drift [wave, counter, height], alpha
  const CURTAINS = [
    [0.35, AUR_VIOLET, 0.62, 1.3, [0.8, 1.7, 1.1, 2.1], [2, 3, 1], 0.45],
    [0.65, AUR_GREEN, 0.52, 1.3, [1.0, 2.0, 1.4, 0.4], [3, 2, 2], 0.55],
    [1.0, null, 0.44, 1.1, [1.3, 2.4, 1.7, 4.3], [4, 3, 1], 0.65],
  ];

  function aurora(ctx, x, y, R, b, phase, vel, ambient) {
    ctx.fillStyle = radial(ctx, x, y, R, [[0, rgba(mix(b, BLACK, 0.86))], [1, rgba(mix(b, BLACK, 0.95))]]);
    disc(ctx, x, y, R); ctx.fill();

    ctx.save(); clipDisc(ctx, x, y, R);
    glowDisc(ctx, x, y + R * 0.9, R * 1.1, b, 0.3 * (0.85 + 0.15 * Math.sin(ambient)));

    const STEPS = 36, FEATHER = R * 0.22;
    for (const [depth, tint, baseF, heightF, rip, drift, alpha] of CURTAINS) {
      const [f1, f2, hf, seed] = rip;
      const wavePhase = phase * depth * 0.9 + seed;
      const sway = Math.sin(phase * 0.4 * depth + seed + ambient) * R * 0.2;
      const baselineY = y + R * baseF - R * 0.5 + sway;
      const maxH = R * heightF;
      const color = tint ? mix(tint, b, 0.12) : b;
      const X = (t) => x - R + t * R * 2;
      const Y = (t) => {
        const wob = 0.5 * Math.sin(t * f1 * TAU + wavePhase + ambient * drift[0]) +
          0.5 * Math.sin(t * f2 * TAU - wavePhase * 1.3 - ambient * drift[1]);
        return baselineY + wob * R * 0.1;
      };
      const H = (t) => maxH * (0.75 + 0.25 * Math.sin(t * hf * TAU + wavePhase * 0.7 + ambient * drift[2]));

      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.moveTo(X(0), Y(0) + FEATHER);
      for (let s = 1; s <= STEPS; s++) ctx.lineTo(X(s / STEPS), Y(s / STEPS) + FEATHER);
      for (let s = STEPS; s >= 0; s--) ctx.lineTo(X(s / STEPS), Y(s / STEPS) - H(s / STEPS));
      ctx.closePath();
      ctx.fillStyle = vgrad(ctx, baselineY - maxH, baselineY + FEATHER, [
        [0, rgba(color, 0)], [0.55, rgba(color, alpha * 0.3)], [0.85, rgba(color, alpha)], [1, rgba(color, alpha * 0.25)],
      ]);
      ctx.fill();

      const rayColor = mix(color, WHITE, 0.25);
      ctx.lineCap = 'round'; ctx.lineWidth = R * 0.014;
      for (let i = 0; i < 28; i++) {
        const t = (i + 0.5) / 28;
        const ang = t * hf * 7 * TAU + wavePhase + ambient * (drift[0] + drift[2]);
        ctx.strokeStyle = rgba(rayColor, 0.3 * (0.5 + 0.5 * Math.sin(ang)) * alpha);
        ctx.beginPath(); ctx.moveTo(X(t), Y(t)); ctx.lineTo(X(t), Y(t) - H(t) * 0.9); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    vignette(ctx, x, y, R, [[0.78, rgba(BLACK, 0)], [0.93, rgba(BLACK, 0.35)], [1, rgba(mix(b, WHITE, 0.2), 0.3)]]);
    ctx.restore();

    specular(ctx, x, y, R, 0.4, 0.34, 0.2);
  }

  /* ---------- GEODE ---------- */
  const GEO_R = rng(0x6e0de);
  const GEO_LEN = Array.from({ length: 32 }, () => 0.75 + GEO_R() * 0.5);
  const GEO_R2 = rng(0x6e0df);
  const GEO_JIT = Array.from({ length: 32 }, () => (GEO_R2() - 0.5) * 0.4);
  const GEO_BACK = { count: 14, len: 0.5, half: 0.15, gain: 0.12, bright: 0.6, off: 0.1 };
  const GEO_FRONT = { count: 8, len: 0.4, half: 0.24, gain: 0.25, bright: 1, off: 0.45 };
  const facetLight = (a, light) => { const r = 0.5 + 0.5 * Math.cos(a - light); return r * r; };

  function geode(ctx, x, y, R, b, phase) {
    ctx.fillStyle = radial(ctx, x, y, R, [[0, rgba(mix(b, BLACK, 0.55))], [1, rgba(mix(b, BLACK, 0.85))]]);
    disc(ctx, x, y, R); ctx.fill();

    ctx.save(); clipDisc(ctx, x, y, R);
    glowDisc(ctx, x, y, R * 0.55, mix(b, WHITE, 0.3), 0.5);
    const lightAngle = phase * 0.6;
    for (const ring of [GEO_BACK, GEO_FRONT]) {
      const rot = ring.off + phase * ring.gain;
      for (let i = 0; i < ring.count; i++) {
        const ang = rot + (i * TAU) / ring.count + GEO_JIT[i % 32];
        const ox = Math.cos(ang), oy = Math.sin(ang), sx = -oy, sy = ox;
        const start = R * 0.86, variation = GEO_LEN[i % 32];
        const length = Math.min(R * ring.len * variation, R * 0.55), half = R * ring.half * variation;
        const pt = (along, across) => [x + ox * (start - along) + sx * across, y + oy * (start - along) + sy * across];
        const bc = pt(0, 0), bl = pt(0, -half), br = pt(0, half);
        const sl = pt(length * 0.55, -half), sr = pt(length * 0.55, half), tip = pt(length, 0);
        const ll = facetLight(ang - 0.5, lightAngle), rl = facetLight(ang + 0.5, lightAngle);
        facet(ctx, [bc, bl, sl, tip], ll, b, ring.bright);
        facet(ctx, [bc, br, sr, tip], rl, b, ring.bright);
        facet(ctx, [sl, sr, tip], Math.min((ll + rl) / 2 + 0.25, 1), b, ring.bright);
      }
    }
    ctx.restore();

    // agate rim, outer edge flush with the bead
    const width = R * 0.24;
    const bands = [
      [0, 0.3, rgba(mix(b, BLACK, 0.85))], [0.3, 0.5, rgba(mix(b, WHITE, 0.3), 0.75)],
      [0.5, 0.68, rgba(mix(b, BLACK, 0.6))], [0.68, 0.84, rgba(mix(b, WHITE, 0.15), 0.85)],
      [0.84, 1, rgba(mix(b, BLACK, 0.8))],
    ];
    for (const [from, to, color] of bands) {
      const bw = width * (to - from);
      ctx.strokeStyle = color; ctx.lineWidth = bw + 0.5;
      disc(ctx, x, y, R - width * from - bw / 2); ctx.stroke();
    }
  }

  function facet(ctx, pts, light, b, brightness) {
    const c = mix(mix(b, BLACK, 0.4 * (1 - light)), WHITE, 0.6 * light * brightness);
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = rgba(c); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke();
  }

  /* ---------- NIGHT GARDEN ---------- */
  // count, lengthFactor, widthFactor, rotationGain, alpha, angleOffset
  const PETAL_RINGS = [
    [9, 0.98, 0.3, 0.18, 0.5, 0.2], [7, 0.74, 0.34, -0.32, 0.75, 0.55], [5, 0.5, 0.4, 0.5, 1, 0.9],
  ];

  function nightGarden(ctx, x, y, R, b, phase) {
    ctx.fillStyle = radial(ctx, x, y, R, [[0, rgba(mix(b, BLACK, 0.78))], [1, rgba(mix(b, BLACK, 0.93))]]);
    disc(ctx, x, y, R); ctx.fill();

    ctx.save(); clipDisc(ctx, x, y, R);
    const motion = phase * 3;
    const petalColor = mix(b, WHITE, 0.35), tipColor = mix(b, WHITE, 0.7);
    PETAL_RINGS.forEach(([count, lf, wf, gain, alpha, off], ri) => {
      const rotation = off + motion * gain;
      const open = 1 - 0.28 + 0.28 * Math.sin(motion * 0.8 + ri * 2.1);
      for (let i = 0; i < count; i++) {
        const a = rotation + (i * TAU) / count;
        const length = R * lf * open, half = R * wf * (0.8 + 0.2 * open);
        const tx = x + Math.cos(a) * length, ty = y + Math.sin(a) * length;
        const along = length * 0.55;
        const bx = x + Math.cos(a) * along, by = y + Math.sin(a) * along;
        const sx = -Math.sin(a) * half * 1.6, sy = Math.cos(a) * half * 1.6;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.quadraticCurveTo(bx + sx, by + sy, tx, ty);
        ctx.quadraticCurveTo(bx - sx, by - sy, x, y);
        ctx.closePath();
        const g = ctx.createLinearGradient(x, y, tx, ty);
        g.addColorStop(0, rgba(petalColor, 0.18 * alpha)); g.addColorStop(1, rgba(tipColor, alpha));
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = rgba(tipColor, 0.35 * alpha); ctx.lineWidth = R * 0.012; ctx.stroke();
      }
    });
    glowDisc(ctx, x, y, R * 0.4, mix(b, WHITE, 0.85), 0.7);
    ctx.restore();

    rim(ctx, x, y, R, rgba(mix(b, WHITE, 0.35), 0.5), 0.024);
    specular(ctx, x, y, R, 0.4, 0.3, 0.22, 0.42);
  }

  /* ---------- INK IN WATER ---------- */
  // rootX, rootY, headingDeg, lengthFactor, seed, swaySpeed
  const INK_BACK = { plumes: [[0.5, 0.5, -100, 1.0, 1.3, 0.35], [-0.5, 0.3, -60, 0.9, 3.1, 0.4], [0.0, -0.7, 90, 1.1, 5.2, 0.3]], alpha: 0.24, scale: 1.35, depth: 0.35 };
  const INK_FRONT = { plumes: [[-0.35, -0.55, 80, 0.95, 0.4, 0.6], [0.4, -0.3, 110, 0.85, 2.2, 0.7], [0.1, 0.6, -80, 0.8, 4.4, 0.55]], alpha: 0.42, scale: 1.0, depth: 0.8 };

  function ink(ctx, x, y, R, b, phase) {
    ctx.fillStyle = radial(ctx, x, y, R, [[0, rgba(mix(b, WHITE, 0.9))], [1, rgba(mix(b, WHITE, 0.7))]]);
    disc(ctx, x, y, R); ctx.fill();

    const inkC = mix(b, BLACK, 0.5), motion = phase * 3.5, BLOBS = 12;
    ctx.save(); clipDisc(ctx, x, y, R);
    for (const layer of [INK_BACK, INK_FRONT]) {
      for (const [rx, ry, headDeg, lf, seed, swaySpeed] of layer.plumes) {
        const swirl = Math.sin(motion * 0.5 * layer.depth + seed) * 28;
        const heading = (headDeg + swirl) * DEG;
        const dx = Math.cos(heading), dy = Math.sin(heading), px = -dy, py = dx;
        const unfurl = 1 + 0.4 * Math.sin(motion * swaySpeed * 0.7 + seed);
        const drift = Math.sin(motion * 0.25 * layer.depth + seed) * R * 0.2;
        const rootX = x + rx * R + px * drift, rootY = y + ry * R + py * drift;
        const length = R * lf * unfurl;
        for (let i = 0; i < BLOBS; i++) {
          const t = i / (BLOBS - 1);
          const curl = Math.sin(t * 4.2 + motion * swaySpeed + seed);
          const sway = curl * R * 0.45 * (0.3 + t);
          const cx = rootX + dx * length * t + px * sway, cy = rootY + dy * length * t + py * sway;
          const blobR = R * (0.1 + (0.27 - 0.1) * t) * layer.scale;
          glowDisc(ctx, cx, cy, blobR, inkC, layer.alpha * (1 - 0.65 * t));
        }
      }
    }
    ctx.restore();

    rim(ctx, x, y, R, rgba(inkC, 0.45), 0.022);
    specular(ctx, x, y, R, 0.4, 0.32, 0.5, 0.42);
  }

  /* ---------- DEEP SEA ---------- */
  // x, y, size, depth, seed, alpha
  const JELLY = [
    [0.58, 0.33, 0.22, 0.3, 0.8, 0.6], [0.64, 0.66, 0.3, 0.6, 2.4, 0.8], [0.42, 0.45, 0.4, 1.0, 4.1, 1],
  ];

  function deepSea(ctx, x, y, R, b, phase) {
    ctx.fillStyle = radial(ctx, x, y - R * 0.3, R * 1.4, [[0, rgba(mix(b, BLACK, 0.8))], [1 / 1.4, rgba(mix(b, BLACK, 0.95))], [1, rgba(mix(b, BLACK, 0.95))]]);
    disc(ctx, x, y, R); ctx.fill();

    ctx.save(); clipDisc(ctx, x, y, R);
    ctx.fillStyle = vgrad(ctx, y - R, y + R * 0.4, [[0, rgba(b, 0.3)], [1, rgba(b, 0)]]);
    disc(ctx, x, y, R); ctx.fill();

    // light shafts
    const shaft = mix(b, WHITE, 0.35);
    withRotation(ctx, x, y, -16, () => {
      [-0.55, 0.05, 0.6].forEach((off, i) => {
        const sway = Math.sin(phase * 0.3 + i * 1.7) * R * 0.1;
        const w = R * (0.32 + 0.1 * i), left = off * R + sway - w / 2;
        const g = ctx.createLinearGradient(left, 0, left + w, 0);
        g.addColorStop(0, rgba(shaft, 0)); g.addColorStop(0.5, rgba(shaft, 0.16)); g.addColorStop(1, rgba(shaft, 0));
        ctx.fillStyle = g; ctx.fillRect(left, -R * 1.5, w, R * 3);
      });
    });

    const tile = R * 3.2;
    for (const [jx, jy, size, depth, seed, alpha] of JELLY) {
      const u = wrap01(jx + (phase * R * depth * 0.3) / tile);
      const v = wrap01(jy - (phase * R * depth) / tile);
      const fade = clamp(Math.min(u, 1 - u) / 0.15, 0, 1) * clamp(Math.min(v, 1 - v) / 0.15, 0, 1) * alpha;
      if (fade <= 0) continue;
      const sway = Math.sin(phase * 0.5 + seed) * R * 0.08;
      const px = x + (u - 0.5) * tile + sway, py = y + (v - 0.5) * tile;
      const bell = R * size, pulse = 1 + 0.12 * Math.sin(phase * 2.2 + seed), bh = bell * 0.85 * pulse;
      const glow = mix(b, WHITE, 0.35);

      glowDisc(ctx, px, py, bell * 2.2, b, 0.28 * fade);

      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const sx = px + (k - 2) * bell * 0.4;
        ctx.moveTo(sx, py + bh * 0.1);
        for (let s = 1; s <= 6; s++) {
          const t = s / 6;
          ctx.lineTo(sx + Math.sin(s * 0.9 + phase * 2 + seed + k) * bell * 0.16 * t, py + bh * 0.1 + t * bell * 2.4);
        }
      }
      ctx.strokeStyle = vgrad(ctx, py, py + bell * 2.5, [[0, rgba(glow, 0.55 * fade)], [1, rgba(glow, 0)]]);
      ctx.lineWidth = bell * 0.07; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(px, py, bell, bh, 0, Math.PI, TAU);
      ctx.quadraticCurveTo(px, py + bh * 0.4, px - bell, py);
      ctx.closePath();
      ctx.fillStyle = radial(ctx, px, py - bh * 0.3, bell * 1.1, [[0, rgba(glow, 0.85 * fade)], [1, rgba(b, 0.3 * fade)]]);
      ctx.fill();
      ctx.strokeStyle = rgba(glow, 0.5 * fade); ctx.lineWidth = bell * 0.05; ctx.stroke();
    }

    vignette(ctx, x, y, R, [[0.78, rgba(BLACK, 0)], [0.93, rgba(BLACK, 0.4)], [1, rgba(mix(b, WHITE, 0.2), 0.28)]]);
    ctx.restore();

    specular(ctx, x, y, R, 0.4, 0.34, 0.18);
  }

  /* ---------- registry ---------- */
  const RENDERERS = { metallic, opal, galaxy, zellige, aurora, geode, nightGarden, ink, deepSea };

  /** Same stack as the app's drawBead(): halo, contact shadow, then the fill. */
  function drawBead(ctx, o) {
    const { x, y, R, fill, color, halo, phase = 0, velocity = 0, ambient = 0 } = o;
    if (halo) glowDisc(ctx, x, y, R * 1.8, halo, 0.4);
    const sr = R + R * 0.17;
    ctx.fillStyle = radial(ctx, x, y, sr, [[R / sr, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,0)']]);
    disc(ctx, x, y, sr); ctx.fill();
    ctx.save();
    RENDERERS[fill](ctx, x, y, R, color, phase, velocity, ambient);
    ctx.restore();
  }

  window.TasbihBeads = { drawBead, hex, mix, rgba };
})();

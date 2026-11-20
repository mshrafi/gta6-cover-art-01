// Sunset Drive cover renderer: draws the multi-panel poster — hero panel plus two
// smaller panels, a sunset/neon colour grade, palm and skyline silhouettes drawn in
// code, halftone dots, grain and a vignette — with bold outlined title lettering in
// a title band. Everything is drawn on canvas; no artwork is loaded from anywhere.

/** Colour grades: sky ramp, photo tint, accent, title ink and silhouette ink. */
export const GRADE_PRESETS = {
  sunset: {
    label: 'Sunset',
    sky: ['#ffd166', '#ff8a3d', '#ff2e88', '#5b2a86'],
    tint: 'rgba(255, 94, 98, 0.16)',
    accent: '#ffb347',
    title: '#fff7ec',
    sil: '#1c0f2e',
  },
  neon: {
    label: 'Neon Nights',
    sky: ['#00e5ff', '#7b2ff7', '#ff2e88', '#0f0524'],
    tint: 'rgba(123, 47, 247, 0.20)',
    accent: '#00e5ff',
    title: '#f2fbff',
    sil: '#0a0618',
  },
  teal: {
    label: 'Teal Dawn',
    sky: ['#ffe29a', '#2ec4b6', '#0f766e', '#0b3d3a'],
    tint: 'rgba(46, 196, 182, 0.14)',
    accent: '#ffd166',
    title: '#f4fffd',
    sil: '#06231f',
  },
  mono: {
    label: 'Mono Noir',
    sky: ['#f2f2f2', '#b5b5b5', '#555555', '#111111'],
    tint: 'rgba(0, 0, 0, 0.10)',
    accent: '#ffffff',
    title: '#ffffff',
    sil: '#0d0d0d',
    mono: true,
  },
};

/** A small deterministic generator, so the grain and skylines never change. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The fresh state of a cover: one photo fills every panel until changed. */
export function makeDefaultState() {
  return {
    title: 'Sunset Drive',
    caption: 'Cruise the neon coast',
    preset: 'sunset',
    size: { w: 1920, h: 1080 },
    photos: [null, null, null],
    panels: [
      { photo: 0, zoom: 1, dx: 0, dy: 0 },
      { photo: 0, zoom: 1, dx: 0, dy: 0 },
      { photo: 0, zoom: 1, dx: 0, dy: 0 },
    ],
  };
}

/**
 * Panel geometry for an export size. Landscape: hero left, two stacked panels
 * right, title band along the foot. Square: hero on top, two panels below.
 * Portrait: hero on top, two panels below, taller title band.
 */
export function layoutForCover(w, h) {
  const gutter = Math.max(6, Math.round(w * 0.005));
  const aspect = w / h;
  let panels;
  let titleH;
  if (aspect > 1.4) {
    titleH = Math.round(h * 0.19);
    const bodyH = h - titleH;
    const heroW = Math.round(w * 0.645);
    panels = [
      { x: 0, y: 0, w: heroW, h: bodyH, hero: true },
      { x: heroW, y: 0, w: w - heroW, h: Math.round(bodyH / 2), hero: false },
      { x: heroW, y: Math.round(bodyH / 2), w: w - heroW, h: bodyH - Math.round(bodyH / 2), hero: false },
    ];
  } else if (aspect < 0.85) {
    titleH = Math.round(h * 0.17);
    const bodyH = h - titleH;
    const heroH = Math.round(bodyH * 0.62);
    panels = [
      { x: 0, y: 0, w, h: heroH, hero: true },
      { x: 0, y: heroH, w: Math.round(w / 2), h: bodyH - heroH, hero: false },
      { x: Math.round(w / 2), y: heroH, w: w - Math.round(w / 2), h: bodyH - heroH, hero: false },
    ];
  } else {
    titleH = Math.round(h * 0.19);
    const bodyH = h - titleH;
    const heroH = Math.round(bodyH * 0.68);
    panels = [
      { x: 0, y: 0, w, h: heroH, hero: true },
      { x: 0, y: heroH, w: Math.round(w / 2), h: bodyH - heroH, hero: false },
      { x: Math.round(w / 2), y: heroH, w: w - Math.round(w / 2), h: bodyH - heroH, hero: false },
    ];
  }
  return { panels, title: { x: 0, y: h - titleH, w, h: titleH }, gutter };
}

/** Draws one photo into a panel rect, cover-fit, with zoom and pan offsets. */
export function drawPhotoIntoPanel(ctx, photo, rect, zoom, dx, dy, mono) {
  const iw = photo.naturalWidth || photo.width;
  const ih = photo.naturalHeight || photo.height;
  const base = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const dw = iw * base;
  const dh = ih * base;
  const x = rect.x + (rect.w - dw) / 2 + dx * rect.w;
  const y = rect.y + (rect.h - dh) / 2 + dy * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (mono) ctx.filter = 'grayscale(1) contrast(1.12) brightness(1.05)';
  ctx.drawImage(photo, x, y, dw, dh);
  ctx.filter = 'none';
  ctx.restore();
}

/** A gradient sky with a low sun, for panels with no photo. */
export function drawEmptyPanelSky(ctx, rect, grade) {
  const sky = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  grade.sky.forEach((c, i) => sky.addColorStop(i / (grade.sky.length - 1), c));
  ctx.fillStyle = sky;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const sunR = Math.min(rect.w, rect.h) * 0.26;
  const sunX = rect.x + rect.w * (rect.hero ? 0.68 : 0.5);
  const sunY = rect.y + rect.h * 0.42;
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.1, sunX, sunY, sunR * 2.2);
  glow.addColorStop(0, 'rgba(255, 240, 180, 0.85)');
  glow.addColorStop(1, 'rgba(255, 240, 180, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = grade.mono ? '#f5f5f5' : '#fff3c4';
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
}

/** A city skyline silhouette with a few lit windows, along a panel's foot. */
export function drawSkylineSilhouette(ctx, rect, grade, seed) {
  const rnd = mulberry32(seed);
  const baseY = rect.y + rect.h;
  const top = rect.y + rect.h * 0.55;
  ctx.fillStyle = grade.sil;
  let x = rect.x + rect.w * 0.02;
  while (x < rect.x + rect.w * 0.96) {
    const bw = rect.w * (0.05 + rnd() * 0.07);
    const bh = (baseY - top) * (0.2 + rnd() * 0.6);
    ctx.fillRect(x, baseY - bh, bw, bh);
    if (rnd() > 0.55) {
      // A taller tower with an antenna spike.
      ctx.fillRect(x + bw * 0.32, baseY - bh - rect.h * 0.12, bw * 0.14, rect.h * 0.12);
      ctx.fillRect(x + bw * 0.36, baseY - bh - rect.h * 0.2, bw * 0.06, rect.h * 0.09);
    } else if (rnd() > 0.7) {
      ctx.fillRect(x + bw * 0.3, baseY - bh - rect.h * 0.05, bw * 0.12, rect.h * 0.05);
    }
    x += bw + rect.w * (0.03 + rnd() * 0.03);
  }
  ctx.fillStyle = grade.accent;
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 9; i++) {
    const wx = rect.x + rnd() * rect.w;
    const wy = top + rnd() * (baseY - top) * 0.75;
    ctx.fillRect(wx, wy, Math.max(2, rect.w * 0.006), Math.max(2, rect.h * 0.014));
  }
  ctx.globalAlpha = 1;
}

/** A palm tree silhouette: curved trunk, long fronds that arc out and droop. */
export function drawPalmSilhouette(ctx, x, baseY, height, grade) {
  ctx.save();
  ctx.strokeStyle = grade.sil;
  ctx.fillStyle = grade.sil;
  ctx.lineCap = 'round';
  const lean = height * 0.18;
  ctx.lineWidth = Math.max(4, height * 0.045);
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + lean * 0.4, baseY - height * 0.6, x + lean, baseY - height);
  ctx.stroke();
  const topX = x + lean;
  const topY = baseY - height;
  // Fronds sweep across the upper half and bend down at the tips, like a real palm.
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.06 + (i / 6) * 0.88);
    const len = height * (0.5 + (i % 3) * 0.09);
    const droop = height * (0.22 + Math.abs(Math.cos(a)) * 0.18);
    ctx.lineWidth = Math.max(3, height * 0.028);
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + Math.cos(a) * len * 0.55,
      topY + Math.sin(a) * len * 0.55 - height * 0.1,
      topX + Math.cos(a) * len,
      topY + Math.sin(a) * len * 0.45 + droop,
    );
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(topX - height * 0.03, topY + height * 0.04, Math.max(3, height * 0.05), 0, Math.PI * 2);
  ctx.arc(topX + height * 0.04, topY + height * 0.05, Math.max(3, height * 0.045), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Halftone dots that shrink across a corner — the print-poster touch. */
export function drawHalftone(ctx, rect, grade) {
  const cols = 9;
  const rows = 5;
  const cell = Math.min(rect.w / cols, rect.h / rows);
  ctx.fillStyle = grade.accent;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const t = (c + r) / (cols + rows);
      const radius = cell * 0.42 * (1 - t * 0.75);
      ctx.globalAlpha = 0.28 + 0.5 * (1 - t);
      ctx.beginPath();
      ctx.arc(rect.x + c * cell + cell / 2, rect.y + r * cell + cell / 2, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** Film grain from a fixed-seed noise tile, tiled over the whole cover. */
export function drawGrain(ctx, w, h) {
  const tile = document.createElement('canvas');
  tile.width = 128;
  tile.height = 128;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(128, 128);
  const rnd = mulberry32(20261120);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  const pattern = ctx.createPattern(tile, 'repeat');
  ctx.save();
  ctx.globalAlpha = 0.055;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** The title band: dark gradient, accent rule, big outlined title, caption. */
export function drawTitleBand(ctx, rect, title, caption, grade) {
  const band = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  band.addColorStop(0, 'rgba(10, 4, 18, 0.92)');
  band.addColorStop(1, 'rgba(10, 4, 18, 0.98)');
  ctx.fillStyle = band;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = grade.accent;
  ctx.fillRect(rect.x, rect.y, rect.w, Math.max(4, rect.h * 0.035));

  const pad = rect.w * 0.035;
  const text = (title || 'Sunset Drive').trim().toUpperCase();
  let size = rect.h * 0.52;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const setFont = (s) => { ctx.font = `${s}px Anton, 'Arial Black', Impact, sans-serif`; };
  setFont(size);
  while (ctx.measureText(text).width > rect.w - pad * 2 && size > 16) {
    size -= 2;
    setFont(size);
  }
  const titleY = rect.y + rect.h * 0.56;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.strokeStyle = 'rgba(10, 4, 18, 0.9)';
  ctx.strokeText(text, pad, titleY);
  const ink = ctx.createLinearGradient(0, titleY - size, 0, titleY);
  ink.addColorStop(0, grade.title);
  ink.addColorStop(1, grade.accent);
  ctx.fillStyle = ink;
  ctx.fillText(text, pad, titleY);

  const cap = (caption || '').trim();
  if (cap) {
    const capSize = Math.max(14, rect.h * 0.15);
    ctx.font = `600 ${capSize}px system-ui, sans-serif`;
    try { ctx.letterSpacing = `${Math.max(2, capSize * 0.18)}px`; } catch { /* older canvas */ }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.fillText(cap.toUpperCase(), pad, rect.y + rect.h * 0.86);
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }
}

/** Draws the whole cover for `state` onto `canvas` (already sized to state.size). */
export function drawCoverArt(canvas, state) {
  const { w, h } = state.size;
  const ctx = canvas.getContext('2d');
  const grade = GRADE_PRESETS[state.preset] || GRADE_PRESETS.sunset;
  const { panels, title, gutter } = layoutForCover(w, h);

  ctx.fillStyle = '#0c0612';
  ctx.fillRect(0, 0, w, h);

  panels.forEach((panel, i) => {
    const p = state.panels[i] || { photo: 0, zoom: 1, dx: 0, dy: 0 };
    const rect = {
      x: panel.x + gutter / 2,
      y: panel.y + gutter / 2,
      w: panel.w - gutter,
      h: panel.h - gutter,
      hero: panel.hero,
    };
    const photo = p.photo >= 0 ? state.photos[p.photo] : null;
    if (photo) {
      drawPhotoIntoPanel(ctx, photo, rect, p.zoom, p.dx, p.dy, !!grade.mono);
      ctx.fillStyle = grade.tint;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    } else {
      drawEmptyPanelSky(ctx, rect, grade);
    }
    const silH = rect.h * (panel.hero ? 0.24 : 0.3);
    drawSkylineSilhouette(ctx, { x: rect.x, y: rect.y + rect.h - silH, w: rect.w, h: silH }, grade, 11 + i * 7);
    drawPalmSilhouette(ctx, rect.x + rect.w * (panel.hero ? 0.12 : 0.82), rect.y + rect.h, silH * 1.15, grade);
    if (panel.hero) {
      drawHalftone(ctx, { x: rect.x + rect.w * 0.78, y: rect.y + rect.h * 0.04, w: rect.w * 0.2, h: rect.h * 0.16 }, grade);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = Math.max(2, w * 0.002);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  });

  drawTitleBand(ctx, title, state.title, state.caption, grade);

  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  drawGrain(ctx, w, h);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = Math.max(3, w * 0.004);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
}

/** Renders a fresh canvas at the export size and returns it. */
export function renderCoverArt(width, height, state) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  drawCoverArt(canvas, { ...state, size: { w: width, h: height } });
  return canvas;
}

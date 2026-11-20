// Sunset Drive editor: photo slots, per-panel photo + zoom, drag-to-pan on the
// live preview, title and caption, four colour grades, three export sizes and a
// one-click PNG export. A `?shot=` query sets up a fixed scene for a screenshot.

import { drawCoverArt, makeDefaultState, renderCoverArt } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('preview');
const status = document.getElementById('status');
const state = makeDefaultState();
let activePanel = 0;

const PANEL_NAMES = ['Hero panel', 'Panel 2', 'Panel 3'];

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function redraw() {
  canvas.width = state.size.w;
  canvas.height = state.size.h;
  drawCoverArt(canvas, state);
}

function refreshPanelRows() {
  document.querySelectorAll('.panel-row').forEach((row) => {
    row.classList.toggle('is-selected', Number(row.dataset.panel) === activePanel);
  });
  document.getElementById('active-panel').textContent = PANEL_NAMES[activePanel];
}

/** Puts an image into a slot and shows its thumbnail. */
export function setPhoto(slot, img) {
  state.photos[slot] = img;
  const thumb = document.getElementById(`thumb${slot}`);
  thumb.src = img.src;
  thumb.hidden = false;
  document.querySelector(`.slot[data-slot="${slot}"]`).classList.add('is-filled');
  redraw();
}

async function loadFileIntoSlot(slot, file) {
  if (!file || !file.type.startsWith('image/')) return;
  setPhoto(slot, await loadImage(URL.createObjectURL(file)));
  status.textContent = `Photo ${slot + 1} loaded — drag it on the preview to position it.`;
}

async function loadSample(name, slot) {
  setPhoto(slot, await loadImage(`samples/${name}.jpg`));
  status.textContent = `Sample photo loaded into slot ${slot + 1}.`;
}

// Photo slots: picker, plus drag-and-drop anywhere on the page.
[0, 1, 2].forEach((slot) => {
  document.getElementById(`file${slot}`).addEventListener('change', (e) => {
    loadFileIntoSlot(slot, e.target.files[0]);
  });
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/'));
  files.forEach((file) => {
    const empty = state.photos.findIndex((p) => !p);
    loadFileIntoSlot(empty === -1 ? 0 : empty, file);
  });
});

// Panels: which photo each shows, and its zoom slider.
[0, 1, 2].forEach((i) => {
  document.getElementById(`panel${i}photo`).addEventListener('change', (e) => {
    state.panels[i].photo = Number(e.target.value);
    redraw();
  });
  document.getElementById(`zoom${i}`).addEventListener('input', (e) => {
    state.panels[i].zoom = Number(e.target.value);
    redraw();
  });
  document.querySelector(`.panel-row[data-panel="${i}"]`).addEventListener('click', () => {
    activePanel = i;
    refreshPanelRows();
  });
});

// Drag on the preview pans the photo of the panel under the pointer.
let drag = null;
function panelAt(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const x = ((clientX - r.left) / r.width) * state.size.w;
  const y = ((clientY - r.top) / r.height) * state.size.h;
  return { x, y, rect: r };
}
canvas.addEventListener('pointerdown', (e) => {
  const { x, y } = panelAt(e.clientX, e.clientY);
  drag = { startX: x, startY: y, panel: panelIndexAt(x, y) };
  activePanel = drag.panel;
  refreshPanelRows();
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const { x, y } = panelAt(e.clientX, e.clientY);
  const p = state.panels[drag.panel];
  const rect = panelRect(drag.panel);
  p.dx += (x - drag.startX) / rect.w;
  p.dy += (y - drag.startY) / rect.h;
  p.dx = Math.max(-0.6, Math.min(0.6, p.dx));
  p.dy = Math.max(-0.6, Math.min(0.6, p.dy));
  drag.startX = x;
  drag.startY = y;
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });

function panelRect(i) {
  const { w, h } = state.size;
  const aspect = w / h;
  if (aspect > 1.4) {
    const titleH = Math.round(h * 0.19);
    const bodyH = h - titleH;
    const heroW = Math.round(w * 0.645);
    return [
      { x: 0, y: 0, w: heroW, h: bodyH },
      { x: heroW, y: 0, w: w - heroW, h: Math.round(bodyH / 2) },
      { x: heroW, y: Math.round(bodyH / 2), w: w - heroW, h: bodyH - Math.round(bodyH / 2) },
    ][i];
  }
  const titleH = Math.round(h * (aspect < 0.85 ? 0.17 : 0.19));
  const bodyH = h - titleH;
  const heroH = Math.round(bodyH * (aspect < 0.85 ? 0.62 : 0.68));
  return [
    { x: 0, y: 0, w, h: heroH },
    { x: 0, y: heroH, w: Math.round(w / 2), h: bodyH - heroH },
    { x: Math.round(w / 2), y: heroH, w: w - Math.round(w / 2), h: bodyH - heroH },
  ][i];
}

function panelIndexAt(x, y) {
  for (let i = 2; i >= 0; i--) {
    const r = panelRect(i);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return 0;
}

// Words.
document.getElementById('title').addEventListener('input', (e) => {
  state.title = e.target.value;
  redraw();
});
document.getElementById('caption').addEventListener('input', (e) => {
  state.caption = e.target.value;
  redraw();
});

// Grade presets.
document.querySelectorAll('.preset').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.preset = btn.dataset.preset;
    document.querySelectorAll('.preset').forEach((b) => b.classList.toggle('is-active', b === btn));
    redraw();
  });
});

// Export sizes.
document.querySelectorAll('.size').forEach((btn) => {
  btn.addEventListener('click', () => {
    const [w, h] = btn.dataset.size.split('x').map(Number);
    state.size = { w, h };
    document.querySelectorAll('.size').forEach((b) => b.classList.toggle('is-active', b === btn));
    redraw();
  });
});

// Sample photos.
document.getElementById('sample-pier').addEventListener('click', () => loadSample('pier', 0));
document.getElementById('sample-boulevard').addEventListener('click', () => loadSample('boulevard', 1));

// One-click PNG export at the chosen size.
document.getElementById('export').addEventListener('click', () => {
  const out = renderCoverArt(state.size.w, state.size.h, state);
  out.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sunset-drive-${state.size.w}x${state.size.h}.png`;
    a.click();
    status.textContent = `Saved sunset-drive-${state.size.w}x${state.size.h}.png`;
  }, 'image/png');
});

// Re-draw once the display font arrives, so the title uses Anton.
if (document.fonts?.ready) {
  document.fonts.load('80px Anton').catch(() => {}).finally(() => redraw());
  document.fonts.ready.then(() => redraw());
}

// Fixed scenes for screenshots.
const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), {
    loadSample: async (name) => loadImage(`samples/${name}.jpg`),
    applyShot: async (photo, title, caption, size, dy) => {
      if (photo) setPhoto(0, photo);
      if (typeof dy === 'number' && dy) state.panels.forEach((p) => { p.dy = dy; });
      if (title !== null) {
        state.title = title;
        document.getElementById('title').value = title;
      }
      if (caption !== null) {
        state.caption = caption;
        document.getElementById('caption').value = caption;
      }
      if (size) {
        state.size = size;
        document.querySelectorAll('.size').forEach((b) => {
          b.classList.toggle('is-active', b.dataset.size === `${size.w}x${size.h}`);
        });
      }
      redraw();
    },
  });
} else {
  redraw();
}
refreshPanelRows();

// Fixed scenes for screenshots: ?shot=editor shows the editor with a sample photo
// loaded; ?shot=cover shows the finished cover alone, full-bleed. `photo` picks the
// sample (samples/<photo>.jpg), `caption` the title words, `size` the export size.
// window.__shotReady is set once the cover is painted.

/** Parses a size like "1080x1350" into { w, h }, or null when it is not one. */
export function parseShotSize(raw) {
  if (!raw) return null;
  const m = /^(\d+)x(\d+)$/.exec(raw.trim());
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (![1080, 1920].includes(w) || ![1080, 1350].includes(h)) return null;
  return { w, h };
}

export async function runShot(shot, query, api) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const photo = await api.loadSample(query.get('photo') ?? 'pier');
  const title = query.get('caption') ?? 'Sunset Drive';
  const caption = shot === 'cover' ? 'Cruise the neon coast' : null;
  const dy = Math.max(-0.6, Math.min(0.6, Number(query.get('dy') ?? '0') || 0));
  await api.applyShot(photo, title, caption, parseShotSize(query.get('size')), dy);
  if (document.fonts?.ready) {
    await document.fonts.load('80px Anton').catch(() => {});
    await document.fonts.ready;
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}

// A canvas "stage": the drawing area of a canvas widget.
// Space is reserved with CSS aspect-ratio before anything loads, so the page
// never jumps. Sharp on HiDPI screens (device pixel ratio capped at 2).
// Draw in CSS pixels: stage.w, stage.h; the transform is set for you.
import { el } from './core.js';

export function createStage(parent, { aspect = '16 / 9', phoneAspect = '1 / 1', label = '' } = {}) {
  const box = el('div', { className: 'ul-stage' }, parent);
  box.style.setProperty('--ul-aspect', aspect);
  box.style.setProperty('--ul-aspect-phone', phoneAspect);
  const canvas = el('canvas', {}, box);
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  if (label) canvas.setAttribute('aria-label', label);
  const ctx = canvas.getContext('2d');
  const stage = {
    box, canvas, ctx, w: 0, h: 0,
    // Call from the widget's resize(); returns true if the size changed.
    fit() {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      if (W === canvas.width && H === canvas.height && stage.w) return false;
      canvas.width = W; canvas.height = H; stage.w = r.width; stage.h = r.height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    },
    clear() { ctx.clearRect(0, 0, stage.w, stage.h); },
  };
  return stage;
}

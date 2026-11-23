// Find the Symmetries: drawing, shared by the widget and its poster. Canvas 2D, CSS pixels.
import { SHAPES, ORDER, place } from './model.js';

const rad = (d) => d * Math.PI / 180;
const alpha = (hex, a) => { const n = parseInt(hex.replace('#', '').slice(0, 6), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };

// The shape's outline as a path in unit coordinates (the caller has set the transform).
export function shapePath(ctx, name, fill, stroke) {
  for (const p of SHAPES[name].parts) {
    ctx.beginPath();
    if (p.type === 'circle') ctx.arc(p.c[0], p.c[1], p.r, 0, 2 * Math.PI);
    else if (p.type === 'leaf') { const [a, b, c, d] = p.pts; ctx.moveTo(...a); ctx.quadraticCurveTo(...b, ...c); ctx.quadraticCurveTo(...d, ...a); }
    else { p.pts.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](...q)); if (p.type === 'poly') ctx.closePath(); }
    if (fill && p.type !== 'line') ctx.fill();
    if (stroke) ctx.stroke();
  }
}

// The shape after a move, with its tracking numbers drawn upright. squash (−1…1) animates a flip.
export function drawFigure(ctx, c, name, cx, cy, U, theta, flipped, { squash = 1, stroke = c.ink, lw = c.line, markPx = 12 } = {}) {
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(squash, 1); ctx.rotate(rad(theta)); if (flipped) ctx.scale(-1, 1); ctx.scale(U, U);
  ctx.lineWidth = lw / U; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = alpha(c.ink, 0.07); ctx.strokeStyle = stroke;
  shapePath(ctx, name, true, true);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = c.grey; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `600 ${markPx}px "Source Sans 3", system-ui, sans-serif`;
  for (const [t, x, y] of SHAPES[name].marks) { const [px, py] = place(x, y, theta, flipped); ctx.fillText(t, cx + px * squash * U, cy + py * U); }
  ctx.restore();
}

// Where the shape started: a dashed outline.
export function drawGhost(ctx, c, name, cx, cy, U) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(U, U);
  ctx.setLineDash([5 / U, 5 / U]); ctx.lineWidth = c.line * 0.8 / U; ctx.strokeStyle = c.ghost;
  shapePath(ctx, name, false, true); ctx.restore();
}

// The ring of results: outer ring = turned, inner ring = flipped; a tick for each result found.
export function drawDial(ctx, c, cx, cy, rOut, rIn, found, { solidOut = false, solidIn = false } = {}) {
  ctx.save(); ctx.lineCap = 'round';
  for (const [r, solid] of [[rOut, solidOut], [rIn, solidIn]]) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.strokeStyle = solid ? c.ink : c.rule; ctx.lineWidth = solid ? c.line * 1.4 : c.line * 0.7; ctx.stroke();
  }
  const tl = Math.max(4, c.line * 3);
  ctx.strokeStyle = c.ink; ctx.lineWidth = c.line * 1.2;
  for (const f of found) {
    const r = f.flipped ? rIn : rOut, a = rad(f.angle), ux = Math.sin(a), uy = -Math.cos(a);
    ctx.beginPath(); ctx.moveTo(cx + ux * (r - tl), cy + uy * (r - tl)); ctx.lineTo(cx + ux * (r + tl), cy + uy * (r + tl)); ctx.stroke();
  }
  ctx.restore();
}

export function drawRingNames(ctx, c, cx, cy, rOut, rIn, S, words) {
  const fs = Math.max(12, S / 36), la = rad(-128);
  ctx.save(); ctx.font = `italic ${fs}px "EB Garamond", serif`; ctx.fillStyle = c.grey; ctx.textBaseline = 'middle';
  ctx.textAlign = 'right'; ctx.fillText(words.turned, cx + (rOut + 6) * Math.cos(la), cy + (rOut + 6) * Math.sin(la));
  ctx.textAlign = 'left'; ctx.fillText(words.flipped, cx + (rIn - 8) * Math.cos(la) + 4, cy + (rIn - 8) * Math.sin(la) + fs * 0.6);
  ctx.restore();
}

export function drawPointer(ctx, c, cx, cy, r, theta, S) {
  const a = rad(theta);
  ctx.beginPath(); ctx.arc(cx + Math.sin(a) * r, cy - Math.cos(a) * r, Math.max(4, S / 90), 0, 2 * Math.PI);
  ctx.fillStyle = c.accent; ctx.fill();
}

export function drawHint(ctx, c, cx, cy, S, text) {
  const r = S * 0.37, a0 = rad(-70), a1 = rad(-20), h = S / 40;
  ctx.save(); ctx.strokeStyle = c.accent; ctx.fillStyle = c.accent; ctx.lineWidth = c.line; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
  const ex = cx + r * Math.cos(a1), ey = cy + r * Math.sin(a1), tx = -Math.sin(a1), ty = Math.cos(a1);
  ctx.beginPath(); ctx.moveTo(ex + tx * h, ey + ty * h); ctx.lineTo(ex - ty * h * 0.6, ey + tx * h * 0.6); ctx.lineTo(ex + ty * h * 0.6, ey - tx * h * 0.6); ctx.closePath(); ctx.fill();
  ctx.font = `italic ${Math.max(14, S / 30)}px "EB Garamond", serif`; ctx.textAlign = 'left';
  ctx.fillText(text, cx + r * Math.cos(rad(-45)) + 10, cy + r * Math.sin(rad(-45)) - 10);
  ctx.restore();
}

// The last screen: all three shapes, their rings, their counts; "in jumps" vs "continuous".
export function drawCompare(ctx, c, w, h, words) {
  const col = w / 3, S = Math.min(col, h * 0.62), cy = h * 0.40, rOut = S * 0.42, rIn = S * 0.36, U = S * 0.24;
  const tri = [0, 120, 240].flatMap((a) => [{ angle: a, flipped: false }, { angle: a, flipped: true }]);
  const sets = [
    { name: 'flower', found: [{ angle: 0, flipped: false }, { angle: 0, flipped: true }], solid: false, n: '2' },
    { name: 'triangle', found: tri, solid: false, n: '6' },
    { name: 'circle', found: [], solid: true, n: '∞' },
  ];
  sets.forEach((s, i) => {
    const cx = col * i + col / 2;
    drawDial(ctx, c, cx, cy, rOut, rIn, s.found, { solidOut: s.solid, solidIn: s.solid });
    drawFigure(ctx, c, s.name, cx, cy, U, 0, false, { markPx: Math.max(9, S / 22) });
    ctx.save(); ctx.fillStyle = c.ink; ctx.textAlign = 'center'; ctx.font = `${Math.max(22, S / 6)}px "EB Garamond", serif`;
    ctx.fillText(s.n, cx, cy + rOut + S * 0.28); ctx.restore();
  });
  const by = cy + rOut + S * 0.40;
  ctx.save(); ctx.strokeStyle = c.grey; ctx.fillStyle = c.ink; ctx.lineWidth = c.line * 0.7; ctx.textAlign = 'center';
  for (const [x0, x1] of [[col * 0.15, col * 1.85], [col * 2.15, col * 2.85]]) {
    ctx.beginPath(); ctx.moveTo(x0, by); ctx.lineTo(x0, by + 8); ctx.lineTo(x1, by + 8); ctx.lineTo(x1, by); ctx.stroke();
  }
  ctx.font = `italic ${Math.max(16, S / 9)}px "EB Garamond", serif`;
  ctx.fillText(words.jumps, col, by + 8 + Math.max(20, S / 7));
  ctx.fillText(words.continuous, col * 2.5, by + 8 + Math.max(20, S / 7));
  ctx.restore();
}
export { ORDER };

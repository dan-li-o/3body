// Drawing for The Pressure Gauge, shared by the widget and its poster.
// A box of gas: three fixed walls (left wall at the far left, top and bottom), the open end at the
// scale's zero; the accent piston slides in a short sleeve beyond it, held by a spring to a fixed post.
// The piston's position is the reading (push per molecule), on the same scale as the chart below.
import { SERIF } from '../core/strip.js';

const DRAWN_R = [2.6, 1.6];      // molecule radius: few, many

// s: { V, f (0..1 along the scale), g (the simulated molecules), N (all molecules), words }
export function drawChamber(ctx, c, w, h, s) {
  const left = 6, top = 24, bot = h - 6, post = w - 6, wall = s.V(0), pp = Math.max(wall, s.V(s.f));
  ctx.lineCap = 'round';
  // the box and the sleeve
  ctx.strokeStyle = c.rule; ctx.lineWidth = 1.75; ctx.beginPath();
  ctx.moveTo(wall, top); ctx.lineTo(left, top); ctx.lineTo(left, bot); ctx.lineTo(wall, bot); ctx.stroke();
  const sleeve = Math.min(post - 30, s.V(1) + 12);
  ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(wall, top); ctx.lineTo(sleeve, top); ctx.moveTo(wall, bot); ctx.lineTo(sleeve, bot); ctx.stroke();
  // the molecules fill the box up to the piston
  const g = s.g, sx = (pp - left - 4) / g.x0, sy = (bot - top) / g.H, r = g.n > 100 ? DRAWN_R[1] : DRAWN_R[0];
  ctx.fillStyle = c.ink;
  for (let i = 0; i < g.n; i++) { ctx.beginPath(); ctx.arc(left + 2 + Math.min(g.x[i], g.x0) * sx, bot - g.y[i] * sy, r, 0, 7); ctx.fill(); }
  // spring to the post
  const mid = (top + bot) / 2, n = 12, amp = 7; ctx.strokeStyle = c.grey; ctx.lineWidth = 1.25; ctx.beginPath(); ctx.moveTo(pp, mid);
  for (let i = 1; i <= n; i++) ctx.lineTo(pp + (post - pp) * i / (n + 1), mid + (i % 2 ? -amp : amp));
  ctx.lineTo(post, mid); ctx.stroke();
  ctx.strokeStyle = c.rule; ctx.lineWidth = 1.75; ctx.beginPath(); ctx.moveTo(post, mid - 26); ctx.lineTo(post, mid + 26); ctx.stroke();
  // the piston (accent)
  ctx.strokeStyle = c.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(pp, top + 2); ctx.lineTo(pp, bot - 2); ctx.stroke();
  // how many
  ctx.font = `italic 14px ${SERIF}`; ctx.fillStyle = c.grey; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const w2 = s.words;
  ctx.fillText(s.N > g.n ? `${s.N.toLocaleString('en')} ${w2.molecules} (${g.n} ${w2.drawn})` : s.N ? `${s.N} ${s.N === 1 ? w2.molecule : w2.molecules}` : w2.empty, left, 15);
  return { x: pp, y: bot };
}

// Wu's cobalt: the instrument, drawn on canvas; shared by the widget and its poster.
// Grammar of Ch1 §5 (core/strip.js): an instrument on top whose accent part slides along a
// value scale, and below it the record on the same scale. Here the instrument is a tray: two
// detector plates stand on the ends of the scale (left = 0, right = 1), the crystal sits
// between them, and the orange pointer on the scale is the share of electrons flying right.
//
// Each nucleus is a ball with a ring round it, like Saturn. The back of the ring passes behind
// the ball, and an arrowhead rides round the ring, so the ring is seen to turn. Untilted, the near
// side moves right: seen from above it turns counterclockwise, so the spin points up. The magnet
// tilts lined-up nuclei a quarter turn so the spin points left; reversed, right. CSS pixels.
export const COLS = 3, ROWS = 4;
const SANS = "'Source Sans 3', system-ui, sans-serif";
const SERIF = '"EB Garamond", Garamond, Georgia, serif';

// axis: valueAxis(w) from core/strip.js, so plates and pointer line up with the record below.
export function layout(w, h, axis) {
  const x0 = axis.V(0), x1 = axis.V(1), span = x1 - x0;
  const top = 30, scaleY = h - 30;                     // tallies above; the scale's numbers below
  const cw = span * 0.46, gx = cw / COLS, gy = (scaleY - top - 8) / ROWS;
  const r = Math.min(gx * 0.21, gy * 0.22);
  const cx0 = (x0 + x1) / 2 - cw / 2, cy0 = top + 4 + gy / 2;
  return { w, h, x0, x1, top, scaleY, gx, gy, r,
    sky: cx0 - x0 + gx * 0.5 - r * 1.4,                 // from the outer column's ball to its plate
    at: (c, k) => ({ x: cx0 + (c + 0.5) * gx, y: cy0 + k * gy }) };
}

// o: { nuclei: [{x, y, tilt, phase}], shots: [{x, y, d, l, mine, counted}], flashes: [{side, y, t}],
//      pulses: [{x, y}], pops: [{x, y, t}], left, right, pointer (0..1 or null), clock: text|null,
//      frozen: bool }
export function drawInstrument(ctx, c, L, o) {
  const lw = c.line, { r } = L;
  // the tray: two plates standing on the scale
  ctx.strokeStyle = c.ink; ctx.lineCap = 'butt';
  ctx.lineWidth = lw * 1.6;
  ctx.beginPath(); ctx.moveTo(L.x0, L.top); ctx.lineTo(L.x0, L.scaleY); ctx.lineTo(L.x1, L.scaleY); ctx.lineTo(L.x1, L.top); ctx.stroke();
  ctx.font = `italic 15px ${SERIF}`; ctx.fillStyle = c.grey; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.strokeStyle = c.grey; ctx.lineWidth = 1.25;
  for (const [f, t] of [[0, '0'], [0.5, '½'], [1, '1']]) {
    const x = L.x0 + f * (L.x1 - L.x0);
    ctx.beginPath(); ctx.moveTo(x, L.scaleY); ctx.lineTo(x, L.scaleY + 5); ctx.stroke();
    ctx.fillText(t, x, L.scaleY + 21);
  }
  // a hit lights the plate briefly where it lands
  for (const f of o.flashes) {
    const x = f.side > 0 ? L.x1 : L.x0, a = Math.max(0, 1 - f.t / 0.3);
    ctx.strokeStyle = c.accent; ctx.globalAlpha = a; ctx.lineWidth = lw * 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, f.y - L.gy * 0.28); ctx.lineTo(x, f.y + L.gy * 0.28); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // nuclei
  for (const n of o.nuclei) drawNucleus(ctx, c, n.x, n.y, r, n.tilt, n.phase);
  // electrons, over the nuclei: a short streak and a dot at the head
  for (const s of o.shots) {
    const tail = Math.min(s.l - r, r * 3), hx = s.x + s.d * s.l;
    const col = o.frozen ? c.ghost : s.mine ? c.accent : c.grey;
    ctx.strokeStyle = ctx.fillStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx - s.d * Math.max(0, tail), s.y); ctx.lineTo(hx, s.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(hx, s.y, lw * 1.7, 0, 2 * Math.PI); ctx.fill();
  }
  // a catch: a ring that opens and fades
  for (const q of o.pops) {
    ctx.strokeStyle = c.accent; ctx.lineWidth = lw * 0.8; ctx.globalAlpha = Math.max(0, 1 - q.t / 0.5);
    ctx.beginPath(); ctx.arc(q.x, q.y, r * (0.5 + q.t * 3), 0, 2 * Math.PI); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // pulses running down a plate and along the scale to the pointer
  ctx.fillStyle = c.accent;
  for (const p of o.pulses) { ctx.beginPath(); ctx.arc(p.x, p.y, lw * 1.6, 0, 2 * Math.PI); ctx.fill(); }
  // the pointer: the share flying right
  if (o.pointer != null) {
    const x = L.x0 + o.pointer * (L.x1 - L.x0), y = L.scaleY + 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 11); ctx.lineTo(x + 7, y + 11); ctx.closePath(); ctx.fill();
  }
  // tallies at the plates; the cold clock between them
  ctx.textBaseline = 'middle'; ctx.fillStyle = c.accent; ctx.font = `600 16px ${SANS}`;
  ctx.textAlign = 'left'; ctx.fillText(`← ${o.left}`, L.x0 - 2, L.top / 2);
  ctx.textAlign = 'right'; ctx.fillText(`${o.right} →`, L.x1 + 2, L.top / 2);
  if (o.clock) { ctx.textAlign = 'center'; ctx.fillStyle = c.grey; ctx.font = `400 13px ${SANS}`; ctx.fillText(o.clock, (L.x0 + L.x1) / 2, L.top / 2); }
  ctx.textBaseline = 'alphabetic';
}

// One nucleus. tilt: the angle of the ring's long axis (0 = lying flat, spin pointing up);
// phase: where the arrowhead is on the ring (radians), decreasing as it turns.
export function drawNucleus(ctx, c, x, y, r, tilt, phase) {
  const rx = r * 1.8, ry = r * 0.55, lw = c.line, ph = ((phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const front = ph < Math.PI;   // the lower half of the ring (in its own frame) is the near side
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.strokeStyle = c.grey; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, Math.PI, 2 * Math.PI); ctx.stroke();
  if (!front) arrow(ctx, c.grey, rx, ry, ph, r);
  ctx.fillStyle = c.paper; ctx.strokeStyle = c.ink;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI); ctx.stroke();
  if (front) arrow(ctx, c.ink, rx, ry, ph, r);
  ctx.restore();
}
function arrow(ctx, col, rx, ry, th, r) {   // heading toward smaller angles
  const px = rx * Math.cos(th), py = ry * Math.sin(th);
  const tx = rx * Math.sin(th), ty = -ry * Math.cos(th), tn = Math.hypot(tx, ty) || 1, ux = tx / tn, uy = ty / tn;
  const a = Math.max(4, r * 0.5);
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(px + ux * a * 0.6, py + uy * a * 0.6);
  ctx.lineTo(px - ux * a * 0.6 - uy * a * 0.5, py - uy * a * 0.6 + ux * a * 0.5);
  ctx.lineTo(px - ux * a * 0.6 + uy * a * 0.5, py - uy * a * 0.6 - ux * a * 0.5);
  ctx.closePath(); ctx.fill();
}

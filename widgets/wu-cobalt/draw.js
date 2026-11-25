// Wu's cobalt: drawing, shared by the widget and its poster. Canvas 2D, CSS pixels.
// Each nucleus is a small ball with a ring round it, like Saturn: the back of the ring passes
// behind the ball, the front in front, and an arrowhead on the front shows which way it spins.
// Untilted, the front moves right: seen from above it turns counterclockwise, so the spin points up
// (the prose: "Look down on it from above, and it turns counterclockwise"). The count of electrons
// that reach the top and the bottom is written there, on the figure.
export const COLS = 6, ROWS = 3;
const SANS = "'Source Sans 3', system-ui, sans-serif";

export function layout(w, h) {
  // The crystal sits in a compact block in the middle; the open sky above and below is where
  // the electrons fly, and where the reader catches them.
  const band = Math.max(28, h * 0.1), top = band, bot = h - band;
  const gx = w / (COLS + 1), gy = Math.min(gx * 0.9, (bot - top) / 5.5);
  const r = Math.min(gx * 0.2, gy * 0.3), cy = h / 2;
  const crystalTop = cy - gy * (ROWS - 1) / 2 - r * 1.2;
  return { w, h, band, top, bot, gx, gy, r, sky: crystalTop - top,
    at: (c, k) => ({ x: (c + 1) * gx, y: cy + (k - (ROWS - 1) / 2) * gy }) };
}

// o: { nuclei: [{x, y, tilt}], shots: [{x, y, d, l, mine, counted}], pops: [{x, y, t}],
//      up, down, clock: text|null, frozen: bool }
export function drawCobalt(ctx, c, L, o) {
  const { r } = L, lw = c.line, rx = r * 1.8, ry = r * 0.55;
  // nuclei
  for (const n of o.nuclei) {
    ctx.save(); ctx.translate(n.x, n.y); ctx.rotate(n.tilt);
    ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.strokeStyle = c.grey;                         // back of the ring (behind the ball)
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, Math.PI, 2 * Math.PI); ctx.stroke();
    ctx.fillStyle = c.paper; ctx.strokeStyle = c.ink; // the ball
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI); ctx.stroke();   // front of the ring
    // arrowhead on the front, heading right (toward smaller angles on the lower half)
    const th = 0.75, px = rx * Math.cos(th), py = ry * Math.sin(th);
    const tx = rx * Math.sin(th), ty = -ry * Math.cos(th), tn = Math.hypot(tx, ty), ux = tx / tn, uy = ty / tn;
    const a = Math.max(4, r * 0.45);
    ctx.fillStyle = c.ink; ctx.beginPath();
    ctx.moveTo(px + ux * a * 0.6, py + uy * a * 0.6);
    ctx.lineTo(px - ux * a * 0.6 - uy * a * 0.5, py - uy * a * 0.6 + ux * a * 0.5);
    ctx.lineTo(px - ux * a * 0.6 + uy * a * 0.5, py - uy * a * 0.6 - ux * a * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // electrons, over the nuclei: a short streak and a dot at the head
  for (const s of o.shots) {
    const tail = Math.min(s.l - r, r * 3), hy = s.y + s.d * s.l;
    const col = o.frozen ? c.ghost : s.mine ? c.accent : s.counted ? c.ink : c.grey;
    ctx.strokeStyle = ctx.fillStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s.x, hy - s.d * Math.max(0, tail)); ctx.lineTo(s.x, hy); ctx.stroke();
    ctx.beginPath(); ctx.arc(s.x, hy, lw * 1.7, 0, 2 * Math.PI); ctx.fill();
  }
  // a catch: a ring that opens and fades
  for (const q of o.pops) {
    ctx.strokeStyle = c.accent; ctx.lineWidth = lw * 0.8; ctx.globalAlpha = Math.max(0, 1 - q.t / 0.5);
    ctx.beginPath(); ctx.arc(q.x, q.y, r * (0.5 + q.t * 3), 0, 2 * Math.PI); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // the counts, where the electrons arrive: the reader's tallies, in the accent
  const fs = Math.round(Math.max(15, Math.min(20, L.band * 0.45)));
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = c.accent;
  ctx.font = `600 ${fs}px ${SANS}`;
  ctx.fillText(`↑ ${o.up}`, L.w / 2, L.band / 2);
  ctx.fillText(`↓ ${o.down}`, L.w / 2, L.h - L.band / 2);
  if (o.clock) {
    ctx.textAlign = 'right'; ctx.fillStyle = c.grey; ctx.font = `400 ${Math.round(fs * 0.8)}px ${SANS}`;
    ctx.fillText(o.clock, L.w - 4, L.band / 2);
  }
}


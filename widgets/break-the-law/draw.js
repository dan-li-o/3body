// Drawing for Try to Break the Law, shared by the widget and its poster.
// The table is four grey cushion lines (no panel); one ink ball with a fading trail, as on the Welcome page.
// Felt leaves a faint permanent track; soft cushions dent where the ball lost energy.
// The energy column: motion (ink), felt and cushions (ghost), one accent mark for the total.
// Wide stages: the column stands to the right of the table. Phone stages: a bar under the table,
// labelled in one row below with leader lines.
import { SERIF } from '../core/strip.js';

export const TABLE = { W: 2, H: 1, R: 0.032 };
export const TRAIL_LIFE = 1.6;     // seconds a trail point takes to fade
const COL = 120, PAD = 10, BAR = 74;

// Where everything goes on a stage of w × h (CSS px). Phone stages are taller than 2 : 1.
export function layout(w, h) {
  const narrow = w / h < 2, colW = narrow ? 0 : COL, extra = narrow ? BAR : 0;
  const s = Math.max(1, Math.min((w - colW - 2 * PAD) / TABLE.W, (h - 2 * PAD - 8 - extra) / TABLE.H));
  const tw = TABLE.W * s, th = TABLE.H * s;
  const y0 = Math.max(0, (h - (th + 2 * PAD + 8 + extra)) / 2);
  const ox = Math.max(PAD, (w - colW - tw) / 2), oy = y0 + PAD + 8;
  return { narrow, s, ox, oy, tw, th, w, h, colX: w - colW + 68, top: y0 + PAD + 22, bot: oy + th,
    barY: oy + th + 30, barL: PAD + 56, barR: w - PAD - 48 };
}
export const toScreen = (L, x, y) => [L.ox + x * L.s, L.oy + y * L.s];
export const ballRadius = (L, c) => Math.max(c.bob, TABLE.R * L.s);

// s: { L, ball, trail [x,y,t…], clock, scars [x0,y0,x1,y1…], dents [{side,s,amt}], warmF, warmC,
//      scale, showTotal, aim: { tip: [x,y] (world), preview (total after the push) } | null, words }
export function drawTable(ctx, c, s) {
  const { L } = s, line = c.line;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // felt marks: permanent and faint; overlapping passes darken (friction takes the same energy per distance)
  if (s.scars.length) {
    ctx.save(); ctx.strokeStyle = c.ghost; ctx.lineWidth = line; ctx.globalAlpha = 0.35;
    for (let i = 0; i < s.scars.length; i += 4) {
      const [a, b] = toScreen(L, s.scars[i], s.scars[i + 1]), [p, q] = toScreen(L, s.scars[i + 2], s.scars[i + 3]);
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(p, q); ctx.stroke();
    }
    ctx.restore();
  }
  // cushions: four lines, dented where energy was lost
  ctx.strokeStyle = c.grey; ctx.lineWidth = line;
  const { W, H } = TABLE;
  cushion(ctx, L, s.dents, 'y0', W, (u, o) => [u, -o]);
  cushion(ctx, L, s.dents, 'y1', W, (u, o) => [u, H + o]);
  cushion(ctx, L, s.dents, 'x0', H, (u, o) => [-o, u]);
  cushion(ctx, L, s.dents, 'x1', H, (u, o) => [W + o, u]);
  // the fading trail
  const tr = s.trail;
  ctx.save(); ctx.strokeStyle = c.grey; ctx.lineWidth = line;
  for (let k = 3; k < tr.length; k += 3) {
    const fade = Math.max(0, 1 - (s.clock - tr[k + 2]) / TRAIL_LIFE); ctx.globalAlpha = c.trail * fade * fade;
    const [a, b] = toScreen(L, tr[k - 3], tr[k - 2]), [p, q] = toScreen(L, tr[k], tr[k + 1]);
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(p, q); ctx.stroke();
  }
  ctx.restore();
  // the ball, and the aiming arrow
  const [x, y] = toScreen(L, s.ball.x, s.ball.y);
  if (s.aim) { const [ex, ey] = toScreen(L, ...s.aim.tip); arrow(ctx, x, y, ex, ey, c.grey, line); }
  ctx.fillStyle = c.ink; ctx.beginPath(); ctx.arc(x, y, ballRadius(L, c), 0, 7); ctx.fill();
  drawColumn(ctx, c, s);
}

function drawColumn(ctx, c, s) {
  const { L, words } = s, V = !L.narrow, k = 0.5 * (s.ball.vx ** 2 + s.ball.vy ** 2), tot = k + s.warmF + s.warmC;
  const P = V ? (v) => L.bot - v / s.scale * (L.bot - L.top) : (v) => L.barL + v / s.scale * (L.barR - L.barL);
  const seg = (a, b) => (V ? [[L.colX, a], [L.colX, b]] : [[a, L.barY], [b, L.barY]]);
  const stroke = ([p0, p1]) => { ctx.beginPath(); ctx.moveTo(...p0); ctx.lineTo(...p1); ctx.stroke(); };
  ctx.strokeStyle = c.rule; ctx.lineWidth = 1; stroke(V ? seg(L.top, L.bot) : seg(L.barL, L.barR));
  ctx.font = `italic 15px ${SERIF}`; ctx.textBaseline = 'middle'; ctx.lineCap = 'butt';
  const gap = 2, labels = [];
  let base = 0;
  for (const [v, col, lab] of [[k, c.ink, words.motion], [s.warmF, c.ghost, words.felt], [s.warmC, c.ghost, words.cushions]]) {
    if (v <= 1e-6) continue;
    const a = P(base), b = P(base + v), dir = V ? -1 : 1;
    ctx.strokeStyle = col; ctx.lineWidth = 7; stroke(seg(a + dir * (base > 0 ? gap / 2 : 0), b - dir * gap / 2));
    if (V) { if (Math.abs(b - a) > 16) { ctx.fillStyle = c.grey; ctx.textAlign = 'right'; ctx.fillText(lab, L.colX - 12, (a + b) / 2); } }
    else labels.push({ lab, mid: (a + b) / 2 });
    base += v;
  }
  if (!V) leaderLabels(ctx, c, L, labels);
  const tick = (p, w) => stroke(V ? [[L.colX - w, p], [L.colX + w, p]] : [[p, L.barY - w], [p, L.barY + w]]);
  if (s.aim) {   // a dashed mark previews the total after this push
    ctx.save(); ctx.strokeStyle = c.accent; ctx.globalAlpha = 0.45; ctx.lineWidth = c.line; ctx.setLineDash([3, 3]);
    tick(P(s.aim.preview), 10); ctx.restore();
  }
  if (s.showTotal) {
    const p = P(tot); ctx.strokeStyle = c.accent; ctx.lineWidth = 2.5; tick(p, 10);
    ctx.fillStyle = c.accent; ctx.textAlign = 'left';
    if (V) ctx.fillText(words.total, L.colX + 15, p); else ctx.fillText(words.total, p + 6, L.barY - 15);
  }
  if (!V) { ctx.fillStyle = c.grey; ctx.textAlign = 'left'; ctx.fillText(words.energy, L.ox, L.barY); }
}

// Phone labels: one row under the bar, spread apart, each with a thin leader line to its part.
function leaderLabels(ctx, c, L, labels) {
  const y = L.barY + 26, pad = 10;
  let x = -1e9;
  const pos = labels.map((h) => { const w = ctx.measureText(h.lab).width, cx = Math.max(h.mid, x + w / 2 + pad); x = cx + w / 2; return { ...h, cx }; });
  const over = x - (L.w - 6); if (over > 0) pos.forEach((p) => { p.cx -= over; });
  for (const p of pos) {
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.mid, L.barY + 5); ctx.lineTo(p.cx, y - 9); ctx.stroke();
    ctx.fillStyle = c.grey; ctx.textAlign = 'center'; ctx.fillText(p.lab, p.cx, y);
  }
}

// A cushion line, pushed outward by a smooth dent wherever the ball lost energy (deeper for more).
function cushion(ctx, L, dents, side, len, at) {
  const sig = 0.018, n = Math.max(40, Math.round(len * L.s / 2)), ds = dents.filter((d) => d.side === side);
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const u = len * i / n;
    let o = 0;
    for (const d of ds) o += Math.min(0.018, 0.014 * Math.sqrt(d.amt)) * Math.exp(-((u - d.s) ** 2) / (2 * sig * sig));
    const [px, py] = toScreen(L, ...at(u, o + TABLE.R * 0.35));
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.stroke();
}

function arrow(ctx, x0, y0, x1, y1, col, line) {
  const dx = x1 - x0, dy = y1 - y0; if (Math.hypot(dx, dy) < 8) return;
  const g = Math.atan2(dy, dx), h = 9;
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = line; ctx.globalAlpha = 0.6; ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  ctx.moveTo(x1, y1); ctx.lineTo(x1 - h * Math.cos(g - 0.45), y1 - h * Math.sin(g - 0.45));
  ctx.moveTo(x1, y1); ctx.lineTo(x1 - h * Math.cos(g + 0.45), y1 - h * Math.sin(g + 0.45));
  ctx.stroke(); ctx.restore();
}

// A dent where the ball hit, deeper for more energy lost; nearby hits deepen the same dent.
export function addDent(dents, ev) {
  const s = ev.side[0] === 'x' ? ev.y : ev.x;
  const near = dents.find((d) => d.side === ev.side && Math.abs(d.s - s) < 0.03);
  if (near) near.amt += ev.amt; else dents.push({ side: ev.side, s, amt: ev.amt });
}

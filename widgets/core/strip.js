// The strip chart shared by Ch1's §5 widgets (The Lawful Coin, The Pressure Gauge).
//
// Grammar (widgets/design.md): an instrument on top whose accent part slides
// left and right; below it a chart on the SAME horizontal scale. The value
// runs left to right, the count runs downward, and the pen draws the record
// like a chart recorder: wild at the top, steady below.
//
// Values are passed normalised: 0 at the left end of the scale, 1 at the right.
// Pure drawing on a 2D canvas context; no DOM, no state except Zoom.

export const SERIF = '"EB Garamond", Garamond, Georgia, serif';

// The shared horizontal scale. Same numbers for the instrument and the chart,
// so their marks line up exactly (both stages are the same width).
export function valueAxis(width, { left = 0.14, right = 0.83 } = {}) {
  const v0 = Math.round(width * left), v1 = Math.round(width * right);
  return { v0, v1, V: (f) => v0 + Math.max(0, Math.min(1, f)) * (v1 - v0) };
}

// The count axis grows in steps (10 → 100 → 1,000 …) and eases between them.
export class Zoom {
  constructor(steps, seconds = 0.8) { this.steps = steps; this.seconds = seconds; this.reset(); }
  reset() { this.x = this.to = this.from = this.steps[0]; this.t = 1; }
  need(n, instant = false) {
    const to = this.steps.find((v) => v >= n) ?? this.steps[this.steps.length - 1];
    if (to > this.to) { this.from = this.x; this.to = to; this.t = instant ? 1 : 0; if (instant) this.x = to; }
  }
  step(dt) {
    if (this.t >= 1) return false;
    this.t = Math.min(1, this.t + dt / this.seconds);
    const e = this.t < 0.5 ? 2 * this.t * this.t : 1 - (-2 * this.t + 2) ** 2 / 2;
    this.x = this.from + (this.to - this.from) * e;
    return true;
  }
  get busy() { return this.t < 1; }
}

// Draw the chart.
//   axis      valueAxis(...)               xMax   count at the bottom of the chart
//   traces    [{ data: [n, f, n, f, …], alpha }]   earlier runs faint, the current one strong
//   pen       { n, f } or null             pointer  f or null (marker on the top edge)
//   mean      f of the ghost reference line
//   bands     (n) => ({ inner: [lo, hi], outer: [lo, hi] })  or null;  bandFade 0..1
//   valueName / countName / meanLabel      words for the axes
//   ticks     [[f, label], …] marks above the chart (for an instrument without its own scale)
export function drawStrip(ctx, c, w, h, o) {
  const { axis: { V }, xMax } = o, top = 26, bottom = h - 34;
  const Y = (n) => top + (n - 1) / Math.max(1, xMax - 1) * (bottom - top);
  const P = (n, f) => [V(f), Y(n)];

  // the expected range, revealed on request: shaded, with thin edges
  const ns = []; for (let i = 0; i <= 240; i++) ns.push(Math.max(1, xMax * (i / 240) ** 2));   // dense where bands change fast
  const edge = (k, e) => ns.map((n) => P(n, o.bands(n)[k][e]));
  if (o.bands && o.bandFade > 0) {
    for (const [k, a] of [['outer', 0.22], ['inner', 0.4]]) {
      ctx.fillStyle = c.ghost; ctx.globalAlpha = a * o.bandFade; ctx.beginPath();
      [...edge(k, 1), ...edge(k, 0).reverse()].forEach((q, i) => (i ? ctx.lineTo(...q) : ctx.moveTo(...q)));
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // axes: the value scale's zero line runs down the left; the reference line runs down the middle
  ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.beginPath();
  ctx.moveTo(V(0), top); ctx.lineTo(V(0), bottom); ctx.stroke();
  ctx.strokeStyle = c.ghost; ctx.lineWidth = 1.25; ctx.beginPath();
  ctx.moveTo(V(o.mean), top); ctx.lineTo(V(o.mean), bottom); ctx.stroke();

  ctx.font = `italic 15px ${SERIF}`; ctx.fillStyle = c.grey;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const lx = V(1) + 10;
  ctx.fillText('1', lx, top);
  ctx.fillText(Math.round(xMax / 2).toLocaleString('en'), lx, (top + bottom) / 2);
  ctx.fillText(Math.round(xMax).toLocaleString('en'), lx, bottom);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right'; ctx.fillText(o.countName, w - 2, bottom + 22); ctx.textAlign = 'left';
  ctx.fillText(`${o.valueName} →`, V(0), h - 6);
  if (o.meanLabel) { ctx.textAlign = 'center'; ctx.fillText(o.meanLabel, V(o.mean), top - 10); }
  if (o.ticks) { ctx.textAlign = 'center'; for (const [f, t] of o.ticks) ctx.fillText(t, V(f), top - 15); }

  // the record
  ctx.save(); ctx.beginPath(); ctx.rect(V(0) - 4, top - 2, V(1) - V(0) + 8, bottom - top + 4); ctx.clip();
  for (const tr of o.traces) {
    const d = tr.data; if (d.length < 4) continue;
    ctx.strokeStyle = c.accent; ctx.globalAlpha = tr.alpha; ctx.lineWidth = 1.25; ctx.lineJoin = 'round'; ctx.beginPath();
    for (let i = 0; i < d.length; i += 2) { const q = P(d[i], d[i + 1]); i ? ctx.lineTo(...q) : ctx.moveTo(...q); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (o.pen) { const [x, y] = P(o.pen.n, o.pen.f); ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.fill(); }
  ctx.restore();

  if (o.bands && o.bandFade > 0) {
    ctx.lineWidth = 1;
    for (const [k, col] of [['inner', c.grey], ['outer', c.ghost]]) for (const e of [0, 1]) {
      ctx.strokeStyle = col; ctx.beginPath(); edge(k, e).forEach((q, i) => (i ? ctx.lineTo(...q) : ctx.moveTo(...q))); ctx.stroke();
    }
  }
  // the pointer: on the chart's top edge, under the instrument's accent part
  if (o.pointer != null) {
    const x = V(o.pointer); ctx.fillStyle = c.accent; ctx.beginPath();
    ctx.moveTo(x, top - 1); ctx.lineTo(x - 4.5, top - 9); ctx.lineTo(x + 4.5, top - 9); ctx.closePath(); ctx.fill();
  }
}

// A faint dashed guide from the instrument's accent part down to the chart.
export function drawGuide(ctx, c, x, y0, y1) {
  ctx.save(); ctx.strokeStyle = c.accent; ctx.globalAlpha = 0.35; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
  ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); ctx.restore();
}

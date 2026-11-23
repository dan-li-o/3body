// The Groove: drawing, shared by the widget and its poster. Canvas 2D, CSS pixels.
import { TAU, radius, radiusTarget } from '../engines/groove.js';

const alpha = (hex, a) => { const n = parseInt(hex.replace('#', '').slice(0, 6), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
export const FADE = 0.9;   // seconds a slice stays: a bit less than a lap

// opts: { m (engine state), slices: [{t, a0, d}], tickTh, sweeping, hint: text|null, readout: text|null }
export function drawGroove(ctx, c, w, h, o) {
  const { m } = o, S = Math.min(w, h), R = S * 0.36, cx = w / 2, cy = h / 2, lw = c.line;
  const rr = (th) => R * radius(m, th);
  const rim = (a0, a1, start) => {
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * 40));
    for (let k = 0; k <= n; k++) { const th = a0 + (a1 - a0) * k / n, r = rr(th), x = cx + r * Math.cos(th), y = cy + r * Math.sin(th); (k || !start) ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  };
  // slices: equal times, so equal slices mean an unchanging pace around
  for (const s of o.slices) {
    const age = m.t - s.t; if (age > FADE) continue;
    const a = 1 - age / FADE;
    ctx.beginPath(); ctx.moveTo(cx, cy); rim(s.a0, s.a0 + s.d, false); ctx.closePath();
    ctx.fillStyle = alpha(c.ink, 0.07 * a); ctx.fill();
    ctx.strokeStyle = alpha(c.grey, 0.6 * a); ctx.lineWidth = 1; ctx.stroke();
  }
  // the slice being swept now: only its crust is in the accent
  if (o.sweeping) {
    ctx.beginPath(); ctx.moveTo(cx, cy); rim(o.tickTh, m.th, false); ctx.closePath();
    ctx.fillStyle = alpha(c.ink, 0.07); ctx.fill();
    ctx.strokeStyle = c.accent; ctx.lineWidth = lw * 1.8; ctx.lineCap = 'round';
    ctx.beginPath(); rim(o.tickTh, m.th, true); ctx.stroke();
  }
  // the perfect circle, dashed: the groove's shape if nothing spoils it
  ctx.setLineDash([4, 5]); ctx.strokeStyle = c.ghost; ctx.lineWidth = lw * 0.8;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  // the groove: two lines along its real shape; a bend waiting to be made is drawn dashed
  const groove = (shape, color, dash) => {
    ctx.strokeStyle = color; ctx.lineWidth = lw * 0.9; ctx.setLineDash(dash);
    for (const d of [-6, 6]) {
      ctx.beginPath();
      for (let k = 0; k <= 720; k++) { const th = k * TAU / 720, r = R * shape(th) + d, x = cx + r * Math.cos(th), y = cy + r * Math.sin(th); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  };
  groove((th) => radius(m, th), c.grey, []);
  const pending = m.bendTarget > 0.5 && (m.bend < 0.5 || m.at !== m.atTarget);
  if (pending) groove((th) => radiusTarget(m, th), alpha(c.grey, 0.6), [3, 4]);
  // first-time hint
  if (o.hint) {
    const r = R * 1.2 + S * 0.03, a0 = -2.25, a1 = -1.55, hh = S / 45;
    ctx.save(); ctx.strokeStyle = c.accent; ctx.fillStyle = c.accent; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
    const ex = cx + r * Math.cos(a1), ey = cy + r * Math.sin(a1), tx = -Math.sin(a1), ty = Math.cos(a1);
    ctx.beginPath(); ctx.moveTo(ex + tx * hh, ey + ty * hh); ctx.lineTo(ex - ty * hh * 0.6, ey + tx * hh * 0.6); ctx.lineTo(ex + ty * hh * 0.6, ey - tx * hh * 0.6); ctx.closePath(); ctx.fill();
    ctx.font = `italic ${Math.max(15, S / 28)}px "EB Garamond", serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(o.hint, ex + hh * 1.4, ey - hh * 0.2);
    ctx.restore();
  }
  if (o.readout) {
    ctx.save(); ctx.fillStyle = c.grey; ctx.textAlign = 'right';
    ctx.font = `${Math.max(13, S / 32)}px "Source Sans 3", system-ui, sans-serif`;
    ctx.fillText(o.readout, w - 4, h - 6); ctx.restore();
  }
  // centre and marble (a dashed ring invites the first flick)
  ctx.fillStyle = c.ink; ctx.beginPath(); ctx.arc(cx, cy, 2, 0, TAU); ctx.fill();
  const rm = rr(m.th), mx = cx + rm * Math.cos(m.th), my = cy + rm * Math.sin(m.th);
  ctx.beginPath(); ctx.arc(mx, my, Math.max(6, S / 52), 0, TAU); ctx.fill();
  if (o.invite) { ctx.setLineDash([2, 3]); ctx.strokeStyle = c.grey; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(mx, my, Math.max(13, S / 26), 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  return { R, cx, cy, mx, my };
}

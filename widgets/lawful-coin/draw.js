// Drawing for The Lawful Coin, shared by the widget and its poster.
// The balance: tails on the left end of a beam (0), heads on the right end (1);
// an accent fulcrum under the beam, sliding on a scale marked 0, ½, 1.
import { SERIF } from '../core/strip.js';

const TRI = 16;           // fulcrum height
const MANY = 60;          // above this, coins are drawn as a stack, not one by one

// s: { V, fx, target, N, heads, landed, air } — fx: fulcrum position (px); target: where it is going (px);
//    air: { k, age } coins spinning above the beam (age 0..1 of the spin), or null.
export function drawBalance(ctx, c, w, h, s) {
  const { V } = s, trackY = h - 26, beamY = trackY - TRI, half = (V(1) - V(0)) / 2;
  const tmax = 14 / half;                                            // a visible rock, never into the scale
  const theta = Math.max(-tmax, Math.min(tmax, (s.target - s.fx) / half * 1.6));
  const end = (x) => { const dx = x - s.fx; return [s.fx + dx * Math.cos(theta), beamY + dx * Math.sin(theta)]; };

  // scale
  ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(V(0) - 10, trackY); ctx.lineTo(V(1) + 10, trackY); ctx.stroke();
  ctx.font = `italic 14px ${SERIF}`; ctx.fillStyle = c.grey; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  for (const [v, t] of [[0, '0'], [0.5, '½'], [1, '1']]) {
    ctx.beginPath(); ctx.moveTo(V(v), trackY); ctx.lineTo(V(v), trackY + 5); ctx.stroke(); ctx.fillText(t, V(v), trackY + 19);
  }

  // beam
  const L0 = end(V(0)), L1 = end(V(1));
  ctx.strokeStyle = c.ink; ctx.lineWidth = 2.25; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(...L0); ctx.lineTo(...L1); ctx.stroke();

  // pans on the beam ends; coins (ghost grey) stack on them
  const panW = Math.min(72, (V(1) - V(0)) * 0.24), post = 10, maxPile = Math.max(30, beamY - post - 58);
  const pan = ([px, py0], count, label) => {
    const py = py0 - post;
    ctx.strokeStyle = c.ink; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px, py0); ctx.lineTo(px, py); ctx.moveTo(px - panW / 2, py); ctx.lineTo(px + panW / 2, py); ctx.stroke();
    let top = py;
    if (s.landed && s.N) {
      if (s.N <= MANY) {
        const per = Math.max(1, Math.floor((panW - 6) / 11)), rx = 4.6, ry = 2.1;
        for (let i = 0; i < count; i++) {
          const row = Math.floor(i / per), col = i % per, x = px - (per - 1) * 5.5 + col * 11, y = py - ry - 1 - row * 4.4;
          ctx.fillStyle = c.ghost; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
          ctx.strokeStyle = c.grey; ctx.lineWidth = 0.75; ctx.stroke(); top = Math.min(top, y - ry);
        }
      } else {                                                         // a stack, in proportion to the count
        const hh = Math.max(1, count / s.N * maxPile * 0.7), ww = panW - 14;
        ctx.fillStyle = c.ghost; ctx.globalAlpha = 0.3; ctx.fillRect(px - ww / 2, py - 1 - hh, ww, hh); ctx.globalAlpha = 1;
        ctx.strokeStyle = c.grey; ctx.lineWidth = 0.75; ctx.strokeRect(px - ww / 2, py - 1 - hh, ww, hh);
        ctx.globalAlpha = 0.35; for (let y = py - 6; y > py - hh; y -= 6) { ctx.beginPath(); ctx.moveTo(px - ww / 2, y); ctx.lineTo(px + ww / 2, y); ctx.stroke(); }
        ctx.globalAlpha = 1; top = py - 1 - hh;
      }
    }
    ctx.fillStyle = c.grey; ctx.textAlign = 'center';
    ctx.fillText(s.landed && s.N ? `${label} ${count.toLocaleString('en')}` : label, px, top - 8);
  };
  pan(L0, s.N - s.heads, s.words.tails); pan(L1, s.heads, s.words.heads);

  // coins in the air: they spin above the beam before dropping into their pans
  if (s.air) {
    const { k, age } = s.air, sq = Math.abs(Math.cos(age * Math.PI * 3)), gap = Math.min(12, (V(1) - V(0)) * 0.5 / Math.max(1, k));
    ctx.strokeStyle = c.grey; ctx.lineWidth = 1;
    for (let i = 0; i < k; i++) {
      const x = (V(0) + V(1)) / 2 + (i - (k - 1) / 2) * gap;
      ctx.beginPath(); ctx.ellipse(x, beamY - 60, Math.max(0.6, 4.6 * sq), 4.6, 0, 0, 7); ctx.stroke();
    }
  }

  // the fulcrum (accent)
  ctx.fillStyle = c.accent; ctx.beginPath();
  ctx.moveTo(s.fx, beamY); ctx.lineTo(s.fx - TRI * 0.7, trackY); ctx.lineTo(s.fx + TRI * 0.7, trackY); ctx.closePath(); ctx.fill();

  ctx.textAlign = 'left'; ctx.fillStyle = c.grey;
  ctx.fillText(s.N ? `${s.N.toLocaleString('en')} ${s.N === 1 ? s.words.coin : s.words.coins}` : s.words.none, 6, 16);
  return trackY;
}

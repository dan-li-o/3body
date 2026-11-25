// Poster for Wu's cobalt: the tray at 0.003 K with the magnet on (most spins pointing left), electrons
// in flight, and below it the record of one Run, which leaves the fair coin's bands to the right.
// All from the real model with a fixed seed; drawn with the widget's own instrument and core/strip.js.
import { PARAMS, ranks, linedUp, pAwayOne, awaySide } from '../engines/cobalt.js';
import { band } from '../engines/coins.js';
import { valueAxis, drawStrip, drawGuide } from '../core/strip.js';
import { COLS, ROWS, layout, drawInstrument } from './draw.js';
import { rng } from '../core/core.js';
const W = 840, H1 = Math.round(W * 4 / 9), H2 = Math.round(W * 9 / 16);
export const size = { width: W, height: H1 + H2 };
export function drawPoster(ctx, c) {
  ctx.fillStyle = c.paper; ctx.fillRect(0, 0, W, H1 + H2);
  const random = rng(60), axis = valueAxis(W), L = layout(W, H1, axis), r = ranks(COLS * ROWS, random), a = PARAMS.maxAlign;
  const nuclei = [];
  for (let k = 0; k < ROWS; k++) for (let i = 0; i < COLS; i++) {
    const home = (random() - 0.5) * 2 * Math.PI, rank = r[k * COLS + i];
    nuclei.push({ ...L.at(i, k), rank, tilt: linedUp(rank, a) ? -Math.PI / 2 : home, phase: random() * 6.28 });
  }
  const pick = () => nuclei[Math.floor(random() * nuclei.length)];
  const dir = (n) => { const lined = linedUp(n.rank, a); return lined ? (random() < pAwayOne(true) ? 1 : -1) * awaySide(1) : (random() < 0.5 ? 1 : -1); };
  let left = 0, right = 0; const data = [];
  for (let i = 0; i < PARAMS.runCount; i++) { dir(pick()) > 0 ? right++ : left++; data.push(left + right, right / (left + right)); }
  const shots = [];
  for (let i = 0; i < 6; i++) { const n = pick(); shots.push({ x: n.x, y: n.y, d: dir(n), l: L.r * (1.6 + random() * 4), mine: false }); }
  const share = right / (left + right);
  drawInstrument(ctx, c, L, { nuclei, shots, flashes: [{ side: 1, y: nuclei[7].y, t: 0.05 }], pops: [], pulses: [], left, right, pointer: share, clock: null, frozen: false });
  drawGuide(ctx, c, axis.V(share), L.scaleY + 13, H1);
  ctx.save(); ctx.translate(0, H1);
  drawStrip(ctx, c, W, H2, { axis, xMax: PARAMS.runCount, traces: [{ data, alpha: 0.85 }], pen: { n: left + right, f: share }, pointer: share, mean: 0.5,
    bands: (n) => ({ inner: band(n, 1), outer: band(n, 2) }), bandFade: 1, valueName: 'share flying right', countName: 'electrons', meanLabel: 'fair coin' });
  ctx.restore();
}

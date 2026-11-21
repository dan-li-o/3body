// Poster for The Pressure Gauge: a finished run to 10,000 molecules with the expected range,
// computed through the real engine (400 simulated molecules + the tested statistical model).
import { rng } from '../core/core.js';
import { valueAxis, drawStrip, drawGuide } from '../core/strip.js';
import { createGas, addBall, step, statImpulse, Dial, MEAN, bandAt } from '../engines/gas.js';
import { drawChamber } from './draw.js';

const W = 800, TOP = W / 3, BOTTOM = W * 10 / 16, YMAX = MEAN * 2.4, SIM = 400;
export const size = { width: W, height: TOP + BOTTOM };

export function drawPoster(ctx, c) {
  ctx.fillStyle = c.paper; ctx.fillRect(0, 0, W, TOP + BOTTOM);
  const random = rng(11), g = createGas({ cap: SIM }), dial = new Dial(), dt = 1 / 60, T = 22, trace = [];
  let N = 1, v = 0;
  for (let i = 0; i * dt <= T; i++) {
    N = Math.round(10000 ** (i * dt / T));
    while (g.n < Math.min(N, SIM)) addBall(g, random);
    v = dial.update(step(g, dt, random) + statImpulse(N - g.n, dt, random), dt, N);
    trace.push(N, Math.min(v, YMAX) / YMAX);
  }
  const axis = valueAxis(W, { left: 0.32, right: 0.8 }), f = Math.min(v, YMAX) / YMAX;
  const p = drawChamber(ctx, c, W, TOP, { V: axis.V, f, g, N, words: { molecule: 'molecule', molecules: 'molecules', drawn: 'drawn', empty: '' } });
  drawGuide(ctx, c, p.x, p.y, TOP);
  ctx.save(); ctx.translate(0, TOP);
  drawStrip(ctx, c, W, BOTTOM, { axis, xMax: 10000, mean: MEAN / YMAX, valueName: 'push per molecule', countName: 'molecules',
    ticks: [[0, '0'], [MEAN / YMAX, 'avg']], traces: [{ data: trace, alpha: 0.85 }], pen: { n: N, f }, pointer: f,
    bands: (n) => ({ inner: bandAt(n, 1).map((x) => x / YMAX), outer: bandAt(n, 2).map((x) => x / YMAX) }), bandFade: 1 });
  ctx.restore();
}

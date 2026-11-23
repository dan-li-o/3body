// Poster for The Groove: a bent groove against the dashed perfect circle, the marble just past the
// bend, and the last second of slices, computed through the real engine.
import { createGroove, step, flick, PARAMS } from '../engines/groove.js';
import { drawGroove, FADE } from './draw.js';
const W = 800, H = 500;
export const size = { width: W, height: H };
export function drawPoster(ctx, c) {
  ctx.fillStyle = c.paper; ctx.fillRect(0, 0, W, H);
  const m = createGroove(); m.at = m.atTarget = -2.3; m.bendTarget = 1; flick(m, PARAMS.defaultLaps);
  const slices = []; let t0 = 0, th0 = m.th; const h = 1 / 480;
  for (let i = 0; i < 480 * 5.2; i++) {
    step(m, h);
    if (m.t - t0 >= PARAMS.tick - 1e-9) { slices.push({ t: m.t, a0: th0, d: m.th - th0 }); t0 = m.t; th0 = m.th; }
  }
  drawGroove(ctx, c, W, H, { m, slices: slices.filter((s) => m.t - s.t < FADE * 0.95), tickTh: th0, sweeping: true, hint: null, readout: null, invite: false });
}

// Poster for Wu's cobalt: the crystal at 0.003 K with the magnet on, most nuclei spinning the same
// way, electrons in flight, and the detector's counts, all from the real model with a fixed seed.
import { PARAMS, ranks, linedUp, pDownOne } from '../engines/cobalt.js';
import { COLS, ROWS, layout, drawCobalt } from './draw.js';
import { rng } from '../core/core.js';
const W = 840, H = 560;
export const size = { width: W, height: H };
export function drawPoster(ctx, c) {
  ctx.fillStyle = c.paper; ctx.fillRect(0, 0, W, H);
  const random = rng(60), L = layout(W, H), r = ranks(COLS * ROWS, random), a = PARAMS.maxAlign;
  const nuclei = [];
  for (let k = 0; k < ROWS; k++) for (let i = 0; i < COLS; i++) {
    const home = (random() - 0.5) * 2 * Math.PI, rank = r[k * COLS + i];
    nuclei.push({ ...L.at(i, k), rank, tilt: linedUp(rank, a) ? 0 : home });
  }
  // eight seconds of the detector
  let up = 0, down = 0; const pick = () => nuclei[Math.floor(random() * nuclei.length)];
  for (let i = 0; i < 8 * PARAMS.detectorRate; i++) random() < pDownOne(linedUp(pick().rank, a)) ? down++ : up++;
  const shots = [];
  for (let i = 0; i < 7; i++) {
    const n = pick(), d = random() < pDownOne(linedUp(n.rank, a)) ? 1 : -1;
    shots.push({ x: n.x, y: n.y, d, l: L.r * (1.6 + random() * 3), counted: true, mine: false });
  }
  drawCobalt(ctx, c, L, { nuclei, shots, pops: [], up, down, clock: null, frozen: false });
}

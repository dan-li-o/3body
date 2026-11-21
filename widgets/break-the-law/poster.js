// Poster for Try to Break the Law: one hard push on a table with felt and soft cushions, a few seconds in,
// computed through the real engine: the felt track, the dents and the column come from the energy actually lost.
import { push } from '../engines/pool-table.js';
import { layout, drawTable } from './draw.js';
import { createState, setSurface, advance } from './model.js';

const W = 800, H = W * 5 / 12;
export const size = { width: W, height: H };

export function drawPoster(ctx, c) {
  ctx.fillStyle = c.paper; ctx.fillRect(0, 0, W, H);
  const st = createState();
  setSurface(st, { felt: true, soft: true });
  push(st.T, st.ball, 2.3, -1.6);
  for (let i = 0; i < 60 * 1.5; i++) advance(st, 1 / 60);
  drawTable(ctx, c, { L: layout(W, H), ...st, scale: 0.5 * 9 * 1.3, showTotal: true, aim: null,
    words: { motion: 'motion', felt: 'felt', cushions: 'cushions', total: 'total', energy: 'energy' } });
}

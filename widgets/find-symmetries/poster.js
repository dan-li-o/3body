// Poster for Find the Symmetries: the last screen, all three shapes with their rings and counts.
import { drawCompare } from './draw.js';
const W = 800, H = 600;
export const size = { width: W, height: H };
export function drawPoster(ctx, c) {
  ctx.fillStyle = c.paper; ctx.fillRect(0, 0, W, H);
  drawCompare(ctx, c, W, H, { jumps: 'in jumps', continuous: 'continuous' });
}

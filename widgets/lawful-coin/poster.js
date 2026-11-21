// Poster for The Lawful Coin: the still shown before the widget starts, if it
// fails, and in a PDF/EPUB edition. A finished run to 10,000 coins with the
// predicted bands, drawn through the real engine and the widget's own drawing.
import { rng } from '../core/core.js';
import { valueAxis, drawStrip, drawGuide } from '../core/strip.js';
import { flip, band, balancePoint } from '../engines/coins.js';
import { drawBalance } from './draw.js';

const W = 800, TOP = W / 3, BOTTOM = W * 10 / 16;      // same proportions as the widget's two stages
export const size = { width: W, height: TOP + BOTTOM };

export function drawPoster(ctx, c) {
  ctx.fillStyle = c.paper; ctx.fillRect(0, 0, W, TOP + BOTTOM);
  const random = rng(7), axis = valueAxis(W), trace = [];
  let heads = 0, share = 0.5;
  for (let n = 1; ; n = Math.min(10000, n < 60 ? n + 1 : Math.ceil(n * 1.02))) {
    heads = flip(n, random).filter(Boolean).length; share = balancePoint(heads, n - heads); trace.push(n, share);
    if (n === 10000) break;
  }
  const N = trace[trace.length - 2];
  ctx.save();
  const trackY = drawBalance(ctx, c, W, TOP, { V: axis.V, fx: axis.V(share), target: axis.V(share), N, heads, landed: true, air: null,
    words: { heads: 'heads', tails: 'tails', coin: 'coin', coins: 'coins', none: '' } });
  drawGuide(ctx, c, axis.V(share), trackY, TOP);
  ctx.restore();
  ctx.save(); ctx.translate(0, TOP);
  drawStrip(ctx, c, W, BOTTOM, { axis, xMax: 10000, mean: 0.5, valueName: 'share of heads', countName: 'coins',
    traces: [{ data: trace, alpha: 0.85 }], pen: { n: N, f: share }, pointer: share,
    bands: (n) => ({ inner: band(n, 1), outer: band(n, 2) }), bandFade: 1 });
  ctx.restore();
}

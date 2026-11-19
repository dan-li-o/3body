// Poster for the Trisolaran sky: the still image shown before the widget
// loads, if it fails, in link previews, and in a PDF/EPUB edition.
// "One push: a tangle." beside "One that works: it repeats."
// Drawn from a fixed launch through the real engine, so it never goes stale.
import * as nb from '../engines/nbody.js';
import { view, drawTrail, drawBall } from './draw.js';

export const size = { width: 1600, height: 800 };

// A fixed launch that makes a clear tangle (same as the gallery screenshot).
const LAUNCH = [0.2, 1.1, 0.55, -0.15];

function run(sys, T, steps, opts) {
  const trails = Array.from(sys.m, () => []);
  for (let k = 0; k <= steps; k++) {
    trails.forEach((tr, i) => tr.push(sys.s[4 * i], sys.s[4 * i + 1], 0));
    nb.advance(sys, T / steps, opts);
  }
  return trails;
}

export function drawPoster(ctx, c, { width: W, height: H } = size) {
  ctx.fillStyle = c.paper; ctx.fillRect(0, 0, W, H);
  const label = (text, x) => {
    ctx.fillStyle = c.ink; ctx.font = 'italic 30px "EB Garamond", Garamond, Georgia, serif';
    ctx.textAlign = 'center'; ctx.fillText(text, x, H - 60);
  };
  const panel = (sys, trails, v, colorOf) => {
    trails.forEach((tr, i) => drawTrail(ctx, tr, { now: 0, v, color: colorOf(i), alpha: c.trail, line: c.line }));
    sys.m.forEach((_, i) => { const [x, y] = v.px(sys.s[4 * i], sys.s[4 * i + 1]); drawBall(ctx, x, y, 7, colorOf(i)); });
  };

  const tangle = nb.toRestFrame(nb.system([...nb.calmPair().s, ...LAUNCH]));
  panel(tangle, run(tangle, 5.5, 3000), view(W * 0.27, H * 0.45, 150), (i) => (i === 2 ? c.accent : c.ink));
  label('One push: a tangle.', W * 0.27);

  const eight = nb.figureEight();
  panel(eight, run(eight, nb.FIGURE_EIGHT_PERIOD, 3000, { eps: 0 }), view(W * 0.73, H * 0.45, 290), () => c.ink);
  label('One that works: it repeats.', W * 0.73);
}

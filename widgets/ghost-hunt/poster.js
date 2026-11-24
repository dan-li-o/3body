// Poster for The ghost hunt: the wide timeline as the page first shows it (Pauli chosen),
// without photos, so the still never depends on an image file.
import { EVENTS, GAP, START, END, x01 } from './model.js';
const W = 800, H = 300;
export const size = { width: W, height: H };
export function drawPoster(ctx, c) {
  ctx.fillStyle = c.paper; ctx.fillRect(0, 0, W, H);
  const Y = 214, pad = 22, X = (y) => pad + x01(y) * (W - 2 * pad), L = (l) => Y - 30 * l - 14;
  const line = (x1, y1, x2, y2, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  const text = (s, x, y, font, col, align = 'left') => { ctx.font = font; ctx.fillStyle = col; ctx.textAlign = align; ctx.fillText(s, x, y); };
  const dot = (x, r) => { ctx.beginPath(); ctx.arc(x, Y, r + 2, 0, 7); ctx.fillStyle = c.paper; ctx.fill(); ctx.beginPath(); ctx.arc(x, Y, r, 0, 7); ctx.fillStyle = c.ink; ctx.fill(); };
  // the twenty-six years
  ctx.globalAlpha = 0.16; ctx.fillStyle = c.accent; ctx.beginPath(); ctx.roundRect(X(GAP[0]), Y - 7, X(GAP[1]) - X(GAP[0]), 14, 7); ctx.fill(); ctx.globalAlpha = 1;
  text('Twenty-six years: no one sees it', (X(GAP[0]) + X(GAP[1])) / 2, Y + 52, 'italic 17px "EB Garamond"', c.accent, 'center');
  line(X(START), Y, X(END), Y, c.grey, 1.5);
  for (let t = START; t <= END; t += 10) { line(X(t), Y, X(t), Y + 6, c.grey, 1.5); text(String(t), X(t), Y + 24, '13px "Source Sans 3"', c.grey, 'center'); }
  for (const e of EVENTS.filter((v) => !v.hunt)) {
    const cx = X(e.y), ly = L(e.lvl);
    line(cx, Y - 7, cx, ly + 5, c.grey, 1);
    text(e.who, e.end ? cx - 5 : cx + 5, ly, `italic ${e.id === 'pauli' ? 600 : 400} 17px "EB Garamond"`, c.ink, e.end ? 'right' : 'left');
    dot(cx, e.id === 'pauli' ? 6.5 : 5);
  }
  const hunt = EVENTS.filter((v) => v.hunt), n = hunt.length, gap = 12, right = W - pad;
  const tw = Math.max(70, Math.min(150, (right - X(1937)) / n - gap)), th = Math.round(tw * 0.68), top = 14, left = right - n * tw - (n - 1) * gap;
  hunt.forEach((e, i) => {
    const tx = left + i * (tw + gap), cx = X(e.y);
    line(tx + tw / 2, top + th + 22, cx, Y - 7, c.grey, 1);
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1.5; ctx.strokeRect(tx, top, tw, th);
    text(e.short, tx + tw / 2, top + th / 2 + 6, 'italic 16px "EB Garamond"', c.ink, 'center');
    text(e.date, tx + tw / 2, top + th + 15, '12px "Source Sans 3"', c.grey, 'center');
    dot(cx, 4.5);
  });
}

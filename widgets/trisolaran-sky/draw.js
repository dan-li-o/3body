// Drawing for the Trisolaran sky, shared by the live widget and its poster.
// Ink on paper, grey trails that fade like contrails, one accent for the
// reader's own sun (design.md).

// A view maps world units to CSS pixels: centre (cx, cy) on screen shows
// world point (x0, y0); `scale` px per world unit; y points up.
export const view = (cx, cy, scale, x0 = 0, y0 = 0) => ({
  scale,
  px: (x, y) => [cx + (x - x0) * scale, cy - (y - y0) * scale],
  world: (px, py) => ({ x: (px - cx) / scale + x0, y: -(py - cy) / scale + y0 }),
});

// trail: flat array of x, y, time triples (oldest first).
// Fades to nothing over `life` seconds of sim time; life = Infinity draws it solid.
export function drawTrail(ctx, trail, { now, life = Infinity, v, color, alpha, line }) {
  if (trail.length < 6) return;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = line; ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
  const RUN = 8 * 3;   // draw in short runs, each at its own opacity
  for (let k = 0; k < trail.length - 3; k += RUN) {
    const fade = Number.isFinite(life) ? Math.max(0, 1 - (now - trail[k + 2]) / life) : 1;
    ctx.globalAlpha = alpha * fade * fade;   // quadratic: soft tail, firm near the sun
    ctx.beginPath();
    let [x, y] = v.px(trail[k], trail[k + 1]); ctx.moveTo(x, y);
    for (let q = k + 3; q <= Math.min(k + RUN, trail.length - 3); q += 3) { [x, y] = v.px(trail[q], trail[q + 1]); ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBall(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill();
}

// A faint arrow for the push while aiming.
export function drawArrow(ctx, x0, y0, x1, y1, color, line) {
  const dx = x1 - x0, dy = y1 - y0;
  if (Math.hypot(dx, dy) < 8) return;
  const ang = Math.atan2(dy, dx), h = 9;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = line; ctx.lineCap = 'round'; ctx.globalAlpha = 0.6;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  ctx.moveTo(x1, y1); ctx.lineTo(x1 - h * Math.cos(ang - 0.45), y1 - h * Math.sin(ang - 0.45));
  ctx.moveTo(x1, y1); ctx.lineTo(x1 - h * Math.cos(ang + 0.45), y1 - h * Math.sin(ang + 0.45));
  ctx.stroke();
  ctx.restore();
}

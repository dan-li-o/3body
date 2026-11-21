// Pool-table engine (Ch1 §4 Try to Break the Law; later §5b pressure gauge, §6).
// Pool-table engine: pure math, no DOM. Unit mass balls; energy = ½v².
// Every joule is accounted for: total = kinetic + warmth = energy pushed in from outside.
export function createTable(W, H, r) {
  return { W, H, r, balls: [], warmth: 0, external: 0, e: 1, mu: 0, events: [] };
}
export function ke(b) { return 0.5 * (b.vx * b.vx + b.vy * b.vy); }
export function kinetic(t) { let k = 0; for (const b of t.balls) k += ke(b); return k; }
export function total(t) { return kinetic(t) + t.warmth; }

export function addBall(t, x, y, rng) {
  rng = rng || Math.random;
  for (let tries = 0; tries < 200; tries++) {
    const px = x != null && tries === 0 ? x : t.r + rng() * (t.W - 2 * t.r);
    const py = y != null && tries === 0 ? y : t.r + rng() * (t.H - 2 * t.r);
    if (px < t.r || px > t.W - t.r || py < t.r || py > t.H - t.r) continue;
    if (t.balls.every(b => (b.x - px) ** 2 + (b.y - py) ** 2 > (2.2 * t.r) ** 2)) {
      const b = { id: t.balls.length, x: px, y: py, vx: 0, vy: 0 };
      t.balls.push(b); return b;
    }
  }
  return null;
}
// The only way energy enters: a push from outside (cue or finger).
export function push(t, b, vx, vy) {
  const before = ke(b); b.vx = vx; b.vy = vy; t.external += ke(b) - before;
}

export function step(t, dt) {
  const n = 8, h = dt / n, r = t.r;
  for (let s = 0; s < n; s++) {
    for (const b of t.balls) {
      if (b.held) continue;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 0) {
        let ns = sp - t.mu * h;
        if (ns < 0.004) ns = 0;                       // comes to rest
        const lost = 0.5 * (sp * sp - ns * ns);
        t.warmth += lost; if (lost > 0) t.events.push({ type: 'felt', amt: lost, id: b.id });
        b.vx *= ns / sp; b.vy *= ns / sp;
      }
      b.x += b.vx * h; b.y += b.vy * h;
      cushion(t, b, 'x', t.W); cushion(t, b, 'y', t.H);
    }
    const B = t.balls;
    for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
      const a = B[i], c = B[j];
      const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
      if (d >= 2 * r || d === 0) continue;
      const nx = dx / d, ny = dy / d;
      const rel = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
      if (rel > 0) {                                   // approaching: elastic, equal masses
        const ka = ke(a), kc = ke(c);
        if (a.held) { c.vx += 2 * rel * nx; c.vy += 2 * rel * ny; t.external += ke(c) - kc; }
        else if (c.held) { a.vx -= 2 * rel * nx; a.vy -= 2 * rel * ny; t.external += ke(a) - ka; }
        else {
          a.vx -= rel * nx; a.vy -= rel * ny; c.vx += rel * nx; c.vy += rel * ny;
          const da = ke(a) - ka;
          if (Math.abs(da) > 1e-4) t.events.push(da < 0 ? { type: 'transfer', from: a.id, to: c.id, amt: -da } : { type: 'transfer', from: c.id, to: a.id, amt: da });
        }
      }
      const o = (2 * r - d) / 2;                       // separate (no energy change)
      if (a.held) { c.x += 2 * o * nx; c.y += 2 * o * ny; }
      else if (c.held) { a.x -= 2 * o * nx; a.y -= 2 * o * ny; }
      else { a.x -= o * nx; a.y -= o * ny; c.x += o * nx; c.y += o * ny; }
    }
  }
}
function cushion(t, b, k, L) {
  const v = k === 'x' ? 'vx' : 'vy', r = t.r;
  const hitLow = b[k] < r && b[v] < 0, hitHigh = b[k] > L - r && b[v] > 0;
  if (hitLow || hitHigh) {
    const before = b[v];
    b[v] = -before * t.e;
    const lost = 0.5 * before * before * (1 - t.e * t.e);
    t.warmth += lost; if (lost > 0) t.events.push({ type: 'cushion', amt: lost, side: k + (hitLow ? '0' : '1'), x: b.x, y: b.y });
  }
  if (b[k] < r) b[k] = r; if (b[k] > L - r) b[k] = L - r;
}

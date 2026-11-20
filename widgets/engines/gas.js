// Gas-chamber engine (Ch1 §5b The Pressure Gauge). Pure math, no drawing.
// Molecules: point-like balls, one speed, random directions; top and bottom walls bounce them back unchanged.
// Left wall: a wall at fixed temperature — a molecule that hits it leaves at the same speed in a random direction
//   (this keeps the gas at one temperature and shuffles the molecules, as real walls do). Directions follow
//   Lambert's cosine law; a uniform spread of angles would trap molecules skimming along the wall.
// Right wall: a piston of mass M on a stiff, lightly damped spring: the needle of a pressure gauge.
//   Molecules bounce off it elastically; every bounce's impulse is recorded. The push on the piston is that impulse over time.
export function createGas(o = {}) {
  return { L: o.L ?? 2, H: o.H ?? 1, v: o.v ?? 2.5, M: o.M ?? 200, k: o.k ?? 50000, c: o.c ?? 1600,
    x0: o.L ?? 2, px: o.L ?? 2, pv: 0, balls: [], impulse: 0, hits: 0, t: 0 };
}
export function addBall(g, rng) {
  const a = rng() * 2 * Math.PI;
  g.balls.push({ x: rng() * (g.px - 0.02) + 0.01, y: rng() * g.H, vx: g.v * Math.cos(a), vy: g.v * Math.sin(a) });
}
export function step(g, dt, rng) {
  const n = 4, h = dt / n, H = g.H;
  for (let s = 0; s < n; s++) {
    for (const b of g.balls) {
      b.x += b.vx * h; b.y += b.vy * h;
      if (b.y < 0) { b.y = -b.y; b.vy = -b.vy; } else if (b.y > H) { b.y = 2 * H - b.y; b.vy = -b.vy; }
      if (b.x < 0) {                                   // wall at fixed temperature
        const a = Math.asin(2 * rng() - 1);              // Lambert's cosine law, as for a real wall
        b.x = -b.x; b.vx = g.v * Math.cos(a); b.vy = g.v * Math.sin(a);
      } else if (b.x > g.px && b.vx > g.pv) {          // elastic bounce off the moving piston
        const u1 = b.vx, u2 = g.pv, M = g.M;
        const v1 = ((1 - M) * u1 + 2 * M * u2) / (1 + M), v2 = ((M - 1) * u2 + 2 * u1) / (1 + M);
        g.impulse += M * (v2 - u2); g.hits++;
        b.vx = v1; g.pv = v2; b.x = g.px - (b.x - g.px);
      }
    }
    const a = (-g.k * (g.px - g.x0) - g.c * g.pv) / g.M;  // spring + damping
    g.pv += a * h; g.px += g.pv * h;
    for (const b of g.balls) if (b.x > g.px) b.x = g.px;
    g.t += h;
  }
}
// One reading: the average push on the piston over a window, per molecule.
export function startReading(g) { g.impulse = 0; g.hits = 0; g.t0 = g.t; }
export function reading(g) { const T = g.t - g.t0; return g.balls.length && T > 0 ? g.impulse / T / g.balls.length : 0; }
export const WINDOW = 2;           // seconds of model time per reading

// Expected range of one reading, measured once by simulating many readings at each count (tools/calibrate-gas.mjs):
// [molecules, mean, 2.5%, 16%, 84%, 97.5%]. The inner band (16–84%) holds about 68 of every 100 readings,
// the outer band (2.5–97.5%) about 95. Never fitted to the reader's own dots.
export const CALIB = [[1, 1.5164, 0, 0, 2.4434, 4.7129], [2, 1.5296, 0, 0.7698, 2.3124, 3.4198], [3, 1.5561, 0.3049, 0.8279, 2.2112, 2.9792], [5, 1.5405, 0.5418, 1.0062, 2.0641, 2.6307], [8, 1.5475, 0.7608, 1.1413, 1.9524, 2.3674], [12, 1.5491, 0.9253, 1.221, 1.8765, 2.1983], [20, 1.544, 1.0579, 1.2849, 1.7906, 2.0524], [30, 1.5332, 1.1214, 1.323, 1.7448, 1.9634], [50, 1.5321, 1.2161, 1.3601, 1.6986, 1.8537], [80, 1.5162, 1.2682, 1.3869, 1.6468, 1.768], [120, 1.5404, 1.3271, 1.4344, 1.6434, 1.7337], [200, 1.5335, 1.3768, 1.4519, 1.6123, 1.6872], [300, 1.524, 1.3917, 1.4591, 1.592, 1.6569]];
export const MEAN = 1.536;   // average push per molecule: the same at every count
// Band edges at any count, interpolated on log(count).
export function bandAt(n, k) {
  const C = CALIB, lo = k === 1 ? 3 : 2, hi = k === 1 ? 4 : 5;
  if (n <= C[0][0]) return [C[0][lo], C[0][hi]];
  for (let i = 1; i < C.length; i++) if (n <= C[i][0]) {
    const t = (Math.log(n) - Math.log(C[i - 1][0])) / (Math.log(C[i][0]) - Math.log(C[i - 1][0]));
    return [C[i - 1][lo] + t * (C[i][lo] - C[i - 1][lo]), C[i - 1][hi] + t * (C[i][hi] - C[i - 1][hi])];
  }
  const L = C[C.length - 1]; return [L[lo], L[hi]];
}

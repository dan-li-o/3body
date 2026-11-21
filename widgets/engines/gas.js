// Gas-chamber engine (Ch1 §5b The Pressure Gauge). Pure math, no drawing.
// A two-dimensional ideal gas: point molecules that do not collide with each other.
// - Speeds follow the Maxwell–Boltzmann distribution (each velocity component normal, spread SIGMA).
// - Top and bottom walls reflect molecules unchanged.
// - Left wall is held at one temperature: a molecule that hits it leaves with a fresh thermal velocity
//   (flux-weighted, as for a real wall: normal component Rayleigh, sideways component normal).
// - Right wall is a heavy piston on a stiff, damped spring. Molecules bounce off it elastically and every
//   bounce's impulse is added up: that is the push on the piston.
// Units are arbitrary: molecule mass 1, SIGMA = 1.5. The push per molecule averages SIGMA² / L
// (the ideal-gas law, P·V = N·k·T, in these units); MEAN below is checked against the simulation in the tests.
export const SIGMA = 1.5;
export function createGas(o = {}) {
  const cap = o.cap ?? 10000, L = o.L ?? 2;
  return { L, H: o.H ?? 1, M: o.M ?? 2000, k: o.k ?? 2e6, c: o.c ?? 38000, x0: L, px: L, pv: 0,
    n: 0, x: new Float64Array(cap), y: new Float64Array(cap), vx: new Float64Array(cap), vy: new Float64Array(cap),
    impulse: 0, t: 0, rate: 0 };
}
function gauss(rng) { return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng()); }
export function addBall(g, rng) {
  if (g.n >= g.x.length) return;
  const i = g.n++; g.x[i] = rng() * (g.px - 0.02) + 0.01; g.y[i] = rng() * g.H;
  g.vx[i] = SIGMA * gauss(rng); g.vy[i] = SIGMA * gauss(rng);
}
export function step(g, dt, rng, sub = 4) {
  const h = dt / sub, H = g.H, M = g.M, X = g.x, Y = g.y, VX = g.vx, VY = g.vy;
  let imp = 0;
  for (let s = 0; s < sub; s++) {
    const px = g.px; let pv = g.pv;
    for (let i = 0; i < g.n; i++) {
      let x = X[i] + VX[i] * h, y = Y[i] + VY[i] * h;
      if (y < 0) { y = -y; VY[i] = -VY[i]; } else if (y > H) { y = 2 * H - y; VY[i] = -VY[i]; }
      if (x < 0) { x = -x; VX[i] = SIGMA * Math.sqrt(-2 * Math.log(1 - rng())); VY[i] = SIGMA * gauss(rng); }
      else if (x > px && VX[i] > pv) {
        const u1 = VX[i], v1 = ((1 - M) * u1 + 2 * M * pv) / (1 + M), v2 = ((M - 1) * pv + 2 * u1) / (1 + M);
        imp += M * (v2 - pv); pv = v2; VX[i] = v1; x = px - (x - px);
      }
      X[i] = x; Y[i] = y;
    }
    pv += ((-g.k * (g.px - g.x0) - g.c * pv) / M) * h; g.px += pv * h; g.pv = pv; g.t += h;
  }
  g.impulse += imp;
  return imp;
}
// The dial: push over the last fraction of a second (an exponential average with time constant TAU), per molecule.
export const TAU = 0.25;
export function updateDial(g, imp, dt) { g.rate += (imp / dt - g.rate) * Math.min(1, dt / TAU); return g.n ? g.rate / g.n : 0; }
// The widget's dial. Both the push and the molecule count are averaged over the same short time, so a
// count that keeps growing (during a run) does not make the reading low. (Dividing by the count right now
// read about 5% low during runs; found 2026-11-20, tested below.)
export class Dial {
  constructor(tau = TAU) { this.tau = tau; this.reset(); }
  reset() { this.rate = 0; this.n = 0; this.value = 0; }
  update(imp, dt, N) {
    const a = Math.min(1, dt / this.tau);
    this.rate += (imp / dt - this.rate) * a; this.n += (N - this.n) * a;
    return (this.value = this.n > 0 ? this.rate / this.n : 0);
  }
}
export const MEAN = SIGMA * SIGMA / 2;   // ideal-gas value for L = 2: SIGMA² / L

// Molecules beyond those simulated one by one. Molecules in an ideal gas don't interact, so the push from many of them is
// the sum of many independent pushes. Each molecule hits the piston at an average rate RATE = SIGMA / (√(2π)·L);
// each hit gives an impulse 2·vx, with vx drawn as at a real wall (Rayleigh, spread SIGMA). So the push from m
// unsimulated molecules over dt is a compound Poisson sum: a Poisson number of hits, each with its own impulse.
// The tests check that this gives the same dial as simulating every molecule.
export const RATE = SIGMA / (Math.sqrt(2 * Math.PI) * 2);
function poisson(mu, rng) {
  if (mu > 30) return Math.max(0, Math.round(mu + Math.sqrt(mu) * gauss(rng)));
  let k = 0, p = Math.exp(-mu), s = p, u = rng(); while (u > s) { k++; p *= mu / k; s += p; } return k;
}
export function statImpulse(m, dt, rng) {
  const k = poisson(m * RATE * dt, rng); let imp = 0;
  if (k > 60) { // many hits: the sum is normal, with mean k·E[J] and variance k·Var[J]; E[J] = 2σ√(π/2), E[J²] = 8σ²
    const EJ = 2 * SIGMA * Math.sqrt(Math.PI / 2), VJ = 8 * SIGMA * SIGMA - EJ * EJ;
    return k * EJ + Math.sqrt(k * VJ) * gauss(rng);
  }
  for (let i = 0; i < k; i++) imp += 2 * SIGMA * Math.sqrt(-2 * Math.log(1 - rng()));
  return imp;
}

// Expected range of the dial, measured once on the widget's own model (400 simulated molecules + the
// statistical shortcut, read through Dial) at each count (tools/calibrate-gas.mjs):
// [molecules, mean, 2.5%, 16%, 84%, 97.5%]. Inner band (16–84%): about 68 of every 100 moments; outer (2.5–97.5%): about 95.
export const CALIB = [[1, 1.0635, 0, 0, 1.3991, 10.4882], [2, 1.0393, 0, 0.0002, 2.0796, 7.5652], [3, 1.0673, 0, 0.0051, 2.3465, 6.1225], [5, 1.1142, 0.0009, 0.0439, 2.316, 5.0189], [10, 1.1135, 0.0319, 0.2102, 2.0271, 3.5962], [20, 1.1155, 0.1398, 0.4289, 1.8172, 2.7816], [50, 1.1148, 0.3937, 0.6776, 1.5594, 2.1081], [100, 1.1185, 0.5726, 0.8056, 1.4348, 1.8054], [200, 1.1094, 0.7106, 0.8946, 1.3277, 1.5842], [500, 1.1263, 0.8653, 0.9866, 1.2666, 1.4212], [1000, 1.1237, 0.9291, 1.0202, 1.2257, 1.3345], [2000, 1.123, 0.9797, 1.0481, 1.197, 1.2703], [5000, 1.1241, 1.0342, 1.077, 1.1715, 1.2166], [10000, 1.1258, 1.0604, 1.0921, 1.1587, 1.1921]];
export function bandAt(n, k) {
  const C = CALIB, lo = k === 1 ? 3 : 2, hi = k === 1 ? 4 : 5;
  if (n <= C[0][0]) return [C[0][lo], C[0][hi]];
  for (let i = 1; i < C.length; i++) if (n <= C[i][0]) {
    const t = (Math.log(n) - Math.log(C[i - 1][0])) / (Math.log(C[i][0]) - Math.log(C[i - 1][0]));
    return [C[i - 1][lo] + t * (C[i][lo] - C[i - 1][lo]), C[i - 1][hi] + t * (C[i][hi] - C[i - 1][hi])];
  }
  const L = C[C.length - 1]; return [L[lo], L[hi]];
}

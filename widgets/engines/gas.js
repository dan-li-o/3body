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
export const MEAN = SIGMA * SIGMA / 2;   // ideal-gas value for L = 2: SIGMA² / L

// Expected range of the dial, measured once by simulating at each count (tools/calibrate-gas.mjs):
// [molecules, mean, 2.5%, 16%, 84%, 97.5%]. Inner band (16–84%): about 68 of every 100 moments; outer (2.5–97.5%): about 95.
export const CALIB = [[1, 0.9327, 0, 0, 1.026, 9.6078], [2, 1.154, 0, 0, 2.4283, 8.3095], [3, 1.1998, 0.0001, 0.0101, 2.6393, 6.7736], [5, 1.1077, 0.002, 0.047, 2.3032, 4.9633], [10, 1.1511, 0.0345, 0.2225, 2.1207, 3.6769], [20, 1.0586, 0.1122, 0.3919, 1.7404, 2.663], [50, 1.1414, 0.3903, 0.6935, 1.5765, 2.1386], [100, 1.1103, 0.5654, 0.7937, 1.4151, 1.8127], [200, 1.1315, 0.7165, 0.9161, 1.3546, 1.5964], [500, 1.111, 0.8586, 0.9802, 1.2498, 1.3875], [1000, 1.1257, 0.9326, 1.0167, 1.2246, 1.3399], [2000, 1.1226, 0.9933, 1.0577, 1.1842, 1.2528], [5000, 1.1071, 1.0243, 1.0659, 1.1489, 1.1918], [10000, 1.0981, 1.037, 1.0682, 1.1293, 1.1578]];
export function bandAt(n, k) {
  const C = CALIB, lo = k === 1 ? 3 : 2, hi = k === 1 ? 4 : 5;
  if (n <= C[0][0]) return [C[0][lo], C[0][hi]];
  for (let i = 1; i < C.length; i++) if (n <= C[i][0]) {
    const t = (Math.log(n) - Math.log(C[i - 1][0])) / (Math.log(C[i][0]) - Math.log(C[i - 1][0]));
    return [C[i - 1][lo] + t * (C[i][lo] - C[i - 1][lo]), C[i - 1][hi] + t * (C[i][hi] - C[i - 1][hi])];
  }
  const L = C[C.length - 1]; return [L[lo], L[hi]];
}

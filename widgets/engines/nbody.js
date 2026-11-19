// N-body gravity engine: pure math, no drawing, no DOM.
// Used by the Welcome page's Trisolaran sky and, later, Ch5's three-body widget.
//
// Units: G = 1. A system is two typed arrays:
//   s: Float64Array of [x, y, vx, vy] per body
//   m: Float64Array of masses
// Integrator: velocity Verlet (leapfrog), symplectic, so energy does not drift.
// The step shrinks in close encounters. Optional softening (eps) only matters
// in near-collisions; use 0 for exact Newtonian orbits such as the figure-eight.

export const DEFAULT_EPS = 0.01;

export function system(state, masses) {
  const s = Float64Array.from(state);
  const m = masses ? Float64Array.from(masses) : new Float64Array(s.length / 4).fill(1);
  return { s, m };
}

function accel(s, m, eps2, a) {
  const n = m.length;
  a.fill(0);
  let rmin = Infinity;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const dx = s[4 * j] - s[4 * i], dy = s[4 * j + 1] - s[4 * i + 1];
    const r2 = dx * dx + dy * dy;
    rmin = Math.min(rmin, Math.sqrt(r2));
    const f = 1 / Math.pow(r2 + eps2, 1.5);
    a[2 * i] += m[j] * dx * f; a[2 * i + 1] += m[j] * dy * f;
    a[2 * j] -= m[i] * dx * f; a[2 * j + 1] -= m[i] * dy * f;
  }
  return rmin;
}

// Advance the system in place by time T. Returns the closest approach seen.
export function advance({ s, m }, T, { eps = DEFAULT_EPS, maxStep = 0.002 } = {}) {
  const n = m.length, eps2 = eps * eps, a = new Float64Array(2 * n);
  let t = 0, rmin = accel(s, m, eps2, a), closest = rmin;
  while (t < T) {
    const dt = Math.min(T - t, maxStep, 0.01 * Math.pow(Math.max(rmin, 0.01), 1.5) + 1e-5);
    for (let i = 0; i < n; i++) {
      s[4 * i + 2] += 0.5 * dt * a[2 * i]; s[4 * i + 3] += 0.5 * dt * a[2 * i + 1];
      s[4 * i] += dt * s[4 * i + 2]; s[4 * i + 1] += dt * s[4 * i + 3];
    }
    rmin = accel(s, m, eps2, a);
    closest = Math.min(closest, rmin);
    for (let i = 0; i < n; i++) { s[4 * i + 2] += 0.5 * dt * a[2 * i]; s[4 * i + 3] += 0.5 * dt * a[2 * i + 1]; }
    t += dt;
  }
  return closest;
}

export function energy({ s, m }, { eps = DEFAULT_EPS } = {}) {
  const n = m.length, eps2 = eps * eps;
  let E = 0;
  for (let i = 0; i < n; i++) E += 0.5 * m[i] * (s[4 * i + 2] ** 2 + s[4 * i + 3] ** 2);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++)
    E -= m[i] * m[j] / Math.sqrt((s[4 * j] - s[4 * i]) ** 2 + (s[4 * j + 1] - s[4 * i + 1]) ** 2 + eps2);
  return E;
}

export function momentum({ s, m }) {
  let px = 0, py = 0;
  for (let i = 0; i < m.length; i++) { px += m[i] * s[4 * i + 2]; py += m[i] * s[4 * i + 3]; }
  return [px, py];
}

export function centerOfMass({ s, m }, only) {
  let x = 0, y = 0, vx = 0, vy = 0, M = 0;
  for (let i = 0; i < m.length; i++) {
    if (only && !only.includes(i)) continue;
    x += m[i] * s[4 * i]; y += m[i] * s[4 * i + 1]; vx += m[i] * s[4 * i + 2]; vy += m[i] * s[4 * i + 3]; M += m[i];
  }
  return { x: x / M, y: y / M, vx: vx / M, vy: vy / M, M };
}

// Shift velocities so the centre of mass stands still (keeps a system in view).
export function toRestFrame(sys) {
  const c = centerOfMass(sys);
  for (let i = 0; i < sys.m.length; i++) { sys.s[4 * i + 2] -= c.vx; sys.s[4 * i + 3] -= c.vy; }
  return sys;
}

export function distance({ s }, i, j) {
  return Math.hypot(s[4 * j] - s[4 * i], s[4 * j + 1] - s[4 * i + 1]);
}

// ----- contact ---------------------------------------------------------------

// Elastic bounce of bodies i and j (keeps momentum and kinetic energy).
// Only acts if they are approaching, so touching bodies never stick.
// Returns true if it bounced.
export function bounce({ s, m }, i, j) {
  const dx = s[4 * j] - s[4 * i], dy = s[4 * j + 1] - s[4 * i + 1];
  const dvx = s[4 * j + 2] - s[4 * i + 2], dvy = s[4 * j + 3] - s[4 * i + 3];
  const dot = dvx * dx + dvy * dy;
  if (dot >= 0) return false;
  const k = 2 * dot / ((dx * dx + dy * dy) * (m[i] + m[j]));
  s[4 * i + 2] += k * m[j] * dx; s[4 * i + 3] += k * m[j] * dy;
  s[4 * j + 2] -= k * m[i] * dx; s[4 * j + 3] -= k * m[i] * dy;
  return true;
}

// Perfectly inelastic merge of j into i (keeps momentum). Returns a new system;
// body j is removed, so indices above j shift down by one.
export function merge({ s, m }, i, j) {
  const M = m[i] + m[j], ns = [], nm = [];
  for (let k = 0; k < m.length; k++) {
    if (k === j) continue;
    if (k === i) { for (let q = 0; q < 4; q++) ns.push((m[i] * s[4 * i + q] + m[j] * s[4 * j + q]) / M); nm.push(M); }
    else { for (let q = 0; q < 4; q++) ns.push(s[4 * k + q]); nm.push(m[k]); }
  }
  return system(ns, nm);
}

// ----- escape (three bodies) -------------------------------------------------
// How far body i has gone from the other two, as a two-body problem: body i
// against the pair (j, k) treated as one mass at its centre.
function escapeTerms({ s, m }, i) {
  const [j, k] = [0, 1, 2].filter((q) => q !== i);
  const pair = centerOfMass({ s, m }, [j, k]);
  const rx = s[4 * i] - pair.x, ry = s[4 * i + 1] - pair.y;
  const vx = s[4 * i + 2] - pair.vx, vy = s[4 * i + 3] - pair.vy;
  const r = Math.hypot(rx, ry), M = pair.M;
  const mu = m[i] * M / (m[i] + M);                      // reduced mass
  const E = 0.5 * mu * (vx * vx + vy * vy) - m[i] * M / r;  // > 0: unbound
  const sep = Math.hypot(s[4 * j] - s[4 * k], s[4 * j + 1] - s[4 * k + 1]);
  const muPair = m[j] * m[k] / (m[j] + m[k]);
  const pairE = 0.5 * muPair * ((s[4 * j + 2] - s[4 * k + 2]) ** 2 + (s[4 * j + 3] - s[4 * k + 3]) ** 2) - m[j] * m[k] / sep;
  return { r, E, sep, pairE, outward: rx * vx + ry * vy > 0 };
}

// Strict test: body i has left for good. The other two are bound to each
// other, i is far away compared with their separation, moving outward, and
// has escape energy. In testing, no body flagged by this rule ever returned.
export function hasEscaped(sys, i) {
  const { r, E, sep, pairE, outward } = escapeTerms(sys, i);
  return pairE < 0 && r > Math.max(3, 5 * sep) && outward && E > 0;
}

// Naive test: body i looks gone (escape energy, some distance away). About
// half of these come back; the Welcome widget uses that gap for its joke.
export function looksGone(sys, i) {
  const { r, E } = escapeTerms(sys, i);
  return E > 0 && r > 3;
}

// Distance from body i to the centre of the other two.
export function distanceFromPair(sys, i) { return escapeTerms(sys, i).r; }

// ----- known systems ---------------------------------------------------------

// Two equal suns on a circular orbit, separation 1, centre at the origin.
export function calmPair() {
  const v = Math.sqrt(1 / 2);
  return system([-0.5, 0, 0, -v, 0.5, 0, 0, v]);
}

// The figure-eight: three equal masses chasing each other along one curve.
// Initial conditions computed by Carles Simó, as published in Chenciner &
// Montgomery, "A remarkable periodic solution of the three-body problem in
// the case of equal masses", Annals of Mathematics 152 (2000), Figure 1.
// Simó showed numerically that it is KAM-stable: small nudges don't break it.
export const FIGURE_EIGHT_PERIOD = 6.32591398;
export function figureEight() {
  const x = 0.97000436, y = -0.24308753, vx = -0.93240737, vy = -0.86473146;
  return system([x, y, -vx / 2, -vy / 2, -x, -y, -vx / 2, -vy / 2, 0, 0, vx, vy]);
}

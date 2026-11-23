// The groove (Ch1 "Three Names, One Bet", Widget 1.5): a bead on a level, frictionless groove.
// Pure math, no DOM. Tests: tests/engines/groove.test.mjs.
//
// The groove's shape is r(θ) = 1 + b·bend·g(θ − A − rot), with g a smooth bump (radius 1 = round).
// Nothing pushes along the groove, so the bead's speed |v| never changes: energy is kept exactly,
// by construction. Its pace around the centre is θ' = v / √(r² + r'²), so where the groove bulges
// out the pace drops. Angular momentum per unit mass, r²·θ', is kept only while the groove is round:
// rotational symmetry ⇔ conservation of angular momentum, seen twice.
// (Design history: Ryan's v6 modelled the dent as a hollow in the floor; Dan chose the bent groove
// on 2026-11-23 so that the picture shows plainly that the groove is no longer a perfect circle.)

export const TAU = Math.PI * 2;
export const PARAMS = { b: 0.2, sigma: 0.42, tick: 0.13, minLaps: 0.3, maxLaps: 0.45, defaultLaps: 0.35 };

export function wrap(x) { x = (x + Math.PI) % TAU; if (x < 0) x += TAU; return x - Math.PI; }

export function createGroove() {
  return { th: Math.PI, v: 0, bend: 0, bendTarget: 0, at: -Math.PI / 4, atTarget: -Math.PI / 4, rot: 0, t: 0, laps: 0 };
}
function bump(m, th, at = m.at) { const x = wrap(th - at - m.rot), s = PARAMS.sigma; return { g: Math.exp(-x * x / (2 * s * s)), x }; }
export function radius(m, th) { return 1 + PARAMS.b * m.bend * bump(m, th).g; }
// The shape the groove WILL have once a pending bend is made (for drawing it dashed meanwhile).
export function radiusTarget(m, th) { return 1 + PARAMS.b * m.bendTarget * bump(m, th, m.atTarget).g; }
function slope(m, th) { const { g, x } = bump(m, th), s = PARAMS.sigma; return -PARAMS.b * m.bend * g * x / (s * s); }
export function pace(m, th = m.th) { return m.v / Math.hypot(radius(m, th), slope(m, th)); }
export function angMom(m) { const r = radius(m, m.th); return r * r * pace(m); }

export function step(m, dt) {
  // A bend is made or smoothed only while the bead is on the far side of it, so the groove never
  // moves under the bead (that would be a push from outside).
  if ((m.bend !== m.bendTarget || m.at !== m.atTarget) && Math.abs(wrap(m.th - m.at - m.rot)) > 1.6 && Math.abs(wrap(m.th - m.atTarget - m.rot)) > 1.6) {
    m.bend = m.bendTarget; m.at = m.atTarget;
  }
  const f = (th) => pace(m, th);                       // RK4 on θ' = v / √(r² + r'²)
  const k1 = f(m.th), k2 = f(m.th + dt * k1 / 2), k3 = f(m.th + dt * k2 / 2), k4 = f(m.th + dt * k3);
  const d = dt * (k1 + 2 * k2 + 2 * k3 + k4) / 6;
  m.th += d; m.t += dt; m.laps += Math.abs(d) / TAU;
}

// A flick: speed such that one lap of the ROUND groove takes 1/laps seconds.
export function flick(m, laps, sign = 1) { m.v = sign * laps * TAU; m.laps = 0; }
export const isBent = (m) => m.bendTarget > 0.5;

// Find the Symmetries: the shapes and the rule for "fits its outline". Pure, no DOM; tested in
// tests/widgets/find-symmetries.test.mjs. A move is "turn by theta degrees (clockwise on screen)
// after an optional flip across the vertical line through the centre".
// Moves count by RESULT (where every point lands), not by path: 0°, 360° and 720° are one symmetry.

export const TOL = 9;   // degrees: how close to an exact fit counts as "fits" (the widget then snaps)

// Shapes in unit coordinates, origin at the centre of turning, y down. Each part is a polyline
// ('line'), a closed polygon ('poly'), a quadratic leaf ('leaf': start, control, tip, control) or a
// circle ('circle': centre, radius). Drawing (draw.js) and the tests read the same numbers.
const petals = Array.from({ length: 5 }, (_, i) => {
  const a = (-90 + 72 * i) * Math.PI / 180;
  return { type: 'circle', c: [0.17 * Math.cos(a), -0.52 + 0.17 * Math.sin(a)], r: 0.125 };
});
export const SHAPES = {
  // drawn exactly mirror-symmetric (stylized, not lifelike), so the flip is a real geometric match
  flower: {
    period: 360, total: 2, parts: [
      { type: 'line', pts: [[0, 0.30], [0, -0.40]] },
      { type: 'leaf', pts: [[0, 0.10], [-0.24, 0.14], [-0.42, -0.10], [-0.20, -0.16]] },
      { type: 'leaf', pts: [[0, 0.10], [0.24, 0.14], [0.42, -0.10], [0.20, -0.16]] },
      ...petals,
      { type: 'circle', c: [0, -0.52], r: 0.08 },
      { type: 'poly', pts: [[-0.31, 0.38], [0.31, 0.38], [0.23, 0.84], [-0.23, 0.84]] },
      { type: 'poly', pts: [[-0.37, 0.28], [0.37, 0.28], [0.37, 0.39], [-0.37, 0.39]] },
    ],
    marks: [['1', -0.27, -0.03], ['2', 0.27, -0.03]],
  },
  triangle: {
    period: 120, total: 6,
    parts: [{ type: 'poly', pts: [0, 1, 2].map((i) => { const a = (-90 + 120 * i) * Math.PI / 180; return [Math.cos(a), Math.sin(a)]; }) }],
    marks: [0, 1, 2].map((i) => { const a = (-90 + 120 * i) * Math.PI / 180; return [String(i + 1), 0.56 * Math.cos(a), 0.56 * Math.sin(a)]; }),
  },
  circle: {
    period: 0, total: Infinity,
    parts: [{ type: 'circle', c: [0, 0], r: 0.85 }],
    marks: [['1', 0, -0.66], ['2', 0.66 * Math.sin(40 * Math.PI / 180), -0.66 * Math.cos(40 * Math.PI / 180)]],
  },
};
export const ORDER = ['flower', 'triangle', 'circle'];

export const mod = (a, n) => ((a % n) + n) % n;

// Where the unit point (x, y) lands after the move (flip first, then turn by theta).
export function place(x, y, theta, flipped) {
  if (flipped) x = -x;
  const r = theta * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return [x * c - y * s, x * s + y * c];
}

// Does the shape fit its outline after the move? null if not; otherwise the result found
// (key, the angle 0 ≤ angle < 360 that names it, and `exact`: the theta to snap to).
export function fit(name, theta, flipped) {
  const P = SHAPES[name].period, a = mod(theta, 360);
  let k, d;
  if (P) {
    const kk = Math.round(a / P); d = a - kk * P; k = mod(kk, 360 / P) * P;
    if (Math.abs(d) > TOL) return null;
  } else { const kk = Math.round(a); d = a - kk; k = mod(kk, 360); }
  return { key: (flipped ? 'f' : 't') + k, angle: k, flipped, exact: theta - d };
}

// The flip is across the screen's vertical line: flipping a shape that is already turned by theta
// leaves it turned by -theta, with the flip toggled.
export const flip = (theta, flipped) => ({ theta: -theta, flipped: !flipped });

export function labelFor(flipped, angle) {
  if (!flipped) return angle ? `turn ${angle}°` : 'as it is';
  return angle ? `flip + ${angle}°` : 'flip';
}

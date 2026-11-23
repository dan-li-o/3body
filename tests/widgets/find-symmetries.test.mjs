// Find the Symmetries: the counts the widget announces (2, 6, endless) and the rule "moves count by
// result" rest on these. The geometric tests check the DRAWN shapes really have those symmetries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, fit, flip, place } from '../../widgets/find-symmetries/model.js';

// every point of the drawn shape (polygon corners, leaf points, circle centres + radii), rounded
function points(name) {
  const out = [];
  for (const p of SHAPES[name].parts) {
    if (p.type === 'circle') out.push([...p.c, p.r]); else for (const q of p.pts) out.push([...q, 0]);
  }
  return out;
}
const key = (pts) => pts.map(([x, y, r]) => `${x.toFixed(6)},${y.toFixed(6)},${r}`.replace(/-0\.000000/g, '0.000000')).sort().join(' ');
const moved = (name, theta, flipped) => points(name).map(([x, y, r]) => [...place(x, y, theta, flipped), r]);
const same = (name, theta, flipped) => key(moved(name, theta, flipped)) === key(points(name));

test('the flower, as drawn, fits as it is and flipped, and at no turn', () => {
  assert.ok(same('flower', 0, false)); assert.ok(same('flower', 0, true));
  for (const a of [90, 120, 180, 72, 270]) { assert.ok(!same('flower', a, false)); assert.ok(!same('flower', a, true)); }
});
test('the triangle, as drawn, fits at 0°, 120°, 240°, flipped or not, and not in between', () => {
  for (const a of [0, 120, 240]) { assert.ok(same('triangle', a, false)); assert.ok(same('triangle', a, true)); }
  for (const a of [60, 90, 180, 30]) assert.ok(!same('triangle', a, false));
});
test('counting by result: 2, 6, and the circle never runs out', () => {
  const results = (name, step) => { const s = new Set(); for (const f of [false, true]) for (let a = -720; a <= 720; a += step) { const r = fit(name, a, f); if (r) s.add(r.key); } return s.size; };
  assert.equal(results('flower', 1), 2);
  assert.equal(results('triangle', 1), 6);
  assert.equal(results('circle', 1), 720);
  assert.ok(results('circle', 0.5) >= 720);
});
test('0°, 360° and 720° are one symmetry; −120° is 240°', () => {
  assert.equal(fit('triangle', 360, false).key, fit('triangle', 0, false).key);
  assert.equal(fit('triangle', 720, false).key, 't0');
  assert.equal(fit('triangle', -120, false).key, 't240');
});
test('a near miss snaps; a far miss does not fit', () => {
  assert.equal(fit('triangle', 125, false).exact, 120);
  assert.equal(fit('triangle', 60, false), null);
  assert.equal(fit('flower', 40, false), null);
});
test('flipping a turned shape: the flip is across the screen, so the turn reverses', () => {
  const f = flip(120, false);
  assert.deepEqual(f, { theta: -120, flipped: true });
  // drawn: screen-mirror of (turn 120°) equals (flip, then turn −120°)
  const [x, y] = place(0.3, -0.7, 120, false), [x2, y2] = place(0.3, -0.7, f.theta, f.flipped);
  assert.ok(Math.abs(-x - x2) < 1e-12 && Math.abs(y - y2) < 1e-12);
});

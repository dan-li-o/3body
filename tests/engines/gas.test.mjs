// Claims of The Pressure Gauge rest on these tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../../widgets/engines/gas.js';
const seeded = (s = 1) => () => (s = s * 16807 % 2147483647) / 2147483647;
function readings(N, reps, seed) {
  const rng = seeded(seed), g = G.createGas(); for (let i = 0; i < N; i++) G.addBall(g, rng);
  for (let i = 0; i < 300; i++) G.step(g, 1 / 60, rng);
  const R = []; for (let r = 0; r < reps; r++) { G.startReading(g); for (let i = 0; i < G.WINDOW * 60; i++) G.step(g, 1 / 60, rng); R.push(G.reading(g)); }
  return R;
}
const sd = a => { const m = a.reduce((x, y) => x + y) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };

test('the average push per molecule is the same with few or many molecules', () => {
  for (const N of [5, 50, 300]) { const R = readings(N, 400, 3 + N); const m = R.reduce((a, b) => a + b) / R.length;
    assert.ok(Math.abs(m / G.MEAN - 1) < 0.06, `N=${N}: ${m}`); }
});
test('"The knocks become a hum": readings spread far less with 300 molecules than with 3', () => {
  assert.ok(sd(readings(3, 600, 7)) > 4 * sd(readings(300, 300, 8)));
});
test('bands: about 68 and 95 of every 100 fresh readings land inside', () => {
  for (const N of [10, 100, 300]) { const R = readings(N, 600, 99 + N);
    const f = k => { const [lo, hi] = G.bandAt(N, k); return R.filter(r => r >= lo && r <= hi).length / R.length; };
    assert.ok(f(1) > 0.6 && f(1) < 0.76, `N=${N} inner ${f(1)}`); assert.ok(f(2) > 0.9 && f(2) < 0.99, `N=${N} outer ${f(2)}`); }
});
test('the piston barely moves: the chamber stays the same size', () => {
  const rng = seeded(4), g = G.createGas(); for (let i = 0; i < 300; i++) G.addBall(g, rng);
  for (let i = 0; i < 600; i++) G.step(g, 1 / 60, rng); assert.ok(Math.abs(g.px - g.x0) < 0.02);
});
